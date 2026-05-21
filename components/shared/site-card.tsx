"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { MapPin, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteCardProps {
  name: string;
  region: string;
  capacity: string;
  type: string;
  manager: string;
  updated: string;
  companyName?: string;
  onClick?: () => void;
  // KPI props
  currentGei?: number | null;
  baselineGei?: number | null;
  targetGei?: number | null;
  targetStatus?: "ON_TRACK" | "NEAR_TARGET" | "OFF_TRACK" | "NO_DATA";
  showKpis?: boolean;
}

function getStatusColor(
  status?: "ON_TRACK" | "NEAR_TARGET" | "OFF_TRACK" | "NO_DATA",
) {
  switch (status) {
    case "ON_TRACK":
      return "text-green-600 bg-green-50";
    case "NEAR_TARGET":
      return "text-amber-600 bg-amber-50";
    case "OFF_TRACK":
      return "text-red-600 bg-red-50";
    default:
      return "text-gray-500 bg-gray-50";
  }
}

function getStatusLabel(
  status?: "ON_TRACK" | "NEAR_TARGET" | "OFF_TRACK" | "NO_DATA",
) {
  switch (status) {
    case "ON_TRACK":
      return "On Track";
    case "NEAR_TARGET":
      return "Near Target";
    case "OFF_TRACK":
      return "Off Track";
    default:
      return "No Data";
  }
}

function getStatusIcon(
  status?: "ON_TRACK" | "NEAR_TARGET" | "OFF_TRACK" | "NO_DATA",
) {
  switch (status) {
    case "ON_TRACK":
      return <TrendingDown className="h-3 w-3" />;
    case "OFF_TRACK":
      return <TrendingUp className="h-3 w-3" />;
    default:
      return <Minus className="h-3 w-3" />;
  }
}

export function SiteCard({
  name,
  region,
  capacity,
  type,
  manager,
  updated,
  companyName,
  onClick,
  currentGei,
  baselineGei,
  targetGei,
  targetStatus,
  showKpis = false,
}: SiteCardProps) {
  const formatGei = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "—";
    return value.toFixed(4);
  };

  return (
    <Card
      className="p-6 border border-[#0A0A0A]/10 hover:border-[#074D47]/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#074D47] focus-visible:ring-offset-2"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-[#074D47] uppercase tracking-wide mb-2">
          {name}
        </h3>
        <div className="flex items-center gap-2 text-[#074D47] text-sm">
          <MapPin className="h-4 w-4" />
          <span>{region}</span>
        </div>
      </div>

      {/* Company Name (if exists) */}
      {companyName && (
        <div className="mb-4 text-sm italic text-[#074D47]">{companyName}</div>
      )}

      {/* Details - Show KPIs or legacy fields */}
      {showKpis ? (
        <div className="space-y-3">
          {/* Status Badge */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-[#074D47] uppercase tracking-wide">
              STATUS
            </span>
            <span
              className={cn(
                "text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1",
                getStatusColor(targetStatus),
              )}
            >
              {getStatusIcon(targetStatus)}
              {getStatusLabel(targetStatus)}
            </span>
          </div>

          {/* Current GEI */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-[#074D47] uppercase tracking-wide">
              CURRENT GEI
            </span>
            <span className="text-sm font-semibold text-[#0A0A0A]">
              {formatGei(currentGei)}{" "}
              <span className="text-xs text-[#0A0A0A]/60">tCO₂e/t</span>
            </span>
          </div>

          {/* Baseline GEI */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-[#074D47] uppercase tracking-wide">
              BASELINE GEI
            </span>
            <span className="text-sm font-semibold text-[#0A0A0A]">
              {formatGei(baselineGei)}{" "}
              <span className="text-xs text-[#0A0A0A]/60">tCO₂e/t</span>
            </span>
          </div>

          {/* Target GEI */}
          <div className="flex justify-between items-center pt-3 border-t border-[#0A0A0A]/10">
            <span className="text-sm text-[#074D47] uppercase tracking-wide">
              TARGET GEI
            </span>
            <span className="text-sm font-semibold text-[#0A0A0A]">
              {formatGei(targetGei)}{" "}
              <span className="text-xs text-[#0A0A0A]/60">tCO₂e/t</span>
            </span>
          </div>

          {/* Sector */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-[#074D47] uppercase tracking-wide">
              SECTOR
            </span>
            <span className="text-sm font-semibold text-[#0A0A0A]">{type}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-[#074D47] uppercase tracking-wide">
              CAPACITY
            </span>
            <span className="text-sm font-semibold text-[#0A0A0A]">
              {capacity}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-[#074D47] uppercase tracking-wide">
              TYPE
            </span>
            <span className="text-sm font-semibold text-[#0A0A0A]">{type}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-[#074D47] uppercase tracking-wide">
              MANAGER
            </span>
            <span className="text-sm font-semibold text-[#0A0A0A]">
              {manager}
            </span>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-[#0A0A0A]/10">
            <span className="text-sm text-[#074D47] uppercase tracking-wide">
              UPDATED
            </span>
            <span className="text-sm font-semibold text-[#0A0A0A]">
              {updated}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
