"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { doc, getDoc, onSnapshot } from "firebase/firestore"
import { getFirebaseDb } from "@/lib/firebase-runtime"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  CheckSquare,
  NotebookPen,
  Star,
  Loader2,
} from "lucide-react"
import { OverviewTab } from "./overview-tab"
import { DocumentList } from "./documentos/document-list"
import { ComingSoonTab } from "./coming-soon-tab"
import type { EstagioRole, EstagioRecord } from "@/lib/estagios/permissions"
import { resolveEstagioPermissions } from "@/lib/estagios/permissions"

type Props = {
  estagioId: string
  currentUserId: string
  currentUserRole: EstagioRole
  backHref?: string
  backLabel?: string
}

type Participant = { name: string; role: EstagioRole; email?: string }

export function EstagioDetailView({
  estagioId,
  currentUserId,
  currentUserRole,
  backHref,
  backLabel = "Voltar",
}: Props) {
  const [estagio, setEstagio] = useState<(EstagioRecord & Record<string, unknown>) | null>(null)
  const [participants, setParticipants] = useState<Record<string, Participant>>({})
  const [courseDirectorId, setCourseDirectorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Subscribe to estagio doc
  useEffect(() => {
    const db = getFirebaseDb()
    const unsub = onSnapshot(
      doc(db, "estagios", estagioId),
      (snap) => {
        if (!snap.exists()) {
          setNotFound(true)
          setLoading(false)
          return
        }
        setEstagio({ id: snap.id, ...(snap.data() as Record<string, unknown>) } as EstagioRecord & Record<string, unknown>)
        setLoading(false)
      },
      (err) => {
        console.error("[v0] estagio snapshot error", err)
        setNotFound(true)
        setLoading(false)
      },
    )
    return () => unsub()
  }, [estagioId])

  // Load participants + course director once we have the estagio
  useEffect(() => {
    if (!estagio) return
    let cancelled = false
    ;(async () => {
      const db = getFirebaseDb()
      const ids = [estagio.alunoId, estagio.professorId, estagio.tutorId].filter(
        (x): x is string => !!x,
      )
      const entries: [string, Participant][] = []
      await Promise.all(
        ids.map(async (uid) => {
          try {
            const u = await getDoc(doc(db, "users", uid))
            if (u.exists()) {
              const data = u.data() as Record<string, unknown>
              entries.push([
                uid,
                {
                  name: (data.name as string) || (data.displayName as string) || uid,
                  role: (data.role as EstagioRole) || "aluno",
                  email: typeof data.email === "string" ? (data.email as string) : undefined,
                },
              ])
            }
          } catch (err) {
            console.error("[v0] load participant failed", uid, err)
          }
        }),
      )
      if (cancelled) return
      setParticipants(Object.fromEntries(entries))

      // Load course director if we have a courseId
      const rawCourseId =
        (estagio as Record<string, unknown>).alunoCourseId ??
        (estagio as Record<string, unknown>).courseId
      if (typeof rawCourseId === "string" && rawCourseId.length > 0) {
        try {
          const c = await getDoc(doc(db, "courses", rawCourseId))
          if (c.exists() && !cancelled) {
            const cd = (c.data() as Record<string, unknown>).courseDirectorId
            setCourseDirectorId(typeof cd === "string" ? cd : null)
          }
        } catch (err) {
          console.error("[v0] load course director failed", err)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [estagio])

  const permissions = useMemo(() => {
    if (!estagio) return null
    return resolveEstagioPermissions({
      currentUserId,
      currentUserRole,
      estagio: estagio as EstagioRecord,
      courseDirectorId,
    })
  }, [estagio, currentUserId, currentUserRole, courseDirectorId])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> A carregar estágio...
      </div>
    )
  }

  if (notFound || !estagio) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">Estágio não encontrado ou sem permissões.</p>
        {backHref && (
          <Button asChild variant="outline">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        )}
      </div>
    )
  }

  if (!permissions?.canView) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">Não tens permissão para ver este estágio.</p>
        {backHref && (
          <Button asChild variant="outline">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        )}
      </div>
    )
  }

  const raw = estagio as Record<string, unknown>
  const overviewData = {
    id: estagio.id,
    title: (raw.title as string | undefined) ?? (raw.titulo as string | undefined),
    alunoId: estagio.alunoId,
    professorId: estagio.professorId,
    tutorId: estagio.tutorId,
    schoolId: estagio.schoolId,
    schoolName: raw.schoolName as string | undefined,
    companyName: (raw.companyName as string | undefined) ?? (raw.empresa as string | undefined),
    courseName: raw.courseName as string | undefined,
    dataInicio: raw.dataInicio as string | undefined,
    dataFim: raw.dataFim as string | undefined,
    horasPorDia: raw.horasPorDia as number | undefined,
    diasSemana: raw.diasSemana as number[] | undefined,
    totalHoras: raw.totalHoras as number | undefined,
    totalDias: raw.totalDias as number | undefined,
    status: (raw.status as string | undefined) ?? (raw.estado as string | undefined),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        {backHref ? (
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backLabel}
            </Link>
          </Button>
        ) : (
          <div />
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="overview">
            <ClipboardList className="mr-2 h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="mr-2 h-4 w-4" />
            Documentos
          </TabsTrigger>
          <TabsTrigger value="presencas">
            <CheckSquare className="mr-2 h-4 w-4" />
            Presenças
          </TabsTrigger>
          <TabsTrigger value="sumarios">
            <NotebookPen className="mr-2 h-4 w-4" />
            Sumários
          </TabsTrigger>
          <TabsTrigger value="avaliacao">
            <Star className="mr-2 h-4 w-4" />
            Avaliação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab estagio={overviewData} participants={participants} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentList
            estagioId={estagio.id}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            canManage={permissions.isCourseDirector}
            participants={participants}
          />
        </TabsContent>

        <TabsContent value="presencas">
          <ComingSoonTab
            title="Registo de presenças"
            description="Em breve poderás registar aqui as presenças diárias do aluno, com validação pelo tutor de estágio e visibilidade pelo Diretor de Curso."
            icon={CheckSquare}
          />
        </TabsContent>

        <TabsContent value="sumarios">
          <ComingSoonTab
            title="Sumários semanais"
            description="Espaço para o aluno descrever as atividades realizadas semanalmente, com validação pelo tutor e revisão pelo Diretor de Curso."
            icon={NotebookPen}
          />
        </TabsContent>

        <TabsContent value="avaliacao">
          <ComingSoonTab
            title="Avaliação final"
            description="Ficha de avaliação a preencher pelo tutor e pelo professor orientador no final do estágio, com cálculo automático da classificação FCT."
            icon={Star}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
