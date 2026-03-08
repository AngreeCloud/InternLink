"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { registerProfessor } from "@/actions/register";
import { professorRegisterFormSchema } from "@/lib/validators/register";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { getRecaptchaV3Token } from "@/lib/recaptcha-v3";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Eye, EyeOff, Info } from "lucide-react";
import { SchoolSelector } from "@/components/auth/school-selector";
import type { School, SchoolConfig } from "@/lib/types/school";

const professorSchema = professorRegisterFormSchema;

type RegistrationStep = "school-selection" | "registration-form";

export default function ProfessorRegisterPage() {
  const [step, setStep] = useState<RegistrationStep>("school-selection");
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const submitLockRef = useRef(false);
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

  const form = useForm<z.infer<typeof professorSchema>>({
    resolver: zodResolver(professorSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      confirmPassword: "",
      escola: "",
      dataNascimento: "",
      localidade: "",
      telefone: "",
    },
  });

  const router = useRouter();
  const selectedSchoolId = form.watch("escola");
  const emailValue = form.watch("email");
  const passwordValue = form.watch("password") ?? "";
  const confirmPasswordValue = form.watch("confirmPassword") ?? "";

  const passwordStrength = useMemo(() => {
    const password = passwordValue;
    if (!password) {
      return { score: 0, label: "Ainda sem avaliação", textClass: "text-muted-foreground" };
    }

    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { score, label: "Fraca", textClass: "text-red-500" };
    if (score === 2) return { score, label: "Média", textClass: "text-amber-500" };
    if (score === 3) return { score, label: "Boa", textClass: "text-lime-600" };
    return { score, label: "Forte", textClass: "text-emerald-600" };
  }, [passwordValue]);

  const passwordsMatch = confirmPasswordValue.length > 0 && passwordValue === confirmPasswordValue;

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

  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === selectedSchoolId),
    [schools, selectedSchoolId]
  );

  const selectedSchoolName = selectedSchool?.name || "";

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
    void getRecaptchaV3Token(recaptchaSiteKey, "register_professor_pageview").catch(() => {});
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

  async function onSubmit(values: z.infer<typeof professorSchema>) {
    if (submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    try {
      setSubmitError("");

      let recaptchaToken = "";
      if (recaptchaSiteKey) {
        recaptchaToken = await getRecaptchaV3Token(recaptchaSiteKey, "register_professor");
      }

      const result = await registerProfessor({
        nome: values.nome,
        email: values.email,
        password: values.password,
        escolaId: values.escola,
        escolaNome: selectedSchoolName,
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
      console.error("Erro ao criar conta de professor:", error);
      setSubmitError(resolveRegisterErrorMessage(error));
    } finally {
      submitLockRef.current = false;
    }
  }

  const handleBackToSchoolSelection = () => {
    setStep("school-selection");
    setSchoolConfig(null);
    form.setValue("escola", "");
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
              <CardTitle>Registo de Professor - Passo 1</CardTitle>
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
              <CardTitle>Registo de Professor - Passo 2</CardTitle>
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
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Mínimo 6 caracteres"
                              className="pr-12"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                              onClick={() => setShowPassword((prev) => !prev)}
                              aria-label={showPassword ? "Esconder password" : "Mostrar password"}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <div className="space-y-1">
                          <div className="h-2 w-full overflow-hidden rounded bg-muted">
                            <div
                              className={`h-full transition-all ${
                                passwordStrength.score <= 1
                                  ? "bg-red-500"
                                  : passwordStrength.score === 2
                                    ? "bg-amber-500"
                                    : passwordStrength.score === 3
                                      ? "bg-lime-500"
                                      : "bg-emerald-500"
                              }`}
                              style={{ width: `${passwordStrength.score * 25}%` }}
                            />
                          </div>
                          <p className={`text-xs ${passwordStrength.textClass}`}>
                            Segurança da password: {passwordStrength.label}
                          </p>
                        </div>
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
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Repita a password"
                              className="pr-12"
                              {...field}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                              onClick={() => setShowConfirmPassword((prev) => !prev)}
                              aria-label={showConfirmPassword ? "Esconder confirmação da password" : "Mostrar confirmação da password"}
                            >
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        {confirmPasswordValue.length > 0 && (
                          <p className={`text-xs ${passwordsMatch ? "text-emerald-600" : "text-red-500"}`}>
                            {passwordsMatch ? "Passwords correspondem." : "Passwords diferentes."}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dataNascimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento (Opcional)</FormLabel>
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
