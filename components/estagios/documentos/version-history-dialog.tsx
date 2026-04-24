"use client"

import { useEffect, useState } from "react"
import { collection, onSnapshot, orderBy, query } from "firebase/firestore"
import { ref as storageRef, getDownloadURL } from "firebase/storage"
import { getDbRuntime, getStorageRuntime } from "@/lib/firebase-runtime"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Download, FileText } from "lucide-react"

type Props = {
  estagioId: string
  documentId: string
  documentTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type VersionRow = {
  id: string
  version: number
  createdAt?: number
  pdfPath: string
  fileUrl?: string
  notes?: string
}

export function VersionHistoryDialog({
  estagioId,
  documentId,
  documentTitle,
  open,
  onOpenChange,
}: Props) {
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    let unsub: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      const db = await getDbRuntime()
      if (cancelled) return
      const q = query(
        collection(db, "estagios", estagioId, "documentos", documentId, "versoes"),
        orderBy("version", "desc"),
      )
      unsub = onSnapshot(q, (snap) => {
        const list: VersionRow[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>
          const uploadedAt =
            typeof data.uploadedAt === "object" && data.uploadedAt
              ? (data.uploadedAt as { toMillis?: () => number }).toMillis?.()
              : typeof data.createdAt === "object" && data.createdAt
                ? (data.createdAt as { toMillis?: () => number }).toMillis?.()
                : typeof data.createdAt === "number"
                  ? (data.createdAt as number)
                  : undefined
          const pdfPath =
            (data.filePath as string | undefined) ??
            (data.pdfPath as string | undefined) ??
            ""
          const fileUrl = (data.fileUrl as string | undefined) ?? ""
          return {
            id: d.id,
            version: typeof data.version === "number" ? (data.version as number) : 0,
            createdAt: uploadedAt,
            pdfPath,
            fileUrl,
            notes: typeof data.notes === "string" ? (data.notes as string) : "",
          }
        })
        setVersions(list)
        setLoading(false)
      })
    })()
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [open, estagioId, documentId])

  const openVersion = async (v: VersionRow) => {
    try {
      if (v.fileUrl) {
        window.open(v.fileUrl, "_blank", "noopener,noreferrer")
        return
      }
      if (!v.pdfPath) return
      const storage = await getStorageRuntime()
      const url = await getDownloadURL(storageRef(storage, v.pdfPath))
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (err) {
      console.error("[v0] open version failed", err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Histórico de versões</DialogTitle>
          <DialogDescription>{documentTitle}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A carregar versões...
          </div>
        ) : versions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ainda não existem versões.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Versão {v.version}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.createdAt
                        ? new Date(v.createdAt).toLocaleString("pt-PT")
                        : "—"}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openVersion(v)}>
                  <Download className="mr-2 h-4 w-4" />
                  Abrir
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
