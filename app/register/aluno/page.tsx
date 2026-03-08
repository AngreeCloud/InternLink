"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { registerAluno } from "@/actions/register";
import { alunoRegisterFormSchema } from "@/lib/validators/register";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { getRecaptchaV3Token } from "@/lib/recaptcha-v3";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Info } from "lucide-react";
import { SchoolSelector } from "@/components/auth/school-selector";
import type { School, SchoolConfig } from "@/lib/types/school";

const studentSchema = alunoRegisterFormSchema;

type RegistrationStep = "school-selection" | "registration-form";

export default function StudentRegisterPage() {
  const [step, setStep] = useState<RegistrationStep>("school-selection");
  const [schools, setSchools] = useState<School[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submitLockRef = useRef(false);
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

  const form = useForm<z.infer<typeof studentSchema>>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      confirmPassword: "",
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
  const emailValue = form.watch("email");

  // Load schools on mount
  useEffect(() => {
    let active = true;

    const loadSchools = async () => {
      setLoadingSchools(true);
      const db = await getDbRuntime();
      const snapshot = await getDocs(collection(db, "schools"));
      if (!active) return;
      
      const schoolsList: School[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || "—",
          emailDomain: data.emailDomain || "",
          requireInstitutionalEmail: Boolean(data.requireInstitutionalEmail),
          allowGoogleLogin: Boolean(data.allowGoogleLogin),
          requiresPhone: Boolean(data.requiresPhone),
        };
      });
      
      setSchools(schoolsList);
      setLoadingSchools(false);
    };

    loadSchools();

    return () => {
      active = false;
    };
  }, []);

  // Load school config when school is selected
  useEffect(() => {
    let active = true;

    const loadSchoolConfig = async () => {
      if (!selectedSchoolId) {
        setSchoolConfig(null);
        setCourses([]);
        return;
      }

      setLoadingConfig(true);
      const db = await getDbRuntime();
      const schoolSnap = await getDoc(doc(db, "schools", selectedSchoolId));
      
      if (!active) return;

      if (schoolSnap.exists()) {
        const data = schoolSnap.data();
        setSchoolConfig({
          requireInstitutionalEmail: Boolean(data.requireInstitutionalEmail),
          emailDomain: data.emailDomain || "",
          allowGoogleLogin: Boolean(data.allowGoogleLogin),
          requiresPhone: Boolean(data.requiresPhone),
        });
      }
      
      setLoadingConfig(false);
    };

    loadSchoolConfig();

    return () => {
      active = false;
    };
  }, [selectedSchoolId]);

  // Load courses when school is selected
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

  // Validate email domain in real-time
  const emailDomainError = useMemo(() => {
    if (!schoolConfig?.requireInstitutionalEmail || !schoolConfig.emailDomain) return null;
    if (!emailValue || emailValue.trim() === "") return null;

    const normalizedEmail = emailValue.trim().toLowerCase();
    const domain = schoolConfig.emailDomain.trim().toLowerCase();
    const expectedDomain = domain.startsWith("@") ? domain : `@${domain}`;

    if (!normalizedEmail.endsWith(expectedDomain)) {
      return `Esta escola exige email institucional com o domínio ${expectedDomain}`;
    }

    return null;
  }, [emailValue, schoolConfig]);

  useEffect(() => {
    if (!recaptchaSiteKey) return;
    void getRecaptchaV3Token(recaptchaSiteKey, "register_aluno_pageview").catch(() => {});
  }, [recaptchaSiteKey]);

  const resolveRegisterErrorMessage = (error: unknown) => {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: string }).code)
        : "";

    if (code === "auth/email-already-in-use") {
      return "Este email já está registado. Utilize outro email ou recupere a palavra-passe.";
    }

    if (code === "auth/missing-recaptcha-token") {
      return "Falha na verificação CAPTCHA. Atualize a página e tente novamente.";
    }

    if (code === "auth/invalid-recaptcha-token" || code === "auth/recaptcha-check-failed") {
      return "Não foi possível validar o reCAPTCHA. Tente novamente.";
    }

    if (code === "auth/invalid-school-email-domain") {
      return "Esta escola exige email institucional. Use um email com o domínio correto.";
    }

    return "Erro ao criar conta. Tente novamente.";
  };

  const handleSchoolSelection = () => {
    if (!selectedSchoolId) {
      return;
    }
    setStep("registration-form");
  };

  async function onSubmit(values: z.infer<typeof studentSchema>) {
    if (submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    try {
      setSubmitError("");

      let recaptchaToken = "";
      if (recaptchaSiteKey) {
        recaptchaToken = await getRecaptchaV3Token(recaptchaSiteKey, "register_aluno");
      }

      // Validation is already done by the schema and real-time checks
      const result = await registerAluno({
        nome: values.nome,
        email: values.email,
        password: values.password,
        escolaId: values.escola,
        escolaNome: selectedSchoolName,
        cursoId: values.curso,
        cursoNome: selectedCourseName,
        dataNascimento: values.dataNascimento,
        localidade: values.localidade,
        telefone: values.telefone,
        recaptchaToken,
      });
      
      // Redirect to email verification page
      router.push(
        `/verify-email?email=${encodeURIComponent(result.email ?? values.email)}`
      );
    } catch (error) {
      console.error("Erro ao criar conta de aluno:", error);
      setSubmitError(resolveRegisterErrorMessage(error));
    } finally {
      submitLockRef.current = false;
    }
  }

  const handleBackToSchoolSelection = () => {
    setStep("school-selection");
    setSchoolConfig(null);
    form.setValue("escola", "");
    form.setValue("curso", "");
  };

  return (
    <div className="min-h-dvh bg-background flex items-start justify-center px-4 py-8 md:py-12">
      <div className="w-full max-w-lg space-y-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/register">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>

        {step === "school-selection" ? (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Registo de Aluno - Passo 1</CardTitle>
              <CardDescription>Primeiro, selecione a sua escola</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <SchoolSelector
                  schools={schools}
                  value={selectedSchoolId}
                  onChange={(schoolId) => form.setValue("escola", schoolId)}
                  disabled={loadingSchools}
                  placeholder={loadingSchools ? "A carregar escolas..." : "Digite o nome da escola..."}
                  label="Escola"
                />
              </div>

              {selectedSchoolId && schoolConfig && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Requisitos da escola:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {schoolConfig.requireInstitutionalEmail && (
                        <li>Email institucional obrigatório: {schoolConfig.emailDomain}</li>
                      )}
                      {schoolConfig.requiresPhone && (
                        <li>Verificação de telemóvel após verificação de email</li>
                      )}
                      {!schoolConfig.allowGoogleLogin && schoolConfig.requireInstitutionalEmail && (
                        <li>Login com Google não permitido (use email/password)</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full"
                onClick={handleSchoolSelection}
                disabled={!selectedSchoolId || loadingConfig}
              >
                {loadingConfig ? "A carregar..." : "Continuar"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Registo de Aluno - Passo 2</CardTitle>
              <CardDescription>
                Preencha os seus dados para {selectedSchool?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {submitError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                    <span className="text-sm font-medium">Escola: {selectedSchool?.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleBackToSchoolSelection}
                    >
                      Alterar
                    </Button>
                  </div>

                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="O seu nome completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="seu@email.com" {...field} />
                        </FormControl>
                        {emailDomainError && (
                          <p className="text-sm text-red-500">{emailDomainError}</p>
                        )}
                        {schoolConfig?.requireInstitutionalEmail && (
                          <FormDescription>
                            Use o seu email institucional: {schoolConfig.emailDomain}
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Repita a password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="curso"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Curso</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  loadingCourses
                                    ? "A carregar cursos..."
                                    : courses.length === 0
                                      ? "Nenhum curso disponível"
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
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dataNascimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="localidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Localidade (Opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="A sua localidade" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Telefone {schoolConfig?.requiresPhone && "(Obrigatório para SMS)"}
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="O seu contacto" {...field} />
                        </FormControl>
                        {schoolConfig?.requiresPhone && (
                          <FormDescription>
                            A sua escola exige verificação por SMS após a verificação de email.
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {recaptchaSiteKey && (
                    <p className="text-xs text-muted-foreground">
                      Este formulário usa reCAPTCHA para proteção automática.
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      form.formState.isSubmitting ||
                      submitLockRef.current ||
                      Boolean(emailDomainError)
                    }
                  >
                    {form.formState.isSubmitting || submitLockRef.current
                      ? "A criar conta..."
                      : "Criar Conta"}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Após criar a conta, receberá um email de verificação. Só poderá aceder à
                    plataforma após verificar o seu email.
                  </p>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
