"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useAppStore } from "@/lib/store/useAppStore";
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
  const { isLoaded, isSignedIn } = useAuth();
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/login");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) return null;

  if (!isSignedIn) {
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
