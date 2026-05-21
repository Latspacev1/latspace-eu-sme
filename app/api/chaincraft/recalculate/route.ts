// POST /api/chaincraft/recalculate
// Body: { period?: "FY2025" }  (defaults to the current period)
// Triggers a full re-evaluation of all formulas for the period and writes
// results into calculated_metrics.

import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { recalculatePeriod } from "@/lib/chaincraft/recalculate";

export async function POST(req: Request) {
  let body: { period?: string } = {};
  try {
    body = (await req.json()) as { period?: string };
  } catch {
    // empty body is fine — fall back to current period
  }

  let periodCode = body.period;
  if (!periodCode) {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("reporting_periods")
      .select("code")
      .eq("is_current", true)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "No current reporting period. Pass { period: 'FY2025' } in the body." },
        { status: 400 },
      );
    }
    periodCode = data.code as string;
  }

  if (!periodCode) {
    return NextResponse.json({ error: "Could not resolve period" }, { status: 400 });
  }

  try {
    const result = await recalculatePeriod(periodCode);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
