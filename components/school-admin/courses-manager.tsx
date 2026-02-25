"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal } from "lucide-react";

type Folder = {
  id: string;
  name: string;
};

type Course = {
  id: string;
  name: string;
  year?: number | null;
  maxStudents?: number | null;
  folderId?: string | null;
  enrolledCount?: number | null;
  teacherIds?: string[];
  internshipDurationMonths?: number | null;
  internshipStartDate?: string | null;
  internshipEndDate?: string | null;
  reportMinHours?: number | null;
  reportWaitDays?: number | null;
  createdAt?: Date | null;
};

type Teacher = {
  id: string;
  name: string;
  email: string;
};

type SchoolInfo = {
  educationLevel?: string;
};

const NO_FOLDER_VALUE = "__no_folder__";
const ALL_FOLDERS_VALUE = "__all_folders__";
const CREATE_FOLDER_VALUE = "__create_folder__";

const padDatePart = (value: number) => String(value).padStart(2, "0");

const formatDateLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  return `${year}-${month}-${day}`;
};

const parseDateLocal = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addMonths = (value: Date, months: number) => {
  const result = new Date(value);
  result.setMonth(result.getMonth() + months);
  return result;
};

const diffMonths = (start: Date, end: Date) => {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) {
    months -= 1;
  }
  return Math.max(0, months);
};

