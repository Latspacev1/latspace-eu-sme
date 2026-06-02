"use client";
import React from "react";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useAppStore } from "@/lib/store/useAppStore";

// Server-side protection is handled by middleware.ts (clerkMiddleware). This
// component is a thin client-side layer that syncs the Clerk session into the
// store and provides a minimal redirect fallback for protected routes.
const PUBLIC_ROUTES = ["/login", "/sign-up"];

function isPublicRoute(pathname: string | null): boolean {
  const path = pathname || "";
  return PUBLIC_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));
}

export function AuthMiddleware({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn, user } = useUser();
  const setSession = useAppStore((s) => s.setSession);
  const setCompanyName = useAppStore((s) => s.setCompanyName);

  // Sync the Clerk session into the store.
  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && user) {
      setSession({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        fullName: user.fullName ?? null,
        avatarUrl: user.imageUrl ?? null,
      });
    } else {
      setSession(null);
    }
  }, [isLoaded, isSignedIn, user, setSession]);

  // Resolve the active organization (company) name server-side. The Clerk
  // session only carries the user's identity, so the company name comes from
  // the membership/org record via /api/onboarding.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetch("/api/onboarding")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { orgName?: string | null } | null) => {
        if (!cancelled && data?.orgName) setCompanyName(data.orgName);
      })
      .catch(() => {
        // Non-fatal: UI falls back to a neutral label when the name is absent.
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user?.id, setCompanyName]);

  // Client-side fallback redirect for protected routes.
  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) return;
    if (isPublicRoute(pathname)) return;
    router.push("/login");
  }, [isLoaded, isSignedIn, pathname, router]);

  return <>{children}</>;
}
