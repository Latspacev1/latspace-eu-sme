import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import React from "react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: KpiCardProps) {
  // Minimalist border accent - only teal spectrum colors
  const borderAccent = {
    default: "var(--ccts-primary)",
    success: "var(--ccts-secondary)",
    warning: "var(--ccts-accent)",
    danger: "var(--ccts-primary)",
  };

  return (
    <Card
      className={cn(
        "bg-white border-[0.5px] border-foreground/8 transition-all duration-500",
        "hover:border-primary/20 hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        className,
      )}
      style={{
        borderLeftWidth: "1px",
        borderLeftColor: borderAccent[variant],
      }}
    >
      {/* Generous padding - maximize whitespace */}
      <CardHeader className="px-8 pt-8 pb-0">
        <div className="flex items-start justify-between gap-8">
          <CardTitle className="text-[10px] font-semibold tracking-[0.12em] uppercase text-foreground/70 leading-tight">
            {title}
          </CardTitle>
          {Icon && (
            <Icon
              className="h-4 w-4 text-primary/60 flex-shrink-0"
              strokeWidth={1.5}
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="px-8 pt-6 pb-8">
        {/* Lab-grade precision typography */}
        <div
          className="text-5xl font-light text-foreground leading-none tracking-[-0.03em] font-mono mb-3"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </div>

        {subtitle && (
          <p className="text-[11px] text-foreground/70 leading-relaxed mt-4">
            {subtitle}
          </p>
        )}

        {/* Understated trend indicator */}
        {trend && (
          <div className="mt-8 pt-6 border-t border-foreground/4">
            <div className="flex items-baseline gap-3">
              <span
                className={cn(
                  "text-[13px] font-mono font-light tracking-tight",
                  trend.value > 0
                    ? "text-secondary"
                    : trend.value < 0
                      ? "text-primary"
                      : "text-foreground/70",
                )}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {trend.value > 0 ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-[9px] uppercase tracking-[0.15em] text-foreground/65 font-medium">
                {trend.label}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
