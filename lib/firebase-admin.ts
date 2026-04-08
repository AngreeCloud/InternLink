import { getApps, initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

type ServiceAccountShape = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

function resolvePrivateKey(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/\\n/g, "\n");
}

function parseServiceAccountFromEnv(): {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
} {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as ServiceAccountShape;
    return {
      projectId: parsed.project_id ?? parsed.projectId,
      clientEmail: parsed.client_email ?? parsed.clientEmail,
      privateKey: resolvePrivateKey(parsed.private_key ?? parsed.privateKey),
    };
  } catch (error) {
    throw new Error(
      `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON invalido: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const fromJson = parseServiceAccountFromEnv();
  const projectId = fromJson.projectId ?? process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = fromJson.clientEmail ?? process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = fromJson.privateKey ?? resolvePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  const databaseURL = process.env.FIREBASE_ADMIN_DATABASE_URL;

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      ...(databaseURL ? { databaseURL } : {}),
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
    ...(databaseURL ? { databaseURL } : {}),
  });
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}
