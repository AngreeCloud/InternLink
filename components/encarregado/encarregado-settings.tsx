"use client";

import { useEffect, useRef, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Loader2, Lock, User } from "lucide-react";

export function EncarregadoSettings() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [nomeLoading, setNomeLoading] = useState(false);
  const [nomeSaved, setNomeSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user || !active) {
          if (active) setLoading(false);
          return;
        }

        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists() || !active) {
          setLoading(false);
          return;
        }
        const data = snap.data() as { nome?: string; email?: string };
        setNome(data.nome || "");
        setEmail(data.email || user.email || "");
        setLoading(false);
      });
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleSaveNome = async () => {
    if (!nome.trim()) return;
    setNomeLoading(true);
    try {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();
      const user = auth.currentUser;
      if (!user) return;
      await updateDoc(doc(db, "users", user.uid), { nome: nome.trim() });
      setNomeSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setNomeSaved(false), 3000);
    } catch (err) {
      console.error("[EE settings save nome]", err);
    } finally {
      setNomeLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    if (newPassword.length < 8) {
      setPasswordError("A nova password deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("As passwords não coincidem.");
      return;
    }
    setPasswordLoading(true);
    try {
      const auth = await getAuthRuntime();
      const user = auth.currentUser;
      if (!user || !user.email) return;

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setPasswordError("Password atual incorreta.");
      } else if (code === "auth/weak-password") {
        setPasswordError("A nova password é demasiado fraca.");
      } else {
        setPasswordError("Erro ao alterar a password. Tente novamente.");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerir os dados da sua conta de Encarregado de Educação.</p>
      </div>

      {/* Dados pessoais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            Dados pessoais
          </CardTitle>
          <CardDescription>Atualize o seu nome de apresentação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (não editável)</Label>
            <Input id="email" value={email} readOnly disabled className="text-muted-foreground" />
          </div>
          <Button onClick={handleSaveNome} disabled={nomeLoading || !nome.trim()}>
            {nomeLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A guardar...</>
            ) : nomeSaved ? (
              <><CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />Guardado</>
            ) : (
              "Guardar alterações"
            )}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Alterar password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            Alterar password
          </CardTitle>
          <CardDescription>Por segurança, insira a sua password atual antes de definir uma nova.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Password atual</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar nova password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {passwordError && (
            <p className="text-sm text-destructive">{passwordError}</p>
          )}
          <Button
            onClick={handleChangePassword}
            disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
          >
            {passwordLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />A alterar...</>
            ) : passwordSaved ? (
              <><CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />Password alterada</>
            ) : (
              "Alterar password"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
