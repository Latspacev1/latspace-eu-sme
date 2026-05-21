"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * RouteRefresh component - triggers a router refresh on every route change
 * to ensure fresh data is loaded and prevent stale data visibility
 */
export function RouteRefresh() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Refresh the route to fetch fresh data from the server
    router.refresh();
  }, [pathname, router]);

  return null;
}
