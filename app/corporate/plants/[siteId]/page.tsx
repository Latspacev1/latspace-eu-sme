"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
  FileText,
  CheckCircle2,
  TrendingDown,
  Target,
  Activity,
  AlertTriangle,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useAppStore } from "@/lib/store/useAppStore";
import { plantsApi, PlantKPIs } from "@/lib/api/plants";
import { outputCalculationApi } from "@/lib/api/output-calculation";
import { geiApi } from "@/lib/api/gei";
import { GeiDataPoint } from "@/lib/types";
import { GeiChart } from "@/components/charts/gei-chart";
import { EmissionsTrendChart } from "@/components/charts/emissions-trend-chart";
import {
  FinancialImpactCard,
  FinancialImpactCalculator,
} from "@/components/plant-detail/financial-impact-card";
import { DeltaGeiCard } from "@/components/plant-detail/delta-gei-card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatFY } from "@/lib/utils/fy";

export default function SiteDetailPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const { user } = useAppStore();
  const [viewMode, setViewMode] = useState<"monthly" | "quarterly" | "yearly">(
    "monthly",
  );
  const [isPredicted, setIsPredicted] = useState<boolean>(false);
  const [isML, setIsML] = useState<boolean>(false); // false = ML, true = Planned

  // Fetch the plant for this siteId
  const { data: userPlant } = useQuery({
    queryKey: ["user-plant", siteId],
    queryFn: async () => {
      if (!siteId) return null;
      const response = await plantsApi.getById(siteId);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    },
    enabled: !!siteId,
  });

  // Fetch KPIs for the selected plant
  const { data: plantKPIs } = useQuery<PlantKPIs | null>({
    queryKey: ["plant-kpis", siteId],
    queryFn: async () => {
      if (!siteId) return null;
      const response = await plantsApi.getKPIs(siteId);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    },
    enabled: !!siteId,
  });

  // Helper functions for prediction calculations (same as GEI chart)
  const calculateMovingAverage = (
    values: (number | null)[],
    window: number = 3,
  ): (number | null)[] => {
    const result: (number | null)[] = [];
    for (let i = 0; i < values.length; i++) {
      const validValues: number[] = [];
      for (let j = Math.max(0, i - window + 1); j <= i; j++) {
        if (values[j] !== null && values[j] !== undefined) {
          validValues.push(values[j] as number);
        }
      }
      if (validValues.length > 0) {
        const avg = validValues.reduce((a, b) => a + b, 0) / validValues.length;
        result.push(parseFloat(avg.toFixed(4)));
      } else {
        result.push(null);
      }
    }
    return result;
  };

  const calculateTrendFromMA = (maValues: (number | null)[]): number => {
    const validMA = maValues
      .map((v, i) => ({ value: v, index: i }))
      .filter((item) => item.value !== null) as {
        value: number;
        index: number;
      }[];
    if (validMA.length < 2) return 0;
    const recentPoints = validMA.slice(-3);
    let totalSlope = 0;
    for (let i = 1; i < recentPoints.length; i++) {
      const slope =
        (recentPoints[i].value - recentPoints[i - 1].value) /
        (recentPoints[i].index - recentPoints[i - 1].index);
      totalSlope += slope;
    }
    return totalSlope / (recentPoints.length - 1);
  };

  // Fetch GEI trend data for predictions
  const currentFinancialYear =
    new Date().getMonth() >= 3
      ? new Date().getFullYear()
      : new Date().getFullYear() - 1;
  const { data: geiTrendData } = useQuery({
    queryKey: ["gei-trend", siteId, currentFinancialYear],
    queryFn: async () => {
      if (!siteId) return null;
      const response = await geiApi.getPlantTrend(
        siteId,
        currentFinancialYear,
        false,
      );
      if (response.success && response.data) {
        return response.data.monthly_data;
      }
      return [];
    },
    enabled: !!siteId,
  });

  // FY months in order: Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar
  const FY_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

  // Calculate predicted GEI using 3-month moving average + trend
  // This matches the logic in gei-chart.tsx for consistency
  const predictedGeiData = React.useMemo(() => {
    if (!geiTrendData || geiTrendData.length === 0) {
      return { predictedGei: null, totalProduction: 0 };
    }

    // Build FY-ordered data (same as chart's fyBasedData logic)
    // This ensures we have 12 data points in correct FY order (Apr=0 to Mar=11)
    const fyOrderedData = FY_MONTH_ORDER.map((calMonth, fyIdx) => {
      // Get calendar year for this month in the current FY
      // FY 2025: Apr-Dec 2025, Jan-Mar 2026
      const calYear =
        calMonth >= 4 ? currentFinancialYear : currentFinancialYear + 1;

      // Find matching data from geiTrendData
      const match = geiTrendData.find((d: GeiDataPoint) => {
        const dataCalYear = d.calendar_year ?? d.financial_year;
        return dataCalYear === calYear && d.month_num === calMonth;
      });

      return {
        gei: match?.gei ?? null,
        equivalent_production: match?.equivalent_production ?? null,
        fyIndex: fyIdx,
      };
    });

    // Get GEI values in FY order
    const geiValues = fyOrderedData.map((d) => d.gei);

    // Find last actual data index (in FY order)
    let lastActualIdx = -1;
    for (let i = geiValues.length - 1; i >= 0; i--) {
      if (geiValues[i] !== null && geiValues[i] !== undefined) {
        lastActualIdx = i;
        break;
      }
    }

    if (lastActualIdx < 1) {
      // Not enough data for prediction
      const totalProd = fyOrderedData.reduce(
        (sum: number, d) => sum + (d.equivalent_production || 0),
        0,
      );
      return {
        predictedGei: geiValues[lastActualIdx],
        totalProduction: totalProd,
      };
    }

    // Calculate 3-month moving average
    const movingAvgValues = calculateMovingAverage(geiValues, 3);
    const lastMA = movingAvgValues[lastActualIdx];
    const trend = calculateTrendFromMA(
      movingAvgValues.slice(0, lastActualIdx + 1),
    );

    // Predict year-end GEI (March = index 11 in FY order, i.e., last index)
    const yearEndIdx = 11; // March is always at index 11 in FY order
    const monthsToYearEnd = yearEndIdx - lastActualIdx;
    const predictedYearEndGei =
      lastMA !== null
        ? parseFloat((lastMA + trend * monthsToYearEnd).toFixed(4))
        : null;

    // Calculate YTD production (sum of actual months only)
    let ytdProduction = 0;
    let actualMonthCount = 0;
    fyOrderedData.forEach((d) => {
      if (
        d.equivalent_production !== null &&
        d.equivalent_production !== undefined
      ) {
        ytdProduction += d.equivalent_production;
        actualMonthCount++;
      }
    });

    // Estimate full year production using average of actual months
    let totalProduction = ytdProduction;
    if (actualMonthCount > 0) {
      const avgMonthlyProduction = ytdProduction / actualMonthCount;
      const remainingMonths = 12 - actualMonthCount;
      totalProduction += avgMonthlyProduction * remainingMonths;
    }

    return {
      predictedGei: predictedYearEndGei,
      totalProduction,
      ytdProduction,
      lastActualGei: geiValues[lastActualIdx],
      monthsRemaining: 12 - (lastActualIdx + 1),
    };
  }, [geiTrendData, currentFinancialYear]);

  // Fetch yearly production data as fallback
  const currentYear = new Date().getFullYear();
  const { data: yearlyProductionData } = useQuery({
    queryKey: ["production-data", siteId, currentYear],
    queryFn: async () => {
      if (!siteId) return null;
      const response = await outputCalculationApi.getForPlant(
        siteId,
        currentYear,
        null,
      );
      if (response.success && response.data) {
        const equivalentProduction = response.data.find(
          (d) => d.param_type === "equivalent_production",
        );
        return equivalentProduction?.data_value || 0;
      }
      return 0;
    },
    enabled: !!siteId,
  });

  // Use production from GEI trend data, fallback to yearly data
  const productionData =
    predictedGeiData.totalProduction > 0
      ? predictedGeiData.totalProduction
      : (yearlyProductionData ?? 0);

  // Calculate GEI values for cards based on mode (current vs predicted)
  const effectiveGei = React.useMemo(() => {
    if (isPredicted) {
      // Use predicted year-end GEI
      return predictedGeiData.predictedGei ?? plantKPIs?.current_gei ?? 0;
    } else {
      // Use current (latest actual) GEI
      return plantKPIs?.current_gei ?? 0;
    }
  }, [isPredicted, predictedGeiData, plantKPIs]);

  // Calculate predicted GEI for the fiscal year end (March)
  const fiscalYearEndPredictedGei = React.useMemo(() => {
    if (!isPredicted) {
      return null;
    }

    // Use the already calculated predictedGei from predictedGeiData (which is for March/year-end)
    const predictedValue = predictedGeiData.predictedGei;

    if (predictedValue === null || predictedValue === undefined) {
      return null;
    }

    // March is always in the next calendar year for a given financial year
    // FY 2025 = April 2025 - March 2026, so March is in 2026
    const marchCalendarYear = currentFinancialYear + 1;
    const monthYear = `Mar ${marchCalendarYear}`;

    return {
      value: predictedValue,
      monthYear: monthYear,
    };
  }, [isPredicted, predictedGeiData, currentFinancialYear]);

  // Calculate totalGhgDelta for financial impact card
  const totalGhgDelta = React.useMemo(() => {
    if (!plantKPIs) return 0;
    const targetGei = plantKPIs.target_gei ?? 0;
    const deltaGei = effectiveGei - targetGei;
    return deltaGei * productionData;
  }, [effectiveGei, plantKPIs, productionData]);

  // Delta GEI for Target Status box: Target - Current (YTD)
  const deltaGEIValue = React.useMemo(() => {
    if (
      !plantKPIs ||
      plantKPIs.target_gei === null ||
      plantKPIs.current_gei === null
    )
      return undefined;
    return plantKPIs.target_gei - plantKPIs.current_gei;
  }, [plantKPIs]);

  if (!userPlant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm font-mono text-gray-500">
          Loading plant data...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Main container */}
      <div className="container mx-auto px-12 py-8">
        {/* Plant Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[#0A0A0A] tracking-tight">
            {userPlant?.name || "Loading..."}
          </h1>
          <Link
            href={`/corporate/plants/${siteId}/settings`}
            className="inline-block"
            aria-label="Plant Settings"
          >
            <Card className="flex flex-row items-center gap-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap hover:shadow-sm">
              <Settings className="h-4 w-4 text-gray-700 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-800 whitespace-nowrap">
                Plant Settings
              </span>
            </Card>
          </Link>
        </div>

        <div className="space-y-6">
          {/* Insights Content */}
          {siteId && plantKPIs ? (
            <div className="grid grid-cols-1 gap-6">
              {/* Performance Metrics Grid */}
              <section className="space-y-4">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">
                  Performance Metrics
                </h2>

                <div
                  className={`grid gap-4 md:grid-cols-2 ${isPredicted ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
                >
                  {/* Baseline GEI */}
                  <Card className="border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-1">
                          Baseline GEI{" "}
                          {plantKPIs?.baseline_year
                            ? `(${formatFY(plantKPIs.baseline_year, false)})`
                            : ""}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-semibold font-mono text-[#050505]">
                            {plantKPIs?.baseline_gei !== null &&
                              plantKPIs?.baseline_gei !== undefined
                              ? plantKPIs.baseline_gei.toFixed(4)
                              : "N/A"}
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium">
                            tCO₂e/ton
                          </span>
                        </div>
                        {(!plantKPIs?.baseline_gei ||
                          plantKPIs.baseline_gei === null) && (
                            <div className="text-[9px] text-gray-400 mt-1">
                              Not yet calculated
                            </div>
                          )}
                      </div>
                      <div className="h-8 w-8 flex items-center justify-center bg-gray-100 rounded">
                        <Activity
                          className="h-4 w-4 text-gray-600"
                          strokeWidth={2}
                        />
                      </div>
                    </div>
                  </Card>

                  {/* Current GEI - Always shows actual current value */}
                  <Card className="border-2 border-latspace-dark/30 bg-latspace-dark/5 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-1">
                          Current GEI{" "}
                          {plantKPIs?.current_period
                            ? `(${plantKPIs.current_period})`
                            : ""}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-semibold font-mono text-latspace-dark">
                            {plantKPIs?.current_gei !== null &&
                              plantKPIs?.current_gei !== undefined &&
                              plantKPIs?.current_gei > 0
                              ? plantKPIs.current_gei.toFixed(4)
                              : "N/A"}
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium">
                            tCO₂e/ton
                          </span>
                        </div>
                        {(plantKPIs?.current_gei === null ||
                          plantKPIs?.current_gei === undefined ||
                          plantKPIs?.current_gei === 0) && (
                            <div className="text-[9px] text-gray-400 mt-1">
                              Not yet calculated
                            </div>
                          )}
                      </div>
                      <div className="h-8 w-8 flex items-center justify-center bg-latspace-dark/10 rounded">
                        <TrendingDown
                          className="h-4 w-4 text-latspace-dark"
                          strokeWidth={2}
                        />
                      </div>
                    </div>
                  </Card>

                  {/* Predicted GEI - Only show when predicted toggle is on */}
                  {isPredicted && fiscalYearEndPredictedGei && (
                    <Card className="border-2 border-orange-300 bg-orange-50/30 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-1">
                            Predicted GEI ({fiscalYearEndPredictedGei.monthYear}
                            )
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-semibold font-mono text-orange-600">
                              {fiscalYearEndPredictedGei.value.toFixed(4)}
                            </span>
                            <span className="text-[10px] text-gray-500 font-medium">
                              tCO₂e/ton
                            </span>
                          </div>
                        </div>
                        <div className="h-8 w-8 flex items-center justify-center bg-orange-100 rounded">
                          <TrendingDown
                            className="h-4 w-4 text-orange-600"
                            strokeWidth={2}
                          />
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Target GEI */}
                  <Card className="border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-1">
                          Target GEI (FY 2025-26)
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-semibold font-mono text-blue-600">
                            {plantKPIs?.target_gei !== null &&
                              plantKPIs?.target_gei !== undefined
                              ? plantKPIs.target_gei.toFixed(4)
                              : "N/A"}
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium">
                            tCO₂e/ton
                          </span>
                        </div>
                      </div>
                      <div className="h-8 w-8 flex items-center justify-center bg-blue-50 rounded">
                        <Target
                          className="h-4 w-4 text-blue-600"
                          strokeWidth={2}
                        />
                      </div>
                    </div>
                  </Card>

                  {/* On-Track / Off-Track Status */}
                  <Card
                    className={`border-2 ${effectiveGei && plantKPIs?.target_gei
                      ? effectiveGei <= plantKPIs.target_gei
                        ? "border-green-200 bg-green-50/30"
                        : "border-red-200 bg-red-50/30"
                      : "border-gray-200 bg-gray-50/30"
                      } p-4`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-500 mb-1">
                          Target Status
                        </div>
                        <div className="flex items-baseline gap-3">
                          <span
                            className={`text-xl font-bold uppercase tracking-tight ${effectiveGei && plantKPIs?.target_gei
                              ? effectiveGei <= plantKPIs.target_gei
                                ? "text-green-600"
                                : "text-red-600"
                              : "text-gray-600"
                              }`}
                          >
                            {effectiveGei && plantKPIs?.target_gei
                              ? effectiveGei <= plantKPIs.target_gei
                                ? "ON TRACK"
                                : "OFF TRACK"
                              : "N/A"}
                          </span>
                          {deltaGEIValue !== undefined && plantKPIs && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className={`text-lg font-bold font-mono cursor-help ${deltaGEIValue >= 0 ? "text-green-600" : "text-red-600"}`}
                                >
                                  ({deltaGEIValue > 0 ? "+" : ""}
                                  {deltaGEIValue.toFixed(4)})
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="bottom"
                                className="bg-white text-[#0A0A0A] p-3 rounded-lg shadow-xl max-w-xs border border-[#0A0A0A]/10"
                              >
                                <p className="text-[10px] font-semibold text-[#5A5A5A] uppercase tracking-wider mb-2">
                                  Calculation Formula
                                </p>
                                <div className="font-mono text-xs space-y-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[#5A5A5A]">
                                      Delta GEI
                                    </span>
                                    <span className="text-[#5A5A5A]">=</span>
                                    <span className="text-[#5A5A5A]">
                                      Target - Current
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[#5A5A5A]">=</span>
                                    <span className="text-blue-600">
                                      {plantKPIs.target_gei?.toFixed(4)}
                                    </span>
                                    <span className="text-[#5A5A5A]">-</span>
                                    <span className="text-emerald-600">
                                      {plantKPIs.current_gei?.toFixed(4)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 pt-1 border-t border-[#0A0A0A]/10">
                                    <span className="text-[#5A5A5A]">=</span>
                                    <span
                                      className={`text-lg font-bold ${deltaGEIValue >= 0 ? "text-green-600" : "text-red-600"}`}
                                    >
                                      {deltaGEIValue > 0 ? "+" : ""}
                                      {deltaGEIValue.toFixed(4)}
                                    </span>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>

                        {(!effectiveGei || !plantKPIs?.target_gei) && (
                          <div className="text-[9px] text-gray-400 mt-1">
                            GEI not yet calculated
                          </div>
                        )}
                      </div>
                      <div
                        className={`h-8 w-8 flex items-center justify-center rounded ${effectiveGei && plantKPIs?.target_gei
                          ? effectiveGei <= plantKPIs.target_gei
                            ? "bg-green-500/10"
                            : "bg-red-500/10"
                          : "bg-gray-500/10"
                          }`}
                      >
                        {effectiveGei &&
                          plantKPIs?.target_gei &&
                          effectiveGei <= plantKPIs.target_gei ? (
                          <CheckCircle2
                            className="h-4 w-4 text-green-600"
                            strokeWidth={2}
                          />
                        ) : (
                          <AlertTriangle
                            className={`h-4 w-4 ${effectiveGei && plantKPIs?.target_gei
                              ? "text-red-600"
                              : "text-gray-600"
                              }`}
                            strokeWidth={2}
                          />
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              </section>

              {/* View Mode Toggle Buttons */}
              <div className="flex items-center justify-center gap-4">
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode("monthly")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === "monthly"
                      ? "bg-white text-[#0A0A0A] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setViewMode("quarterly")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === "quarterly"
                      ? "bg-white text-[#0A0A0A] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    Quarterly
                  </button>
                  <button
                    onClick={() => setViewMode("yearly")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === "yearly"
                      ? "bg-white text-[#0A0A0A] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    Yearly
                  </button>
                </div>

                {/* Current/Predicted Toggle */}
                <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg border border-gray-200">
                  <Label
                    htmlFor="current-predicted-toggle"
                    className={`text-sm font-medium cursor-pointer transition-colors ${!isPredicted ? "text-[#0A0A0A]" : "text-gray-400"
                      }`}
                  >
                    Current
                  </Label>
                  <Switch
                    id="current-predicted-toggle"
                    checked={isPredicted}
                    onCheckedChange={setIsPredicted}
                    className="data-[state=checked]:bg-blue-600"
                  />
                  <Label
                    htmlFor="current-predicted-toggle"
                    className={`text-sm font-medium cursor-pointer transition-colors ${isPredicted ? "text-blue-600" : "text-gray-400"
                      }`}
                  >
                    Predicted
                  </Label>
                </div>

                {isPredicted && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg border border-gray-200">
                    <Label
                      htmlFor="ml-planned-toggle"
                      className={`text-sm font-medium cursor-pointer transition-colors ${!isML ? "text-[#0A0A0A]" : "text-gray-400"
                        }`}
                    >
                      ML
                    </Label>
                    <Switch
                      id="ml-planned-toggle"
                      checked={isML}
                      onCheckedChange={setIsML}
                      className="data-[state=checked]:bg-blue-600"
                    />
                    <Label
                      htmlFor="ml-planned-toggle"
                      className={`text-sm font-medium cursor-pointer transition-colors ${isML ? "text-blue-600" : "text-gray-400"
                        }`}
                    >
                      Planned
                    </Label>
                  </div>
                )}
              </div>

              {/* GHG Emissions Intensity Trend */}
              <section className="space-y-4">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">
                  GHG Emissions Intensity Trend
                  {isPredicted ? " - Predicted" : ""}
                </h2>

                <div className="h-[400px] w-full">
                  <GeiChart
                    siteId={siteId}
                    siteName={userPlant?.name || "Unknown Plant"}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    isPredicted={isPredicted}
                    isML={isML}
                    baselineGEI={plantKPIs?.baseline_gei}
                  />
                </div>
              </section>

              {/* Impact Analysis - Only show when Predicted mode is enabled */}
              {isPredicted && (
                <>
                  <div className="mt-2">
                    <h3 className="text-sm font-semibold text-gray-600">
                      Impact Analysis (Predicted)
                    </h3>
                  </div>

                  {/* Delta GEI and Financial Impact Cards - Side by Side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    <DeltaGeiCard
                      currentGei={effectiveGei}
                      targetGei={plantKPIs?.target_gei ?? 0}
                      production={productionData}
                      isPredicted={isPredicted}
                    />
                    <FinancialImpactCard totalGhgDelta={totalGhgDelta} />
                  </div>
                </>
              )}

              <div className="h-[400px] w-full">
                <EmissionsTrendChart
                  siteId={siteId}
                  siteName={userPlant?.name || "Unknown Plant"}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                />
              </div>

              {/* Financial Impact Calculator - Always Visible */}
              <section className="space-y-4 mt-8">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">
                  Financial Impact Calculator
                </h2>
                <FinancialImpactCalculator
                  plantId={siteId}
                  currentGeiOptions={[
                    {
                      label: plantKPIs?.current_period || "Current Period",
                      value: plantKPIs?.current_gei || 0.0,
                    },
                  ]}
                  targetGeiOptions={[
                    {
                      label: `FY ${plantKPIs?.target_year || 2025}-${((plantKPIs?.target_year || 2025) + 1).toString().slice(-2)}`,
                      value: plantKPIs?.target_gei || 0,
                    },
                  ]}
                  productionOptions={[
                    {
                      label: "Avg Yearly Production",
                      value: productionData || 115388,
                    },
                    { label: "Annual Installed Capacity", value: 150000 },
                    {
                      label: "YTD Production",
                      value:
                        predictedGeiData.ytdProduction ||
                        Math.round((productionData || 115388) * 0.67),
                    },
                  ]}
                  defaultCurrentGei={plantKPIs?.current_gei || 0.0}
                  defaultTargetGei={plantKPIs?.target_gei || 0.0}
                  defaultProduction={productionData || 0}
                  defaultCccRate={500}
                  showPredictedOption={isPredicted}
                  predictedGeiValue={predictedGeiData.predictedGei ?? undefined}
                  predictedGeiLabel={
                    isML ? "Predicted GEI (Planned)" : "Predicted GEI (ML)"
                  }
                />
              </section>
            </div>
          ) : siteId ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="text-gray-400 text-sm">Loading plant data...</div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="bg-gray-50 p-6 rounded-full mb-4">
                <FileText className="h-12 w-12 text-gray-300" />
              </div>
              <p className="text-gray-500 mt-2">
                Please select a plant to view insights.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
