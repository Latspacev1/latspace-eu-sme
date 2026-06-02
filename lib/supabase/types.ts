// Types for the generic, multi-tenant metrics schema. Mirror of
// supabase/migrations/0001_chaincraft_vsme.sql as amended by
// 0004_genericize_org_scoping.sql (org_id scoping + free-text section).
// If you regenerate Supabase types via the CLI, replace this file with the
// generated one.

export type ParamCategory = "input" | "emission_factor" | "output";

// --- Multi-tenant org schema (migration 0005, Clerk-keyed) ------------------
// Identity is handled by Clerk; user ids are TEXT (e.g. "user_2abc..."). There
// is no auth.users FK and no app_users mirror. See lib/auth/session.ts for the
// runtime Membership shape used by the auth seam.

export type MembershipRole = "owner" | "admin" | "member";

// organizations(id uuid, name, slug, created_by text /* Clerk user id */, ...)
// onboarding_profile (jsonb, migration 0006) holds the OnboardingProfile shape
// from lib/types/onboarding.ts — surfaced in the AI Context page.
export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  created_by: string | null;
  onboarding_profile: import("@/lib/types/onboarding").OnboardingProfile | null;
  created_at: string;
}

// memberships(user_id text /* Clerk id */, org_id uuid -> organizations, role text)
export interface Membership {
  id: string;
  user_id: string;
  org_id: string;
  role: MembershipRole;
  created_at: string;
}

// section was an enum (param_section) in the single-tenant schema; 0004 retyped
// it to free text so extraction can invent per-org sections. The curated VSME
// section names still live in lib/metrics/param-sections.ts.

export interface ReportingPeriod {
  id: string;
  org_id: string;
  code: string;
  label: string;
  start_date: string;
  end_date: string;
  status: "open" | "locked" | "filed";
  is_current: boolean;
  created_at: string;
}

export interface Parameter {
  id: string;
  org_id: string;
  code: string;
  display_name: string;
  unit: string;
  category: ParamCategory;
  section: string;
  vsme_cell: string | null;
  source_note: string | null;
  is_monthly: boolean;
  is_calculated: boolean;
  display_order: number;
  created_at: string;
}

export interface DataPoint {
  id: string;
  org_id: string;
  period_id: string;
  parameter_id: string;
  value_annual: number | null;
  values_monthly: (number | null)[] | null;
  notes: string | null;
  source_file: string | null;
  entered_by: string | null;
  entered_at: string;
  updated_at: string;
}

export interface Formula {
  id: string;
  org_id: string;
  output_param_id: string;
  expression: string;
  expression_human: string | null;
  dependencies: string[];
  description: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
}

export interface CalculatedMetric {
  id: string;
  org_id: string;
  period_id: string;
  parameter_id: string;
  formula_id: string;
  value: number | null;
  trace: {
    inputs: Record<string, number>;
    expression: string;
  } | null;
  computed_at: string;
  is_stale: boolean;
}

// View row
export interface CurrentMetricRow {
  org_id: string;
  period_id: string;
  period_code: string;
  parameter_id: string;
  parameter_code: string;
  display_name: string;
  unit: string;
  section: string;
  vsme_cell: string | null;
  value: number | null;
  trace: CalculatedMetric["trace"];
  is_stale: boolean;
  computed_at: string;
}

// Provenance row for an uploaded document (extraction_documents table).
export interface ExtractionDocument {
  id: string;
  org_id: string;
  period_id: string | null;
  storage_path: string;
  filename: string;
  mime_type: string;
  status: "pending" | "committed" | "failed";
  proposal: unknown | null;
  created_at: string;
}
