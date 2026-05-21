"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store/useAppStore";
import { useHasHydrated } from "@/lib/hooks/useHasHydrated";
import { CorporateSidebar } from "@/components/shared/corporate-sidebar";
import { NotificationsBell } from "@/components/shared/notifications-bell";
import { RouteRefresh } from "@/components/shared/route-refresh";

export default function ApprovalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated } = useAppStore();
  const hasHydrated = useHasHydrated();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) router.push("/login");
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-white flex">
      <RouteRefresh />
      <CorporateSidebar />
      <div className="flex-1 ml-64 min-h-screen bg-white flex flex-col">
        {/* Top Header Bar - matches sidebar logo height */}
        <header className="sticky top-0 z-30 bg-white border-b border-[#0A0A0A]/[0.06] h-24 flex items-center px-8">
          <div className="flex items-center justify-end w-full">
            <NotificationsBell />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
