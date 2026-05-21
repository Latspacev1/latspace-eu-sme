import { cn } from "@/lib/utils";

interface MetricRowProps {
  label: string;
  value: string | number;
  unit?: string;
  valueClassName?: string;
  className?: string;
}

export function MetricRow({
  label,
  value,
  unit,
  valueClassName,
  className,
}: MetricRowProps) {
  return (
    <div className={cn("flex items-center justify-between text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono", valueClassName || "text-foreground")}>
        {value}
        {unit && ` ${unit}`}
      </span>
    </div>
  );
}
