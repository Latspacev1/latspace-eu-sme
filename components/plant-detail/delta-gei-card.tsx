"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertTriangle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

interface DeltaGeiCardProps {
  currentGei: number;
  targetGei: number;
  production?: number;
  className?: string;
  isPredicted?: boolean;
}

export function DeltaGeiCard({
  currentGei,
  targetGei,
  production = 0,
  className,
  isPredicted = false,
}: DeltaGeiCardProps) {
  // Calculate delta GEI (difference between current and target)
  const deltaGei = currentGei - targetGei;

  // Calculate total GHG emissions excess/deficit
  const totalGhgDelta = deltaGei * production;

  // Determine status (excess, deficit, or neutral)
  const status = deltaGei > 0 ? "excess" : deltaGei < 0 ? "deficit" : "neutral";

  // Format values for display
  const formatValue = (value: number) => {
    return Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  };

  const formatEmissions = (value: number) => {
    return Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  return (
    <Card
      className={cn("border-2", className, {
        "border-red-500/30 bg-red-50/30": status === "excess",
        "border-green-500/30 bg-green-50/30": status === "deficit",
        "border-gray-300 bg-gray-50/50": status === "neutral",
      })}
    >
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <span>Delta GEI & Emissions Impact</span>
          {status === "excess" ? (
            <TrendingUp className="h-6 w-6 text-red-600" />
          ) : status === "deficit" ? (
            <TrendingDown className="h-6 w-6 text-green-600" />
          ) : (
            <Minus className="h-6 w-6 text-gray-500" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Delta GEI */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-[0.1em] text-gray-600">
            Delta GEI ({isPredicted ? "Predicted" : "Current"} - Target)
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn("text-5xl font-bold font-mono", {
                "text-red-600": status === "excess",
                "text-green-600": status === "deficit",
                "text-gray-600": status === "neutral",
              })}
            >
              {status === "excess" && "+"}
              {status === "deficit" && "-"}
              {formatValue(deltaGei)}
            </span>
            <span className="text-xs text-gray-600 font-medium">tCO₂e/ton</span>
          </div>
          <div className="text-xs text-gray-600 font-medium">
            {status === "excess" && (
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Exceeding target intensity
              </span>
            )}
            {status === "deficit" && (
              <span className="text-green-600">
                Below target intensity (credit potential)
              </span>
            )}
            {status === "neutral" && <span>Meeting target exactly</span>}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* Total GHG Emissions Impact */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-[0.1em] text-gray-600">
            Total GHG Emissions{" "}
            {status === "excess"
              ? "Excess"
              : status === "deficit"
                ? "Deficit"
                : "Impact"}
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn("text-2xl font-semibold font-mono", {
                "text-red-600": status === "excess",
                "text-green-600": status === "deficit",
                "text-gray-600": status === "neutral",
              })}
            >
              {formatEmissions(totalGhgDelta)}
            </span>
            <span className="text-xs text-gray-600 font-medium">tCO₂e</span>
          </div>
          <div className="text-xs text-gray-600 font-medium">
            Based on {formatEmissions(production)} tons production
          </div>
        </div>

        {/* Calculation Note */}
        <div className="pt-3 border-t border-gray-200">
          <div className="text-[10px] text-gray-600">
            <div className="font-semibold mb-1.5 text-xs">Calculation:</div>
            <div className="space-y-1 font-mono text-[11px]">
              <div>
                Delta GEI = {formatValue(currentGei)} - {formatValue(targetGei)}{" "}
                = {formatValue(deltaGei)}
              </div>
              <div>
                Total Impact = {formatValue(deltaGei)} ×{" "}
                {formatEmissions(production)} = {formatEmissions(totalGhgDelta)}{" "}
                tCO₂e
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
