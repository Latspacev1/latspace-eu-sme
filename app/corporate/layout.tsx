"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store/useAppStore";
import { useHasHydrated } from "@/lib/hooks/useHasHydrated";
import { CorporateSidebar } from "@/components/shared/corporate-sidebar";
import { PageHeader } from "@/components/shared/page-header";
import { RouteRefresh } from "@/components/shared/route-refresh";
import { cn } from "@/lib/utils";

export default function CorporateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, sidebarCollapsed } = useAppStore();
  const hasHydrated = useHasHydrated();

  useEffect(() => {
    if (!hasHydrated) return;

    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated) return null;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white flex">
      <RouteRefresh />
      <CorporateSidebar />
      <div
        className={cn(
          "flex-1 min-h-screen bg-white flex flex-col transition-[margin-left] duration-300 ease-in-out",
          sidebarCollapsed ? "ml-16" : "ml-64"
        )}
      >
        <PageHeader
          showBackButton={false}
          backButtonLabel="Back to Overview"
          backButtonHref="/corporate/overview"
        />

        {/* Main Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
