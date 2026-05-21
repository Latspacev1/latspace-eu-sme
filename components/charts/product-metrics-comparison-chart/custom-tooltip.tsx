import type { TooltipProps } from "recharts";
import { cn } from "@/lib/utils";
import { BASELINE_COLOR, CURRENT_COLOR, type ChartDataItem } from "./constants";

export function CustomTooltip({
  active,
  payload,
}: TooltipProps<number, string> & {
  payload?: Array<{ payload?: ChartDataItem }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  return (
    <div className="border bg-white p-3 shadow-lg">
      <p className="font-medium text-sm mb-2">
        {data?.product} - {data?.metric}
      </p>
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3"
            style={{ backgroundColor: BASELINE_COLOR }}
          />
          <span className="text-gray-500">Baseline:</span>
          <span className="font-medium">
            {data?.baseline != null
              ? `${data.baseline.toLocaleString()} ${data.unit}`
              : "N/A"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3"
            style={{ backgroundColor: CURRENT_COLOR }}
          />
          <span className="text-gray-500">Current:</span>
          <span className="font-medium">
            {data?.current != null
              ? `${data.current.toLocaleString()} ${data.unit}`
              : "N/A"}
          </span>
        </div>
        {data?.change != null && (
          <div className="flex items-center gap-2 pt-1 border-t">
            <span className="text-gray-500">Change:</span>
            <span
              className={cn(
                "font-medium",
                data.change > 0
                  ? "text-green-600"
                  : data.change < 0
                    ? "text-red-600"
                    : "text-gray-600",
              )}
            >
              {data.change > 0 ? "+" : ""}
              {data.change}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
