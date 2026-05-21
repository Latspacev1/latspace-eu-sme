"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store/useAppStore";

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated } = useAppStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/corporate/overview");
    } else {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  return null;
}
