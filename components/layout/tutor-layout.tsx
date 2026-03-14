"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GraduationCap, Inbox, LayoutDashboard, LogOut, MessageSquare, User } from "lucide-react";

type AuthState = {
  loading: boolean;
  userId: string;
  name: string;
  email: string;
  empresa: string;
  photoURL: string;
};

export function TutorLayout({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    userId: "",
    name: "",
    email: "",
    empresa: "",
    photoURL: "",
  });
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { href: "/tutor", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tutor/inbox", label: "Caixa de Entrada", icon: Inbox },
    { href: "/tutor/chat", label: "Chat", icon: MessageSquare },
    { href: "/tutor/documentos", label: "Documentos", icon: User },
  ];

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
          estado?: string;
          nome?: string;
          email?: string;
          empresa?: string;
          photoURL?: string;
        };

        if (data.role !== "tutor") {
          setState((prev) => ({ ...prev, loading: false }));
          router.replace("/login");
          return;
        }

        setState({
          loading: false,
          userId: user.uid,
          name: data.nome || user.displayName || "Tutor",
          email: data.email || user.email || "",
          empresa: data.empresa || "",
          photoURL: data.photoURL || "",
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

  if (!state.userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 border-b border-border bg-card px-4 shadow-sm sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <div>
              <p className="text-sm font-semibold">InternLink</p>
              <p className="text-xs text-muted-foreground">Tutor</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/tutor" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "inline-flex items-center rounded-md px-3 py-1.5 text-sm transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={state.photoURL || "/placeholder.svg"} alt={state.name} />
                  <AvatarFallback>{state.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{state.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {state.empresa ? `${state.empresa} • ` : ""}
                    {state.email}
                  </p>
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
                  const auth = await getAuthRuntime();
                  await signOut(auth);
                  router.replace("/login");
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <main className="py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
