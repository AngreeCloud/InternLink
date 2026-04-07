"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { AlertTriangle, Trash2 } from "lucide-react";

type Course = {
  id: string;
  name: string;
  courseDirectorId?: string | null;
  supportingTeacherIds?: string[];
  teacherIds?: string[];
};

type Professor = {
  id: string;
  name: string;
  email: string;
  photoURL: string;
  courses: string[]; // IDs de cursos em que está
};

export function ActiveProfessorsSection() {
  const { schoolId, userId } = useSchoolAdmin();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedProfessor, setSelectedProfessor] = useState<Professor | null>(null);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [roleInCourse, setRoleInCourse] = useState("other");
  const [askReplaceDirector, setAskReplaceDirector] = useState(false);

  const [showEditCourseRole, setShowEditCourseRole] = useState(false);
  const [editingProfessor, setEditingProfessor] = useState<Professor | null>(null);
  const [editingCourseId, setEditingCourseId] = useState("");
  const [editingNewRole, setEditingNewRole] = useState("other");

  const [showRemoveFromCourse, setShowRemoveFromCourse] = useState(false);
  const [removingProfessor, setRemovingProfessor] = useState<Professor | null>(null);
  const [removingCourseId, setRemovingCourseId] = useState("");

  const [systemRemovalProfessor, setSystemRemovalProfessor] = useState<Professor | null>(null);

  const selectedCourseData = useMemo(
    () => courses.find((c) => c.id === selectedCourse),
    [courses, selectedCourse]
  );

  const editingCourseData = useMemo(
    () => courses.find((c) => c.id === editingCourseId),
    [courses, editingCourseId]
  );

  const availableCoursesForProfessor = useMemo(
    () => (selectedProfessor ? courses.filter((c) => !selectedProfessor.courses.includes(c.id)) : []),
    [courses, selectedProfessor]
  );

  const canProfessorAddMoreCourses = (professor: Professor) =>
    courses.some((course) => !professor.courses.includes(course.id));

  const loadProfessorsAndCourses = useCallback(async () => {
    const db = await getDbRuntime();

    // Carregar professores ativos
    const usersSnap = await getDocs(
      query(
        collection(db, "users"),
        where("schoolId", "==", schoolId),
        where("role", "==", "professor"),
        where("estado", "==", "ativo")
      )
    );

    const professorsMap = new Map<string, Professor>();
    usersSnap.docs.forEach((doc) => {
      const data = doc.data() as {
        nome?: string;
        email?: string;
        photoURL?: string;
      };
      professorsMap.set(doc.id, {
        id: doc.id,
        name: data.nome || "—",
        email: data.email || "—",
        photoURL: data.photoURL || "",
        courses: [],
      });
    });

    // Carregar cursos e associar professores
    const coursesSnap = await getDocs(
      query(collection(db, "courses"), where("schoolId", "==", schoolId))
    );

    const coursesList: Course[] = [];
    coursesSnap.docs.forEach((doc) => {
      const data = doc.data() as {
        name?: string;
        courseDirectorId?: string | null;
        supportingTeacherIds?: string[];
        teacherIds?: string[];
      };

      const teacherIds = Array.isArray(data.teacherIds) ? data.teacherIds : [];
      coursesList.push({
        id: doc.id,
        name: data.name || "—",
        courseDirectorId: data.courseDirectorId || null,
        supportingTeacherIds: data.supportingTeacherIds || [],
        teacherIds,
      });

      // Associar cursos aos professores
      teacherIds.forEach((teacherId) => {
        if (professorsMap.has(teacherId)) {
          const prof = professorsMap.get(teacherId)!;
          prof.courses.push(doc.id);
        }
      });
    });

    const updatedProfessors = Array.from(professorsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-PT")
    );

    return { professors: updatedProfessors, courses: coursesList };
  }, [schoolId]);

  const refreshData = async () => {
    try {
      const { professors: updatedProfessors, courses: coursesList } = await loadProfessorsAndCourses();

      setProfessors(updatedProfessors);
      setCourses(coursesList);

      return { professors: updatedProfessors, courses: coursesList };
    } catch (error) {
      console.error("Erro ao atualizar dados:", error);
      return { professors: [], courses: [] };
    }
  };

  // Atualizar selectedProfessor quando professors muda
  useEffect(() => {
    if (selectedProfessor && professors.length > 0) {
      const updated = professors.find((p) => p.id === selectedProfessor.id);
      if (updated) {
        setSelectedProfessor(updated);
      }
    }
  }, [professors, selectedProfessor]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { professors: updatedProfessors, courses: coursesList } = await loadProfessorsAndCourses();

        if (!active) return;
        setProfessors(updatedProfessors);
        setCourses(coursesList);
        setLoading(false);
      } catch (error) {
        console.error("Erro ao carregar professores ativos:", error);
        if (active) {
          setLoading(false);
          setActionError("Não foi possível carregar professores.");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [loadProfessorsAndCourses]);

  const handleAssignToCourse = async () => {
    if (!selectedProfessor || !selectedCourse) {
      setActionError("Selecione professor e curso.");
      return;
    }

    const courseData = selectedCourseData;
    if (!courseData) return;

    // Se já é diretor, não precisa de confirmação
    if (courseData.courseDirectorId === selectedProfessor.id) {
      setActionError("Este professor já é diretor do curso.");
      setShowAssignDialog(false);
      return;
    }

    // Se vai ser diretor e já existe diretor, pedir confirmação
    if (roleInCourse === "director" && courseData.courseDirectorId) {
      setAskReplaceDirector(true);
      return;
    }

    await performAssignment();
  };

  const performAssignment = async () => {
    if (!selectedProfessor || !selectedCourse) return;

    setActionError("");
    setActionSuccess("");

    try {
      const db = await getDbRuntime();
      const courseRef = doc(db, "courses", selectedCourse);
      const courseData = selectedCourseData!;

      const updatedTeacherIds = Array.isArray(courseData.teacherIds) ? [...courseData.teacherIds] : [];
      if (!updatedTeacherIds.includes(selectedProfessor.id)) {
        updatedTeacherIds.push(selectedProfessor.id);
      }

      let updatedDirectorId = courseData.courseDirectorId;
      let updatedSupportingIds = Array.isArray(courseData.supportingTeacherIds)
        ? [...courseData.supportingTeacherIds]
        : [];

      if (roleInCourse === "director") {
        // Se há diretor anterior, move-o para outros professores
        if (updatedDirectorId && updatedDirectorId !== selectedProfessor.id) {
          if (!updatedSupportingIds.includes(updatedDirectorId)) {
            updatedSupportingIds.push(updatedDirectorId);
          }
        }
        updatedDirectorId = selectedProfessor.id;
        updatedSupportingIds = updatedSupportingIds.filter((id) => id !== selectedProfessor.id);
      } else {
        // Adicionar como outro professor
        updatedDirectorId = updatedDirectorId || null;
        if (!updatedSupportingIds.includes(selectedProfessor.id)) {
          updatedSupportingIds.push(selectedProfessor.id);
        }
      }

      await updateDoc(courseRef, {
        teacherIds: updatedTeacherIds,
        courseDirectorId: updatedDirectorId,
        supportingTeacherIds: updatedSupportingIds,
        updatedAt: serverTimestamp(),
      });

      setActionSuccess(`${selectedProfessor.name} adicionado a "${courseData.name}".`);
      setShowAssignDialog(false);
      setAskReplaceDirector(false);
      setSelectedProfessor(null);
      setSelectedCourse("");
      setRoleInCourse("other");

      // Atualizar dados
      await refreshData();
    } catch (error) {
      console.error("Erro ao atribuir professor a curso:", error);
      setActionError("Não foi possível atribuir professor. Tente novamente.");
    }
  };

  const handleEditCourseRole = async () => {
    if (!editingProfessor || !editingCourseId) return;

    const courseData = editingCourseData;
    if (!courseData) return;

    setActionError("");
    setActionSuccess("");

    try {
      const db = await getDbRuntime();

      let updatedSupportingIds = Array.isArray(courseData.supportingTeacherIds)
        ? [...courseData.supportingTeacherIds]
        : [];
      let updatedDirectorId = courseData.courseDirectorId;

      if (editingNewRole === "director") {
        // Movendo para diretor
        if (updatedDirectorId && updatedDirectorId !== editingProfessor.id) {
          if (!updatedSupportingIds.includes(updatedDirectorId)) {
            updatedSupportingIds.push(updatedDirectorId);
          }
        }
        updatedDirectorId = editingProfessor.id;
        updatedSupportingIds = updatedSupportingIds.filter((id) => id !== editingProfessor.id);
      } else {
        // Movendo para outro professor
        updatedSupportingIds = updatedSupportingIds.filter((id) => id !== editingProfessor.id);
        if (!updatedSupportingIds.includes(editingProfessor.id)) {
          updatedSupportingIds.push(editingProfessor.id);
        }
        if (updatedDirectorId === editingProfessor.id) {
          updatedDirectorId = null;
        }
      }

      await updateDoc(doc(db, "courses", editingCourseId), {
        courseDirectorId: updatedDirectorId,
        supportingTeacherIds: updatedSupportingIds,
        updatedAt: serverTimestamp(),
      });

      setActionSuccess("Cargo atualizado com sucesso.");
      setShowEditCourseRole(false);
      setEditingProfessor(null);
      setEditingCourseId("");
      await refreshData();
    } catch (error) {
      console.error("Erro ao editar cargo:", error);
      setActionError("Não foi possível editar cargo. Tente novamente.");
    }
  };

  const handleRemoveFromCourse = async () => {
    if (!removingProfessor || !removingCourseId) return;

    const courseData = courses.find((c) => c.id === removingCourseId);
    if (!courseData) return;

    setActionError("");
    setActionSuccess("");

    try {
      const db = await getDbRuntime();

      const updatedTeacherIds = (courseData.teacherIds || []).filter((id) => id !== removingProfessor.id);
      const updatedSupportingIds = (courseData.supportingTeacherIds || []).filter(
        (id) => id !== removingProfessor.id
      );
      const updatedDirectorId =
        courseData.courseDirectorId === removingProfessor.id ? null : courseData.courseDirectorId;

      await updateDoc(doc(db, "courses", removingCourseId), {
        teacherIds: updatedTeacherIds,
        courseDirectorId: updatedDirectorId,
        supportingTeacherIds: updatedSupportingIds,
        updatedAt: serverTimestamp(),
      });

      setActionSuccess(`${removingProfessor.name} removido de "${courseData.name}".`);
      setShowRemoveFromCourse(false);
      setRemovingProfessor(null);
      setRemovingCourseId("");
      await refreshData();
    } catch (error) {
      console.error("Erro ao remover professor de curso:", error);
      setActionError("Não foi possível remover professor. Tente novamente.");
    }
  };

  const handleRemoveFromSystem = async () => {
    if (!systemRemovalProfessor) return;

    setActionError("");
    setActionSuccess("");

    try {
      const db = await getDbRuntime();

      // Remover de todos os cursos
      const affectedCourses = courses.filter((c) =>
        (c.teacherIds || []).includes(systemRemovalProfessor.id)
      );

      for (const courseData of affectedCourses) {
        const updatedTeacherIds = (courseData.teacherIds || []).filter((id) => id !== systemRemovalProfessor.id);
        const updatedSupportingIds = (courseData.supportingTeacherIds || []).filter(
          (id) => id !== systemRemovalProfessor.id
        );
        const updatedDirectorId =
          courseData.courseDirectorId === systemRemovalProfessor.id ? null : courseData.courseDirectorId;

        await updateDoc(doc(db, "courses", courseData.id), {
          teacherIds: updatedTeacherIds,
          courseDirectorId: updatedDirectorId,
          supportingTeacherIds: updatedSupportingIds,
          updatedAt: serverTimestamp(),
        });
      }

      // Atualizar utilizador para removido
      await updateDoc(doc(db, "users", systemRemovalProfessor.id), {
        estado: "removido",
        schoolId: null,
        courseId: null,
        reviewedAt: serverTimestamp(),
        reviewedBy: userId,
      });

      setActionSuccess(`${systemRemovalProfessor.name} removido do sistema da escola.`);
      setSystemRemovalProfessor(null);
      await refreshData();
    } catch (error) {
      console.error("Erro ao remover professor do sistema:", error);
      setActionError("Não foi possível remover professor. Tente novamente.");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Professores no sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">A carregar...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Professores no sistema</CardTitle>
          <CardDescription>Gerir atribuição de professores a cursos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {actionError && (
            <Alert variant="destructive">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}
          {actionSuccess && (
            <Alert>
              <AlertDescription>{actionSuccess}</AlertDescription>
            </Alert>
          )}

          {professors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem professores ativos na escola.</p>
          ) : (
            <div className="space-y-3">
              {professors.map((professor) => (
                <div
                  key={professor.id}
                  className="rounded-lg border border-border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={professor.photoURL} alt={professor.name} />
                        <AvatarFallback>{professor.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{professor.name}</p>
                        <p className="text-xs text-muted-foreground">{professor.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedProfessor(professor);
                          setSelectedCourse("");
                          setRoleInCourse("other");
                          setShowAssignDialog(true);
                        }}
                        disabled={!canProfessorAddMoreCourses(professor)}
                        title={
                          !canProfessorAddMoreCourses(professor)
                            ? "Este professor já está em todos os cursos"
                            : ""
                        }
                      >
                        Adicionar a curso
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSystemRemovalProfessor(professor)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover do sistema
                      </Button>
                    </div>
                  </div>

                  {professor.courses.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground">Cursos:</p>
                      <div className="space-y-2">
                        {professor.courses
                          .map((courseId) => courses.find((c) => c.id === courseId))
                          .filter(Boolean)
                          .map((course) => {
                            if (!course) return null;
                            const isDirector = course.courseDirectorId === professor.id;
                            return (
                              <div
                                key={course.id}
                                className="flex items-center justify-between rounded bg-muted/50 px-3 py-2 text-sm"
                              >
                                <div className="flex-1">
                                  <span className="font-medium">{course.name}</span>
                                  {isDirector && (
                                    <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                                      Diretor
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-xs"
                                    onClick={() => {
                                      setEditingProfessor(professor);
                                      setEditingCourseId(course.id);
                                      setEditingNewRole(isDirector ? "director" : "other");
                                      setShowEditCourseRole(true);
                                    }}
                                  >
                                    Editar cargo
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8 px-2 text-xs"
                                    onClick={() => {
                                      setRemovingProfessor(professor);
                                      setRemovingCourseId(course.id);
                                      setShowRemoveFromCourse(true);
                                    }}
                                  >
                                    Remover
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo: Adicionar a curso */}
      <Dialog
        open={showAssignDialog}
        onOpenChange={(open) => {
          setShowAssignDialog(open);
          if (!open) {
            setSelectedCourse("");
            setRoleInCourse("other");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar {selectedProfessor?.name} a um curso</DialogTitle>
            <DialogDescription>Escolha o curso e a função do professor.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Curso</label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um curso" />
                </SelectTrigger>
                <SelectContent>
                  {availableCoursesForProfessor.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCourseData && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Função do professor</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="role"
                      value="director"
                      checked={roleInCourse === "director"}
                      onChange={(e) => setRoleInCourse(e.target.value)}
                    />
                    Diretor do Curso
                    {selectedCourseData.courseDirectorId &&
                      selectedCourseData.courseDirectorId !== selectedProfessor?.id && (
                        <span className="text-xs text-amber-600">(irá substituir atual)</span>
                      )}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="role"
                      value="other"
                      checked={roleInCourse === "other"}
                      onChange={(e) => setRoleInCourse(e.target.value)}
                    />
                    Outro Professor
                  </label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAssignToCourse}>Atribuir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Confirmar substituição de diretor */}
      <Dialog open={askReplaceDirector} onOpenChange={setAskReplaceDirector}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Substituir diretor do curso?</DialogTitle>
            <DialogDescription>
              Já existe um diretor neste curso. Deseja substituí-lo por {selectedProfessor?.name}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAskReplaceDirector(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setAskReplaceDirector(false);
                performAssignment();
              }}
            >
              Substituir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Editar cargo em um curso */}
      <Dialog open={showEditCourseRole} onOpenChange={setShowEditCourseRole}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cargo de {editingProfessor?.name}</DialogTitle>
            <DialogDescription>Em: {editingCourseData?.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nova função</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="edit-role"
                  value="director"
                  checked={editingNewRole === "director"}
                  onChange={(e) => setEditingNewRole(e.target.value)}
                />
                Diretor do Curso
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="edit-role"
                  value="other"
                  checked={editingNewRole === "other"}
                  onChange={(e) => setEditingNewRole(e.target.value)}
                />
                Outro Professor
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCourseRole(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditCourseRole}>Atualizar cargo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Confirmação remover de curso */}
      <Dialog open={showRemoveFromCourse} onOpenChange={setShowRemoveFromCourse}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover de curso</DialogTitle>
            <DialogDescription>
              Remover {removingProfessor?.name} de "{courses.find((c) => c.id === removingCourseId)?.name}"?
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O professor será removido deste curso mas permanecerá no sistema.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveFromCourse(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRemoveFromCourse}>
              Remover de curso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Remover do sistema (aviso sério) */}
      <Dialog open={!!systemRemovalProfessor} onOpenChange={() => setSystemRemovalProfessor(null)}>
        <DialogContent className="border-destructive">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <DialogTitle className="text-destructive">Remover do sistema da escola</DialogTitle>
            </div>
            <DialogDescription className="text-foreground font-medium">
              Isto é uma ação permanente e não pode ser desfeita imediatamente.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{systemRemovalProfessor?.name}</strong> será:
              <ul className="mt-2 ml-4 space-y-1 list-disc text-sm">
                <li>Removido de todos os cursos</li>
                <li>Marcado como removido no sistema</li>
                <li>Será necessário re-solicitar acesso à escola</li>
                <li>O perfil e conta serão preservados</li>
              </ul>
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSystemRemovalProfessor(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveFromSystem}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Remover do sistema
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
