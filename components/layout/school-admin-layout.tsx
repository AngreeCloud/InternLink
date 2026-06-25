"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { logoutWithServerSession, waitForLogoutTransition } from "@/lib/auth/client-session";
import { SchoolAdminProvider } from "@/components/school-admin/school-admin-context";
import { LogoutOverlay } from "@/components/layout/logout-overlay"
import { TRANSITION_PORTAL_MS } from "@/components/layout/access-validation-overlay";
import { ChatNavUnreadBadge } from "@/components/chat/chat-nav-unread-badge";
import { NotificationsInbox } from "@/components/chat/notifications-inbox";
import { useChatNotifications } from "@/lib/chat/use-chat-notifications";
import { SchoolAdminApprovalsBadge } from "@/components/school-admin/school-admin-approvals-badge";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/sidebar";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckSquare, Folder, GraduationCap, History, Home, Info, LogOut, Menu, MessageSquare, Users, Building2, User } from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/school-admin", icon: Home },
  { name: "Informações da Escola", href: "/school-admin/informacoes", icon: Info },
  { name: "Aprovações", href: "/school-admin/aprovacoes", icon: CheckSquare },
  { name: "E. Educação", href: "/school-admin/encarregados", icon: Users },
  { name: "Empresas", href: "/school-admin/empresas", icon: Building2 },
  { name: "Chat", href: "/school-admin/chat", icon: MessageSquare },
  { name: "Histórico", href: "/school-admin/historico", icon: History },
  { name: "Cursos", href: "/school-admin/cursos", icon: Folder },
];

type AuthState = {
  loading: boolean;
  userId: string;
  schoolId: string;
  name: string;
  email: string;
  photoURL: string;
};

export function SchoolAdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { collapsed, toggle: toggleSidebar } = useSidebarCollapsed();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [state, setState] = useState<AuthState>({
    loading: true,
    userId: "",
    schoolId: "",
    name: "",
    email: "",
    photoURL: "",
  });
  const router = useRouter();
  const pathname = usePathname();

  const isActiveRoute = (href: string) => {
    if (href === "/school-admin") {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isChatPage = isActiveRoute("/school-admin/chat");

  const { notifications, handleOpenConversation } = useChatNotifications({
    userId: state.userId,
    enabled: !isChatPage,
    isChatOpen: isChatPage,
    onOpenConversation: (conversationId) => {
      router.push(`/school-admin/chat?conversationId=${conversationId}`);
    },
  });

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setState((prev) => ({ ...prev, loading: false }));
          return;
        }

        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists()) {
          setState((prev) => ({ ...prev, loading: false }));
          return;
        }

        const data = userSnap.data() as {
          role?: string;
          schoolId?: string;
          nome?: string;
          email?: string;
          photoURL?: string;
        };

        if (data.role !== "admin_escolar" || !data.schoolId) {
          setState((prev) => ({ ...prev, loading: false }));
          return;
        }

        setState({
          loading: false,
          userId: user.uid,
          schoolId: data.schoolId,
          name: data.nome || user.displayName || "Administrador Escolar",
          email: data.email || user.email || "",
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
        {isLoggingOut ? <LogoutOverlay /> : null}
        <Sidebar
          collapsed={collapsed}
          onToggle={toggleSidebar}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        >
          <div className={`flex h-16 shrink-0 items-center transition-all duration-300 ${collapsed ? "justify-center" : "gap-x-3"}`}>
            <GraduationCap className="h-7 w-7 text-primary" />
            {!collapsed && (
              <div className="leading-tight">
                <p className="text-sm font-semibold">InternLink</p>
                <p className="text-xs text-muted-foreground">Admin Escolar</p>
              </div>
            )}
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={[
                          "flex items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors",
                          collapsed ? "justify-center" : "",
                          isActiveRoute(item.href)
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        ].join(" ")}
                        aria-current={isActiveRoute(item.href) ? "page" : undefined}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.name}</span>}
                        {!collapsed && item.href === "/school-admin/chat" && (
                          <ChatNavUnreadBadge userId={state.userId} isActive={isActiveRoute(item.href)} />
                        )}
                        {!collapsed && item.href === "/school-admin/aprovacoes" && (
                          <SchoolAdminApprovalsBadge schoolId={state.schoolId} isActive={isActiveRoute(item.href)} />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </nav>
        </Sidebar>

        <div className={`transition-all duration-300 ${collapsed ? "lg:pl-[72px]" : "lg:pl-72"}`}>
          <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b border-border bg-background/95 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex flex-1 items-center justify-end gap-3">
              <NotificationsInbox notifications={notifications} onOpenChat={handleOpenConversation} />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={state.photoURL || undefined} alt={state.name} />
                      <AvatarFallback>{state.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{state.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{state.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/school-admin/perfil">
                      <User className="mr-2 h-4 w-4" />
                      <span>Perfil</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      setIsLoggingOut(true);
                      const logoutPromise = logoutWithServerSession({ deferClientSignOutMs: 150 });
                      await waitForLogoutTransition(logoutPromise, TRANSITION_PORTAL_MS);
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
            <div className="px-4 sm:px-6 lg:px-8">{children}</div>
          </main>
        </div>
      </div>
    </SchoolAdminProvider>
  );
}
