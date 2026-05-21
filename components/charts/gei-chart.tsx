"use client";

import { useState, useMemo, useEffect, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  CalendarIcon,
  BarChart3,
  LineChart as LineChartIcon,
  TrendingUp,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { GeiDataPoint } from "@/lib/types";

interface GeiChartProps {
  siteId: string;
  siteName: string;
  viewMode?: "monthly" | "quarterly" | "yearly";
  onViewModeChange?: (mode: "monthly" | "quarterly" | "yearly") => void;
  isPredicted?: boolean;
  isML?: boolean; // true = ML mode, false = Planned mode (only relevant when isPredicted is true)
  showPlantNameAsTitle?: boolean; // If true, show plant name instead of default title
  hideChartTypeToggle?: boolean; // If true, hide chart type toggle and force line chart
  hideYtdToggle?: boolean; // If true, hide YTD toggle and force GEI mode
  currentGEI?: number | null; // Current month GEI value
  targetGEI?: number | null; // Target GEI value
  baselineGEI?: number | null; // Baseline GEI value
}

// Helper to get financial year from date
function getFinancialYear(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 4 ? year : year - 1;
}

// Calculate Moving Average for trend analysis
function calculateMovingAverage(
  values: (number | null)[],
  window: number = 3,
): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    // Get the last 'window' valid values up to current index
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
}

// Calculate trend (slope) from moving average - used for predictions
function calculateTrendFromMA(maValues: (number | null)[]): number {
  // Get last few valid MA values to calculate trend direction
  const validMA = maValues
    .map((v, i) => ({ value: v, index: i }))
    .filter((item) => item.value !== null) as {
      value: number;
      index: number;
    }[];

  if (validMA.length < 2) return 0;

  // Use last 3 points (or all if less) to calculate average slope
  const recentPoints = validMA.slice(-3);
  let totalSlope = 0;

  for (let i = 1; i < recentPoints.length; i++) {
    const slope =
      (recentPoints[i].value - recentPoints[i - 1].value) /
      (recentPoints[i].index - recentPoints[i - 1].index);
    totalSlope += slope;
  }

  return totalSlope / (recentPoints.length - 1);
}

// Convert calendar month (1-12) to financial year month index (0-11, where Apr=0, Mar=11)
function calendarMonthToFYIndex(calMonth: number): number {
  // Apr(4)->0, May(5)->1, ..., Dec(12)->8, Jan(1)->9, Feb(2)->10, Mar(3)->11
  return calMonth >= 4 ? calMonth - 4 : calMonth + 8;
}

// FY months in order for display: Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar
const FY_MONTH_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const FY_MONTH_NAMES = [
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
];

