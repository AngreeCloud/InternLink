"use client"

import Link from "next/link"
import { LoginForm } from "@/components/auth/login-form"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">Voltar</Link>
        </Button>
        <LoginForm />
      </div>
    </div>
  )
}
