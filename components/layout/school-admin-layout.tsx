"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { SchoolAdminProvider } from "@/components/school-admin/school-admin-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckSquare, Folder, GraduationCap, History, Home, Info, LogOut, Menu } from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/school-admin", icon: Home },
  { name: "Informações da Escola", href: "/school-admin/informacoes", icon: Info },
  { name: "Aprovações", href: "/school-admin/aprovacoes", icon: CheckSquare },
  { name: "Histórico", href: "/school-admin/historico", icon: History },
  { name: "Cursos", href: "/school-admin/cursos", icon: Folder },
];

type AuthState = {
  loading: boolean;
  userId: string;
  schoolId: string;
  name: string;
  email: string;
};

export function SchoolAdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [state, setState] = useState<AuthState>({
    loading: true,
    userId: "",
    schoolId: "",
    name: "",
    email: "",
  });
  const router = useRouter();

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setState((prev) => ({ ...prev, loading: false }));
          router.replace("/login");
          return;
        }

        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists()) {
          setState((prev) => ({ ...prev, loading: false }));
          router.replace("/login");
          return;
        }

        const data = userSnap.data() as {
          role?: string;
          schoolId?: string;
          nome?: string;
          email?: string;
        };

        if (data.role !== "admin_escolar" || !data.schoolId) {
          setState((prev) => ({ ...prev, loading: false }));
          router.replace("/login");
          return;
        }

        setState({
          loading: false,
          userId: user.uid,
          schoolId: data.schoolId,
          name: data.nome || user.displayName || "Administrador Escolar",
          email: data.email || user.email || "",
        });
      });
    })();

    return () => unsubscribe();
  }, [router]);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p>A validar acesso...</p>
      </div>
    );
  }

  if (!state.userId || !state.schoolId) {
    return null;
  }

  return (
    <SchoolAdminProvider
      value={{
        userId: state.userId,
        schoolId: state.schoolId,
        name: state.name,
        email: state.email,
      }}
    >
      <div className="min-h-screen bg-muted/20">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <div className="flex h-full flex-col bg-card">
              <div className="flex h-16 items-center gap-2 px-6 border-b border-border">
                <GraduationCap className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm font-semibold">InternLink</p>
                  <p className="text-xs text-muted-foreground">Admin Escolar</p>
                </div>
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

        <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
          <div className="flex grow flex-col gap-y-6 overflow-y-auto border-r border-border bg-card px-6">
            <div className="flex h-16 items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm font-semibold">InternLink</p>
                <p className="text-xs text-muted-foreground">Admin Escolar</p>
              </div>
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

        <div className="lg:pl-72">
          <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b border-border bg-background/95 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex flex-1 items-center justify-end gap-3">
              <div className="flex items-center gap-3 rounded-full border border-border bg-card px-3 py-1">
                <Avatar className="h-7 w-7">
                  <AvatarFallback>{state.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <p className="text-xs font-semibold text-foreground">{state.name}</p>
                  <p className="text-[11px] text-muted-foreground">{state.email}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const auth = await getAuthRuntime();
                  await signOut(auth);
                  router.replace("/login");
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>

          <main className="py-10">
            <div className="px-4 sm:px-6 lg:px-8">{children}</div>
          </main>
        </div>
      </div>
    </SchoolAdminProvider>
  );
}
