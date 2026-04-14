"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Mail, Lock } from "lucide-react"
import Link from "next/link"
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime"
import { getRecaptchaV3Token } from "@/lib/recaptcha-v3"
import { finalizePendingRegistration, isVerificationBypassEnabled } from "@/lib/verification"
import { createServerSession } from "@/lib/auth/client-session"
import { getLoginRedirectRoute } from "@/lib/auth/status-routing"
import { useRouter } from "next/navigation"
import { AccessValidationOverlay } from "@/components/layout/access-validation-overlay"

async function verifyRecaptchaToken(token: string, action: "login_password" | "login_google") {
  const response = await fetch("/api/recaptcha/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, action }),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("Falha ao validar CAPTCHA.")
  }

  const data = (await response.json()) as { success?: boolean }
  if (!data.success) {
    throw new Error("Verificação CAPTCHA falhou. Tente novamente.")
  }
}

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const googleLockRef = useRef(false)
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""

  useEffect(() => {
    if (!recaptchaSiteKey) return
    void getRecaptchaV3Token(recaptchaSiteKey, "login_pageview").catch(() => {})
  }, [recaptchaSiteKey])

  const resetGoogleLoginState = () => {
    googleLockRef.current = false
    setIsGoogleLoading(false)
  }

  const redirectBasedOnRole = (role: string, estado: string) => {
    const href = getLoginRedirectRoute(role, estado)
    router.prefetch(href)
    router.push(href)
  }

  const handleGoogleLogin = async () => {
    if (googleLockRef.current) return
    
    googleLockRef.current = true
    setError("")
    let didNavigate = false

    try {
      if (recaptchaSiteKey) {
        const recaptchaToken = await getRecaptchaV3Token(recaptchaSiteKey, "login_google")
        await verifyRecaptchaToken(recaptchaToken, "login_google")
      }

      const auth = await getAuthRuntime()
      const db = await getDbRuntime()
      const provider = new GoogleAuthProvider()
      
      const result = await signInWithPopup(auth, provider)
      const user = result.user
      const userEmail = user.email || ""
      const verificationBypassEnabled = isVerificationBypassEnabled()

      setIsGoogleLoading(true)

      if (!user.emailVerified && !verificationBypassEnabled) {
        didNavigate = true
        router.push(`/verify-email?email=${encodeURIComponent(userEmail)}`)
        return
      }

      // Check if user document exists
      const userSnap = await getDoc(doc(db, "users", user.uid))
      let userData = userSnap.exists()
        ? (userSnap.data() as { role?: string; estado?: string; schoolId?: string })
        : null
      
      if (!userData) {
        if (verificationBypassEnabled && !user.emailVerified) {
          const pendingSnap = await getDoc(doc(db, "pendingRegistrations", user.uid))

          if (!pendingSnap.exists()) {
            await signOut(auth)
            setError("Não encontrámos uma conta associada a este login Google. Registe-se para continuar.")
            return
          }

          const pendingData = pendingSnap.data() as { role?: string; estado?: string; schoolId?: string }
          userData = {
            role: pendingData.role,
            estado: pendingData.estado,
            schoolId: pendingData.schoolId,
          }
        } else {
        const finalizedUser = await finalizePendingRegistration(db, user.uid, {
          markEmailVerified: user.emailVerified,
        })

        if (!finalizedUser) {
          await signOut(auth)
          setError("Não encontrámos uma conta associada a este login Google. Registe-se para continuar.")
          return
        }

        userData = finalizedUser
        }
      }

      const role = userData.role || ""
      const estado = userData.estado || ""
      const schoolId = userData.schoolId || ""

      // Check school settings for Google login restrictions
      if (schoolId) {
        const schoolSnap = await getDoc(doc(db, "schools", schoolId))

        if (!schoolSnap.exists()) {
          await signOut(auth)
          setError("Login com Google indisponível: configuração da sua escola não permite login com Google.")
          return
        }

        const schoolData = schoolSnap.data() as {
          requireInstitutionalEmail?: boolean
          allowGoogleLogin?: boolean
        }

        if (schoolData.requireInstitutionalEmail) {
          await signOut(auth)
          setError("Login com Google indisponível: a sua escola exige login com email institucional.")
          return
        }

        if (schoolData.allowGoogleLogin === false) {
          await signOut(auth)
          setError("Login com Google indisponível: a sua escola não permite login com Google.")
          return
        }
      }

      const session = await createServerSession(user)
      didNavigate = true
      redirectBasedOnRole(session.role || role, session.estado || estado)
    } catch (err: any) {
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
        setError("")
        return
      }

      console.error("Erro no login com Google:", err)

      if (err.code === "auth/account-exists-with-different-credential") {
        setError("Já existe uma conta associada a este email. Inicie sessão com email e password.")
      } else {
        const message = err instanceof Error ? err.message : String(err)
        setError(message.includes("Firebase config") ? message : "Erro ao fazer login com Google. Tente novamente.")
      }
    } finally {
      if (!didNavigate) {
        resetGoogleLoginState()
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      if (recaptchaSiteKey) {
        const recaptchaToken = await getRecaptchaV3Token(recaptchaSiteKey, "login_password")
        await verifyRecaptchaToken(recaptchaToken, "login_password")
      }

      const auth = await getAuthRuntime()
      const db = await getDbRuntime()
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      const verificationBypassEnabled = isVerificationBypassEnabled()

      // Check if email is verified
      if (!user.emailVerified && !verificationBypassEnabled) {
        // User needs to verify email first
        router.push(`/verify-email?email=${encodeURIComponent(user.email || email)}`)
        return
      }

      const userSnap = await getDoc(doc(db, "users", user.uid))
      if (!userSnap.exists()) {
        const finalizedUser = await finalizePendingRegistration(db, user.uid, {
          markEmailVerified: user.emailVerified,
        })

        if (!finalizedUser) {
          await signOut(auth)
          setError("Não encontrámos uma conta associada a este login. Registe-se para continuar.")
          return
        }
      }

      const session = await createServerSession(user)
      setIsLoading(true)
      redirectBasedOnRole(session.role, session.estado)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message.includes("Firebase config") ? message : "Erro ao fazer login. Verifique as suas credenciais e tente novamente.")
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || isGoogleLoading) {
    return <AccessValidationOverlay />
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
          <Button type="submit" className="w-full mt-1" disabled={isSubmitting || isLoading}>
            {isSubmitting ? "A entrar..." : "Entrar"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Ou</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading || isLoading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {isGoogleLoading ? "A entrar..." : "Entrar com Google"}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Não tem uma conta?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Registe-se
            </Link>
          </div>

          {recaptchaSiteKey && (
            <p className="text-center text-xs text-muted-foreground">Este formulário usa reCAPTCHA para proteção automática.</p>
          )}
        </CardFooter>
      </form>
    </Card>
  )
}
