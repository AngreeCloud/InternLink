"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { logoutWithServerSession } from "@/lib/auth/client-session";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/sidebar";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Home,
  LogOut,
  Menu,
  Headset,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const navItems = [
  { name: "Tickets", href: "/support", icon: Headset },
];

export function SupportLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ uid: string; email: string; displayName: string } | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggle } = useSidebarCollapsed();

  function isActiveRoute(href: string) {
    if (href === "/support") return pathname === "/support";
    return pathname.startsWith(href);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (cancelled) return;
        if (!firebaseUser) { setLoading(false); router.replace("/login"); return; }

        try {
          const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (!userSnap.exists()) { setLoading(false); router.replace("/login"); return; }
          const userData = userSnap.data() as { role?: string; nome?: string };
          if (userData.role !== "support") { setLoading(false); router.replace("/login"); return; }

          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: userData.nome || firebaseUser.displayName || "Support",
          });
          setRole(userData.role);
        } catch { /* ignore */ } finally {
          if (!cancelled) setLoading(false);
        }
      });
      return () => { cancelled = true; unsubscribe(); };
    })();
  }, [router]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await logoutWithServerSession(); router.push("/login"); } catch { setLoggingOut(false); }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (!user || role !== "support") return null;

  return (
    <div className="min-h-screen bg-muted/20">
      <Sidebar collapsed={collapsed} onToggle={toggle} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
        <div className="flex h-16 shrink-0 items-center transition-all duration-300 gap-x-3">
          <Headset className="h-7 w-7 text-primary shrink-0" />
          {!collapsed && <div className="leading-tight"><p className="text-sm font-semibold">InternLink</p><p className="text-xs text-muted-foreground">Support</p></div>}
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="-mx-2 space-y-1">
            {navItems.map((item) => (
              <li key={item.name}>
                <Link href={item.href} className={["flex items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors", collapsed ? "justify-center" : "", isActiveRoute(item.href) ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"].join(" ")}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-border pt-2">
          <Button variant="ghost" className={["w-full text-muted-foreground hover:text-destructive", collapsed ? "justify-center px-2" : "justify-start"].join(" ")} onClick={handleLogout} disabled={loggingOut}>
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="ml-2">{loggingOut ? "A sair..." : "Logout"}</span>}
          </Button>
        </div>
      </Sidebar>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <div className="flex h-full flex-col bg-card">
            <div className="flex items-center gap-x-2 px-6 pt-4 pb-2">
              <Headset className="h-6 w-6 text-primary shrink-0" />
              <div className="leading-tight"><p className="text-sm font-semibold">InternLink</p><p className="text-xs text-muted-foreground">Support</p></div>
            </div>
            <nav className="flex-1 px-2 pt-4">
              <ul role="list" className="space-y-1">
                {navItems.map((item) => (
                  <li key={item.name}>
                    <Link href={item.href} onClick={() => setSidebarOpen(false)} className={["flex items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors", isActiveRoute(item.href) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"].join(" ")}>
                      <item.icon className="h-4 w-4 shrink-0" /><span>{item.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </SheetContent>
      </Sheet>

      <div className={`transition-all duration-300 ${collapsed ? "lg:pl-[72px]" : "lg:pl-72"}`}>
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-card px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></Button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8"><AvatarFallback>{user.displayName?.charAt(0) || "S"}</AvatarFallback></Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal"><div className="flex flex-col space-y-1"><p className="text-sm font-medium leading-none">{user.displayName}</p><p className="text-xs leading-none text-muted-foreground">{user.email}</p></div></DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} disabled={loggingOut}><LogOut className="mr-2 h-4 w-4" /><span>{loggingOut ? "A sair..." : "Sair"}</span></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
