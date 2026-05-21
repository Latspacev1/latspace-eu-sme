"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { IndianRupee, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LegacyFinancialImpactCardProps {
  totalGhgDelta: number;
  defaultCccRate?: number;
  className?: string;
}

export function FinancialImpactCard({
  totalGhgDelta,
  defaultCccRate = 500,
  className,
}: LegacyFinancialImpactCardProps) {
  const [cccRate, setCccRate] = useState(defaultCccRate);

  const financialImpact = Math.abs(totalGhgDelta) * cccRate;
  const isExcess = totalGhgDelta > 0;
  const isDeficit = totalGhgDelta < 0;
  const isNeutral = totalGhgDelta === 0;

  const formatCurrency = (value: number) => {
    return `${(value / 100000).toFixed(2)} L`;
  };

  const formatEmissions = (value: number) => {
    return Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const handleSliderChange = (value: number[]) => {
    setCccRate(value[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    if (value >= 100 && value <= 5000) {
      setCccRate(value);
    }
  };

  return (
    <Card
      className={cn("border-2", className, {
        "border-orange-500/30 bg-orange-50/30": isExcess,
        "border-teal-500/30 bg-teal-50/30": isDeficit,
        "border-gray-300 bg-gray-50/50": isNeutral,
      })}
    >
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <span>Financial Impact Calculator</span>
          <IndianRupee className="h-6 w-6 text-gray-600" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-600">
              CCC Rate (per tCO2e)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={cccRate}
                onChange={handleInputChange}
                className="h-9 w-24 text-sm font-mono text-right"
                min={100}
                max={5000}
                step={50}
              />
              <span className="text-xs text-gray-600 font-medium">/tonne</span>
            </div>
          </div>
          <Slider
            value={[cccRate]}
            onValueChange={handleSliderChange}
            min={100}
            max={5000}
            step={50}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-gray-500 font-medium">
            <span>100</span>
            <span>2,500</span>
            <span>5,000</span>
          </div>
        </div>

        <div className="border-t border-gray-200" />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-[0.1em] text-gray-600">
              {isExcess
                ? "Compliance Cost"
                : isDeficit
                  ? "Credit Value Potential"
                  : "Financial Impact"}
            </div>
            {(isExcess || isDeficit) && (
              <div
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md", {
                  "bg-orange-100": isExcess,
                  "bg-teal-100": isDeficit,
                })}
              >
                <span
                  className={cn("text-sm font-bold", {
                    "text-orange-800": isExcess,
                    "text-teal-800": isDeficit,
                  })}
                >
                  {formatEmissions(totalGhgDelta)}
                </span>
                <span
                  className={cn("text-xs font-semibold", {
                    "text-orange-700": isExcess,
                    "text-teal-700": isDeficit,
                  })}
                >
                  CCCs
                </span>
              </div>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn("text-3xl font-semibold", {
                "text-orange-600": isExcess,
                "text-teal-600": isDeficit,
                "text-gray-600": isNeutral,
              })}
            >
              {formatCurrency(financialImpact)}
            </span>
            <span className="text-lg text-gray-500">INR</span>
            {isExcess && <TrendingUp className="h-5 w-5 text-orange-500" />}
            {isDeficit && <TrendingDown className="h-5 w-5 text-teal-500" />}
          </div>
          <div className="text-xs text-gray-600 font-medium">
            {isExcess && "Estimated cost for purchasing carbon credits"}
            {isDeficit && "Potential revenue from selling surplus credits"}
            {isNeutral && "No financial impact - meeting target exactly"}
          </div>
        </div>

        <div className="space-y-2 p-4 bg-gray-50 rounded-md border border-gray-200">
          <div className="text-xs font-semibold text-gray-700">Calculation Breakdown</div>
          <div className="space-y-1.5 text-[11px] text-gray-600 font-mono">
            <div className="flex justify-between">
              <span>GHG {isExcess ? "Excess" : isDeficit ? "Deficit" : "Delta"}:</span>
              <span className="font-semibold">{formatEmissions(totalGhgDelta)} tCO2e</span>
            </div>
            <div className="flex justify-between">
              <span>CCC Rate:</span>
              <span className="font-semibold">{cccRate}/tonne</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-gray-300">
              <span>Total Impact:</span>
              <span
                className={cn("font-semibold", {
                  "text-orange-600": isExcess,
                  "text-teal-600": isDeficit,
                  "text-gray-600": isNeutral,
                })}
              >
                {formatCurrency(financialImpact)} INR
              </span>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-gray-500 italic">
          * CCC rates are indicative and may vary based on market conditions
        </div>
      </CardContent>
    </Card>
  );
}
