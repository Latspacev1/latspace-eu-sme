// Types for the ChainCraft VSME schema. Mirror of supabase/migrations/0001_chaincraft_vsme.sql.
// If you regenerate Supabase types via the CLI, replace this file with the generated one.

export type ParamCategory = "input" | "emission_factor" | "output";

export type ParamSection =
  // Input sections
  | "energy"
  | "feedstock"
  | "water"
  | "wastewater"
  | "air"
  | "hazardous_waste"
  | "workforce"
  | "governance"
  | "conversion"
  // Output (VSME) sections
  | "vsme_b3_energy"
  | "vsme_b3_scope1"
  | "vsme_b3_scope2"
  | "vsme_b3_scope3"
  | "vsme_b3_consolidated"
  | "vsme_b6_water"
  | "vsme_b4_pollution"
  | "vsme_b7_waste"
  | "vsme_b7_materials"
  | "vsme_b8_b11_workforce_gov";

export interface ReportingPeriod {
  id: string;
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
  code: string;
  display_name: string;
  unit: string;
  category: ParamCategory;
  section: ParamSection;
  vsme_cell: string | null;
  source_note: string | null;
  is_monthly: boolean;
  is_calculated: boolean;
  display_order: number;
  created_at: string;
}

export interface DataPoint {
  id: string;
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
  period_id: string;
  period_code: string;
  parameter_id: string;
  parameter_code: string;
  display_name: string;
  unit: string;
  section: ParamSection;
  vsme_cell: string | null;
  value: number | null;
  trace: CalculatedMetric["trace"];
  is_stale: boolean;
  computed_at: string;
}
