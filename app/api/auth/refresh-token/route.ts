import { NextRequest, NextResponse } from "next/server";
import { buildPayload, expIn, tokenForExp } from "@/lib/demo-user";

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer demo-token-")) {
    return NextResponse.json(
      { success: false, message: "Invalid token" },
      { status: 401 },
    );
  }

  const exp = expIn(60 * 60 * 24);
  return NextResponse.json({
    success: true,
    message: "Token refreshed",
    data: { token: tokenForExp(exp), payload: buildPayload(exp) },
  });
}
