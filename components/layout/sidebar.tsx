"use client";

import type React from "react";
import { PanelLeftClose } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type SidebarProps = {
  children: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
};

export function Sidebar({ children, collapsed, onToggle, sidebarOpen, setSidebarOpen }: SidebarProps) {
  return (
    <>
      <div
        className={[
          "hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300",
          collapsed ? "lg:w-[72px]" : "lg:w-72",
        ].join(" ")}
      >
        <div
          className={[
            "flex grow flex-col gap-y-6 overflow-y-auto border-r border-border bg-card pb-4 transition-all duration-300",
            collapsed ? "px-3" : "px-6",
          ].join(" ")}
        >
          {children}
          <button
            type="button"
            onClick={onToggle}
            className={[
              "flex items-center gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
              collapsed ? "justify-center" : "",
            ].join(" ")}
            title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          >
            <PanelLeftClose
              className={[
                "h-4 w-4 shrink-0 transition-transform duration-300",
                collapsed ? "rotate-180" : "",
              ].join(" ")}
            />
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <div className="flex h-full flex-col bg-card px-6 pb-4 overflow-y-auto">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