export const GeiChart = memo(function GeiChart({
  siteId,
  siteName,
  viewMode: externalViewMode,
  onViewModeChange,
  isPredicted = false,
  isML = true,
  showPlantNameAsTitle = false,
  hideChartTypeToggle = false,
  hideYtdToggle = false,
  currentGEI,
  targetGEI,
  baselineGEI,
}: GeiChartProps) {
  const [internalViewMode, setInternalViewMode] = useState<
    "monthly" | "quarterly" | "yearly"
  >("monthly");
  const viewMode = externalViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  // Force line chart if toggle is hidden
  const effectiveChartType = hideChartTypeToggle ? "line" : chartType;
  const showTrendline = isPredicted;
  const [showYtdGei, setShowYtdGei] = useState(false); // Toggle between GEI and YTD GEI
  // Force GEI mode (not YTD) if toggle is hidden
  const effectiveShowYtdGei = hideYtdToggle ? false : showYtdGei;

  // Default date range: Apr 2025 to Mar 2026 (fiscal year)
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(2025, 3, 1), // Apr 1, 2025
    to: new Date(2026, 2, 31), // Mar 31, 2026
  });

  const [tempDateRange, setTempDateRange] = useState<{
    from?: Date;
    to?: Date;
  }>(dateRange);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // State for quarterly view controls
  const [selectedFinancialYear, setSelectedFinancialYear] =
    useState<number>(2025); // Default FY 2025-26
  const [selectedQuarter, setSelectedQuarter] = useState<string>("full-year");

  // State for yearly view - default years 2023-2030
  const [yearlyStartYear, setYearlyStartYear] = useState<number>(2023);
  const [yearlyEndYear, setYearlyEndYear] = useState<number>(2030);

  // Fetch data
  const {
    data: rawData,
    isLoading,
    error,
  } = useQuery<GeiDataPoint[]>({
    queryKey: ["gei", siteId, "trend"],
    queryFn: async () => {
      try {
        const { geiApi } = await import("@/lib/api/gei");
        // We pass 2024 as a default, but the backend returns all data anyway
        const response = await geiApi.getPlantTrend(siteId, 2024, false);

        if (response.success && response.data && response.data.monthly_data) {
          return response.data.monthly_data;
        }
        return [];
      } catch (error) {
        console.error("Error fetching GEI data:", error);
        return [];
      }
    },
    enabled: !!siteId,
  });

  // Process data based on filters
  const processedData = useMemo(() => {
    if (!rawData) return [];

    // Yearly View Logic - aggregate by calendar year
    if (viewMode === "yearly") {
      const yearlyData: any[] = [];

      // Generate years from yearlyStartYear to yearlyEndYear
      for (let year = yearlyStartYear; year <= yearlyEndYear; year++) {
        // Filter data for this calendar year
        const yearData = rawData.filter((d) => {
          const dataYear = d.calendar_year ?? d.financial_year;
          return dataYear === year;
        });

        // Filter out null values for calculation
        const validData = yearData.filter(
          (d) => d.gei !== null && d.gei !== undefined,
        );

        if (validData.length === 0) {
          yearlyData.push({
            month: year.toString(),
            calendar_year: year,
            gei: null,
            isActual: false,
          });
        } else {
          // Calculate average GEI for the year
          const avgGei =
            validData.reduce((sum, d) => sum + (d.gei || 0), 0) /
            validData.length;
          yearlyData.push({
            month: year.toString(),
            calendar_year: year,
            gei: parseFloat(avgGei.toFixed(4)),
            isActual: true,
          });
        }
      }

      return yearlyData;
    }

    // 1. Filter by Date Range
    if (viewMode === "monthly") {
      const fromTime = dateRange.from.getTime();
      const toTime = dateRange.to.getTime();

      // Generate all months in the range
      const monthsInRange: any[] = [];
      let currentDate = new Date(dateRange.from);
      currentDate.setDate(1); // Start of month

      while (currentDate <= dateRange.to) {
        const monthNum = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();
        const fy = monthNum >= 4 ? year : year - 1;

        // Find matching data
        const match = rawData?.find((d) => {
          const dataYear = d.calendar_year ?? d.financial_year;
          return dataYear === year && d.month_num === monthNum;
        });

        monthsInRange.push({
          month: format(currentDate, "MMM"),
          month_num: monthNum,
          financial_year: fy,
          gei: match ? match.gei : null, // Use null for missing data
          isActual: true,
        });

        // Next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      return monthsInRange;
    } else {
      // Quarterly View Logic
      // Database stores calendar year, so we need to map FY to calendar year:
      // FY 2025-26: Q1-Q3 (Apr-Dec) uses calendar year 2025, Q4 (Jan-Mar) uses calendar year 2026
      if (!rawData) return [];

      // Helper to get the correct calendar year for a month in a financial year
      const getCalendarYear = (month: number) =>
        month <= 3 ? selectedFinancialYear + 1 : selectedFinancialYear;

      // Aggregate by Quarter if showing full year in quarterly view
      if (selectedQuarter === "full-year") {
        const quarters = [
          { name: "Q1", months: [4, 5, 6], label: "Apr-Jun" },
          { name: "Q2", months: [7, 8, 9], label: "Jul-Sep" },
          { name: "Q3", months: [10, 11, 12], label: "Oct-Dec" },
          { name: "Q4", months: [1, 2, 3], label: "Jan-Mar" },
        ];

        const aggregated = quarters.map((q) => {
          // For each quarter, filter data matching the correct calendar year and months
          const qData = rawData.filter((d) => {
            if (!q.months.includes(d.month_num)) return false;
            const expectedCalYear = getCalendarYear(d.month_num);
            return d.financial_year === expectedCalYear;
          });

          // Filter out null values for calculation
          const validData = qData.filter((d) => d.gei !== null);

          if (validData.length === 0) {
            // Return placeholder with null gei
            return {
              month: q.name,
              fullLabel: `${q.name} (${q.label})`,
              gei: null,
              financial_year: selectedFinancialYear,
              isActual: true,
            };
          }

          const avgGei =
            validData.reduce((sum, d) => sum + (d.gei || 0), 0) /
            validData.length;
          return {
            month: q.name, // Display name on X-axis
            fullLabel: `${q.name} (${q.label})`,
            gei: parseFloat(avgGei.toFixed(4)),
            financial_year: selectedFinancialYear,
            isActual: true,
          };
        });

        return aggregated;
      } else {
        // If a specific quarter is selected, show the months of that quarter
        const quarterMonths: Record<string, number[]> = {
          q1: [4, 5, 6],
          q2: [7, 8, 9],
          q3: [10, 11, 12],
          q4: [1, 2, 3],
        };
        const targetMonths = quarterMonths[selectedQuarter] || [];

        const filledMonths = targetMonths.map((m) => {
          // Get the correct calendar year for this month
          const calYear = getCalendarYear(m);
          // Find data matching this month AND the correct calendar year
          const match = rawData.find(
            (d) => d.month_num === m && d.financial_year === calYear,
          );
          const date = new Date(calYear, m - 1, 1);

          return {
            month: format(date, "MMM"),
            month_num: m,
            financial_year: selectedFinancialYear,
            gei: match ? match.gei : null,
            isActual: true,
          };
        });

        return filledMonths;
      }
    }
  }, [
    rawData,
    viewMode,
    dateRange,
    selectedFinancialYear,
    selectedQuarter,
    yearlyStartYear,
    yearlyEndYear,
  ]);

  // Use backend-calculated YTD GEI values directly
  // The backend calculates YTD GEI = cumulative_emissions / cumulative_production
  // This ensures consistency with how monthly GEI is calculated
  const ytdProcessedData = useMemo(() => {
    if (
      !effectiveShowYtdGei ||
      processedData.length === 0 ||
      viewMode === "yearly"
    ) {
      return processedData;
    }

    // Find the last month with actual YTD data (for forecast starting point)
    let lastActualIdx = -1;
    let lastYtdGei: number | null = null;
    let lastYtdEmissions = 0;
    let lastYtdProduction = 0;

    // First pass: find actual data and calculate average production for forecasting
    const actualData: { ytdGei: number; production: number; index: number }[] =
      [];

    processedData.forEach((dataPoint: any, index: number) => {
      const matchingRaw = rawData?.find((d: any) => {
        const dataCalYear = d.calendar_year ?? d.financial_year;
        if (viewMode === "monthly") {
          const dpDate = new Date(dateRange.from);
          dpDate.setMonth(dpDate.getMonth() + index);
          const dpYear = dpDate.getFullYear();
          const dpMonth = dpDate.getMonth() + 1;
          return dataCalYear === dpYear && d.month_num === dpMonth;
        }
        return false;
      });

      // Use backend-calculated YTD values
      if (matchingRaw?.ytd_gei !== null && matchingRaw?.ytd_gei !== undefined) {
        lastActualIdx = index;
        lastYtdGei = matchingRaw.ytd_gei;
        lastYtdEmissions = matchingRaw.ytd_emissions ?? 0;
        lastYtdProduction = matchingRaw.ytd_production ?? 0;

        if (matchingRaw.equivalent_production) {
          actualData.push({
            ytdGei: matchingRaw.ytd_gei,
            production: matchingRaw.equivalent_production,
            index,
          });
        }
      }
    });

    // Calculate average production for forecasting
    const avgProduction =
      actualData.length > 0
        ? actualData.reduce((sum, d) => sum + d.production, 0) /
        actualData.length
        : 0;

    // Calculate YTD GEI trend for forecasting
    const ytdGeiValues = actualData.map((d) => d.ytdGei);
    const movingAvg = calculateMovingAverage(ytdGeiValues, 3);
    const lastMA =
      movingAvg.length > 0 ? movingAvg[movingAvg.length - 1] : null;
    const ytdGeiTrend = calculateTrendFromMA(movingAvg);

    // Track cumulative values for forecasting
    let cumulativeEmissions = lastYtdEmissions;
    let cumulativeProduction = lastYtdProduction;
    let monthsAfterLastActual = 0;

    // Second pass: build YTD data using backend values + forecast
    return processedData.map((dataPoint: any, index: number) => {
      const matchingRaw = rawData?.find((d: any) => {
        const dataCalYear = d.calendar_year ?? d.financial_year;
        if (viewMode === "monthly") {
          const dpDate = new Date(dateRange.from);
          dpDate.setMonth(dpDate.getMonth() + index);
          const dpYear = dpDate.getFullYear();
          const dpMonth = dpDate.getMonth() + 1;
          return dataCalYear === dpYear && d.month_num === dpMonth;
        }
        return false;
      });

      // Check if backend has YTD data for this month
      const hasBackendYtdData =
        matchingRaw?.ytd_gei !== null && matchingRaw?.ytd_gei !== undefined;

      if (hasBackendYtdData) {
        // Use backend-calculated YTD values directly
        return {
          ...dataPoint,
          gei: matchingRaw.ytd_gei, // Display YTD GEI
          ytdEmissions: matchingRaw.ytd_emissions,
          ytdProduction: matchingRaw.ytd_production,
          monthlyEmissions:
            matchingRaw.total_ghg_emissions ??
            matchingRaw.total_direct_and_indirect_emission,
          monthlyProduction: matchingRaw.equivalent_production,
          isPredicted: false,
          predictedYtdGei: null,
        };
      } else if (
        showTrendline &&
        index > lastActualIdx &&
        lastActualIdx >= 0 &&
        avgProduction > 0 &&
        lastMA !== null
      ) {
        // Forecast mode: estimate future months
        monthsAfterLastActual++;

        // Predict YTD GEI using trend (gradual change from last actual YTD GEI)
        const predictedYtdGei = lastMA + ytdGeiTrend * monthsAfterLastActual;

        // Estimate monthly values for reference
        // Back-calculate what emissions would be needed to achieve this YTD GEI
        const estimatedMonthlyProduction = avgProduction;
        cumulativeProduction += estimatedMonthlyProduction;

        // Calculate what emissions would give this YTD GEI
        // YTD GEI = cumulative_emissions / cumulative_production
        // So: cumulative_emissions = YTD GEI * cumulative_production
        const targetCumulativeEmissions =
          predictedYtdGei * cumulativeProduction;
        const estimatedMonthlyEmissions =
          targetCumulativeEmissions - cumulativeEmissions;
        cumulativeEmissions = targetCumulativeEmissions;

        return {
          ...dataPoint,
          gei: null, // No actual GEI
          ytdEmissions: cumulativeEmissions,
          ytdProduction: cumulativeProduction,
          monthlyEmissions: estimatedMonthlyEmissions,
          monthlyProduction: estimatedMonthlyProduction,
          isPredicted: true,
          predictedYtdGei: parseFloat(predictedYtdGei.toFixed(4)),
        };
      } else {
        // No data and no forecast
        return {
          ...dataPoint,
          gei: null,
          ytdEmissions: null,
          ytdProduction: null,
          monthlyEmissions: null,
          monthlyProduction: null,
          isPredicted: false,
          predictedYtdGei: null,
        };
      }
    });
  }, [
    processedData,
    rawData,
    effectiveShowYtdGei,
    showTrendline,
    viewMode,
    dateRange,
  ]);

  // Generate FY-based data for trendline prediction (Apr to Mar)
  const fyBasedData = useMemo(() => {
    if (
      !showTrendline ||
      !rawData ||
      viewMode !== "quarterly" ||
      selectedQuarter !== "full-year"
    ) {
      return null;
    }

    // For the selected FY, generate all 12 months in FY order
    const fyData = FY_MONTH_ORDER.map((calMonth, fyIdx) => {
      // Get calendar year for this month in the selected FY
      // FY 2024-25: Apr-Dec 2024, Jan-Mar 2025
      const calYear =
        calMonth >= 4 ? selectedFinancialYear : selectedFinancialYear + 1;

      // Find matching data from rawData (which stores calendar year/month)
      const match = rawData.find((d) => {
        const dataCalYear = d.calendar_year ?? d.financial_year;
        return dataCalYear === calYear && d.month_num === calMonth;
      });

      return {
        month: FY_MONTH_NAMES[fyIdx],
        month_num: calMonth,
        calendar_year: calYear,
        financial_year: selectedFinancialYear,
        gei: match?.gei ?? null,
        fyIndex: fyIdx, // 0-11 for Apr-Mar
        isActual: match?.gei !== null && match?.gei !== undefined,
      };
    });

    return fyData;
  }, [
    rawData,
    showTrendline,
    viewMode,
    selectedQuarter,
    selectedFinancialYear,
  ]);

  // Calculate trendline data with predictions using Moving Average
  const chartDataWithTrendline = useMemo(() => {
    // Use YTD data when YTD mode is enabled
    const dataToProcess = effectiveShowYtdGei
      ? ytdProcessedData
      : processedData;

    if (!showTrendline || effectiveShowYtdGei || dataToProcess.length === 0) {
      return dataToProcess;
    }

    // Use FY-based data for quarterly full-year view, otherwise use dataToProcess
    const dataToUse = fyBasedData || dataToProcess;

    // Extract GEI values in order
    const geiValues = dataToUse.map((d: any) => d.gei);

    // Calculate 3-month moving average for actual data only
    const movingAvgValues = calculateMovingAverage(geiValues, 3);

    // Find the last index with actual data
    let lastActualIdx = -1;
    for (let i = geiValues.length - 1; i >= 0; i--) {
      if (geiValues[i] !== null && geiValues[i] !== undefined) {
        lastActualIdx = i;
        break;
      }
    }

    if (lastActualIdx < 1) {
      // Need at least 2 data points
      return dataToUse;
    }

    // Get the last valid moving average value and trend for predictions
    const lastMA = movingAvgValues[lastActualIdx];
    const trend = calculateTrendFromMA(
      movingAvgValues.slice(0, lastActualIdx + 1),
    );

    // Build result with trendline (MA) only for actual data, predictions for future
    return dataToUse.map((d: any, idx: number) => {
      const hasActualData = d.gei !== null && d.gei !== undefined;

      if (hasActualData) {
        // For actual data: show moving average as trendline
        return {
          ...d,
          trendline: movingAvgValues[idx],
          predicted: null,
          isPredicted: false,
        };
      } else if (idx > lastActualIdx && lastMA !== null) {
        // For future months (after last actual): predict based on MA + trend
        const monthsAhead = idx - lastActualIdx;
        let predictedValue = parseFloat(
          (lastMA + trend * monthsAhead).toFixed(4),
        );

        // In Planned mode (isML = true), generate random value between (value - 0.3) and (value + 0.3)
        if (isML) {
          const a = predictedValue + 0.3;
          const b = predictedValue - 0.3;
          const randomValue = b + Math.random() * (a - b);
          predictedValue = parseFloat(randomValue.toFixed(4));
        }

        return {
          ...d,
          trendline: null, // No trendline for future (no backfitting)
          predicted: predictedValue,
          isPredicted: true,
        };
      }

      // For months before first actual data
      return {
        ...d,
        trendline: null,
        predicted: null,
        isPredicted: false,
      };
    });
  }, [
    processedData,
    ytdProcessedData,
    fyBasedData,
    showTrendline,
    effectiveShowYtdGei,
    isML,
  ]);

  // Calculate trend statistics for display
  const trendStats = useMemo(() => {
    if (!showTrendline || processedData.length === 0) return null;

    const dataToUse = fyBasedData || processedData;

    // Extract GEI values
    const geiValues = dataToUse.map((d: any) => d.gei);
    const validGeiCount = geiValues.filter(
      (v: any) => v !== null && v !== undefined,
    ).length;

    if (validGeiCount < 2) return null;

    // Calculate moving average
    const movingAvgValues = calculateMovingAverage(geiValues, 3);

    // Find last actual data index
    let lastActualIdx = -1;
    for (let i = geiValues.length - 1; i >= 0; i--) {
      if (geiValues[i] !== null && geiValues[i] !== undefined) {
        lastActualIdx = i;
        break;
      }
    }

    const lastMA = movingAvgValues[lastActualIdx];
    const trend = calculateTrendFromMA(
      movingAvgValues.slice(0, lastActualIdx + 1),
    );
    const trendDirection =
      trend < -0.001 ? "decreasing" : trend > 0.001 ? "increasing" : "stable";

    // Predict year-end value (last index in data = March for FY)
    const yearEndIdx = dataToUse.length - 1;
    const monthsToYearEnd = yearEndIdx - lastActualIdx;
    let predictedYearEnd =
      lastMA !== null
        ? parseFloat((lastMA + trend * monthsToYearEnd).toFixed(4))
        : null;

    // In Planned mode (isML = true), generate random value between (value - 0.1) and (value + 0.1)
    if (predictedYearEnd !== null && isML) {
      const a = predictedYearEnd + 0.1;
      const b = predictedYearEnd - 0.1;
      const randomValue = b + Math.random() * (a - b);
      predictedYearEnd = parseFloat(randomValue.toFixed(4));
    }

    // Calculate percentage change from first actual to predicted year-end
    const firstActualValue = geiValues.find(
      (v: any) => v !== null && v !== undefined,
    );
    const percentChange =
      firstActualValue && predictedYearEnd
        ? (
          ((predictedYearEnd - firstActualValue) / firstActualValue) *
          100
        ).toFixed(1)
        : null;

    return {
      monthlyChange: trend.toFixed(4),
      trend: trendDirection,
      predictedYearEnd,
      percentChange,
      dataPoints: validGeiCount,
      lastMA: lastMA?.toFixed(4),
      monthsRemaining: monthsToYearEnd,
    };
  }, [processedData, fyBasedData, showTrendline, isML]);

  // Handlers
  const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range) setTempDateRange(range);
  };

  const handleConfirmDateRange = () => {
    if (tempDateRange?.from && tempDateRange?.to) {
      setDateRange({ from: tempDateRange.from, to: tempDateRange.to });
      setIsPopoverOpen(false);
    }
  };

  return (
    <Card className="p-6 border border-gray-200 shadow-sm h-full flex flex-col bg-white">
      {/* Header Controls */}
      <div className="flex flex-col gap-1 mb-1">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <h3 className="text-lg font-semibold text-[#0A0A0A]">
            {showPlantNameAsTitle
              ? siteName
              : effectiveShowYtdGei
                ? "Year-to-Date GHG Emissions Intensity (YTD GEI)"
                : "GHG Emissions Intensity (GEI)"}
          </h3>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle - Only show if not controlled externally */}
            {!externalViewMode && (
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("monthly")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    viewMode === "monthly"
                      ? "bg-white text-[#0A0A0A] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setViewMode("quarterly")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    viewMode === "quarterly"
                      ? "bg-white text-[#0A0A0A] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Quarterly
                </button>
              </div>
            )}

            {/* Chart Type Toggle */}
            {!hideChartTypeToggle && (
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setChartType("line")}
                  className={`p-1.5 rounded-md transition-all ${
                    chartType === "line"
                      ? "bg-white text-[#0A0A0A] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  title="Line Chart"
                >
                  <LineChartIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setChartType("bar")}
                  className={`p-1.5 rounded-md transition-all ${
                    chartType === "bar"
                      ? "bg-white text-[#0A0A0A] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  title="Bar Chart"
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* YTD GEI Toggle - Only for monthly view */}
            {!hideYtdToggle && viewMode === "monthly" && (
              <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg border border-gray-200">
                <Label
                  htmlFor="ytd-toggle"
                  className={`text-xs font-medium cursor-pointer transition-colors ${!showYtdGei ? "text-[#0A0A0A]" : "text-gray-400"
                    }`}
                >
                  GEI
                </Label>
                <Switch
                  id="ytd-toggle"
                  checked={showYtdGei}
                  onCheckedChange={setShowYtdGei}
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label
                  htmlFor="ytd-toggle"
                  className={`text-xs font-medium cursor-pointer transition-colors ${showYtdGei ? "text-blue-600" : "text-gray-400"
                    }`}
                >
                  YTD GEI
                </Label>
              </div>
            )}
          </div>
        </div>

        {/* Trend Statistics Banner */}
        {/* {showTrendline && trendStats && (
          <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-100">
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-4 w-4 ${trendStats.trend === "decreasing" ? "text-emerald-600" : trendStats.trend === "increasing" ? "text-amber-600" : "text-gray-500"}`} />
              <span className="text-xs font-medium text-gray-700">
                Trend: <span className={trendStats.trend === "decreasing" ? "text-emerald-600" : trendStats.trend === "increasing" ? "text-amber-600" : "text-gray-600"}>
                  {trendStats.trend === "decreasing" ? "↓ Improving" : trendStats.trend === "increasing" ? "↑ Worsening" : "→ Stable"}
                </span>
              </span>
            </div>
            <div className="h-4 w-px bg-emerald-200" />
            <div className="text-xs text-gray-600">
              <span className="font-medium">3-Mo Avg:</span>{" "}
              <span className="text-gray-900 font-semibold">{trendStats.lastMA}</span>
            </div>
            <div className="h-4 w-px bg-emerald-200" />
            <div className="text-xs text-gray-600">
              <span className="font-medium">Predicted Mar:</span>{" "}
              <span className="text-gray-900 font-semibold">{trendStats.predictedYearEnd}</span>
              {trendStats.percentChange && (
                <span className={`ml-1 ${parseFloat(trendStats.percentChange) < 0 ? "text-emerald-600" : "text-amber-600"}`}>
                  ({parseFloat(trendStats.percentChange) > 0 ? "+" : ""}{trendStats.percentChange}%)
                </span>
              )}
            </div>
            {trendStats.monthsRemaining > 0 && (
              <>
                <div className="h-4 w-px bg-emerald-200" />
                <div className="text-xs text-gray-500">
                  {trendStats.monthsRemaining} months to forecast
                </div>
              </>
            )}
          </div>
        )} */}

        {/* Filters */}
        <div className="flex items-center justify-end gap-3">
          {viewMode === "monthly" ? (
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 border-gray-200 text-xs font-normal"
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-gray-500" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={tempDateRange as any}
                  onSelect={handleDateSelect}
                  numberOfMonths={2}
                />
                <div className="p-3 border-t border-gray-100 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPopoverOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleConfirmDateRange}>
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          ) : viewMode === "yearly" ? (
            <div className="text-sm text-gray-600">
              Showing years {yearlyStartYear} - {yearlyEndYear}
            </div>
          ) : (
            <div className="flex gap-2">
              <Select
                value={selectedFinancialYear.toString()}
                onValueChange={(v) => setSelectedFinancialYear(parseInt(v))}
              >
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Select FY" />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025].map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      FY {year}-{String(year + 1).slice(-2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedQuarter}
                onValueChange={setSelectedQuarter}
              >
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-year">Full Year</SelectItem>
                  <SelectItem value="q1">Q1 (Apr-Jun)</SelectItem>
                  <SelectItem value="q2">Q2 (Jul-Sep)</SelectItem>
                  <SelectItem value="q3">Q3 (Oct-Dec)</SelectItem>
                  <SelectItem value="q4">Q4 (Jan-Mar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            Loading data...
          </div>
        ) : processedData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            No data available for selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {effectiveChartType === "line" ? (
              <LineChart
                data={chartDataWithTrendline}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f0f0f0"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#666", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#666", fontSize: 12 }}
                  label={{
                    value: "tCO₂e/ton",
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: "#999", fontSize: 12 },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  cursor={{ stroke: "#ddd" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0]?.payload;
                    if (!data) return null;

                    const hasActual =
                      data.gei !== null && data.gei !== undefined;
                    const hasTrendline =
                      showTrendline &&
                      !effectiveShowYtdGei &&
                      data.trendline !== null &&
                      data.trendline !== undefined;
                    const hasPredicted =
                      showTrendline &&
                      !effectiveShowYtdGei &&
                      data.predicted !== null &&
                      data.predicted !== undefined;
                    const hasYtdForecast =
                      effectiveShowYtdGei &&
                      data.isPredicted &&
                      data.predictedYtdGei !== null;
                    const hasAnyData =
                      hasActual ||
                      hasTrendline ||
                      hasPredicted ||
                      hasYtdForecast;

                    return (
                      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
                        <p className="font-medium text-gray-900 mb-1">
                          {label}
                        </p>
                        {effectiveShowYtdGei ? (
                          // YTD GEI Mode tooltip
                          <>
                            {hasActual && (
                              <>
                                <p className="text-sm text-blue-600">
                                  <span className="inline-block w-2 h-2 rounded-full bg-blue-600 mr-2" />
                                  YTD GEI:{" "}
                                  <span className="font-medium">
                                    {data.gei?.toFixed(4)}
                                  </span>{" "}
                                  tCO₂e/ton
                                </p>
                                {data.ytdEmissions !== null &&
                                  data.ytdProduction !== null && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                      <p className="text-xs text-gray-500 mb-1">
                                        Cumulative Values:
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        Emissions:{" "}
                                        <span className="font-medium">
                                          {data.ytdEmissions?.toFixed(2)}
                                        </span>{" "}
                                        tCO₂e
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        Production:{" "}
                                        <span className="font-medium">
                                          {data.ytdProduction?.toFixed(2)}
                                        </span>{" "}
                                        tons
                                      </p>
                                    </div>
                                  )}
                                {data.monthlyEmissions !== null &&
                                  data.monthlyProduction !== null && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                      <p className="text-xs text-gray-500 mb-1">
                                        This Month:
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        Emissions:{" "}
                                        <span className="font-medium">
                                          {data.monthlyEmissions?.toFixed(2)}
                                        </span>{" "}
                                        tCO₂e
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        Production:{" "}
                                        <span className="font-medium">
                                          {data.monthlyProduction?.toFixed(2)}
                                        </span>{" "}
                                        tons
                                      </p>
                                    </div>
                                  )}
                              </>
                            )}
                            {hasYtdForecast && (
                              <>
                                <p
                                  className={`text-sm ${isML ? "text-blue-600" : "text-amber-600"}`}
                                >
                                  <span
                                    className={`inline-block w-2 h-2 rounded-full mr-2 ${isML ? "bg-blue-500" : "bg-amber-500"}`}
                                  />
                                  Forecast YTD GEI:{" "}
                                  <span className="font-medium">
                                    {data.predictedYtdGei?.toFixed(4)}
                                  </span>{" "}
                                  tCO₂e/ton
                                </p>
                                {data.ytdEmissions !== null &&
                                  data.ytdProduction !== null && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                      <p className="text-xs text-gray-500 mb-1">
                                        Projected Cumulative:
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        Emissions:{" "}
                                        <span className="font-medium">
                                          {data.ytdEmissions?.toFixed(2)}
                                        </span>{" "}
                                        tCO₂e
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        Production:{" "}
                                        <span className="font-medium">
                                          {data.ytdProduction?.toFixed(2)}
                                        </span>{" "}
                                        tons
                                      </p>
                                    </div>
                                  )}
                                {data.monthlyEmissions !== null &&
                                  data.monthlyProduction !== null && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                      <p className="text-xs text-gray-500 mb-1">
                                        Estimated Month:
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        Emissions:{" "}
                                        <span className="font-medium">
                                          {data.monthlyEmissions?.toFixed(2)}
                                        </span>{" "}
                                        tCO₂e
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        Production:{" "}
                                        <span className="font-medium">
                                          {data.monthlyProduction?.toFixed(2)}
                                        </span>{" "}
                                        tons
                                      </p>
                                    </div>
                                  )}
                              </>
                            )}
                            {!hasActual && !hasYtdForecast && (
                              <p className="text-sm text-gray-400 italic">
                                No data available
                              </p>
                            )}
                          </>
                        ) : (
                          // Regular GEI Mode tooltip
                          <>
                            {hasActual && (
                              <p className="text-sm text-gray-600">
                                <span className="inline-block w-2 h-2 rounded-full bg-[#0A0A0A] mr-2" />
                                Actual:{" "}
                                <span className="font-medium">
                                  {data.gei?.toFixed(4)}
                                </span>
                              </p>
                            )}
                            {hasTrendline && (
                              <p className="text-sm text-gray-600">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                                3-Mo Avg:{" "}
                                <span className="font-medium">
                                  {data.trendline?.toFixed(4)}
                                </span>
                              </p>
                            )}
                            {hasPredicted && (
                              <p
                                className={`text-sm ${isML ? "text-blue-600" : "text-amber-600"}`}
                              >
                                <span
                                  className={`inline-block w-2 h-2 rounded-full mr-2 ${isML ? "bg-blue-500" : "bg-amber-500"}`}
                                />
                                Forecast:{" "}
                                <span className="font-medium">
                                  {data.predicted?.toFixed(4)}
                                </span>
                              </p>
                            )}
                            {!hasAnyData && (
                              <p className="text-sm text-gray-400 italic">
                                No data available
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  }}
                />
                {/* Legend for trendline mode */}
                {showTrendline && !effectiveShowYtdGei && (
                  <Legend
                    verticalAlign="top"
                    height={36}
                    content={() => (
                      <div className="flex items-center justify-center gap-6 text-xs mb-2">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-4 h-0.5 bg-emerald-500"
                            style={{ borderTop: "2px dashed #10b981" }}
                          />
                          <span className="text-gray-600">3-Month MA</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`w-4 h-0.5 ${isML ? "bg-blue-500" : "bg-amber-500"}`}
                          />
                          <span className="text-gray-600">Forecast</span>
                        </div>
                      </div>
                    )}
                  />
                )}
                {/* Legend for YTD GEI mode */}
                {effectiveShowYtdGei && (
                  <Legend
                    verticalAlign="top"
                    height={36}
                    content={() => (
                      <div className="flex items-center justify-center gap-6 text-xs mb-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-0.5 bg-blue-600" />
                          <span className="text-gray-600">Actual YTD GEI</span>
                        </div>
                        {showTrendline && (
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`w-4 h-0.5 ${isML ? "bg-blue-500" : "bg-amber-500"}`}
                            />
                            <span className="text-gray-600">
                              Forecast YTD GEI
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  />
                )}
                {/* GEI Line - changes color based on mode */}
                <Line
                  type="monotone"
                  dataKey="gei"
                  name={effectiveShowYtdGei ? "YTD GEI" : "Actual GEI"}
                  stroke={effectiveShowYtdGei ? "#2563eb" : "#0A0A0A"}
                  strokeWidth={2}
                  dot={{
                    r: 4,
                    fill: effectiveShowYtdGei ? "#2563eb" : "#0A0A0A",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
                  activeDot={{
                    r: 6,
                    fill: effectiveShowYtdGei ? "#2563eb" : "#0A0A0A",
                  }}
                  connectNulls={false}
                />
                {/* 3-Month Moving Average (dashed, only on actual data, not in YTD mode) */}
                {showTrendline && !effectiveShowYtdGei && (
                  <Line
                    type="monotone"
                    dataKey="trendline"
                    name="3-Month MA"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={false}
                    connectNulls={true}
                  />
                )}
                {/* Forecast line (future months only, not in YTD mode) */}
                {showTrendline && !effectiveShowYtdGei && (
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    name="Forecast"
                    stroke={isML ? "#2563eb" : "#f59e0b"}
                    strokeWidth={2}
                    dot={{
                      r: 4,
                      fill: isML ? "#2563eb" : "#f59e0b",
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    activeDot={{ r: 6, fill: isML ? "#2563eb" : "#f59e0b" }}
                    connectNulls={true}
                  />
                )}
                {/* Forecast line for YTD GEI mode */}
                {showTrendline && effectiveShowYtdGei && (
                  <Line
                    type="monotone"
                    dataKey="predictedYtdGei"
                    name="Forecast YTD GEI"
                    stroke={isML ? "#2563eb" : "#f59e0b"}
                    strokeWidth={2}
                    dot={{
                      r: 4,
                      fill: isML ? "#2563eb" : "#f59e0b",
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    activeDot={{ r: 6, fill: isML ? "#2563eb" : "#f59e0b" }}
                    connectNulls={true}
                  />
                )}
                {/* Baseline GEI Reference Line */}
                {baselineGEI !== null && baselineGEI !== undefined && (
                  <ReferenceLine
                    y={baselineGEI}
                    stroke="#9ca3af"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    label={{
                      value: "Baseline GEI",
                      position: "insideBottomRight",
                      fill: "#9ca3af",
                      fontSize: 10,
                      offset: 10,
                      dy: 25,
                    }}
                  />
                )}
              </LineChart>
            ) : (
              <BarChart
                data={effectiveShowYtdGei ? ytdProcessedData : processedData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f0f0f0"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#666", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#666", fontSize: 12 }}
                  label={{
                    value: "tCO₂e/ton",
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: "#999", fontSize: 12 },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  cursor={{ fill: "#f5f5f5" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0]?.payload;
                    if (!data) return null;

                    const hasValue =
                      data.gei !== null && data.gei !== undefined;
                    const hasYtdForecast =
                      effectiveShowYtdGei &&
                      data.isPredicted &&
                      data.predictedYtdGei !== null;

                    return (
                      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
                        <p className="font-medium text-gray-900 mb-1">
                          {label}
                        </p>
                        {effectiveShowYtdGei ? (
                          <>
                            {hasValue && (
                              <>
                                <p className="text-sm text-blue-600">
                                  <span className="inline-block w-2 h-2 rounded-full bg-blue-600 mr-2" />
                                  YTD GEI:{" "}
                                  <span className="font-medium">
                                    {data.gei?.toFixed(4)}
                                  </span>{" "}
                                  tCO₂e/ton
                                </p>
                                {data.ytdEmissions !== null &&
                                  data.ytdProduction !== null && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                      <p className="text-xs text-gray-500 mb-1">
                                        Cumulative:
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        Emissions:{" "}
                                        <span className="font-medium">
                                          {data.ytdEmissions?.toFixed(2)}
                                        </span>{" "}
                                        tCO₂e
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        Production:{" "}
                                        <span className="font-medium">
                                          {data.ytdProduction?.toFixed(2)}
                                        </span>{" "}
                                        tons
                                      </p>
                                    </div>
                                  )}
                              </>
                            )}
                            {hasYtdForecast && (
                              <>
                                <p
                                  className={`text-sm ${isML ? "text-blue-600" : "text-amber-600"}`}
                                >
                                  <span
                                    className={`inline-block w-2 h-2 rounded-full mr-2 ${isML ? "bg-blue-500" : "bg-amber-500"}`}
                                  />
                                  Forecast YTD GEI:{" "}
                                  <span className="font-medium">
                                    {data.predictedYtdGei?.toFixed(4)}
                                  </span>{" "}
                                  tCO₂e/ton
                                </p>
                                {data.ytdEmissions !== null &&
                                  data.ytdProduction !== null && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                      <p className="text-xs text-gray-500 mb-1">
                                        Projected Cumulative:
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        Emissions:{" "}
                                        <span className="font-medium">
                                          {data.ytdEmissions?.toFixed(2)}
                                        </span>{" "}
                                        tCO₂e
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        Production:{" "}
                                        <span className="font-medium">
                                          {data.ytdProduction?.toFixed(2)}
                                        </span>{" "}
                                        tons
                                      </p>
                                    </div>
                                  )}
                              </>
                            )}
                            {!hasValue && !hasYtdForecast && (
                              <p className="text-sm text-gray-400 italic">
                                No data available
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            {hasValue && (
                              <p className="text-sm text-gray-600">
                                <span className="inline-block w-2 h-2 rounded-full bg-[#0A0A0A] mr-2" />
                                GEI:{" "}
                                <span className="font-medium">
                                  {data.gei?.toFixed(4)}
                                </span>{" "}
                                tCO₂e/ton
                              </p>
                            )}
                            {!hasValue && (
                              <p className="text-sm text-gray-400 italic">
                                No data available
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  }}
                />
                {effectiveShowYtdGei && (
                  <Legend
                    verticalAlign="top"
                    height={36}
                    content={() => (
                      <div className="flex items-center justify-center gap-6 text-xs mb-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-2 bg-blue-600 rounded-sm" />
                          <span className="text-gray-600">Actual YTD GEI</span>
                        </div>
                        {showTrendline && (
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`w-4 h-2 rounded-sm ${isML ? "bg-blue-500" : "bg-amber-500"}`}
                            />
                            <span className="text-gray-600">
                              Forecast YTD GEI
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  />
                )}
                <Bar
                  dataKey="gei"
                  fill={effectiveShowYtdGei ? "#2563eb" : "#0A0A0A"}
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
                {/* Forecast bar for YTD GEI mode */}
                {showTrendline && effectiveShowYtdGei && (
                  <Bar
                    dataKey="predictedYtdGei"
                    fill={isML ? "#2563eb" : "#f59e0b"}
                    radius={[4, 4, 0, 0]}
                    barSize={40}
                  />
                )}
                {/* Baseline GEI Reference Line */}
                {baselineGEI !== null && baselineGEI !== undefined && (
                  <ReferenceLine
                    y={baselineGEI}
                    stroke="#9ca3af"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    label={{
                      value: "Baseline GEI",
                      position: "insideBottomRight",
                      fill: "#9ca3af",
                      fontSize: 10,
                      offset: 10,
                      dy: 25,
                    }}
                  />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
});
