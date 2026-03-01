"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  GraduationCap,
  FileText,
  MessageSquare,
  LogOut,
  Menu,
  Home,
  Upload,
  User,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Protocolos", href: "/dashboard/protocols", icon: FileText },
  { name: "Relatórios", href: "/dashboard/reports", icon: Upload },
  { name: "Chat", href: "/dashboard/chat", icon: MessageSquare },
]

interface DashboardLayoutProps {
  children: React.ReactNode
}

type AuthState = {
  loading: boolean
  userId: string
  name: string
  email: string
  photoURL: string
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [state, setState] = useState<AuthState>({
    loading: true,
    userId: "",
    name: "",
    email: "",
    photoURL: "",
  })
  const router = useRouter()

  useEffect(() => {
    let unsubscribe = () => {}

    ;(async () => {
      const auth = await getAuthRuntime()
      const db = await getDbRuntime()

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setState((prev) => ({ ...prev, loading: false }))
          router.replace("/login")
          return
        }

        const userSnap = await getDoc(doc(db, "users", user.uid))
        if (!userSnap.exists()) {
          setState((prev) => ({ ...prev, loading: false }))
          router.replace("/login")
          return
        }

        const data = userSnap.data() as {
          role?: string
          estado?: string
          nome?: string
          email?: string
          photoURL?: string
        }

        if (data.role === "admin_escolar") {
          setState((prev) => ({ ...prev, loading: false }))
          router.replace("/school-admin")
          return
        }

        if (data.role !== "aluno") {
          setState((prev) => ({ ...prev, loading: false }))
          router.replace("/account-status")
          return
        }

        if (data.estado !== "ativo") {
          setState((prev) => ({ ...prev, loading: false }))
          router.replace("/waiting")
          return
        }

        setState({
          loading: false,
          userId: user.uid,
          name: data.nome || user.displayName || "Aluno",
          email: data.email || user.email || "",
          photoURL: data.photoURL || "",
        })
      })
    })()

    return () => unsubscribe()
  }, [router])

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p>A validar acesso...</p>
      </div>
    )
  }

  if (!state.userId) {
    return null
  }

  const user = {
    name: state.name,
    email: state.email,
    avatar: state.photoURL,
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center gap-2 px-6 border-b border-border">
              <GraduationCap className="h-6 w-6 text-primary" />
              <span className="font-semibold text-foreground">InternLink</span>
            </div>
            <nav className="flex-1 space-y-1 p-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6">
          <div className="flex h-16 shrink-0 items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="font-semibold text-card-foreground">InternLink</span>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-card px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile">
                      <User className="mr-2 h-4 w-4" />
                      <span>Perfil</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      const auth = await getAuthRuntime()
                      await signOut(auth)
                      router.replace("/login")
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
