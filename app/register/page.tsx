"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { GraduationCap, User, Briefcase, School } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type UserType = "aluno" | "professor" | "tutor"

export default function RegisterPage() {
  const router = useRouter()

  const go = (type: UserType) => {
    if (type === "aluno") router.push("/register/aluno")
    if (type === "professor") router.push("/register/professor")
    if (type === "tutor") router.push("/register/tutor")
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/">Voltar</Link>
        </Button>
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-primary/10 rounded-full">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Criar Conta</h1>
          <p className="text-muted-foreground mt-2">Selecione o tipo de utilizador para continuar</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => go("aluno")}>
            <CardHeader className="items-center text-center">
              <User className="h-8 w-8 text-primary" />
              <CardTitle className="text-lg">Aluno</CardTitle>
              <CardDescription>Registo para alunos</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Continuar</Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => go("professor")}>
            <CardHeader className="items-center text-center">
              <School className="h-8 w-8 text-primary" />
              <CardTitle className="text-lg">Professor</CardTitle>
              <CardDescription>Registo para professores</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
                Continuar
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => go("tutor")}>
            <CardHeader className="items-center text-center">
              <Briefcase className="h-8 w-8 text-primary" />
              <CardTitle className="text-lg">Tutor</CardTitle>
              <CardDescription>Registo para tutores</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
                Continuar
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Já tem uma conta?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </div>
      </div>
    </div>
  )
}
