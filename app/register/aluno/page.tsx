"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { registerAluno } from "@/actions/register";
import { alunoRegisterFormSchema } from "@/lib/validators/register";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { CaptchaWidget } from "@/components/auth/captcha-widget";

const studentSchema = alunoRegisterFormSchema;

export default function StudentRegisterPage() {
  const [schools, setSchools] = useState<{
    id: string;
    name: string;
    emailDomain?: string;
    requireInstitutionalEmail?: boolean;
  }[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submitLockRef = useRef(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

  const form = useForm<z.infer<typeof studentSchema>>({
    resolver: zodResolver(studentSchema),
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
          const data = docSnap.data() as {
            name?: string;
            emailDomain?: string;
            requireInstitutionalEmail?: boolean;
          };
          return {
            id: docSnap.id,
            name: data.name || "—",
            emailDomain: data.emailDomain || "",
            requireInstitutionalEmail: Boolean(data.requireInstitutionalEmail),
          };
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

  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === selectedSchoolId),
    [schools, selectedSchoolId]
  );

  const selectedSchoolName = selectedSchool?.name || "";

  const selectedCourseName = useMemo(
    () => courses.find((course) => course.id === selectedCourseId)?.name || "",
    [courses, selectedCourseId]
  );

  async function onSubmit(values: z.infer<typeof studentSchema>) {
    if (submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    try {
      setSubmitError("");

      if (recaptchaSiteKey && !captchaToken) {
        setSubmitError("Por favor complete o CAPTCHA.");
        return;
      }

      if (selectedSchool?.requireInstitutionalEmail && selectedSchool.emailDomain) {
        const domain = selectedSchool.emailDomain.trim().toLowerCase();
        const email = values.email.trim().toLowerCase();
        if (!email.endsWith(domain)) {
          setSubmitError("Esta escola exige email institucional. Use um email com o domínio correto.");
          return;
        }
      }

      const result = await registerAluno({
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
      console.error("Erro ao criar conta de aluno:", error);
      alert("Erro ao criar conta. Tente novamente.");
    } finally {
      submitLockRef.current = false;
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Registo de Aluno</CardTitle>
          <CardDescription>Preenche os teus dados para criar a conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {submitError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {submitError}
                </div>
              )}
              <FormField control={form.control} name="nome" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl><Input placeholder="O teu nome" {...field} /></FormControl>
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
                  <FormLabel>Data de Nascimento</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="localidade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Localidade (Opcional)</FormLabel>
                  <FormControl><Input placeholder="A tua localidade" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="telefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (Opcional)</FormLabel>
                  <FormControl><Input placeholder="O teu contacto" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {recaptchaSiteKey && (
                <CaptchaWidget
                  siteKey={recaptchaSiteKey}
                  onVerify={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken("")}
                />
              )}
              <Button type="submit" className="w-full mt-1" disabled={form.formState.isSubmitting || submitLockRef.current}>
                {form.formState.isSubmitting || submitLockRef.current ? "A registar..." : "Criar Conta"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
