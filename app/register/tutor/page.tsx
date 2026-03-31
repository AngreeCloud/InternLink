"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { registerTutor } from "@/actions/register";
import { tutorRegisterFormSchema } from "@/lib/validators/register";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { getRecaptchaV3Token } from "@/lib/recaptcha-v3";
import { isVerificationBypassEnabled } from "@/lib/verification";
import { GoogleAuthProvider, sendEmailVerification, signInWithPopup, signOut } from "firebase/auth";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";

const tutorSchema = tutorRegisterFormSchema;

type RegistrationStep = "auth-selection" | "registration-form";
type AuthMethod = "password" | "google" | null;

export default function TutorRegisterPage() {
  const [step, setStep] = useState<RegistrationStep>("auth-selection");
  const submitLockRef = useRef(false);
  const googleSignInLockRef = useRef(false);
  const [submitError, setSubmitError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [googleUserId, setGoogleUserId] = useState("");
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
  const form = useForm<z.infer<typeof tutorSchema>>({
    resolver: zodResolver(tutorSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      confirmPassword: "",
      empresa: "",
      dataNascimento: "",
      localidade: "",
      telefone: "",
    },
  });

  const router = useRouter();
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

  useEffect(() => {
    if (!recaptchaSiteKey) return;
    void getRecaptchaV3Token(recaptchaSiteKey, "register_tutor_pageview").catch(() => {});
  }, [recaptchaSiteKey]);

  const resolveRegisterErrorMessage = (error: unknown): string => {
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

    return "Erro ao criar conta. Tente novamente.";
  };

  const handleEmailPasswordSelection = () => {
    setAuthMethod("password");
    setGoogleUserId("");
    setSubmitError("");
    setStep("registration-form");
  };

  const handleGoogleSignIn = async () => {
    if (googleSignInLockRef.current) {
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

  async function onSubmit(values: z.infer<typeof tutorSchema>) {
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
          role: "tutor",
          nome: values.nome,
          email: values.email,
          empresa: values.empresa,
          dataNascimento: values.dataNascimento || "",
          localidade: values.localidade || "",
          telefone: values.telefone || "",
          estado: "ativo",
          emailVerified: user.emailVerified,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (!user.emailVerified) {
          await sendEmailVerification(user);
        }

        if (!user.emailVerified && !isVerificationBypassEnabled()) {
          router.push(`/verify-email?email=${encodeURIComponent(user.email ?? values.email)}`);
        } else {
          router.push("/tutor");
        }
      } else {
        let recaptchaToken = "";
        if (recaptchaSiteKey) {
          recaptchaToken = await getRecaptchaV3Token(recaptchaSiteKey, "register_tutor");
        }

        const result = await registerTutor({
          nome: values.nome,
          email: values.email,
          password: values.password,
          empresa: values.empresa,
          dataNascimento: values.dataNascimento,
          localidade: values.localidade,
          telefone: values.telefone,
          recaptchaToken,
        });

        if (isVerificationBypassEnabled()) {
          router.push("/tutor");
        } else {
          router.push(`/verify-email?email=${encodeURIComponent(result.email ?? values.email)}`);
        }
      }
    } catch (error) {
      console.error("Erro ao criar conta de tutor:", error);
      setSubmitError(resolveRegisterErrorMessage(error));
    } finally {
      submitLockRef.current = false;
    }
  }

  const handleBackToAuthSelection = () => {
    setStep("auth-selection");
    setSubmitError("");

    if (authMethod === "google") {
      void (async () => {
        const auth = await getAuthRuntime();
        await signOut(auth);
      })();
    }
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

        {step === "auth-selection" ? (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Registo de Tutor - Passo 1</CardTitle>
              <CardDescription>Escolha como pretende autenticar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" onClick={handleEmailPasswordSelection}>
                Continuar com Email e Password
              </Button>

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

              {submitError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Registo de Tutor - Passo 2</CardTitle>
              <CardDescription>Preencha os seus dados para criar a conta de tutor.</CardDescription>
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

                  <div className="flex items-center justify-between rounded-md bg-muted p-3">
                    <span className="text-sm font-medium">
                      Método: {authMethod === "google" ? "Google" : "Email e Password"}
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={handleBackToAuthSelection}>
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
                          <Input placeholder="O seu nome" {...field} />
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
                          <Input type="email" placeholder="teu@email.com" disabled={authMethod === "google"} {...field} />
                        </FormControl>
                        {authMethod === "google" && <FormDescription>Email obtido da conta Google.</FormDescription>}
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
                    name="empresa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Empresa</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome da sua empresa" {...field} />
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
                        <FormLabel>Telefone (Opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="O seu contacto" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {recaptchaSiteKey && authMethod !== "google" && (
                    <p className="text-xs text-muted-foreground">Este formulário usa reCAPTCHA para proteção automática.</p>
                  )}

                  <Button type="submit" className="w-full mt-1" disabled={form.formState.isSubmitting || submitLockRef.current}>
                    {form.formState.isSubmitting || submitLockRef.current ? "A registar..." : "Criar Conta"}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
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
