"use client"

import { useEffect, useState } from "react"
import { collection, onSnapshot, orderBy, query } from "firebase/firestore"
import { ref as storageRef, getDownloadURL } from "firebase/storage"
import { getFirebaseDb, getFirebaseStorage } from "@/lib/firebase-runtime"
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
    const db = getFirebaseDb()
    const q = query(
      collection(db, "estagios", estagioId, "documentos", documentId, "versoes"),
      orderBy("version", "desc"),
    )
    const unsub = onSnapshot(q, (snap) => {
      const list: VersionRow[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>
        return {
          id: d.id,
          version: typeof data.version === "number" ? (data.version as number) : 0,
          createdAt: typeof data.createdAt === "number" ? (data.createdAt as number) : undefined,
          pdfPath: (data.pdfPath as string) ?? "",
        }
      })
      setVersions(list)
      setLoading(false)
    })
    return () => unsub()
  }, [open, estagioId, documentId])

  const openVersion = async (v: VersionRow) => {
    try {
      const storage = getFirebaseStorage()
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
