"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

export default function RootPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    // Signed-in users go to /post-auth so the server org check decides
    // overview vs onboarding; everyone else goes to /login.
    if (isSignedIn) {
      router.replace("/post-auth");
    } else {
      router.replace("/login");
    }
  }, [isLoaded, isSignedIn, router]);

  return null;
}
