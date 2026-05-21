"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Building2, TrendingUp, TrendingDown } from "lucide-react";
import { CompanySummary } from "@/lib/types";

interface CompanyCardProps {
  company: CompanySummary;
  onClick?: () => void;
}

export function CompanyCard({ company, onClick }: CompanyCardProps) {
  const isPositiveTrend = company.yoyChangePct < 0; // Negative change is good (reduction in emissions)

  return (
    <Card
      className="p-6 border border-[#0A0A0A]/10 hover:border-[#074D47]/30 transition-all duration-200 cursor-pointer hover:shadow-md"
      onClick={onClick}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-5 w-5 text-[#074D47]" />
          <h3 className="text-lg font-bold text-[#074D47] tracking-wide">
            {company.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#0A0A0A]/60 uppercase tracking-wider">
            {company.sector}
          </span>
          <span className="text-[#0A0A0A]/30">•</span>
          <span className="text-xs text-[#0A0A0A]/60">
            {company.plantCount} {company.plantCount === 1 ? "Plant" : "Plants"}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="space-y-4">
        {/* Total Emissions */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#074D47] uppercase tracking-wide">
            Total Emissions
          </span>
          <span className="text-sm font-semibold text-[#0A0A0A]">
            {(company.totalEmissions_tco2e / 1000).toFixed(0)}k tCO₂e
          </span>
        </div>

        {/* Average GEI */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#074D47] uppercase tracking-wide">
            Avg GEI
          </span>
          <span className="text-sm font-semibold text-[#0A0A0A]">
            {company.avgGei_tco2ePerTon.toFixed(2)} tCO₂e/ton
          </span>
        </div>

        {/* YoY Change */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#074D47] uppercase tracking-wide">
            YoY Change
          </span>
          <div className="flex items-center gap-1.5">
            {isPositiveTrend ? (
              <TrendingDown className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5 text-red-600" />
            )}
            <span
              className={`text-sm font-semibold ${
                isPositiveTrend ? "text-green-600" : "text-red-600"
              }`}
            >
              {Math.abs(company.yoyChangePct).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Compliance */}
        <div className="flex justify-between items-center pt-4 border-t border-[#0A0A0A]/10">
          <span className="text-sm text-[#074D47] uppercase tracking-wide">
            Compliance
          </span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 bg-[#0A0A0A]/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#074D47] rounded-full transition-all"
                style={{ width: `${company.compliancePct}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-[#0A0A0A] min-w-[40px] text-right">
              {company.compliancePct.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
