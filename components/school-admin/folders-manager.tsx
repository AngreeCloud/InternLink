"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Folder = {
  id: string;
  name: string;
};

type Course = {
  id: string;
  name: string;
  year?: number | null;
  maxStudents?: number | null;
};

type SchoolInfo = {
  educationLevel?: string;
};

export function FoldersManager() {
  const { schoolId } = useSchoolAdmin();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState("");
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({});
  const [coursesByFolder, setCoursesByFolder] = useState<Record<string, Course[]>>({});
  const [editFolderName, setEditFolderName] = useState<Record<string, string>>({});
  const [courseDrafts, setCourseDrafts] = useState<Record<string, Course>>({});

  const requiresYear = useMemo(
    () => schoolInfo.educationLevel === "Secundária/Profissional",
    [schoolInfo.educationLevel]
  );

  useEffect(() => {
    let active = true;

    const loadSchoolInfo = async () => {
      const db = await getDbRuntime();
      const snap = await getDoc(doc(db, "schools", schoolId));
      if (!active) return;
      if (snap.exists()) {
        setSchoolInfo(snap.data() as SchoolInfo);
      }
    };

    loadSchoolInfo();

    return () => {
      active = false;
    };
  }, [schoolId]);

  useEffect(() => {
    let active = true;

    const loadFolders = async () => {
      setLoading(true);
      const db = await getDbRuntime();
      const foldersRef = collection(db, "schools", schoolId, "folders");
      const snapshot = await getDocs(query(foldersRef, orderBy("createdAt", "desc")));

      if (!active) return;

      const data = snapshot.docs.map((docSnap) => {
        const payload = docSnap.data() as { name?: string };
        return { id: docSnap.id, name: payload.name || "—" };
      });

      setFolders(data);
      setEditFolderName((prev) => {
        const next = { ...prev };
        data.forEach((folder) => {
          if (!next[folder.id]) {
            next[folder.id] = folder.name;
          }
        });
        return next;
      });
      setLoading(false);
    };

    loadFolders();

    return () => {
      active = false;
    };
  }, [schoolId]);

  const loadCourses = async (folderId: string) => {
    const db = await getDbRuntime();
    const coursesRef = collection(db, "schools", schoolId, "folders", folderId, "courses");
    const snapshot = await getDocs(query(coursesRef, orderBy("createdAt", "desc")));

    setCoursesByFolder((prev) => ({
      ...prev,
      [folderId]: snapshot.docs.map((docSnap) => {
        const payload = docSnap.data() as {
          name?: string;
          year?: number;
          maxStudents?: number;
        };
        return {
          id: docSnap.id,
          name: payload.name || "—",
          year: payload.year ?? null,
          maxStudents: payload.maxStudents ?? null,
        };
      }),
    }));
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const db = await getDbRuntime();
    const foldersRef = collection(db, "schools", schoolId, "folders");
    await addDoc(foldersRef, {
      name: newFolderName.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNewFolderName("");
    await reloadFolders();
  };

  const reloadFolders = async () => {
    const db = await getDbRuntime();
    const foldersRef = collection(db, "schools", schoolId, "folders");
    const snapshot = await getDocs(query(foldersRef, orderBy("createdAt", "desc")));
    const data = snapshot.docs.map((docSnap) => {
      const payload = docSnap.data() as { name?: string };
      return { id: docSnap.id, name: payload.name || "—" };
    });
    setFolders(data);
  };

  const handleRenameFolder = async (folderId: string) => {
    const name = editFolderName[folderId]?.trim();
    if (!name) return;
    const db = await getDbRuntime();
    await updateDoc(doc(db, "schools", schoolId, "folders", folderId), {
      name,
      updatedAt: serverTimestamp(),
    });
    await reloadFolders();
  };

  const handleCourseDraftChange = (folderId: string, updates: Partial<Course>) => {
    setCourseDrafts((prev) => ({
      ...prev,
      [folderId]: {
        id: prev[folderId]?.id || "",
        name: prev[folderId]?.name || "",
        year: prev[folderId]?.year ?? null,
        maxStudents: prev[folderId]?.maxStudents ?? null,
        ...updates,
      },
    }));
  };

  const handleCreateCourse = async (folderId: string) => {
    const draft = courseDrafts[folderId];
    if (!draft || !draft.name?.trim()) return;

    const payload = {
      name: draft.name.trim(),
      year: requiresYear && draft.year ? Number(draft.year) : null,
      maxStudents: draft.maxStudents ? Number(draft.maxStudents) : null,
      schoolId,
      folderId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const db = await getDbRuntime();
    const courseRef = await addDoc(collection(db, "schools", schoolId, "folders", folderId, "courses"), payload);
    await setDoc(doc(db, "courses", courseRef.id), payload, { merge: true });

    setCourseDrafts((prev) => ({ ...prev, [folderId]: { id: "", name: "", year: null, maxStudents: null } }));
    await loadCourses(folderId);
  };

  const handleUpdateCourse = async (folderId: string, course: Course) => {
    if (!course.name.trim()) return;
    const db = await getDbRuntime();
    const payload = {
      name: course.name.trim(),
      year: requiresYear && course.year ? Number(course.year) : null,
      maxStudents: course.maxStudents ? Number(course.maxStudents) : null,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, "schools", schoolId, "folders", folderId, "courses", course.id), payload);
    await updateDoc(doc(db, "courses", course.id), payload);
    await loadCourses(folderId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pastas e Cursos</CardTitle>
        <CardDescription>Crie pastas e estruturas de cursos para a sua escola.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <Label>Nome da pasta</Label>
            <Input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Ex: Informática"
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={handleCreateFolder}>
              Criar pasta
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">A carregar pastas...</p>
        ) : folders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não existem pastas.</p>
        ) : (
          <div className="space-y-6">
            {folders.map((folder) => (
              <div key={folder.id} className="rounded-lg border border-border p-4 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-2 flex-1">
                    <Label>Nome da pasta</Label>
                    <Input
                      value={editFolderName[folder.id] ?? folder.name}
                      onChange={(event) =>
                        setEditFolderName((prev) => ({ ...prev, [folder.id]: event.target.value }))
                      }
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={() => handleRenameFolder(folder.id)}>
                    Renomear
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Nome do curso</Label>
                      <Input
                        value={courseDrafts[folder.id]?.name || ""}
                        onChange={(event) => handleCourseDraftChange(folder.id, { name: event.target.value })}
                        placeholder="Ex: Gestão"
                      />
                    </div>
                    {requiresYear && (
                      <div className="space-y-2">
                        <Label>Ano</Label>
                        <Input
                          type="number"
                          min={1}
                          max={12}
                          value={courseDrafts[folder.id]?.year ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            handleCourseDraftChange(folder.id, { year: value ? Number(value) : null });
                          }}
                          placeholder="10"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Nº máximo de alunos</Label>
                      <Input
                        type="number"
                        min={1}
                        value={courseDrafts[folder.id]?.maxStudents ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          handleCourseDraftChange(folder.id, { maxStudents: value ? Number(value) : null });
                        }}
                        placeholder="30"
                      />
                    </div>
                  </div>
                  <Button type="button" onClick={() => handleCreateCourse(folder.id)}>
                    Criar curso
                  </Button>
                </div>

                <div className="space-y-3">
                  <Button type="button" variant="ghost" onClick={() => loadCourses(folder.id)}>
                    Atualizar lista de cursos
                  </Button>
                  {(coursesByFolder[folder.id] || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem cursos nesta pasta.</p>
                  ) : (
                    <div className="space-y-3">
                      {coursesByFolder[folder.id].map((course) => (
                        <div key={course.id} className="grid gap-3 md:grid-cols-4 items-end">
                          <div className="space-y-2">
                            <Label>Curso</Label>
                            <Input
                              value={course.name}
                              onChange={(event) => {
                                setCoursesByFolder((prev) => ({
                                  ...prev,
                                  [folder.id]: prev[folder.id].map((item) =>
                                    item.id === course.id ? { ...item, name: event.target.value } : item
                                  ),
                                }));
                              }}
                            />
                          </div>
                          {requiresYear && (
                            <div className="space-y-2">
                              <Label>Ano</Label>
                              <Input
                                type="number"
                                min={1}
                                max={12}
                                value={course.year ?? ""}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setCoursesByFolder((prev) => ({
                                    ...prev,
                                    [folder.id]: prev[folder.id].map((item) =>
                                      item.id === course.id
                                        ? { ...item, year: value ? Number(value) : null }
                                        : item
                                    ),
                                  }));
                                }}
                              />
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label>Limite de alunos</Label>
                            <Input
                              type="number"
                              min={1}
                              value={course.maxStudents ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                setCoursesByFolder((prev) => ({
                                  ...prev,
                                  [folder.id]: prev[folder.id].map((item) =>
                                    item.id === course.id
                                      ? { ...item, maxStudents: value ? Number(value) : null }
                                      : item
                                  ),
                                }));
                              }}
                            />
                          </div>
                          <Button type="button" variant="outline" onClick={() => handleUpdateCourse(folder.id, course)}>
                            Guardar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
