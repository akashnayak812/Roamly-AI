"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className={cn("flex-1 ml-[240px] min-h-screen overflow-x-hidden", className)}>
        {children}
      </main>
    </div>
  );
}
