import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { getActiveMembership } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PostAuthPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const membership = await getActiveMembership();
  redirect(membership ? "/corporate/overview" : "/onboarding");

  return null;
}
