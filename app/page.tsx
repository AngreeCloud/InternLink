import { LoginForm } from "@/components/auth/login-form"
import { GraduationCap } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-primary/10 rounded-full">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">FCT Platform</h1>
          <p className="text-muted-foreground mt-2">Gestão de Estágios Curriculares</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
