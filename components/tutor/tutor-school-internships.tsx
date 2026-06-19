"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, ArrowRight, FileText, FileUp, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";

type Estagio = {
  id: string;
  titulo: string;
  alunoNome: string;
  alunoEmail: string;
  empresa: string;
  estado: string;
  professorId: string;
  professorNome: string;
};

type SchoolData = {
  name: string;
  shortName: string;
  bannerUrl: string;
  profileImageUrl: string;
  bannerFocusX: number;
  bannerFocusY: number;
};

export function TutorSchoolInternships({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<SchoolData>({
    name: "Escola",
    shortName: "",
    bannerUrl: "",
    profileImageUrl: "",
    bannerFocusX: 50,
    bannerFocusY: 50,
  });
  const [estagios, setEstagios] = useState<Estagio[]>([]);
  const [search, setSearch] = useState("");

  const schoolLabel = useMemo(() => school.shortName || school.name, [school]);

  const filteredEstagios = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return estagios;
    return estagios.filter(
      (e) =>
        e.professorNome.toLowerCase().includes(term) ||
        e.alunoNome.toLowerCase().includes(term) ||
        e.empresa.toLowerCase().includes(term) ||
        e.titulo.toLowerCase().includes(term)
    );
  }, [estagios, search]);

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setLoading(false);
          setEstagios([]);
          return;
        }

        try {
          const schoolSnap = await getDoc(doc(db, "schools", schoolId));
          if (schoolSnap.exists()) {
            const data = schoolSnap.data() as {
              name?: string;
              shortName?: string;
              bannerUrl?: string;
              profileImageUrl?: string;
              bannerFocusX?: number;
              bannerFocusY?: number;
            };
            setSchool({
              name: data.name || "Escola",
              shortName: data.shortName || "",
              bannerUrl: data.bannerUrl || "",
              profileImageUrl: data.profileImageUrl || "",
              bannerFocusX: typeof data.bannerFocusX === "number" ? data.bannerFocusX : 50,
              bannerFocusY: typeof data.bannerFocusY === "number" ? data.bannerFocusY : 50,
            });
          }
        } catch {
          // ignore
        }

        let list: Estagio[] = [];

        try {
          const byTutorId = await getDocs(
            query(
              collection(db, "estagios"),
              where("schoolId", "==", schoolId),
              where("tutorId", "==", user.uid)
            )
          );

          const map = new Map<string, Estagio>();
          const estagioDocs = [...byTutorId.docs];
          for (const docSnap of estagioDocs) {
            const data = docSnap.data() as {
              titulo?: string;
              alunoNome?: string;
              alunoEmail?: string;
              empresa?: string;
              estado?: string;
              professorId?: string;
              professorNome?: string;
            };
            map.set(docSnap.id, {
              id: docSnap.id,
              titulo: data.titulo || "Estágio",
              alunoNome: data.alunoNome || "Aluno",
              alunoEmail: data.alunoEmail || "",
              empresa: data.empresa || "—",
              estado: data.estado || "ativo",
              professorId: data.professorId || "",
              professorNome: data.professorNome || "—",
            });
          }

          list = Array.from(map.values()).sort((a, b) => a.alunoNome.localeCompare(b.alunoNome, "pt-PT"));
        } catch {
          list = [];
        }

        setEstagios(list);
        setLoading(false);
      });
    })();

    return () => unsubscribe();
  }, [schoolId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Estágios • {schoolLabel}</h1>
          <p className="text-muted-foreground">Acompanhe os alunos sob sua responsabilidade nesta escola.</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/tutor/estagios")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Trocar escola
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por professor, aluno, empresa ou título..."
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {school.bannerUrl ? (
          <div className="h-40 w-full bg-muted">
            <img
              src={school.bannerUrl}
              alt={`Banner de ${school.name}`}
              className="h-full w-full object-cover"
              style={{ objectPosition: `${school.bannerFocusX}% ${school.bannerFocusY}%` }}
            />
          </div>
        ) : null}
        <div className="p-4">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={school.profileImageUrl || undefined} alt={school.name} />
              <AvatarFallback>{schoolLabel.charAt(0)}</AvatarFallback>
            </Avatar>
            <p className="text-sm font-medium">{school.name}</p>
            <Badge variant="secondary">{estagios.length} estágio(s)</Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alunos encarregados</CardTitle>
          <CardDescription>
            Selecione um estágio para abrir as páginas internas de protocolo e relatório.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar estágios...</p>
          ) : filteredEstagios.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search.trim()
                ? "Nenhum estágio encontrado para esta pesquisa."
                : "Ainda não existem estágios atribuídos nesta escola."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredEstagios.map((estagio) => (
                <div key={estagio.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={undefined} alt={estagio.alunoNome} />
                          <AvatarFallback>{estagio.alunoNome.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <p className="text-sm font-medium">{estagio.alunoNome}</p>
                        <Badge variant={estagio.estado === "ativo" ? "default" : "secondary"}>{estagio.estado}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{estagio.alunoEmail || "Sem email"}</p>
                      <p className="text-sm text-foreground">{estagio.titulo}</p>
                      <p className="text-xs text-muted-foreground">Empresa: {estagio.empresa}</p>
                      <p className="text-xs text-muted-foreground">Orientador: {estagio.professorNome}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/tutor/estagios/${schoolId}/${estagio.id}/protocolo`)}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Protocolo
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/tutor/estagios/${schoolId}/${estagio.id}/relatorios`)}
                      >
                        <FileUp className="mr-2 h-4 w-4" />
                        Relatório
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => router.push(`/tutor/estagios/${schoolId}/${estagio.id}`)}
                      >
                        Abrir estágio
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
