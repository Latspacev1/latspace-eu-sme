"use client";
import React from "react";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store/useAppStore";
import { authApi } from "@/lib/api/auth";

function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const store = useAppStore as any;

    if (store.persist?.hasHydrated?.()) {
      setHydrated(true);
    } else {
      const unsub = store.persist?.onFinishHydration?.(() => {
        setHydrated(true);
      });
      const timeout = setTimeout(() => setHydrated(true), 300);
      return () => {
        unsub?.();
        clearTimeout(timeout);
      };
    }
  }, []);

  return hydrated;
}

const PUBLIC_ROUTES = ["/login"];

export function AuthMiddleware({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, token, refreshToken, logout } = useAppStore();
  const hasHydrated = useHasHydrated();
  const hasVerified = useRef(false);

  // Redirect unauthenticated users (runs on hydration + auth state changes)
  useEffect(() => {
    if (!hasHydrated) return;
    if (PUBLIC_ROUTES.includes(pathname || "")) return;

    if (!isAuthenticated || !token) {
      if (pathname !== "/login") {
        router.push("/login");
      }
    }
  }, [hasHydrated, isAuthenticated, token, pathname, router]);

  // Verify token once on app load, not on every navigation
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !token || hasVerified.current) return;

    const verify = async () => {
      try {
        const result = await authApi.verifyToken();

        if (!result.success) {
          // 401 = token expired/invalid
          if (result._status === 401) {
            const refreshed = await refreshToken();
            if (!refreshed) {
              await logout();
              router.push("/login");
            }
          }
          // _status=0 or 502 = backend down/network error — can't verify token, force re-login
          else if (result._status === 0 || result._status === 502) {
            await logout();
            router.push("/login");
          }
          return;
        }

        const payload = result.data as any;
        if (payload?.exp) {
          const timeUntilExpiry = payload.exp * 1000 - Date.now();
          const tenMinutes = 10 * 60 * 1000;
          if (timeUntilExpiry > 0 && timeUntilExpiry < tenMinutes) {
            await refreshToken();
          }
        }
      } catch {
        // Network/unexpected error — force re-login since we can't verify auth
        await logout();
        router.push("/login");
      }
    };

    hasVerified.current = true;
    verify();
  }, [hasHydrated, isAuthenticated, token, refreshToken, logout, router]);

  // Periodic token refresh (every 30 minutes)
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const id = setInterval(async () => {
      if (!PUBLIC_ROUTES.includes(pathname || "")) {
        await refreshToken();
      }
    }, 30 * 60 * 1000);

    return () => clearInterval(id);
  }, [isAuthenticated, token, pathname, refreshToken]);

  return <>{children}</>;
}
