"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Mail, Lock } from "lucide-react"
import Link from "next/link"
import { signInWithEmailAndPassword } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime"
import { useRouter } from "next/navigation"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const auth = await getAuthRuntime()
      const db = await getDbRuntime()
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Check if email is verified
      if (!user.emailVerified) {
        // User needs to verify email first
        router.push(`/verify-email?email=${encodeURIComponent(user.email || email)}`)
        return
      }

      // Email is verified, check if user document exists
      const userSnap = await getDoc(doc(db, "users", user.uid))
      
      if (!userSnap.exists()) {
        // User verified email but doesn't have document yet
        // This can happen if they verified but didn't complete the flow
        // Redirect to verify-email page which will create the document
        router.push(`/verify-email?email=${encodeURIComponent(user.email || email)}`)
        return
      }

      const userData = userSnap.data() as { role?: string; estado?: string }
      const role = userData.role || ""
      const estado = userData.estado || ""

      if (role === "admin_escolar") {
        router.push("/school-admin")
      } else if (role === "aluno" && estado !== "ativo") {
        router.push("/waiting")
      } else if (role === "aluno") {
        router.push("/dashboard")
      } else if (role === "professor" && estado === "ativo") {
        router.push("/professor")
      } else if (role === "tutor" && estado === "ativo") {
        router.push("/tutor")
      } else {
        router.push("/account-status")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message.includes("Firebase config") ? message : "Erro ao fazer login. Verifique as suas credenciais e tente novamente.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Entrar</CardTitle>
        <CardDescription className="text-center">Entre com as suas credenciais para aceder à plataforma</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="teu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Palavra-passe</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Esqueceu-se da password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="A tua palavra-passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full mt-1" disabled={isLoading}>
            {isLoading ? "A entrar..." : "Entrar"}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Não tem uma conta?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Registe-se
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}
