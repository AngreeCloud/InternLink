"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, ImageIcon } from "lucide-react";

type Foto = {
  id: string;
  url: string;
  legenda?: string;
  uploadedBy: string;
  uploadedAt: number;
};

type Props = {
  empresaId: string;
};

export function EmpresaPhotos({ empresaId }: Props) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchFotos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/empresas/${empresaId}`);
      if (!res.ok) throw new Error("Erro ao carregar fotos");
      const data = await res.json();
      setFotos((data.empresa?.fotos as Foto[]) ?? []);
    } catch {
      setFotos([]);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchFotos();
  }, [fetchFotos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { getStorageRuntime } = await import("@/lib/firebase-runtime");
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const storage = await getStorageRuntime();
      const photoId = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `empresa-photos/${empresaId}/${photoId}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const res = await fetch(`/api/empresas/${empresaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fotos: [
            ...fotos.map((f) => ({ id: f.id, url: f.url, legenda: f.legenda, uploadedBy: f.uploadedBy, uploadedAt: f.uploadedAt })),
            { id: photoId, url, uploadedBy: "current", uploadedAt: Date.now() },
          ],
        }),
      });
      if (!res.ok) throw new Error("Erro ao guardar foto");
      await fetchFotos();
    } catch {
      // silent
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (foto: Foto) => {
    setDeleting(foto.id);
    try {
      const { getStorageRuntime } = await import("@/lib/firebase-runtime");
      const { ref, deleteObject } = await import("firebase/storage");
      const storage = await getStorageRuntime();
      const storageRef = ref(storage, `empresa-photos/${empresaId}/${foto.id}`);
      await deleteObject(storageRef).catch(() => {});
      const updated = fotos.filter((f) => f.id !== foto.id);
      const res = await fetch(`/api/empresas/${empresaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fotos: updated.map((f) => ({ id: f.id, url: f.url, legenda: f.legenda, uploadedBy: f.uploadedBy, uploadedAt: f.uploadedAt })),
        }),
      });
      if (!res.ok) throw new Error("Erro ao remover foto");
      setFotos(updated);
    } catch {
      // silent
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Galeria de Fotos</h2>
        <label className="cursor-pointer">
          <Button size="sm" disabled={uploading} asChild>
            <span>
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploading ? "A enviar..." : "Adicionar Foto"}
            </span>
          </Button>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {fotos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma foto na galeria.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {fotos.map((foto) => (
            <div key={foto.id} className="relative group rounded-lg border border-border overflow-hidden">
              <img
                src={foto.url}
                alt={foto.legenda || ""}
                className="h-40 w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(foto)}
                  disabled={deleting === foto.id}
                >
                  {deleting === foto.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
