import type { MetricInfo } from "@/lib/api/product-metrics";

export interface ChartDataItem {
  name: string;
  baseline: number | null;
  current: number | null;
  unit: string;
  change: number | null;
  product: string;
  metric: string;
}

// Default metrics - cement-specific metrics first since they have data
export const DEFAULT_METRICS: MetricInfo[] = [
  { key: "production", display_name: "Production", unit: "MT" },
  { key: "clinker_factor", display_name: "Clinker Factor", unit: "%" },
  { key: "total_additives", display_name: "Total Additives Used", unit: "MT" },
  { key: "clinker_used", display_name: "Clinker Used (Estimated)", unit: "MT" },
  { key: "sold_to_market", display_name: "Sold to Market", unit: "MT" },
  { key: "sec_electrical", display_name: "Electrical SEC", unit: "kWh/ton" },
  { key: "sec_thermal", display_name: "Thermal SEC", unit: "GJ/ton" },
  { key: "sec_total", display_name: "Total SEC", unit: "GJ/ton" },
];

// Color palette for baseline and current year bars
export const BASELINE_COLOR = "#94a3b8"; // slate-400
export const CURRENT_COLOR = "#0d9488"; // teal-600
