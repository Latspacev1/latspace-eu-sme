// Client-side fetch helper for dashboard data routes. The Clerk session lives
// in cookies shared with the server, so we just forward credentials and let
// the server resolve the caller (and their org) from the session cookie.
//
// The exported name/signature is kept identical so existing callers are
// unaffected.
export function dashboardFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, credentials: "same-origin" });
}
