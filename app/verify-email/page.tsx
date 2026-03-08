"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { onAuthStateChanged, sendEmailVerification } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

export default function EmailVerificationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState({
    loading: true,
    email: "",
    verified: false,
    error: "",
    resendCooldown: 0,
  });
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const email = searchParams.get("email") || state.email;

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setState((s) => ({ ...s, loading: false, error: "Não autenticado" }));
          router.replace("/login");
          return;
        }

        const userEmail = user.email || email;
        setState((s) => ({ ...s, email: userEmail, loading: false }));

        // Check if email is already verified
        if (user.emailVerified) {
          await user.getIdToken(true);

          // Check if user document exists
          const userDocSnap = await getDoc(doc(db, "users", user.uid));

          if (userDocSnap.exists()) {
            // User already has a document, redirect to appropriate page
            const userData = userDocSnap.data() as { role?: string; estado?: string };
            redirectBasedOnRole(userData.role || "", userData.estado || "");
          } else {
            // User verified email but no document exists yet
            // Check pendingRegistrations and create user document
            await createUserDocumentFromPending(user.uid, db);
          }
        } else {
          // Email not verified, set up periodic check
          setupEmailVerificationCheck(user.uid);
        }
      });
    })();

    return () => {
      unsubscribe();
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, [router, email]);

  const setupEmailVerificationCheck = (userId: string) => {
    // Check every 3 seconds
    checkIntervalRef.current = setInterval(async () => {
      const auth = await getAuthRuntime();
      const user = auth.currentUser;

      if (!user) return;

      // Reload user to get fresh emailVerified status
      await user.reload();

      if (user.emailVerified) {
        await user.getIdToken(true);
        setState((s) => ({ ...s, verified: true }));

        // Clear interval
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }

        // Create user document
        const db = await getDbRuntime();
        await createUserDocumentFromPending(userId, db);
      }
    }, 3000);
  };

  const createUserDocumentFromPending = async (userId: string, db: any) => {
    try {
      const auth = await getAuthRuntime();
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }

      // Get pending registration data
      const pendingSnap = await getDoc(doc(db, "pendingRegistrations", userId));

      if (!pendingSnap.exists()) {
        setState((s) => ({ ...s, error: "Dados de registo não encontrados" }));
        return;
      }

      const pendingData = pendingSnap.data();
      const role = pendingData.role;

      // Create user document
      const userDoc = {
        ...pendingData,
        emailVerified: true,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", userId), userDoc);

      // For professors, also create pendingTeachers entry
      if (role === "professor" && pendingData.schoolId) {
        await setDoc(
          doc(db, "schools", pendingData.schoolId, "pendingTeachers", userId),
          {
            name: pendingData.nome,
            email: pendingData.email,
            role: "teacher",
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      // Delete pending registration
      await deleteDoc(doc(db, "pendingRegistrations", userId));

      // Redirect based on role
      redirectBasedOnRole(role, pendingData.estado || "");
    } catch (error) {
      console.error("Erro ao criar documento de utilizador:", error);
      setState((s) => ({ ...s, error: "Erro ao criar conta. Tente novamente." }));
    }
  };

  const redirectBasedOnRole = (role: string, estado: string) => {
    if (role === "admin_escolar") {
      router.replace("/school-admin");
    } else if (role === "aluno") {
      if (estado === "ativo") {
        router.replace("/dashboard");
      } else {
        router.replace("/waiting");
      }
    } else if (role === "professor") {
      if (estado === "ativo") {
        router.replace("/professor");
      } else {
        router.replace("/account-status");
      }
    } else if (role === "tutor") {
      if (estado === "ativo") {
        router.replace("/tutor");
      } else {
        router.replace("/account-status");
      }
    } else {
      router.replace("/account-status");
    }
  };

  const handleResendEmail = async () => {
    if (state.resendCooldown > 0) return;

    try {
      const auth = await getAuthRuntime();
      const user = auth.currentUser;

      if (!user) {
        setState((s) => ({ ...s, error: "Não autenticado" }));
        return;
      }

      await sendEmailVerification(user);

      // Set cooldown (60 seconds)
      setState((s) => ({ ...s, resendCooldown: 60, error: "" }));

      // Start cooldown countdown
      cooldownIntervalRef.current = setInterval(() => {
        setState((s) => {
          const newCooldown = s.resendCooldown - 1;
          if (newCooldown <= 0 && cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current);
          }
          return { ...s, resendCooldown: newCooldown };
        });
      }, 1000);
    } catch (error: any) {
      console.error("Erro ao reenviar email:", error);
      const message =
        error.code === "auth/too-many-requests"
          ? "Muitas tentativas. Aguarde alguns minutos."
          : "Erro ao reenviar email. Tente novamente.";
      setState((s) => ({ ...s, error: message }));
    }
  };

  if (state.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
            <p className="text-center mt-4 text-muted-foreground">A carregar...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            {state.verified ? (
              <CheckCircle className="h-16 w-16 text-green-500" />
            ) : (
              <Mail className="h-16 w-16 text-primary" />
            )}
          </div>
          <CardTitle className="text-center">
            {state.verified ? "Email Verificado!" : "Verifique o seu Email"}
          </CardTitle>
          <CardDescription className="text-center">
            {state.verified
              ? "A criar a sua conta..."
              : "Enviámos um email de verificação para o seu endereço"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!state.verified && (
            <>
              {state.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  <strong>Email:</strong> {email}
                </p>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Verifique a sua caixa de entrada</li>
                      <li>Clique no link de verificação no email</li>
                      <li>Volte a esta página (será redirecionado automaticamente)</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <div className="pt-2">
                  <p className="text-sm text-muted-foreground text-center mb-2">
                    Não recebeu o email?
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleResendEmail}
                    disabled={state.resendCooldown > 0}
                  >
                    {state.resendCooldown > 0
                      ? `Aguarde ${state.resendCooldown}s`
                      : "Reenviar Email"}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Esta página verifica automaticamente se o seu email foi verificado.
                </p>
              </div>
            </>
          )}

          {state.verified && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Email verificado com sucesso! A preparar a sua conta...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
