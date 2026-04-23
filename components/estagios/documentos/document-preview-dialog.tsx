"use client"

import { useEffect, useState } from "react"
import { doc, getDoc } from "firebase/firestore"
import { ref as storageRef, getDownloadURL } from "firebase/storage"
import { getFirebaseDb, getFirebaseStorage } from "@/lib/firebase-runtime"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Download, CheckCircle2, Clock } from "lucide-react"
import { PdfViewer } from "../pdf/pdf-viewer"
import { SignatureBoxesOverlay, type SignatureBoxSpec } from "../pdf/signature-boxes-overlay"
import type { EstagioDocument } from "./document-list"
import type { EstagioRole } from "@/lib/estagios/permissions"

const ROLE_LABEL: Record<EstagioRole, string> = {
  aluno: "Aluno",
  professor: "Professor Orientador",
  tutor: "Tutor de Estágio",
  encarregado: "Encarregado de Educação",
  diretor_curso: "Diretor de Curso",
}

type Props = {
  estagioId: string
  doc: EstagioDocument
  open: boolean
  onOpenChange: (open: boolean) => void
  participants: Record<string, { name: string; role: EstagioRole }>
}

type Version = {
  id: string
  pdfPath: string
  boxes: SignatureBoxSpec[]
  createdAt?: number
  version: number
}

export function DocumentPreviewDialog({ estagioId, doc: docEntry, open, onOpenChange, participants }: Props) {
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState<string | null>(null)
  const [version, setVersion] = useState<Version | null>(null)

  useEffect(() => {
    if (!open || !docEntry.currentVersionId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const db = getFirebaseDb()
        const vref = doc(
          db,
          "estagios",
          estagioId,
          "documentos",
          docEntry.id,
          "versoes",
          docEntry.currentVersionId!,
        )
        const vsnap = await getDoc(vref)
        if (!vsnap.exists()) return
        const data = vsnap.data() as Record<string, unknown>
        const pdfPath = data.pdfPath as string
        const boxes = Array.isArray(data.boxes) ? (data.boxes as SignatureBoxSpec[]) : []
        const created = typeof data.createdAt === "number" ? (data.createdAt as number) : undefined
        const versionNumber = typeof data.version === "number" ? (data.version as number) : 1

        const storage = getFirebaseStorage()
        const dl = await getDownloadURL(storageRef(storage, pdfPath))

        if (cancelled) return
        setVersion({ id: vsnap.id, pdfPath, boxes, createdAt: created, version: versionNumber })
        setUrl(dl)
      } catch (err) {
        console.error("[v0] preview load error", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, estagioId, docEntry.id, docEntry.currentVersionId])

  const totalSigners = docEntry.signers.length || docEntry.rolesRequired.length
  const signedCount = docEntry.signedBy.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{docEntry.title}</DialogTitle>
          <DialogDescription>
            {totalSigners > 0
              ? `${signedCount} de ${totalSigners} assinaturas recolhidas`
              : "Documento sem assinaturas configuradas"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-96 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A carregar documento...
          </div>
        ) : url && version ? (
          <div className="grid gap-4 md:grid-cols-[1fr_280px]">
            <div className="max-h-[70vh] overflow-auto rounded-lg border bg-muted/20 p-3">
              <PdfViewer
                source={url}
                overlay={({ pageIndex, width, height }) => (
                  <SignatureBoxesOverlay
                    pageIndex={pageIndex}
                    width={width}
                    height={height}
                    boxes={version.boxes}
                    mode="preview"
                    signedByRole={(role) =>
                      docEntry.signers.some(
                        (uid) =>
                          docEntry.signedBy.includes(uid) && participants[uid]?.role === role,
                      )
                    }
                  />
                )}
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Assinatários</h4>
                <ul className="space-y-2 text-sm">
                  {docEntry.signers.map((uid) => {
                    const p = participants[uid]
                    const signed = docEntry.signedBy.includes(uid)
                    return (
                      <li
                        key={uid}
                        className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p?.name ?? uid}</p>
                          <p className="text-xs text-muted-foreground">
                            {p?.role ? ROLE_LABEL[p.role] : ""}
                          </p>
                        </div>
                        {signed ? (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-900">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Assinado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <Clock className="mr-1 h-3 w-3" />
                            Pendente
                          </Badge>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>

              <Button variant="outline" className="w-full" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer" download={`${docEntry.title}.pdf`}>
                  <Download className="mr-2 h-4 w-4" />
                  Descarregar PDF
                </a>
              </Button>

              <p className="text-xs text-muted-foreground">
                Versão {version.version}
                {version.createdAt
                  ? ` • ${new Date(version.createdAt).toLocaleString("pt-PT")}`
                  : ""}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Documento indisponível.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
