"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { CorporateSidebar } from "@/components/shared/corporate-sidebar";
import { cn } from "@/lib/utils";

export default function ReportingLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, sidebarCollapsed } = useAppStore();

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-white flex">
      <CorporateSidebar />
      <div
        className={cn(
          "flex-1 min-h-screen bg-white flex flex-col transition-[margin-left] duration-300 ease-in-out",
          sidebarCollapsed ? "ml-16" : "ml-64",
        )}
      >
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