export function CoursesManager() {
  const { schoolId } = useSchoolAdmin();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState("");
  const [newCourse, setNewCourse] = useState({
    name: "",
    year: "",
    maxStudents: "",
    folderId: "",
    teacherIds: [] as string[],
    internshipDurationMonths: "",
    internshipStartDate: "",
    internshipEndDate: "",
    reportMinHours: "80",
    reportWaitDays: "0",
  });
  const [editCourseId, setEditCourseId] = useState<string | null>(null);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({});
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filterFolderId, setFilterFolderId] = useState<string>(ALL_FOLDERS_VALUE);
  const [sortBy, setSortBy] = useState<string>("recent");
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [showCreateFolderWizard, setShowCreateFolderWizard] = useState(false);

  const requiresYear = useMemo(
    () => schoolInfo.educationLevel === "Secundária/Profissional",
    [schoolInfo.educationLevel]
  );

  useEffect(() => {
    let active = true;

    const loadInfo = async () => {
      try {
        const db = await getDbRuntime();
        const snap = await getDoc(doc(db, "schools", schoolId));
        if (!active) return;
        if (snap.exists()) {
          setSchoolInfo(snap.data() as SchoolInfo);
        }
      } catch (error) {
        console.error("[CoursesManager] Erro ao carregar escola", error);
      }
    };

    loadInfo();

    return () => {
      active = false;
    };
  }, [schoolId]);

  useEffect(() => {
    let active = true;

    const loadFolders = async () => {
      try {
        const db = await getDbRuntime();
        const foldersRef = collection(db, "schools", schoolId, "folders");
        const snapshot = await getDocs(query(foldersRef, orderBy("name", "asc")));
        if (!active) return;
        const data = snapshot.docs.map((docSnap) => {
          const payload = docSnap.data() as { name?: string };
          return { id: docSnap.id, name: payload.name || "—" };
        });
        setFolders(data);
      } catch (error) {
        console.error("[CoursesManager] Erro ao carregar pastas", error);
      }
    };

    const loadCourses = async () => {
      setLoading(true);
      try {
        const db = await getDbRuntime();
        const coursesRef = collection(db, "courses");
        const snapshot = await getDocs(
          query(coursesRef, where("schoolId", "==", schoolId), orderBy("createdAt", "desc"))
        );
        if (!active) return;
        setCourses(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as {
              name?: string;
              year?: number;
              maxStudents?: number;
              folderId?: string | null;
              enrolledCount?: number;
              teacherIds?: string[];
              internshipDurationMonths?: number;
              internshipStartDate?: string | null;
              internshipEndDate?: string | null;
              reportMinHours?: number;
              reportWaitDays?: number;
              createdAt?: { toDate?: () => Date };
            };
            return {
              id: docSnap.id,
              name: data.name || "—",
              year: data.year ?? null,
              maxStudents: data.maxStudents ?? null,
              folderId: data.folderId ?? null,
              enrolledCount: data.enrolledCount ?? 0,
              teacherIds: Array.isArray(data.teacherIds) ? data.teacherIds : [],
              internshipDurationMonths: data.internshipDurationMonths ?? null,
              internshipStartDate: data.internshipStartDate ?? null,
              internshipEndDate: data.internshipEndDate ?? null,
              reportMinHours: data.reportMinHours ?? 80,
              reportWaitDays: data.reportWaitDays ?? 0,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
            };
          })
        );
      } catch (error) {
        console.error("[CoursesManager] Erro ao carregar cursos", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const loadTeachers = async () => {
      try {
        const db = await getDbRuntime();
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(
          query(usersRef, where("schoolId", "==", schoolId), where("role", "==", "professor"))
        );
        if (!active) return;
        setTeachers(
          snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as { nome?: string; email?: string };
            return {
              id: docSnap.id,
              name: data.nome || "—",
              email: data.email || "—",
            };
          })
        );
      } catch (error) {
        console.error("[CoursesManager] Erro ao carregar professores", error);
      }
    };

    loadFolders();
    loadCourses();
    loadTeachers();

    return () => {
      active = false;
    };
  }, [schoolId]);

  const folderOptions = useMemo(
    () => [{ id: NO_FOLDER_VALUE, name: "Sem pasta" }, ...folders],
    [folders]
  );

  const filterOptions = useMemo(
    () => [{ id: ALL_FOLDERS_VALUE, name: "Mostrar tudo" }, ...folderOptions],
    [folderOptions]
  );

  const refreshCourses = async () => {
    const db = await getDbRuntime();
    const coursesRef = collection(db, "courses");
    const snapshot = await getDocs(
      query(coursesRef, where("schoolId", "==", schoolId), orderBy("createdAt", "desc"))
    );
    setCourses(
      snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as {
          name?: string;
          year?: number;
          maxStudents?: number;
          folderId?: string | null;
          enrolledCount?: number;
          teacherIds?: string[];
          internshipDurationMonths?: number;
          internshipStartDate?: string | null;
          internshipEndDate?: string | null;
          reportMinHours?: number;
          reportWaitDays?: number;
          createdAt?: { toDate?: () => Date };
        };
        return {
          id: docSnap.id,
          name: data.name || "—",
          year: data.year ?? null,
          maxStudents: data.maxStudents ?? null,
          folderId: data.folderId ?? null,
          enrolledCount: data.enrolledCount ?? 0,
          teacherIds: Array.isArray(data.teacherIds) ? data.teacherIds : [],
          internshipDurationMonths: data.internshipDurationMonths ?? null,
          internshipStartDate: data.internshipStartDate ?? null,
          internshipEndDate: data.internshipEndDate ?? null,
          reportMinHours: data.reportMinHours ?? 80,
          reportWaitDays: data.reportWaitDays ?? 0,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
        };
      })
    );
  };

  const refreshFolders = async () => {
    const db = await getDbRuntime();
    const snapshot = await getDocs(query(collection(db, "schools", schoolId, "folders"), orderBy("name", "asc")));
    const data = snapshot.docs.map((docSnap) => {
      const payload = docSnap.data() as { name?: string };
      return { id: docSnap.id, name: payload.name || "—" };
    });
    setFolders(data);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const db = await getDbRuntime();
    await addDoc(collection(db, "schools", schoolId, "folders"), {
      name: newFolderName.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNewFolderName("");
    await refreshFolders();
    setShowCreateFolderWizard(false);
  };

  const handleCreateCourse = async () => {
    if (!newCourse.name.trim()) return;
    if (!newCourse.internshipStartDate) {
      alert("A data de início é obrigatória.");
      return;
    }

    let durationMonths = newCourse.internshipDurationMonths
      ? Number(newCourse.internshipDurationMonths)
      : null;
    let startDate = newCourse.internshipStartDate || null;
    let endDate = newCourse.internshipEndDate || null;

    const parsedStart = parseDateLocal(startDate);
    const parsedEnd = parseDateLocal(endDate);

    if (parsedStart && durationMonths && !parsedEnd) {
      endDate = formatDateLocal(addMonths(parsedStart, durationMonths));
    }

    if (parsedStart && parsedEnd && !durationMonths) {
      durationMonths = diffMonths(parsedStart, parsedEnd);
    }

    const db = await getDbRuntime();
    await addDoc(collection(db, "courses"), {
      name: newCourse.name.trim(),
      year: requiresYear && newCourse.year ? Number(newCourse.year) : null,
      maxStudents: newCourse.maxStudents ? Number(newCourse.maxStudents) : null,
      schoolId,
      folderId: newCourse.folderId && newCourse.folderId !== NO_FOLDER_VALUE ? newCourse.folderId : null,
      teacherIds: newCourse.teacherIds,
      internshipDurationMonths: durationMonths,
      internshipStartDate: startDate,
      internshipEndDate: endDate,
      reportMinHours: newCourse.reportMinHours ? Number(newCourse.reportMinHours) : 80,
      reportWaitDays: newCourse.reportWaitDays ? Number(newCourse.reportWaitDays) : 0,
      enrolledCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNewCourse({
      name: "",
      year: "",
      maxStudents: "",
      folderId: "",
      teacherIds: [],
      internshipDurationMonths: "",
      internshipStartDate: "",
      internshipEndDate: "",
      reportMinHours: "80",
      reportWaitDays: "0",
    });
    await refreshCourses();
  };

  const startEditCourse = (course: Course) => {
    setEditCourseId(course.id);
    setEditCourse({ ...course });
  };

  const cancelEdit = () => {
    setEditCourseId(null);
    setEditCourse(null);
  };

  const saveCourse = async () => {
    if (!editCourse || !editCourse.name.trim()) return;
    if (!editCourse.internshipStartDate) {
      alert("A data de início é obrigatória.");
      return;
    }

    let durationMonths = editCourse.internshipDurationMonths ?? null;
    let startDate = editCourse.internshipStartDate ?? null;
    let endDate = editCourse.internshipEndDate ?? null;

    const parsedStart = parseDateLocal(startDate);
    const parsedEnd = parseDateLocal(endDate);

    if (parsedStart && durationMonths && !parsedEnd) {
      endDate = formatDateLocal(addMonths(parsedStart, durationMonths));
    }

    if (parsedStart && parsedEnd && !durationMonths) {
      durationMonths = diffMonths(parsedStart, parsedEnd);
    }

    const db = await getDbRuntime();
    await updateDoc(doc(db, "courses", editCourse.id), {
      name: editCourse.name.trim(),
      year: requiresYear && editCourse.year ? Number(editCourse.year) : null,
      maxStudents: editCourse.maxStudents ? Number(editCourse.maxStudents) : null,
      folderId:
        editCourse.folderId && editCourse.folderId !== NO_FOLDER_VALUE ? editCourse.folderId : null,
      teacherIds: editCourse.teacherIds || [],
      internshipDurationMonths: durationMonths,
      internshipStartDate: startDate,
      internshipEndDate: endDate,
      reportMinHours: editCourse.reportMinHours ?? 80,
      reportWaitDays: editCourse.reportWaitDays ?? 0,
      updatedAt: serverTimestamp(),
    });
    cancelEdit();
    await refreshCourses();
  };

  const handleDeleteCourse = async (course: Course) => {
    if (!window.confirm(`Eliminar o curso "${course.name}"?`)) return;
    const db = await getDbRuntime();
    await deleteDoc(doc(db, "courses", course.id));
    await refreshCourses();
  };

  const resolveFolderName = (folderId?: string | null) =>
    folders.find((folder) => folder.id === folderId)?.name || "Sem pasta";

  const filteredCourses = useMemo(() => {
    const data =
      filterFolderId === ALL_FOLDERS_VALUE
        ? courses
        : courses.filter((course) => (course.folderId || "") === filterFolderId);
    const sorted = [...data].sort((a, b) => {
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "name-desc") return b.name.localeCompare(a.name);
      if (sortBy === "year-asc") return (a.year ?? 0) - (b.year ?? 0);
      if (sortBy === "year-desc") return (b.year ?? 0) - (a.year ?? 0);
      if (sortBy === "limit-asc") return (a.maxStudents ?? 0) - (b.maxStudents ?? 0);
      if (sortBy === "limit-desc") return (b.maxStudents ?? 0) - (a.maxStudents ?? 0);
      return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
    });
    return sorted;
  }, [courses, filterFolderId, sortBy]);

  const groupedCourses = useMemo(() => {
    const knownFolderIds = new Set(folderOptions.map((folder) => folder.id));
    const groups = new Map<string, Course[]>();

    filteredCourses.forEach((course) => {
      const rawFolderId = course.folderId || NO_FOLDER_VALUE;
      const folderId = knownFolderIds.has(rawFolderId) ? rawFolderId : NO_FOLDER_VALUE;
      if (!groups.has(folderId)) {
        groups.set(folderId, []);
      }
      groups.get(folderId)?.push(course);
    });

    const orderedFolders =
      filterFolderId === ALL_FOLDERS_VALUE
        ? folderOptions
        : folderOptions.filter((folder) => folder.id === filterFolderId);

    return orderedFolders
      .map((folder) => ({
        id: folder.id,
        name: folder.name,
        courses: groups.get(folder.id) ?? [],
      }))
      .filter((group) => filterFolderId !== ALL_FOLDERS_VALUE || group.courses.length > 0);
  }, [filterFolderId, filteredCourses, folderOptions]);

  return (
    <div className="space-y-6">
      <Dialog open={showCreateFolderWizard} onOpenChange={setShowCreateFolderWizard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar nova pasta</DialogTitle>
            <DialogDescription>Crie uma pasta para organizar visualmente os cursos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nome da pasta</Label>
            <Input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Ex: Informática"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
            >
              Criar pasta
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowCreateFolderWizard(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Criar curso</CardTitle>
              <CardDescription>Crie cursos com ou sem pasta.</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={() => setShowCreateCourse((prev) => !prev)}>
              {showCreateCourse ? "Fechar" : "Criar curso"}
            </Button>
          </div>
        </CardHeader>
        {showCreateCourse && (
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Nome do curso</Label>
                <Input
                  value={newCourse.name}
                  onChange={(event) => setNewCourse((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex: Informática - Sistemas"
                />
              </div>
              {requiresYear && (
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={newCourse.year}
                    onChange={(event) => setNewCourse((prev) => ({ ...prev, year: event.target.value }))}
                    placeholder="10"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Nº máximo de alunos</Label>
                <Input
                  type="number"
                  min={1}
                  value={newCourse.maxStudents}
                  onChange={(event) => setNewCourse((prev) => ({ ...prev, maxStudents: event.target.value }))}
                  placeholder="30"
                />
              </div>
            </div>
            <div className="max-w-xs space-y-2">
              <Label>Pasta</Label>
              <Select
                value={newCourse.folderId || NO_FOLDER_VALUE}
                onValueChange={(value) => setNewCourse((prev) => ({ ...prev, folderId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem pasta" />
                </SelectTrigger>
                <SelectContent>
                  {folderOptions.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Duração do estágio (meses)</Label>
                <Input
                  type="number"
                  min={1}
                  value={newCourse.internshipDurationMonths}
                  onChange={(event) =>
                    setNewCourse((prev) => ({ ...prev, internshipDurationMonths: event.target.value }))
                  }
                  placeholder="6"
                />
              </div>
              <div className="space-y-2">
                <Label>Data de início</Label>
                <Input
                  type="date"
                  value={newCourse.internshipStartDate}
                  onChange={(event) =>
                    setNewCourse((prev) => {
                      const startDate = event.target.value;
                      const parsedStart = parseDateLocal(startDate);
                      let endDate = prev.internshipEndDate;
                      let duration = prev.internshipDurationMonths;

                      if (parsedStart && duration && !endDate) {
                        endDate = formatDateLocal(addMonths(parsedStart, Number(duration)));
                      } else if (parsedStart && endDate && !duration) {
                        const parsedEnd = parseDateLocal(endDate);
                        if (parsedEnd) {
                          duration = String(diffMonths(parsedStart, parsedEnd));
                        }
                      }

                      return {
                        ...prev,
                        internshipStartDate: startDate,
                        internshipEndDate: endDate,
                        internshipDurationMonths: duration,
                      };
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Data de conclusão</Label>
                <Input
                  type="date"
                  value={newCourse.internshipEndDate}
                  onChange={(event) =>
                    setNewCourse((prev) => {
                      const endDate = event.target.value;
                      const parsedStart = parseDateLocal(prev.internshipStartDate);
                      let duration = prev.internshipDurationMonths;

                      if (parsedStart && endDate && !duration) {
                        const parsedEnd = parseDateLocal(endDate);
                        if (parsedEnd) {
                          duration = String(diffMonths(parsedStart, parsedEnd));
                        }
                      }

                      return {
                        ...prev,
                        internshipEndDate: endDate,
                        internshipDurationMonths: duration,
                      };
                    })
                  }
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Horas mínimas para relatório</Label>
                <Input
                  type="number"
                  min={1}
                  value={newCourse.reportMinHours}
                  onChange={(event) =>
                    setNewCourse((prev) => ({ ...prev, reportMinHours: event.target.value }))
                  }
                  placeholder="80"
                />
              </div>
              <div className="space-y-2">
                <Label>Período de espera para relatório (dias)</Label>
                <Input
                  type="number"
                  min={0}
                  value={newCourse.reportWaitDays}
                  onChange={(event) =>
                    setNewCourse((prev) => ({ ...prev, reportWaitDays: event.target.value }))
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Professores responsáveis</Label>
              {teachers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem professores registados.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {teachers.map((teacher) => (
                    <label key={teacher.id} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={newCourse.teacherIds.includes(teacher.id)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setNewCourse((prev) => ({
                            ...prev,
                            teacherIds: checked
                              ? [...prev.teacherIds, teacher.id]
                              : prev.teacherIds.filter((id) => id !== teacher.id),
                          }));
                        }}
                      />
                      <span>{teacher.name}</span>
                      <span className="text-xs text-muted-foreground">{teacher.email}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={async () => {
                  await handleCreateCourse();
                  setShowCreateCourse(false);
                }}
              >
                Criar curso
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreateCourse(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cursos</CardTitle>
          <CardDescription>Gestão de cursos existentes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Filtrar por pasta</Label>
              <Select
                value={filterFolderId}
                onValueChange={(value) => {
                  if (value === CREATE_FOLDER_VALUE) {
                    setShowCreateFolderWizard(true);
                    return;
                  }
                  setFilterFolderId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mostrar tudo" />
                </SelectTrigger>
                <SelectContent>
                  {filterOptions.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                  <div className="px-2 pb-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowCreateFolderWizard(true)}
                    >
                      Criar nova pasta
                    </Button>
                  </div>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ordenar por</Label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Mais recentes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Nome (Z-A)</SelectItem>
                  <SelectItem value="year-asc">Ano (asc)</SelectItem>
                  <SelectItem value="year-desc">Ano (desc)</SelectItem>
                  <SelectItem value="limit-asc">Limite (asc)</SelectItem>
                  <SelectItem value="limit-desc">Limite (desc)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar cursos...</p>
          ) : filteredCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não existem cursos.</p>
          ) : (
            <div className="space-y-6">
              {groupedCourses.map((group) => (
                <div key={group.id} className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Pasta</p>
                      <h3 className="text-base font-semibold text-foreground">{group.name}</h3>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {group.courses.length} curso{group.courses.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {group.courses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem cursos nesta pasta.</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {group.courses.map((course) => {
                        const isEditing = editCourseId === course.id;
                        const draft = isEditing ? editCourse : null;
                        return (
                          <div key={course.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                            <div className="flex items-start justify-between">
                              <h3 className="text-lg font-semibold text-foreground">{course.name}</h3>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => startEditCourse(course)}>
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => startEditCourse(course)}>
                                    Mover para pasta
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDeleteCourse(course)}>
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {isEditing && draft ? (
                              <div className="mt-4 space-y-3">
                                <div className="space-y-2">
                                  <Label>Nome</Label>
                                  <Input
                                    value={draft.name}
                                    onChange={(event) =>
                                      setEditCourse((prev) =>
                                        prev ? { ...prev, name: event.target.value } : prev
                                      )
                                    }
                                  />
                                </div>
                                {requiresYear && (
                                  <div className="space-y-2">
                                    <Label>Ano</Label>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={12}
                                      value={draft.year ?? ""}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setEditCourse((prev) =>
                                          prev ? { ...prev, year: value ? Number(value) : null } : prev
                                        );
                                      }}
                                    />
                                  </div>
                                )}
                                <div className="space-y-2">
                                  <Label>Limite de alunos</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={draft.maxStudents ?? ""}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      setEditCourse((prev) =>
                                        prev ? { ...prev, maxStudents: value ? Number(value) : null } : prev
                                      );
                                    }}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Mover para pasta</Label>
                                  <Select
                                    value={draft.folderId || NO_FOLDER_VALUE}
                                    onValueChange={(value) =>
                                      setEditCourse((prev) => (prev ? { ...prev, folderId: value } : prev))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Sem pasta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {folderOptions.map((folder) => (
                                        <SelectItem key={folder.id} value={folder.id}>
                                          {folder.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label>Duração do estágio (meses)</Label>
                                    <Input
                                      type="number"
                                      min={1}
                                      value={draft.internshipDurationMonths ?? ""}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setEditCourse((prev) => {
                                          if (!prev) return prev;
                                          const parsedStart = parseDateLocal(prev.internshipStartDate);
                                          const duration = value ? Number(value) : null;
                                          let endDate = prev.internshipEndDate;
                                          if (parsedStart && duration && !endDate) {
                                            endDate = formatDateLocal(addMonths(parsedStart, duration));
                                          }
                                          return {
                                            ...prev,
                                            internshipDurationMonths: duration,
                                            internshipEndDate: endDate,
                                          };
                                        });
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Data de início</Label>
                                    <Input
                                      type="date"
                                      value={draft.internshipStartDate ?? ""}
                                      onChange={(event) => {
                                        const startDate = event.target.value;
                                        setEditCourse((prev) => {
                                          if (!prev) return prev;
                                          const parsedStart = parseDateLocal(startDate);
                                          let endDate = prev.internshipEndDate;
                                          let duration = prev.internshipDurationMonths;

                                          if (parsedStart && duration && !endDate) {
                                            endDate = formatDateLocal(addMonths(parsedStart, duration));
                                          } else if (parsedStart && endDate && !duration) {
                                            const parsedEnd = parseDateLocal(endDate);
                                            if (parsedEnd) {
                                              duration = diffMonths(parsedStart, parsedEnd);
                                            }
                                          }

                                          return {
                                            ...prev,
                                            internshipStartDate: startDate,
                                            internshipEndDate: endDate,
                                            internshipDurationMonths: duration,
                                          };
                                        });
                                      }}
                                      required
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Data de conclusão</Label>
                                    <Input
                                      type="date"
                                      value={draft.internshipEndDate ?? ""}
                                      onChange={(event) => {
                                        const endDate = event.target.value;
                                        setEditCourse((prev) => {
                                          if (!prev) return prev;
                                          const parsedStart = parseDateLocal(prev.internshipStartDate);
                                          let duration = prev.internshipDurationMonths;
                                          if (parsedStart && endDate && !duration) {
                                            const parsedEnd = parseDateLocal(endDate);
                                            if (parsedEnd) {
                                              duration = diffMonths(parsedStart, parsedEnd);
                                            }
                                          }
                                          return {
                                            ...prev,
                                            internshipEndDate: endDate,
                                            internshipDurationMonths: duration,
                                          };
                                        });
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label>Horas mínimas para relatório</Label>
                                    <Input
                                      type="number"
                                      min={1}
                                      value={draft.reportMinHours ?? 80}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setEditCourse((prev) =>
                                          prev ? { ...prev, reportMinHours: value ? Number(value) : 80 } : prev
                                        );
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Período de espera para relatório (dias)</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={draft.reportWaitDays ?? 0}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setEditCourse((prev) =>
                                          prev ? { ...prev, reportWaitDays: value ? Number(value) : 0 } : prev
                                        );
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>Professores responsáveis</Label>
                                  {teachers.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sem professores registados.</p>
                                  ) : (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {teachers.map((teacher) => (
                                        <label
                                          key={teacher.id}
                                          className="flex items-center gap-2 text-sm text-foreground"
                                        >
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4"
                                            checked={(draft.teacherIds || []).includes(teacher.id)}
                                            onChange={(event) => {
                                              const checked = event.target.checked;
                                              setEditCourse((prev) => {
                                                if (!prev) return prev;
                                                const ids = prev.teacherIds || [];
                                                return {
                                                  ...prev,
                                                  teacherIds: checked
                                                    ? [...ids, teacher.id]
                                                    : ids.filter((id) => id !== teacher.id),
                                                };
                                              });
                                            }}
                                          />
                                          <span>{teacher.name}</span>
                                          <span className="text-xs text-muted-foreground">{teacher.email}</span>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button type="button" onClick={saveCourse}>
                                    Guardar
                                  </Button>
                                  <Button type="button" variant="outline" onClick={cancelEdit}>
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-4 space-y-3">
                                <div className="flex flex-wrap gap-2">
                                  {requiresYear && <Badge variant="secondary">Ano: {course.year ?? "—"}</Badge>}
                                  <Badge variant="secondary">Limite: {course.maxStudents ?? "—"}</Badge>
                                  <Badge variant="outline">Inscritos: {course.enrolledCount ?? 0}</Badge>
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <p>Duração do estágio: {course.internshipDurationMonths ?? "—"} meses</p>
                                  <p>Data de início: {course.internshipStartDate || "—"}</p>
                                  <p>Data de conclusão: {course.internshipEndDate || "—"}</p>
                                  <p>Horas mínimas para relatório: {course.reportMinHours ?? 80}h</p>
                                  <p>Espera para relatório: {course.reportWaitDays ?? 0} dia(s)</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
