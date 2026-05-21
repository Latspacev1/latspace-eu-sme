"use client";

import React from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const sectors = ["Cement", "Steel", "Chemicals", "PulpPaper"];
const businessUnits = [
  "Cement Division",
  "Steel Division",
  "Chemicals Division",
  "Paper Division",
];
const regions = ["North", "South", "East", "West"];

export function FilterBar() {
  const filters = useAppStore((state) => state.filters);
  const setFilters = useAppStore((state) => state.setFilters);
  const resetFilters = useAppStore((state) => state.resetFilters);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Sync URL params with store on mount
  useEffect(() => {
    const year = searchParams.get("year");
    const sector = searchParams.get("sector");
    const bu = searchParams.get("bu");
    const region = searchParams.get("region");

    const updates: any = {};
    if (year) updates.year = parseInt(year);
    if (sector) updates.sector = sector;
    if (bu) updates.bu = bu;
    if (region) updates.region = region;

    if (Object.keys(updates).length > 0) {
      setFilters(updates);
    }
  }, [searchParams, setFilters]);

  // Update URL when filters change
  const updateURL = (newFilters: typeof filters) => {
    const params = new URLSearchParams();
    params.set("year", newFilters.year.toString());
    if (newFilters.sector) params.set("sector", newFilters.sector);
    if (newFilters.bu) params.set("bu", newFilters.bu);
    if (newFilters.region) params.set("region", newFilters.region);

    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleYearChange = (value: string) => {
    const newFilters = { ...filters, year: parseInt(value) };
    setFilters({ year: parseInt(value) });
    updateURL(newFilters);
  };

  const handleSectorChange = (value: string) => {
    const newFilters = {
      ...filters,
      sector: value as any,
    };
    setFilters({ sector: value as any });
    updateURL(newFilters);
  };

  const handleBUChange = (value: string) => {
    const newFilters = { ...filters, bu: value };
    setFilters({ bu: value });
    updateURL(newFilters);
  };

  const handleRegionChange = (value: string) => {
    const newFilters = { ...filters, region: value };
    setFilters({ region: value });
    updateURL(newFilters);
  };

  const handleReset = () => {
    resetFilters();
    router.push(`?year=${2024}`, { scroll: false });
  };

  const hasActiveFilters = filters.sector || filters.bu || filters.region;

  return (
    <div className="border-b border-[#050505]/6 bg-white">
      <div className="container mx-auto px-12 py-8">
        {/* Grid-aligned horizontal layout with generous spacing */}
        <div className="flex flex-wrap items-center gap-10">
          {/* Year filter */}
          <div className="flex items-center gap-4">
            <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-[#050505]/70 min-w-[32px]">
              Year
            </span>
            <Select
              value={filters.year.toString()}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="w-[90px] h-9 border-[0.5px] border-[#050505]/10 hover:border-[#074D47]/30 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Hairline separator */}
          <div className="w-[1px] h-5 bg-[#050505]/8"></div>

          {/* Sector filter */}
          <div className="flex items-center gap-4">
            <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-[#050505]/70 min-w-[42px]">
              Sector
            </span>
            <Select
              value={filters.sector || "all"}
              onValueChange={(v) => handleSectorChange(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-[140px] h-9 border-[0.5px] border-[#050505]/10 hover:border-[#074D47]/30 transition-colors">
                <SelectValue placeholder="All Sectors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Business Unit filter */}
          <div className="flex items-center gap-4">
            <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-[#050505]/70 min-w-[24px]">
              BU
            </span>
            <Select
              value={filters.bu || "all"}
              onValueChange={(v) => handleBUChange(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-[170px] h-9 border-[0.5px] border-[#050505]/10 hover:border-[#074D47]/30 transition-colors">
                <SelectValue placeholder="All Business Units" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Business Units</SelectItem>
                {businessUnits.map((bu) => (
                  <SelectItem key={bu} value={bu}>
                    {bu}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Region filter */}
          <div className="flex items-center gap-4">
            <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-[#050505]/70 min-w-[42px]">
              Region
            </span>
            <Select
              value={filters.region || "all"}
              onValueChange={(v) => handleRegionChange(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-[110px] h-9 border-[0.5px] border-[#050505]/10 hover:border-[#074D47]/30 transition-colors">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear filters - minimal visual weight */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="ml-auto h-9 px-3 text-[10px] tracking-[0.08em] uppercase text-[#074D47] hover:text-[#074D47] hover:bg-[#074D47]/5 transition-colors"
            >
              <X className="h-3 w-3 mr-2" strokeWidth={1.5} />
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
