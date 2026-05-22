// Stable identity for a ChartSpec — used by both the chat surfaces (to dim
// the Pin button when a chart is already pinned) and the grid (as the
// canonical "is this pinned?" lookup key). Sort parameter_codes so order
// doesn't change the key.

import type { ChartSpec } from "@/lib/dashboard/chart-spec";

export function specKey(spec: ChartSpec): string {
  return [
    spec.kind,
    spec.period_code,
    spec.granularity,
    [...spec.parameter_codes].sort().join(","),
  ].join("|");
}
