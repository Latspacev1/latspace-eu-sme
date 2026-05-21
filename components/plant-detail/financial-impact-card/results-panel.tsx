"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResultsPanelProps {
  currentGei: number;
  targetGei: number;
  production: number;
  cccRate: number;
  geiDelta: number;
  totalGhgDelta: number;
  financialImpact: number;
  isExcess: boolean;
  isDeficit: boolean;
  isNeutral: boolean;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number, decimals?: number) => string;
}

export function ResultsPanel({
  currentGei,
  targetGei,
  production,
  cccRate,
  geiDelta,
  totalGhgDelta,
  financialImpact,
  isExcess,
  isDeficit,
  isNeutral,
  formatCurrency,
  formatNumber,
}: ResultsPanelProps) {
  return (
    <Card
      className={cn("border-2", {
        "border-red-500/30 bg-red-50/30": isExcess,
        "border-green-500/30 bg-green-50/30": isDeficit,
        "border-gray-300 bg-gray-50/50": isNeutral,
      })}
    >
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <span>Financial Impact</span>
          <IndianRupee className="h-5 w-5 text-gray-600" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Total GHG Emissions - Main Display */}
        <div
          className={cn("p-4 rounded-lg", {
            "bg-red-100/50": isExcess,
            "bg-green-100/50": isDeficit,
            "bg-gray-100": isNeutral,
          })}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600 mb-2">
            Total GHG Emissions {isExcess ? "Excess" : isDeficit ? "Deficit" : "Delta"}
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span
              className={cn("text-4xl font-bold font-mono", {
                "text-red-600": isExcess,
                "text-green-600": isDeficit,
                "text-gray-600": isNeutral,
              })}
            >
              {formatNumber(Math.abs(totalGhgDelta))}
            </span>
            <span
              className={cn("text-lg font-semibold", {
                "text-red-500": isExcess,
                "text-green-500": isDeficit,
                "text-gray-500": isNeutral,
              })}
            >
              tCO2e
            </span>
          </div>
          <div className="text-xs text-gray-600">
            Based on <span className="font-semibold">{formatNumber(production)}</span> tons
            production
          </div>
        </div>

        {/* Calculation */}
        <div className="space-y-2 p-3 bg-white/80 rounded-md border border-gray-200">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-2">
            Calculation
          </div>
          <div className="space-y-2 text-sm text-gray-700 font-mono">
            <div>
              <span className="text-gray-500">Delta GEI</span> = {currentGei.toFixed(4)} -{" "}
              {targetGei.toFixed(4)} ={" "}
              <span
                className={cn("font-semibold", {
                  "text-red-600": isExcess,
                  "text-green-600": isDeficit,
                })}
              >
                {geiDelta > 0 ? "" : ""}
                {geiDelta.toFixed(4)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Total Impact</span> ={" "}
              {Math.abs(geiDelta).toFixed(4)} x {formatNumber(production)} ={" "}
              <span
                className={cn("font-semibold", {
                  "text-red-600": isExcess,
                  "text-green-600": isDeficit,
                })}
              >
                {formatNumber(Math.abs(totalGhgDelta))} tCO2e
              </span>
            </div>
          </div>
        </div>

        {/* Financial Impact */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">
            {isExcess
              ? "Compliance Cost"
              : isDeficit
                ? "Credit Value Potential"
                : "Financial Impact"}
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn("text-3xl font-semibold", {
                "text-red-600": isExcess,
                "text-green-600": isDeficit,
                "text-gray-600": isNeutral,
              })}
            >
              {formatCurrency(financialImpact)}
            </span>
            <span className="text-lg text-gray-500">INR</span>
            {isExcess && <TrendingUp className="h-5 w-5 text-red-500" />}
            {isDeficit && <TrendingDown className="h-5 w-5 text-green-500" />}
          </div>
          <div className="text-xs text-gray-500">
            {formatNumber(Math.abs(totalGhgDelta))} tCO2e x {cccRate}/tonne
          </div>
          <div className="text-xs text-gray-600 font-medium mt-1">
            {isExcess && "Estimated cost for purchasing carbon credits"}
            {isDeficit && "Potential revenue from selling surplus credits"}
            {isNeutral && "No financial impact - meeting target exactly"}
          </div>
        </div>

        {/* Market Note */}
        <div className="text-[10px] text-gray-500 italic">
          * CCC rates are indicative and may vary based on market conditions
        </div>
      </CardContent>
    </Card>
  );
}
