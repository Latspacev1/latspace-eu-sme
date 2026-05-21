"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { GeiChart } from "@/components/charts/gei-chart";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AddPlantDialog } from "@/components/dialogs/add-plant-dialog";
import { useAppStore } from "@/lib/store/useAppStore";
import { useFinancialImpactStore } from "@/lib/store/useFinancialImpactStore";
import { organizationsApi } from "@/lib/api/organizations";
import { plantsApi } from "@/lib/api/plants";
import type { Site } from "@/lib/types";
import { getOrganizationLogo } from "@/lib/utils/organization-logo";

// Component for individual plant card with KPIs
function PlantChartCard({
  plant,
  isPredicted,
  viewMode,
  onPlantClick,
}: {
  plant: Site;
  isPredicted: boolean;
  viewMode: "monthly" | "quarterly" | "yearly";
  onPlantClick: (plantId: string) => void;
  isCementCorphead?: boolean;
}) {
  // Check if this is a dummy plant
  const isDummyPlant = plant.id.startsWith("dummy-");

  // Get stored calculator values for this plant
  const storedValues = useFinancialImpactStore(
    (state) => state.plantValues[plant.id]
  );

  // Fetch KPIs for this plant (skip for dummy plants)
  const { data: plantKPIs } = useQuery({
    queryKey: ["plant-kpis", plant.id],
    queryFn: async () => {
      const response = await plantsApi.getKPIs(plant.id);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    },
    enabled: !!plant.id && !isDummyPlant,
  });

  // For dummy plants, use 0.00 for currentGEI and hide targetGEI
  const currentGEI = isDummyPlant ? 0.75 : plantKPIs?.current_gei;
  const targetGEI = isDummyPlant ? 0.7 : plantKPIs?.target_gei;
  const baselineGEI = isDummyPlant ? 0.8 : plantKPIs?.baseline_gei;
  const targetStatus = isDummyPlant ? "OFF_TRACK" : plantKPIs?.target_status;
  const ytdProduction = isDummyPlant ? 15000 : plantKPIs?.ytd_production;

  // Use stored values from calculator if available, otherwise calculate from KPIs
  const hasStoredValues = storedValues && storedValues.currentGeiSelection;

  // Delta GEI: from store or calculated (Target - Current)
  const deltaGEI = hasStoredValues
    ? -storedValues.deltaGei // Store has (current - target), we display (target - current)
    : targetGEI !== undefined && currentGEI !== undefined && targetGEI !== null && currentGEI !== null
      ? targetGEI - currentGEI
      : undefined;

  // CCC Rate: from store or default 900
  const cccRate = hasStoredValues ? storedValues.cccRate : 900;

  // Production: from store or YTD production
  const productionForCalc = hasStoredValues ? storedValues.production : (ytdProduction ?? 0);

  // Penalty amount calculation
  const penaltyAmount = hasStoredValues
    ? -storedValues.financialImpact * (storedValues.deltaGei > 0 ? 1 : -1) // Negate based on excess/deficit
    : deltaGEI !== undefined && ytdProduction ? deltaGEI * ytdProduction * cccRate : 0;

  const formatValue = (val: number | undefined | null) => {
    if (val === undefined || val === null) return "—";
    return val.toFixed(4);
  };

  return (
    <div
      onClick={() => onPlantClick(plant.id)}
      className="group cursor-pointer transition-all duration-300 hover:shadow-xl min-h-[680px] bg-white border border-[#0A0A0A]/5 flex flex-col overflow-hidden"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onPlantClick(plant.id);
        }
      }}
    >
      {/* KPI Header Section */}
      <div className="px-2 pt-5 pb-2">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-[#0A0A0A] font-bold text-base leading-tight group-hover:text-[#074D47] transition-colors line-clamp-2">
              {plant.name}
            </h3>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#F8F9FA] p-3 rounded-lg border border-[#0A0A0A]/5">
            <p className="text-[10px] text-[#5A5A5A] font-semibold uppercase tracking-wider mb-1">
              Current
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-[#0A0A0A]">{formatValue(currentGEI)}</span>
              <span className="text-[9px] text-[#5A5A5A]/50 font-medium">GEI</span>
            </div>
          </div>
          <div className="bg-[#F8F9FA] p-3 rounded-lg border border-[#0A0A0A]/5">
            <p className="text-[10px] text-[#5A5A5A] font-semibold uppercase tracking-wider mb-1">
              Baseline
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-[#0A0A0A]">{formatValue(baselineGEI)}</span>
              <span className="text-[9px] text-[#5A5A5A]/50 font-medium">GEI</span>
            </div>
          </div>
          <div className="bg-[#F8F9FA] p-3 rounded-lg border border-[#0A0A0A]/5 border-l-2 border-l-[#074D47]/20">
            <p className="text-[10px] text-[#074D47] font-semibold uppercase tracking-wider mb-1">
              Target
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-[#074D47]">{formatValue(targetGEI)}</span>
              <span className="text-[9px] text-[#074D47]/50 font-medium">GEI</span>
            </div>
          </div>
        </div>

        {/* Status and Penalty Box */}
        <div
          className={`mt-3 p-3 rounded-lg border flex flex-col gap-2 ${targetStatus === "OFF_TRACK"
            ? "bg-red-50 border-red-200"
            : targetStatus === "ON_TRACK"
              ? "bg-emerald-50 border-emerald-200"
              : "bg-blue-50 border-blue-200"
            }`}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${targetStatus === "OFF_TRACK"
                  ? "bg-red-100 text-red-700"
                  : targetStatus === "ON_TRACK"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-blue-100 text-blue-700"
                  }`}
              >
                {targetStatus?.replace("_", " ")}
              </span>
              <span className="text-[10px] text-[#5A5A5A] font-semibold uppercase tracking-wider ml-2">
                Delta GEI:
              </span>
              <span
                className={`text-xs font-bold ${deltaGEI !== undefined && deltaGEI < 0 ? "text-red-600" : "text-emerald-600"}`}
              >
                {formatValue(deltaGEI)}
              </span>
            </div>
            <div className="text-[9px] text-[#5A5A5A]/60 font-medium">Δ = Tgt - Cur (YTD)</div>
          </div>

          <div className="pt-2 border-t border-[#0A0A0A]/5">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <p className="text-[8px] text-[#5A5A5A]/60 font-bold uppercase tracking-tight">
                  Rate per Carbon Credit
                </p>
                <p className="text-[10px] text-[#0A0A0A] font-medium">₹ {cccRate}</p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-right cursor-help">
                    <p className="text-[8px] text-[#5A5A5A]/60 font-bold uppercase tracking-tight">
                      {penaltyAmount < 0 ? "Penalty Amount" : "Credit Selling Opportunity"}
                    </p>
                    <div className="flex items-baseline justify-end gap-1">
                      <span
                        className={`text-sm font-bold ${penaltyAmount < 0 ? "text-red-600" : "text-emerald-600"}`}
                      >
                        ₹ {(Math.abs(penaltyAmount) / 100000).toFixed(2)} L
                      </span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-white text-[#0A0A0A] p-3 rounded-lg shadow-xl max-w-xs border border-[#0A0A0A]/10"
                >
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-[#5A5A5A] uppercase tracking-wider mb-2">
                      Calculation Formula
                    </p>
                    <div className="font-mono text-xs space-y-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-blue-600">{deltaGEI?.toFixed(4) ?? "—"}</span>
                        <span className="text-[#5A5A5A]">×</span>
                        <span className="text-emerald-600">
                          {ytdProduction?.toLocaleString("en-IN", {
                            maximumFractionDigits: 2,
                          }) ?? "—"}
                        </span>
                        <span className="text-[#5A5A5A]/60 text-[10px]">(Prod)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[#5A5A5A]">=</span>
                        <span className="text-amber-600">
                          {Math.abs((deltaGEI ?? 0) * (ytdProduction ?? 0)).toLocaleString(
                            "en-IN",
                            {
                              maximumFractionDigits: 2,
                            }
                          )}
                        </span>
                        <span className="text-[#5A5A5A]/60 text-[10px]">tCO2e</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[#5A5A5A]">×</span>
                        <span className="text-[#0A0A0A]">{cccRate}</span>
                        <span className="text-[#5A5A5A]/60 text-[10px]">(CCC Rate)</span>
                      </div>
                      <div className="flex items-center gap-1 pt-1 border-t border-[#0A0A0A]/10">
                        <span className="text-[#5A5A5A]">=</span>
                        <span className="text-lg font-bold text-[#074D47]">
                          ₹{" "}
                          {Math.abs(penaltyAmount).toLocaleString("en-IN", {
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-2 pb-2">
        <GeiChart
          siteId={plant.id}
          siteName={plant.name}
          isPredicted={isPredicted}
          viewMode={viewMode}
          showPlantNameAsTitle={false}
          hideChartTypeToggle={true}
          hideYtdToggle={true}
          currentGEI={currentGEI}
          targetGEI={targetGEI}
          baselineGEI={baselineGEI}
        />
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const { user } = useAppStore();
  const [isPredicted, setIsPredicted] = useState(false);
  const [viewMode, setViewMode] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [addPlantDialogOpen, setAddPlantDialogOpen] = useState(false);

  // Fetch the user's organization to determine logo
  const { data: userOrganization } = useQuery({
    queryKey: ["user-organization", user?.orgId],
    queryFn: async () => {
      if (!user?.orgId) return null;
      const response = await organizationsApi.getById(user.orgId);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    },
    enabled: !!user?.orgId,
  });

  // Fetch plants filtered by user's organization
  const { data: plants, isLoading: plantsLoading } = useQuery<Site[]>({
    queryKey: ["plants", user?.orgId],
    queryFn: async () => {
      if (!user?.orgId) return [];
      const response = await plantsApi.getAll({
        organization_id: user.orgId,
      });
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    },
    enabled: !!user?.orgId,
  });

  const handlePlantClick = (plantId: string) => {
    router.push(`/corporate/plants/${plantId}`);
  };

  // Check if user is from cement organization (cement corphead)
  const isCementCorphead = userOrganization?.name?.toLowerCase().includes("cement") ?? false;

  // Dummy plants for demonstration - only show for cement corphead
  const dummyPlants: Site[] = isCementCorphead
    ? [
      {
        id: "dummy-awarpur",
        name: "Awarpur Cement Works Chandrapur",
        companyId: user?.orgId || "",
        region: "Chandrapur",
        sector: "Cement" as const,
        bu: "Cement Division",
        gridRegion: "Western",
        baselineYear: 2020,
      },
      {
        id: "dummy-baga",
        name: "Baga Cement Works Solan",
        companyId: user?.orgId || "",
        region: "Solan",
        sector: "Cement" as const,
        bu: "Cement Division",
        gridRegion: "Northern",
        baselineYear: 2020,
      },
    ]
    : [];

  return (
    <div className="bg-white min-h-screen">
      {/* Main container */}
      <div className="container mx-auto px-6 py-6">
        {/* Page Header with Toggles */}
        <div className="mb-6 flex items-center justify-between">
          {/* Left: Logo and Title */}
          <div className="flex items-center gap-4">
            <Image
              src={getOrganizationLogo(userOrganization?.name).logo}
              alt={getOrganizationLogo(userOrganization?.name).alt}
              width={64}
              height={64}
              className="object-contain flex-shrink-0"
              style={{ height: "auto" }}
            />
            <div className="pt-2">
              <h1 className="text-[#0A0A0A] text-xl font-semibold tracking-tight leading-none">
                Corporate Level Dashboard
              </h1>
              <p className="text-[#0A0A0A]/50 text-xs leading-none">
                GHG Emissions Intensity monitoring across all plants
              </p>
            </div>
          </div>

          {/* Right: Toggles Container - all boxes same height */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle (Annually/Quarterly/Monthly) */}
            <div className="inline-flex items-center border border-[#0A0A0A]/10 bg-white h-9">
              <button
                onClick={() => setViewMode("yearly")}
                className={`px-4 h-full text-xs font-medium transition-all duration-200 ${viewMode === "yearly"
                  ? "bg-[#0A0A0A] text-white"
                  : "text-[#5A5A5A] hover:text-[#0A0A0A]"
                  }`}
              >
                Yearly
              </button>
              <button
                onClick={() => setViewMode("quarterly")}
                className={`px-4 h-full text-xs font-medium transition-all duration-200 ${viewMode === "quarterly"
                  ? "bg-[#0A0A0A] text-white"
                  : "text-[#5A5A5A] hover:text-[#0A0A0A]"
                  }`}
              >
                Quarterly
              </button>
              <button
                onClick={() => setViewMode("monthly")}
                className={`px-4 h-full text-xs font-medium transition-all duration-200 ${viewMode === "monthly"
                  ? "bg-[#0A0A0A] text-white"
                  : "text-[#5A5A5A] hover:text-[#0A0A0A]"
                  }`}
              >
                Monthly
              </button>
            </div>

            {/* Current/Predicted Toggle */}
            <div className="flex items-center gap-2 border border-[#0A0A0A]/10 bg-white px-3 h-9">
              <Label
                htmlFor="view-toggle"
                className={`text-xs font-medium cursor-pointer transition-colors ${!isPredicted ? "text-[#0A0A0A]" : "text-[#5A5A5A]"
                  }`}
              >
                Current
              </Label>
              <Switch
                id="view-toggle"
                checked={isPredicted}
                onCheckedChange={setIsPredicted}
                aria-label="Toggle between current and predicted emissions data"
                className="scale-90"
              />
              <Label
                htmlFor="view-toggle"
                className={`text-xs font-medium cursor-pointer transition-colors ${isPredicted ? "text-[#0A0A0A]" : "text-[#5A5A5A]"
                  }`}
              >
                Predicted
              </Label>
            </div>

            {/* Configure New Plant Button */}
            <button
              onClick={() => setAddPlantDialogOpen(true)}
              className="flex items-center gap-1.5 bg-[#074D47] hover:bg-[#22867C] text-white px-4 h-9 text-xs font-medium transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Configure New Plant
            </button>
          </div>
        </div>

        {/* Add Plant Dialog */}
        <AddPlantDialog
          open={addPlantDialogOpen}
          onOpenChange={setAddPlantDialogOpen}
          organizationId={user?.orgId || ""}
        />

        {/* 3x2 Grid of GEI Charts */}
        <div className="grid grid-cols-3 gap-5">
          {plantsLoading ? (
            // Loading skeleton
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[450px] bg-gray-100 animate-pulse rounded-lg" />
            ))
          ) : (
            <>
              {/* Render actual plants */}
              {plants &&
                plants.length > 0 &&
                plants.map((plant) => (
                  <PlantChartCard
                    key={plant.id}
                    plant={plant}
                    isPredicted={isPredicted}
                    viewMode={viewMode}
                    onPlantClick={handlePlantClick}
                    isCementCorphead={isCementCorphead}
                  />
                ))}
              {/* Render dummy plants */}
              {/*{dummyPlants.map((plant) => (
                <PlantChartCard
                  key={plant.id}
                  plant={plant}
                  isPredicted={isPredicted}
                  viewMode={viewMode}
                  onPlantClick={handlePlantClick}
                  isCementCorphead={isCementCorphead}
                />
              ))}*/}
              {/* Show message if no plants at all */}
              {(!plants || plants.length === 0) && dummyPlants.length === 0 && (
                <div className="col-span-3 text-center py-12">
                  <p className="text-gray-500">No plants found for your organization</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
