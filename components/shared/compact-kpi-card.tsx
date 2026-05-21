import { cn } from "@/lib/utils";
import React from "react";
interface CompactKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}

export function CompactKpiCard({
  title,
  value,
  subtitle,
  className,
}: CompactKpiCardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-600 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{value}</span>
            {subtitle && (
              <span className="text-sm font-medium text-gray-500">
                {subtitle}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
