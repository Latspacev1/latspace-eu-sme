// Root Next.js middleware — Clerk authentication + route protection.
//
// Clerk owns identity. Everything is protected EXCEPT the sign-in / sign-up
// pages and Clerk's own internal routes. Unauthenticated users hitting a
// protected route are redirected to /login (Clerk's sign-in page) by
// auth.protect().
//
// Post-sign-in routing (onboarding vs. overview) is handled by the /post-auth
// server route, which Clerk redirects to via NEXT_PUBLIC_CLERK_*_FALLBACK_
// REDIRECT_URL — not here, so middleware stays free of DB/membership lookups.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes accessible without authentication.
const isPublicRoute = createRouteMatcher([
  "/login(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and all static assets unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
