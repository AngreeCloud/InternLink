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
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { getRecaptchaV3Token } from "@/lib/recaptcha-v3";
import { signInWithPopup, GoogleAuthProvider, sendEmailVerification, signOut } from "firebase/auth";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Eye, EyeOff, Info } from "lucide-react";
import { SchoolSelector } from "@/components/auth/school-selector";
import type { School, SchoolConfig } from "@/lib/types/school";

const professorSchema = professorRegisterFormSchema;

type RegistrationStep = "school-selection" | "auth-selection" | "registration-form";
type AuthMethod = "password" | "google" | null;

export default function ProfessorRegisterPage() {
  const [step, setStep] = useState<RegistrationStep>("school-selection");
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [googleUserId, setGoogleUserId] = useState("");
  const submitLockRef = useRef(false);
  const googleSignInLockRef = useRef(false);
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
          profileImageUrl: data.profileImageUrl || "",
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
        const data = schoolSnap.data() as any;
        setSchoolConfig({
          requireInstitutionalEmail: Boolean(data.requireInstitutionalEmail),
          emailDomain: data.emailDomain || "",
          allowGoogleLogin: Boolean(data.allowGoogleLogin),
          requiresPhone: Boolean(data.requiresPhone),
          requirePhone: data.requirePhone !== undefined ? Boolean(data.requirePhone) : Boolean(data.requiresPhone),
          requirePhoneVerification:
            data.requirePhoneVerification !== undefined ? Boolean(data.requirePhoneVerification) : Boolean(data.requiresPhone),
        } as unknown as SchoolConfig);
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

  const handleGoogleSignIn = async () => {
    if (googleSignInLockRef.current || !selectedSchoolId || !schoolConfig) {
      return;
    }

    if (!schoolConfig.allowGoogleLogin || schoolConfig.requireInstitutionalEmail) {
      setSubmitError("Login com Google não permitido para esta escola.");
      return;
    }

    googleSignInLockRef.current = true;
    setSubmitError("");

    try {
      const auth = await getAuthRuntime();
      const provider = new GoogleAuthProvider();
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const email = user.email || "";
      const displayName = user.displayName || "";

      // Validate institutional email if required
      if (schoolConfig.requireInstitutionalEmail && schoolConfig.emailDomain) {
        const normalizedEmail = email.trim().toLowerCase();
        const domain = schoolConfig.emailDomain.trim().toLowerCase();
        const expectedDomain = domain.startsWith("@") ? domain : `@${domain}`;

        if (!normalizedEmail.endsWith(expectedDomain)) {
          await signOut(auth);
          setSubmitError(`Esta escola exige email institucional com o domínio ${expectedDomain}`);
          return;
        }
      }

      const generatedPassword = `G${Math.random().toString(36).slice(2)}Aa1!`;
      form.setValue("nome", displayName);
      form.setValue("email", email);
      form.setValue("password", generatedPassword);
      form.setValue("confirmPassword", generatedPassword);
      setGoogleUserId(user.uid);
      setAuthMethod("google");
      setStep("registration-form");
    } catch (error: any) {
      if (error?.code === "auth/popup-closed-by-user" || error?.code === "auth/cancelled-popup-request") {
        setSubmitError("");
        return;
      }

      console.error("Erro no registo Google:", error);
      if (error.code === "auth/email-already-in-use") {
        setSubmitError("Este email já está registado. Faça login em vez de registar.");
      } else {
        setSubmitError("Erro ao registar com Google. Tente novamente.");
      }
    } finally {
      googleSignInLockRef.current = false;
    }
  };

  const handleSchoolSelection = () => {
    if (!selectedSchoolId) {
      return;
    }
    setStep("auth-selection");
  };

  const handleEmailPasswordSelection = () => {
    setAuthMethod("password");
    setGoogleUserId("");
    setSubmitError("");
    setStep("registration-form");
  };

  async function onSubmit(values: z.infer<typeof professorSchema>) {
    if (submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    try {
      setSubmitError("");

      if (authMethod === "google") {
        const auth = await getAuthRuntime();
        const db = await getDbRuntime();
        const user = auth.currentUser;

        if (!user || !googleUserId || user.uid !== googleUserId) {
          throw new Error("Sessão Google inválida. Inicie novamente o registo com Google.");
        }

        await setDoc(doc(db, "users", user.uid), {
          role: "professor",
          nome: values.nome,
          email: values.email,
          escola: selectedSchoolName,
          schoolId: values.escola,
          dataNascimento: values.dataNascimento || "",
          localidade: values.localidade || "",
          telefone: values.telefone || "",
          estado: "pendente",
          emailVerified: user.emailVerified,
          createdAt: serverTimestamp(),
        });

        if (!user.emailVerified) {
          await sendEmailVerification(user);
        }

        router.push(`/verify-email?email=${encodeURIComponent(user.email ?? values.email)}`);
      } else {
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

        router.push(`/verify-email?email=${encodeURIComponent(result.email ?? values.email)}`);
      }
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
    setAuthMethod(null);
    setGoogleUserId("");
    form.setValue("escola", "");
  };

  const handleBackToAuthSelection = () => {
    setStep("auth-selection");
    setSubmitError("");
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
                      {schoolConfig.requirePhoneVerification && (
                        <li>Verificação de telemóvel após verificação de email</li>
                      )}
                      {(!schoolConfig.allowGoogleLogin || schoolConfig.requireInstitutionalEmail) && (
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
        ) : step === "auth-selection" ? (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Registo de Professor - Passo 2</CardTitle>
              <CardDescription>
                Escolha como pretende autenticar para {selectedSchool?.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" onClick={handleEmailPasswordSelection}>
                Continuar com Email e Password
              </Button>

              {schoolConfig?.allowGoogleLogin && !schoolConfig.requireInstitutionalEmail && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={googleSignInLockRef.current}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {googleSignInLockRef.current ? "A autenticar..." : "Continuar com Google"}
                </Button>
              )}

              {(schoolConfig?.requireInstitutionalEmail || !schoolConfig?.allowGoogleLogin) && (
                <p className="text-sm text-muted-foreground">Esta escola não permite registo com Google.</p>
              )}

              {submitError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              <Button type="button" variant="ghost" className="w-full" onClick={handleBackToSchoolSelection}>
                Voltar para escola
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Registo de Professor - Passo 3</CardTitle>
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
                      onClick={handleBackToAuthSelection}
                    >
                      Alterar método
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
                          <Input type="email" placeholder="seu@email.com" disabled={authMethod === "google"} {...field} />
                        </FormControl>
                        {authMethod === "google" && (
                          <FormDescription>Email obtido da conta Google.</FormDescription>
                        )}
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

                  {authMethod !== "google" && (
                    <>
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
                    </>
                  )}

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
                    rules={
                      schoolConfig?.requirePhone
                        ? { required: "O telefone é obrigatório." }
                        : undefined
                    }
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Telefone {schoolConfig?.requirePhone ? "(Obrigatório)" : "(Opcional)"}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="O seu contacto"
                            required={schoolConfig?.requirePhone}
                            {...field}
                          />
                        </FormControl>
                        {schoolConfig?.requirePhoneVerification && (
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
