// ChartSpec — the contract between the LLM and the renderer.
//
// Everything the AI dashboard produces is a ChartSpec. Inline chat charts and
// pinned dashboard tiles both render from the same spec, so the schema doubles
// as the persisted shape for `dashboard_tiles.spec`.
//
// Keep this file tight — broaden the schema only when the renderer can
// actually paint the new variant. Speculative fields invite invalid persisted
// rows that the renderer can't honour.

import { z } from "zod";

export const ChartKindSchema = z.enum(["trend", "bar", "kpi", "stacked", "pie"]);
export type ChartKind = z.infer<typeof ChartKindSchema>;

export const GranularitySchema = z.enum(["monthly", "annual"]);
export type Granularity = z.infer<typeof GranularitySchema>;

export const ChartOptionsSchema = z.object({
  color: z.string().optional(),
  stacked: z.boolean().optional(),
}).strict();

export const ChartSpecSchema = z.object({
  kind: ChartKindSchema,
  title: z.string().min(1).max(120),
  period_code: z.string().min(1).max(40),
  parameter_codes: z.array(z.string().min(1)).min(1).max(8),
  granularity: GranularitySchema,
  options: ChartOptionsSchema.optional(),
}).strict();

export type ChartSpec = z.infer<typeof ChartSpecSchema>;

// ── Data envelope returned alongside a spec ────────────────────────────────
// The chat endpoint fetches the actual numbers and ships them inline so the
// chart can paint without a follow-up request. Pinned tiles refetch live
// from the metrics/timeseries endpoints, so this envelope is transient
// for inline rendering.

export interface ChartSeriesPoint {
  label: string;          // "Jan", "FY2025", etc.
  value: number | null;
}

export interface ChartSeries {
  code: string;
  display_name: string;
  unit: string;
  points: ChartSeriesPoint[];
}

export interface ChartData {
  period_label: string;
  series: ChartSeries[];
}
