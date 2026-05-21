import { cn } from "@/lib/utils";

interface ValueDisplayProps {
  value: number | string;
  unit?: string;
  label?: string;
  /** Number of decimal places (default: 2) */
  precision?: number;
  /** Shows +/- prefix and colors based on sign */
  showDelta?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "text-sm",
  md: "text-xl",
  lg: "text-2xl",
} as const;

export function ValueDisplay({
  value,
  unit,
  label,
  precision = 2,
  showDelta = false,
  size = "md",
  className,
}: ValueDisplayProps) {
  const numericValue = typeof value === "number" ? value : parseFloat(value);
  const formattedValue =
    typeof value === "number" ? value.toFixed(precision) : value;

  const deltaColor = showDelta
    ? numericValue > 0
      ? "text-emerald-600"
      : numericValue < 0
        ? "text-destructive"
        : "text-muted-foreground"
    : "";

  const deltaPrefix = showDelta
    ? numericValue > 0
      ? "-"
      : numericValue < 0
        ? "+"
        : ""
    : "";

  return (
    <div className={cn("text-center", className)}>
      {label && <div className="text-overline mb-1">{label}</div>}
      <div
        className={cn(
          "font-mono font-semibold",
          sizeClasses[size],
          deltaColor || "text-foreground",
        )}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {deltaPrefix}
        {formattedValue}
      </div>
      {unit && (
        <div className="text-[10px] text-muted-foreground">{unit}</div>
      )}
    </div>
  );
}
