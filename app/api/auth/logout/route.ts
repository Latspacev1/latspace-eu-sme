import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, message: "Password login has been removed. Use Google sign-in." },
    { status: 410 },
  );
}
