"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { CursoDatasAvaliacao } from "@/lib/avaliacao/types";

type CourseInfo = {
  id: string;
  name: string;
  datas?: CursoDatasAvaliacao;
};

type Props = {
  userId: string;
  schoolId: string;
};

export function AgendarPublicacaoNotas({ userId, schoolId }: Props) {
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [disponibilidade, setDisponibilidade] = useState("");
  const [publicacao, setPublicacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [autoArquivar, setAutoArquivar] = useState(false);
  const [loadedDatas, setLoadedDatas] = useState<
    Record<string, CursoDatasAvaliacao | undefined>
  >({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await getDbRuntime();
        const q = query(
          collection(db, "courses"),
          where("schoolId", "==", schoolId),
          where("courseDirectorId", "==", userId)
        );
        const snap = await getDocs(q);
        if (cancelled) return;

        const items: CourseInfo[] = [];
        for (const courseDoc of snap.docs) {
          const courseData = courseDoc.data() as { name?: string };
          items.push({
            id: courseDoc.id,
            name: courseData.name || courseDoc.id,
          });
        }
        if (!cancelled) setCourses(items);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, schoolId]);

  // Hide if not director of any course
  if (!loadingCourses && courses.length === 0) return null;

  const openDialog = async () => {
    setError(null);
    setSuccess(null);
    setDisponibilidade("");
    setPublicacao("");
    setSelectedCourseId("");
    setDialogOpen(true);
  };

  const handleCourseSelect = async (courseId: string) => {
    setSelectedCourseId(courseId);
    setError(null);
    setSuccess(null);

    if (loadedDatas[courseId] !== undefined) {
      const d = loadedDatas[courseId];
      setDisponibilidade(
        d?.datas?.disponibilidadePreenchimento
          ? toDateInput(d.datas.disponibilidadePreenchimento)
          : ""
      );
      setPublicacao(
        d?.datas?.publicacaoNotaFinal
          ? toDateInput(d.datas.publicacaoNotaFinal)
          : ""
      );
      return;
    }

    try {
      const db = await getDbRuntime();
      const snap = await getDoc(
        doc(db, "courses", courseId, "settings", "avaliacaoDatas")
      );
      const datas = snap.exists()
        ? (snap.data() as CursoDatasAvaliacao)
        : undefined;
      setLoadedDatas((prev) => ({ ...prev, [courseId]: datas }));
      setDisponibilidade(
        datas?.datas?.disponibilidadePreenchimento
          ? toDateInput(datas.datas.disponibilidadePreenchimento)
          : ""
      );
      setPublicacao(
        datas?.datas?.publicacaoNotaFinal
          ? toDateInput(datas.datas.publicacaoNotaFinal)
          : ""
      );
      setAutoArquivar(datas?.autoArquivarNaPublicacao === true);
    } catch {
      // ignore
    }
  };

  const handleSave = async () => {
    if (!selectedCourseId) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const body: Record<string, unknown> = {};
      if (disponibilidade) {
        body.disponibilidadePreenchimento =
          new Date(disponibilidade).toISOString();
      }
      if (publicacao) {
        body.publicacaoNotaFinal =
          new Date(publicacao).toISOString();
      }
      body.autoArquivarNaPublicacao = autoArquivar;

      const res = await fetch(
        `/api/courses/${selectedCourseId}/avaliacao-datas`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha ao guardar datas.");
        return;
      }

      const courseName =
        courses.find((c) => c.id === selectedCourseId)?.name ?? "";
      setSuccess(`Datas guardadas para "${courseName}".`);

      setLoadedDatas((prev) => ({
        ...prev,
        [selectedCourseId]: {
          cursoId: selectedCourseId,
          schoolId,
          datas: {
            disponibilidadePreenchimento: disponibilidade
              ? new Date(disponibilidade).toISOString()
              : prev[selectedCourseId]?.datas
                  ?.disponibilidadePreenchimento ?? "",
            publicacaoNotaFinal: publicacao
              ? new Date(publicacao).toISOString()
              : prev[selectedCourseId]?.datas?.publicacaoNotaFinal ??
                "",
          },
        },
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro inesperado."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={openDialog}
        disabled={loadingCourses}
      >
        <Calendar className="mr-2 h-4 w-4" />
        Agendar publicação das notas
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Agendar publicação das notas
            </DialogTitle>
            <DialogDescription>
              Escolha a turma e defina as datas de disponibilidade e
              publicação das avaliações.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Turma</Label>
              <Select
                value={selectedCourseId}
                onValueChange={handleCourseSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar turma..." />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCourseId && (
              <>
                <div className="space-y-2">
                  <Label>
                    Disponibilidade para preenchimento (tutor)
                  </Label>
                  <Input
                    type="date"
                    value={disponibilidade}
                    onChange={(e) =>
                      setDisponibilidade(e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    A partir desta data o tutor pode preencher e
                    assinar a avaliação.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>
                    Publicação da nota final (aluno)
                  </Label>
                  <Input
                    type="date"
                    value={publicacao}
                    onChange={(e) =>
                      setPublicacao(e.target.value)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    A partir desta data o aluno vê a nota final.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <Label className="cursor-pointer">
                      Arquivar automaticamente
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Na data de publicação, arquiva automaticamente os
                      estágios que cumpram todos os requisitos (data de
                      fim, relatório assinado, sumários e avaliação
                      concluídos).
                    </p>
                  </div>
                  <Switch
                    checked={autoArquivar}
                    onCheckedChange={setAutoArquivar}
                  />
                </div>
              </>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
            >
              Fechar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !selectedCourseId}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A guardar...
                </>
              ) : (
                "Guardar datas"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function toDateInput(iso: string): string {
  try {
    return new Date(iso).toISOString().split("T")[0] ?? "";
  } catch {
    return "";
  }
}
