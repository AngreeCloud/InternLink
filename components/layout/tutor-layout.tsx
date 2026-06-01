"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { logoutWithServerSession, waitForLogoutTransition } from "@/lib/auth/client-session";
import { LogoutOverlay } from "@/components/layout/logout-overlay";
import { TRANSITION_PORTAL_MS } from "@/components/layout/access-validation-overlay";
import { ChatNavUnreadBadge } from "@/components/chat/chat-nav-unread-badge";
import { NotificationsInbox } from "@/components/chat/notifications-inbox";
import { useChatNotifications } from "@/lib/chat/use-chat-notifications";
import { usePendingSummaries } from "@/lib/estagios/use-pending-summaries";
import { usePendingRequests } from "@/lib/estagios/use-pending-requests";
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
import {
  Briefcase,
  CalendarClock,
  ChevronDown,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  User,
  FileText,
} from "lucide-react";

type AuthState = {
  loading: boolean;
  userId: string;
  name: string;
  email: string;
  empresa: string;
  photoURL: string;
};

export function TutorLayout({ children }: { children: React.ReactNode }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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
    { href: "/tutor", label: "Home", icon: LayoutDashboard },
    {
      group: "Gestão",
      icon: Briefcase,
      children: [
        { href: "/tutor/estagios", label: "Estágios", icon: Briefcase },
        { href: "/tutor/sumarios", label: "Validação de sumários", icon: FileText, badge: "summaries" },
        { href: "/tutor/solicitacoes-horario", label: "Sol. Mudança Hor.", icon: CalendarClock, badge: "requests" },
      ],
    },
    {
      group: "Comunicação",
      icon: MessageSquare,
      children: [
        { href: "/tutor/chat", label: "Chat", icon: MessageSquare, badge: "chat" },
        { href: "/tutor/inbox", label: "Caixa de Entrada", icon: Inbox },
      ],
    },
    { href: "/tutor/documentos", label: "Documentos", icon: User },
  ];

  const isChatPage = pathname === "/tutor/chat" || pathname.startsWith("/tutor/chat/");

  const pendingSummariesCount = usePendingSummaries(state.userId);
  const pendingRequestsCount = usePendingRequests(state.userId);
  const totalGestaoCount = pendingSummariesCount + pendingRequestsCount;

  const { notifications, handleOpenConversation } = useChatNotifications({
    userId: state.userId,
    enabled: !isChatPage,
    isChatOpen: isChatPage,
    onOpenConversation: (conversationId) => {
      router.push(`/tutor/chat?conversationId=${conversationId}`);
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
          estado?: string;
          nome?: string;
          email?: string;
          empresa?: string;
          photoURL?: string;
        };

        if (data.role !== "tutor") {
          setState((prev) => ({ ...prev, loading: false }));
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
      {isLoggingOut ? <LogoutOverlay /> : null}
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
            {navItems.map((item, index) => {
              if (item.group) {
                const isGroupActive = item.children?.some(
                  (child) => pathname === child.href || pathname.startsWith(`${child.href}/`)
                );
                const Icon = item.icon;

                return (
                  <DropdownMenu key={`group-${index}`}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={[
                          "inline-flex items-center rounded-md px-3 py-1.5 text-sm transition-colors",
                          isGroupActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted",
                        ].join(" ")}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{item.group}</span>
                        {item.group === "Gestão" && totalGestaoCount > 0 && (
                          <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                            {totalGestaoCount}
                          </span>
                        )}
                        {item.group === "Comunicação" && (
                          <ChatNavUnreadBadge
                            userId={state.userId}
                            isActive={Boolean(isGroupActive)}
                          />
                        )}
                        <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[200px]">
                      {item.children?.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                        return (
                          <DropdownMenuItem key={child.href} asChild>
                            <Link href={child.href} className="flex w-full items-center justify-between">
                              <div className="flex items-center">
                                <ChildIcon className="mr-2 h-4 w-4" />
                                <span className={isChildActive ? "font-semibold" : ""}>{child.label}</span>
                              </div>
                              {child.badge === "summaries" && pendingSummariesCount > 0 && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                                  {pendingSummariesCount}
                                </span>
                              )}
                              {child.badge === "requests" && pendingRequestsCount > 0 && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                                  {pendingRequestsCount}
                                </span>
                              )}
                              {child.badge === "chat" && (
                                <div className="ml-2">
                                  <ChatNavUnreadBadge
                                    userId={state.userId}
                                    isActive={isChildActive}
                                  />
                                </div>
                              )}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              const Icon = item.icon!;
              // @ts-ignore
              const active = pathname === item.href || (item.href !== "/tutor" && pathname.startsWith(item.href));
              return (
                <Link
                  // @ts-ignore
                  key={item.href}
                  // @ts-ignore
                  href={item.href}
                  className={[
                    "inline-flex items-center rounded-md px-3 py-1.5 text-sm transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {/* @ts-ignore */}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
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
      </div>

      <main className="py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
