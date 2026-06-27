/**
 * Script de diagnóstico — audita links de notificações na Firestore.
 *
 * Execução:
 *   npx tsx scripts/audit-notification-links.ts
 *
 * Outputs:
 *   scripts/notification-link-audit.json — dados completos
 *   scripts/notification-link-audit.txt — resumo legível
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { resolve, join } from "path";

// ── Firebase init ──────────────────────────────────────────
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Variáveis de ambiente Firebase Admin em falta.");
  console.error("Define NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const db = getFirestore();

// ── Route discovery ────────────────────────────────────────
function discoverRoutes(dirPath: string, prefix = ""): string[] {
  const routes: string[] = [];
  if (!existsSync(dirPath)) return routes;

  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      let segment = entry.name;
      // Skip private folders, api prefix
      if (segment.startsWith("_") || segment.startsWith("(")) continue;

      // Dynamic segments are valid routes
      routes.push(...discoverRoutes(fullPath, `${prefix}/${segment}`));
    } else if (entry.isFile()) {
      const ext = entry.name.split(".").pop();
      if (ext === "tsx" || ext === "ts" || ext === "js" || ext === "jsx") {
        const baseName = entry.name.replace(/\.(tsx?|jsx?)$/, "");
        if (baseName === "page" || baseName === "route" || baseName === "layout" || baseName === "loading") {
          routes.push(prefix || "/");
        }
      }
    }
  }

  return [...new Set(routes)];
}

// Discover routes from app/ directory
const appDir = resolve(process.cwd(), "app");
const discoveredRoutes = discoverRoutes(appDir);

// Manually add known valid routes that may not be in the filesystem
const KNOWN_VALID_ROUTES = new Set([
  ...discoveredRoutes,
  // Known dynamic routes
  "/professor/estagios/[id]",
  "/professor/estagios/[id]/protocolo",
  "/professor/estagios/[id]/relatorios",
  "/tutor/estagios/[schoolId]/[estagioId]",
  "/dashboard/estagio/[id]",
  "/school-admin/estagios/[id]",
  "/encarregado/estagio/[id]",
]);

// ── Link classification ────────────────────────────────────
type LinkResult = {
  userId: string;
  estagioId: string;
  notificationId: string;
  type: string;
  link: string;
  classification: "valido" | "invalido" | "suspeito" | "vazio";
  reason: string;
};

function classifyLink(rawLink: string | undefined | null, type: string, estagioId: string): LinkResult["classification"] {
  if (!rawLink) return "vazio";

  const link = rawLink.trim();
  if (!link) return "vazio";

  // Absolute URLs to the same domain are fine
  if (link.startsWith("http://") || link.startsWith("https://")) {
    if (link.includes("localhost") || link.includes("127.0.0.1")) return "suspeito";
    return "valido";
  }

  // Check if link matches any known route pattern
  // Replace dynamic segments with [id] for matching
  const normalizedLink = link.replace(/\/[a-zA-Z0-9_-]{15,}/g, "/[id]");

  for (const route of KNOWN_VALID_ROUTES) {
    // Convert route pattern to regex
    const pattern = route
      .replace(/\[(\w+)\]/g, "([^/]+)")
      .replace(/\//g, "\\/");
    const regex = new RegExp(`^${pattern}(\\?.*)?$`);
    if (regex.test(link) || regex.test(normalizedLink)) {
      return "valido";
    }
  }

  // Check if link has query params with tab=
  const baseLink = link.split("?")[0];
  if (baseLink) {
    for (const route of KNOWN_VALID_ROUTES) {
      const pattern = route
        .replace(/\[(\w+)\]/g, "([^/]+)")
        .replace(/\//g, "\\/");
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(baseLink)) {
        return "valido";
      }
    }
  }

  return "invalido";
}

// ── Main audit ─────────────────────────────────────────────
type AuditEntry = LinkResult;

async function auditNotifications(): Promise<AuditEntry[]> {
  console.log("A pesquisar notificações...");
  const results: AuditEntry[] = [];

  // Get all estagios
  const estagiosSnap = await db.collection("estagios").get();
  console.log(`Encontrados ${estagiosSnap.size} estágios.`);

  for (const estagioDoc of estagiosSnap.docs) {
    const notifsSnap = await db
      .collection("estagios")
      .doc(estagioDoc.id)
      .collection("notifications")
      .get();

    for (const notifDoc of notifsSnap.docs) {
      const data = notifDoc.data() as Record<string, unknown>;
      const type = (data.type as string) || "unknown";
      const link = (data.link || data.url || data.path || data.actionUrl || data.href) as string | undefined;
      const userId = (data.userId as string) || "unknown";
      const estagioId = estagioDoc.id;
      const classification = classifyLink(link, type, estagioId);

      results.push({
        userId,
        estagioId,
        notificationId: notifDoc.id,
        type,
        link: link || "",
        classification,
        reason: classification === "vazio"
          ? "Sem link definido"
          : classification === "invalido"
            ? `Link '${link}' não corresponde a nenhuma rota conhecida`
            : classification === "suspeito"
              ? `Link '${link}' aponta para localhost`
              : "OK",
      });
    }
  }

  return results;
}

// ── Generate reports ───────────────────────────────────────
async function main() {
  console.log("=== Auditoria de Links de Notificações ===\n");

  const results = await auditNotifications();

  // Classify
  const validos = results.filter((r) => r.classification === "valido");
  const invalidos = results.filter((r) => r.classification === "invalido");
  const suspeitos = results.filter((r) => r.classification === "suspeito");
  const vazios = results.filter((r) => r.classification === "vazio");

  // JSON report
  const jsonOutput = {
    summary: {
      total: results.length,
      validos: validos.length,
      invalidos: invalidos.length,
      suspeitos: suspeitos.length,
      vazios: vazios.length,
    },
    details: results,
  };

  const jsonPath = resolve(process.cwd(), "scripts", "notification-link-audit.json");
  writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`JSON guardado em: ${jsonPath}`);

  // Text report
  const lines: string[] = [];
  lines.push("=== RELATÓRIO DE AUDITORIA DE LINKS DE NOTIFICAÇÕES ===");
  lines.push(`Data: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("--- SUMÁRIO ---");
  lines.push(`Total de notificações: ${results.length}`);
  lines.push(`Válidas: ${validos.length}`);
  lines.push(`Inválidas: ${invalidos.length}`);
  lines.push(`Suspeitas: ${suspeitos.length}`);
  lines.push(`Sem link: ${vazios.length}`);
  lines.push("");

  if (invalidos.length > 0) {
    lines.push("--- LINKS INVÁLIDOS ---");
    for (const r of invalidos) {
      lines.push(`  userId: ${r.userId}`);
      lines.push(`  estagioId: ${r.estagioId}`);
      lines.push(`  notificationId: ${r.notificationId}`);
      lines.push(`  type: ${r.type}`);
      lines.push(`  link: ${r.link}`);
      lines.push(`  motivo: ${r.reason}`);
      lines.push("");
    }
  }

  if (suspeitos.length > 0) {
    lines.push("--- LINKS SUSPEITOS ---");
    for (const r of suspeitos) {
      lines.push(`  userId: ${r.userId} | link: ${r.link} | motivo: ${r.reason}`);
    }
    lines.push("");
  }

  if (vazios.length > 0) {
    lines.push("--- NOTIFICAÇÕES SEM LINK ---");
    const byType = new Map<string, number>();
    for (const r of vazios) {
      byType.set(r.type, (byType.get(r.type) || 0) + 1);
    }
    for (const [type, count] of byType) {
      lines.push(`  ${type}: ${count} notificações`);
    }
    lines.push("");
  }

  const txtPath = resolve(process.cwd(), "scripts", "notification-link-audit.txt");
  writeFileSync(txtPath, lines.join("\n"));
  console.log(`Relatório TXT guardado em: ${txtPath}`);

  console.log("\n=== Auditoria concluída ===");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erro na auditoria:", err);
    process.exit(1);
  });
