"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthMiddleware } from "@/components/shared/auth-middleware";
import { WelcomeOverlay } from "@/components/shared/welcome-overlay";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WelcomeOverlay />
      <AuthMiddleware>{children}</AuthMiddleware>
    </QueryClientProvider>
  );
}
