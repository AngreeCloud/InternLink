"use client";

import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { getAuthRuntime } from "@/lib/firebase-runtime";
import { computePasswordStrength } from "@/lib/auth/password-strength";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, ShieldAlert, Eye, EyeOff, Loader2 } from "lucide-react";

export function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const strength = computePasswordStrength(newPassword);
  const passwordsMatch = confirmPassword === newPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword.length > 0 &&
    passwordsMatch &&
    !submitting;

  const handleChangePassword = async () => {
    setError("");
    setSuccess(false);
    setSubmitting(true);
    try {
      const auth = await getAuthRuntime();
      const user = auth.currentUser;
      if (!user || !user.email) {
        setError("Sessão não encontrada. Faça login novamente.");
        return;
      }
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, currentPassword)
      );
      await updatePassword(user, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        setError("A palavra-passe atual está incorreta.");
      } else if (e.code === "auth/weak-password") {
        setError("A nova palavra-passe é muito fraca.");
      } else if (e.code === "auth/requires-recent-login") {
        setError("Sessão expirou. Faça login novamente.");
      } else {
        setError(e.message || "Erro ao alterar palavra-passe.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Segurança
        </CardTitle>
        <CardDescription>
          Altere a sua palavra-passe. Deve ter pelo menos 8 caracteres com maiúsculas, minúsculas, números e símbolos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Palavra-passe alterada com sucesso!
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="currentPassword">Palavra-passe atual</Label>
          <div className="relative">
            <Input
              id="currentPassword"
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="A sua palavra-passe atual"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPassword">Nova palavra-passe</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nova palavra-passe (mín. 8 caracteres)"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {newPassword && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${strength.score * 25}%`,
                      backgroundColor:
                        strength.score <= 1 ? "#ef4444" :
                        strength.score === 2 ? "#f59e0b" :
                        strength.score === 3 ? "#65a30d" :
                        "#059669",
                    }}
                  />
                </div>
                <span className={`text-xs font-medium ${strength.textClass}`}>
                  {strength.label}
                </span>
              </div>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                <li className={newPassword.length >= 8 ? "text-green-600" : ""}>
                  Pelo menos 8 caracteres
                </li>
                <li className={/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? "text-green-600" : ""}>
                  Maiúsculas e minúsculas
                </li>
                <li className={/\d/.test(newPassword) ? "text-green-600" : ""}>
                  Pelo menos um número
                </li>
                <li className={/[^A-Za-z0-9]/.test(newPassword) ? "text-green-600" : ""}>
                  Pelo menos um símbolo
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar nova palavra-passe</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova palavra-passe"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {confirmPassword && newPassword && !passwordsMatch && (
            <p className="text-xs text-red-500">As palavras-passe não coincidem.</p>
          )}
        </div>

        <Button onClick={handleChangePassword} disabled={!canSubmit} className="w-full">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              A alterar...
            </>
          ) : (
            "Alterar palavra-passe"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
