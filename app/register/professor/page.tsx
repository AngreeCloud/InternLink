"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { registerProfessor } from "@/actions/register";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";

const professorSchema = z.object({
  nome: z.string().min(3, "O nome é obrigatório."),
  email: z.string().email("Email inválido."),
  password: z.string().min(6, "A password deve ter no mínimo 6 caracteres."),
  escola: z.string().min(1, "A escola é obrigatória."),
  curso: z.string().min(1, "O curso é obrigatório."),
  dataNascimento: z.string().optional(),
  localidade: z.string().optional(),
  telefone: z.string().optional(),
});

export default function ProfessorRegisterPage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const form = useForm<z.infer<typeof professorSchema>>({
    resolver: zodResolver(professorSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      escola: "",
      curso: "",
      dataNascimento: "",
      localidade: "",
      telefone: "",
    },
  });

  const router = useRouter();
  const selectedSchoolId = form.watch("escola");
  const selectedCourseId = form.watch("curso");

  useEffect(() => {
    let active = true;

    const loadSchools = async () => {
      setLoadingSchools(true);
      const db = await getDbRuntime();
      const snapshot = await getDocs(collection(db, "schools"));
      if (!active) return;
      setSchools(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as { name?: string };
          return { id: docSnap.id, name: data.name || "—" };
        })
      );
      setLoadingSchools(false);
    };

    loadSchools();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadCourses = async () => {
      if (!selectedSchoolId) {
        setCourses([]);
        return;
      }
      setLoadingCourses(true);
      const db = await getDbRuntime();
      const snapshot = await getDocs(query(collection(db, "courses"), where("schoolId", "==", selectedSchoolId)));
      if (!active) return;
      setCourses(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as { name?: string };
          return { id: docSnap.id, name: data.name || "—" };
        })
      );
      setLoadingCourses(false);
    };

    loadCourses();

    return () => {
      active = false;
    };
  }, [selectedSchoolId]);

  const selectedSchoolName = useMemo(
    () => schools.find((school) => school.id === selectedSchoolId)?.name || "",
    [schools, selectedSchoolId]
  );

  const selectedCourseName = useMemo(
    () => courses.find((course) => course.id === selectedCourseId)?.name || "",
    [courses, selectedCourseId]
  );

  async function onSubmit(values: z.infer<typeof professorSchema>) {
    try {
      const result = await registerProfessor({
        ...values,
        escolaId: values.escola,
        escolaNome: selectedSchoolName,
        cursoId: values.curso,
        cursoNome: selectedCourseName,
      });
      router.push(
        `/account-status?email=${encodeURIComponent(result.email ?? values.email)}&createdAt=${encodeURIComponent(
          result.createdAt ?? ""
        )}`
      );
    } catch (error) {
      console.error("Erro ao criar conta de professor:", error);
      alert("Erro ao criar conta. Tente novamente.");
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Registo de Professor</CardTitle>
          <CardDescription>Preencha os seus dados para criar a conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="nome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl><Input placeholder="O seu nome" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
               <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="teu@email.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="escola" render={({ field }) => (
                <FormItem>
                  <FormLabel>Escola</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("curso", "");
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingSchools ? "A carregar escolas..." : "Selecione a escola"} />
                      </SelectTrigger>
                      <SelectContent>
                        {schools.map((school) => (
                          <SelectItem key={school.id} value={school.id}>
                            {school.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="curso" render={({ field }) => (
                <FormItem>
                  <FormLabel>Curso</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !selectedSchoolId
                              ? "Escolha uma escola primeiro"
                              : loadingCourses
                                ? "A carregar cursos..."
                                : "Selecione o curso"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
               <FormField control={form.control} name="dataNascimento" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Nascimento (Opcional)</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="localidade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Localidade (Opcional)</FormLabel>
                  <FormControl><Input placeholder="A sua localidade" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="telefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (Opcional)</FormLabel>
                  <FormControl><Input placeholder="O seu contacto" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full mt-1">Criar Conta</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
