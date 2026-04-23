"use client"

import { useEffect, useMemo, useState } from "react"
import { collection, onSnapshot, orderBy, query, doc, updateDoc } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase-runtime"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  FileText,
  Search,
  MoreHorizontal,
  Pin,
  PinOff,
  Eye,
  PenLine,
  History,
  Upload,
  Loader2,
} from "lucide-react"
import { UploadWizard } from "./upload-wizard"
import { DocumentPreviewDialog } from "./document-preview-dialog"
import { SignDialog } from "./sign-dialog"
import { VersionHistoryDialog } from "./version-history-dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { EstagioRole } from "@/lib/estagios/permissions"

export type DocumentStatus = "rascunho" | "a_assinar" | "parcial" | "assinado"

export type EstagioDocument = {
  id: string
  title: string
  templateKey: string | null
  status: DocumentStatus
  pinned?: boolean
  currentVersionId: string | null
  currentPdfPath: string | null
  signers: string[]
  signedBy: string[]
  rolesRequired: EstagioRole[]
  createdAt?: number
  updatedAt?: number
}

type Props = {
  estagioId: string
  currentUserId: string
  currentUserRole: EstagioRole
  canManage: boolean
  participants: Record<string, { name: string; role: EstagioRole }>
}

const STATUS_LABEL: Record<DocumentStatus, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  a_assinar: { label: "A aguardar assinaturas", className: "bg-amber-100 text-amber-900" },
  parcial: { label: "Parcialmente assinado", className: "bg-blue-100 text-blue-900" },
  assinado: { label: "Assinado", className: "bg-emerald-100 text-emerald-900" },
}

export function DocumentList({
  estagioId,
  currentUserId,
  currentUserRole,
  canManage,
  participants,
}: Props) {
  const [docs, setDocs] = useState<EstagioDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"all" | "pending" | "signed">("all")

  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<EstagioDocument | null>(null)
  const [signDoc, setSignDoc] = useState<EstagioDocument | null>(null)
  const [historyDoc, setHistoryDoc] = useState<EstagioDocument | null>(null)

  useEffect(() => {
    const db = getFirebaseDb()
    const q = query(
      collection(db, "estagios", estagioId, "documentos"),
      orderBy("createdAt", "desc"),
    )
    const unsub = onSnapshot(q, (snap) => {
      const list: EstagioDocument[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>
        return {
          id: d.id,
          title: (data.title as string) || "Documento sem título",
          templateKey: (data.templateKey as string | null) ?? null,
          status: (data.status as DocumentStatus) || "rascunho",
          pinned: Boolean(data.pinned),
          currentVersionId: (data.currentVersionId as string | null) ?? null,
          currentPdfPath: (data.currentPdfPath as string | null) ?? null,
          signers: Array.isArray(data.signers) ? (data.signers as string[]) : [],
          signedBy: Array.isArray(data.signedBy) ? (data.signedBy as string[]) : [],
          rolesRequired: Array.isArray(data.rolesRequired)
            ? (data.rolesRequired as EstagioRole[])
            : [],
          createdAt: typeof data.createdAt === "number" ? (data.createdAt as number) : undefined,
          updatedAt: typeof data.updatedAt === "number" ? (data.updatedAt as number) : undefined,
        }
      })
      setDocs(list)
      setLoading(false)
    })
    return () => unsub()
  }, [estagioId])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    let list = docs
    if (tab === "pending") list = list.filter((d) => d.status !== "assinado")
    if (tab === "signed") list = list.filter((d) => d.status === "assinado")
    if (s) list = list.filter((d) => d.title.toLowerCase().includes(s))
    // pinned first, then by updatedAt desc
    return [...list].sort((a, b) => {
      if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
    })
  }, [docs, search, tab])

  const togglePin = async (d: EstagioDocument) => {
    if (!canManage) return
    try {
      const db = getFirebaseDb()
      await updateDoc(doc(db, "estagios", estagioId, "documentos", d.id), {
        pinned: !d.pinned,
        updatedAt: Date.now(),
      })
    } catch (err) {
      console.error("[v0] toggle pin failed", err)
      toast.error("Não foi possível fixar o documento.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar documento..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="pending">Por assinar</TabsTrigger>
              <TabsTrigger value="signed">Assinados</TabsTrigger>
            </TabsList>
          </Tabs>
          {canManage && (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Novo documento
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-lg border bg-card py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A carregar documentos...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 border-dashed py-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Ainda não há documentos para este estágio.
          </p>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Carregar primeiro documento
            </Button>
          )}
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Progresso</th>
                <th className="px-4 py-3 font-medium">Atualizado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((d) => {
                const mustSign = d.signers.includes(currentUserId) && !d.signedBy.includes(currentUserId)
                const signedCount = d.signedBy.length
                const totalSigners = d.signers.length || d.rolesRequired.length || 0
                return (
                  <tr key={d.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        {d.pinned ? (
                          <Pin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0">
                          <button
                            className="truncate text-left font-medium hover:underline"
                            onClick={() => setPreviewDoc(d)}
                          >
                            {d.title}
                          </button>
                          {d.templateKey && (
                            <p className="truncate text-xs text-muted-foreground">
                              Template: {d.templateKey}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn("font-normal", STATUS_LABEL[d.status].className)}>
                        {STATUS_LABEL[d.status].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {totalSigners > 0 ? `${signedCount}/${totalSigners} assinaturas` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.updatedAt ? new Date(d.updatedAt).toLocaleDateString("pt-PT") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {mustSign && (
                          <Button size="sm" onClick={() => setSignDoc(d)}>
                            <PenLine className="mr-1.5 h-3.5 w-3.5" />
                            Assinar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setPreviewDoc(d)}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">Pré-visualizar</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Mais ações</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setHistoryDoc(d)}>
                              <History className="mr-2 h-4 w-4" />
                              Histórico de versões
                            </DropdownMenuItem>
                            {canManage && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => togglePin(d)}>
                                  {d.pinned ? (
                                    <>
                                      <PinOff className="mr-2 h-4 w-4" />
                                      Desafixar
                                    </>
                                  ) : (
                                    <>
                                      <Pin className="mr-2 h-4 w-4" />
                                      Fixar no topo
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {uploadOpen && (
        <UploadWizard
          estagioId={estagioId}
          participants={participants}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
        />
      )}
      {previewDoc && (
        <DocumentPreviewDialog
          estagioId={estagioId}
          doc={previewDoc}
          open={!!previewDoc}
          onOpenChange={(o) => !o && setPreviewDoc(null)}
          participants={participants}
        />
      )}
      {signDoc && (
        <SignDialog
          estagioId={estagioId}
          doc={signDoc}
          open={!!signDoc}
          onOpenChange={(o) => !o && setSignDoc(null)}
        />
      )}
      {historyDoc && (
        <VersionHistoryDialog
          estagioId={estagioId}
          documentId={historyDoc.id}
          documentTitle={historyDoc.title}
          open={!!historyDoc}
          onOpenChange={(o) => !o && setHistoryDoc(null)}
        />
      )}
    </div>
  )
}
