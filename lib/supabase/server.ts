// Server-side Supabase clients.
//   - getSupabaseServerClient(): user-scoped, reads cookies (RLS enforced).
//   - getSupabaseServiceClient(): SERVICE ROLE — bypasses RLS. Use only in
//     route handlers / server actions that perform admin tasks like recalc.

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Set inside a Route Handler — fine to ignore here.
        }
      },
    },
  });
}

export function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "The service-role client is server-only.",
    );
  }
  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
