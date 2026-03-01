"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { getAuthRuntime } from "@/lib/firebase-runtime";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);

    try {
      const auth = await getAuthRuntime();
      auth.languageCode = "pt";
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("user-not-found") || message.includes("invalid-email")) {
        setError("Não foi encontrada uma conta com este email.");
      } else {
        setError("Erro ao enviar email de recuperação. Tente novamente.");
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao login
          </Link>
        </Button>

        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Recuperar Password</CardTitle>
            <CardDescription className="text-center">
              Insira o email associado à sua conta para receber um link de redefinição de password.
            </CardDescription>
          </CardHeader>
          {success ? (
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <h3 className="text-lg font-medium text-foreground">Email enviado!</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Se existir uma conta com o email <strong>{email}</strong>, receberá um link para
                  redefinir a sua password. Verifique também a pasta de spam.
                </p>
              </div>
              <Button asChild className="w-full">
                <Link href="/login">Voltar ao login</Link>
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="teu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-4">
                <Button type="submit" className="w-full mt-1" disabled={isLoading}>
                  {isLoading ? "A enviar..." : "Enviar Link de Recuperação"}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  Lembrou-se da password?{" "}
                  <Link href="/login" className="text-primary hover:underline">
                    Entrar
                  </Link>
                </div>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
