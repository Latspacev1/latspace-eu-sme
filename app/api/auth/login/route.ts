import { NextRequest, NextResponse } from "next/server";
import { DEMO_USER, buildPayload, expIn, tokenForExp } from "@/lib/demo-user";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json(
      { success: false, message: "Invalid request" },
      { status: 400 },
    );
  }

  const email = body.email.trim().toLowerCase();
  if (email !== DEMO_USER.email) {
    return NextResponse.json(
      { success: false, message: "User not found", error: "user not found" },
      { status: 401 },
    );
  }

  if (body.password !== DEMO_USER.password) {
    return NextResponse.json(
      { success: false, message: "Invalid password", error: "invalid password" },
      { status: 401 },
    );
  }

  const exp = expIn(60 * 60 * 24);
  return NextResponse.json({
    success: true,
    message: "Login successful",
    data: { token: tokenForExp(exp), payload: buildPayload(exp) },
  });
}
