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
import {
  CalendarIcon,
  BarChart3,
  LineChart as LineChartIcon,
  Search,
  ChevronDown,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
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
} from "recharts";
import {
  outputCalculationApi,
  type OutputParameter,
} from "@/lib/api/output-calculation";
import { plantsApi } from "@/lib/api/plants";

interface EmissionsTrendChartProps {
  siteId: string;
  siteName: string;
  viewMode?: "monthly" | "quarterly" | "yearly";
  onViewModeChange?: (mode: "monthly" | "quarterly" | "yearly") => void;
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

export const EmissionsTrendChart = memo(function EmissionsTrendChart({
  siteId,
  siteName,
  viewMode: externalViewMode,
  onViewModeChange,
}: EmissionsTrendChartProps) {
  const [internalViewMode, setInternalViewMode] = useState<
    "monthly" | "quarterly" | "yearly"
  >("monthly");
  const viewMode = externalViewMode ?? internalViewMode;
  const setViewMode = onViewModeChange ?? setInternalViewMode;
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [selectedParam, setSelectedParam] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isParamSelectorOpen, setIsParamSelectorOpen] = useState(false);

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

  // Fetch the plant data for other info (not output params - those come from org-wide API)
  const { data: plantData } = useQuery({
    queryKey: ["plant-raw", siteId],
    queryFn: async () => {
      const response = await plantsApi.getRawById(siteId);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    },
    enabled: !!siteId,
  });

  // Fetch plant-specific output parameters with asset info
  const { data: outputParams, isLoading: paramsLoading } = useQuery({
    queryKey: ["output-params-plant", siteId],
    queryFn: async () => {
      const response = await outputCalculationApi.getParameters(siteId);
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    },
    enabled: !!siteId,
  });

  const plantOutputParams = useMemo(() => {
    return outputParams || [];
  }, [outputParams]);

  // Set default selected param when params are loaded
  useEffect(() => {
    if (plantOutputParams.length > 0 && !selectedParam) {
      // Find total_ghg_emission or total_ghg_emissions or first available
      const totalEmissions =
        plantOutputParams.find((p) => p.name === "total_ghg_emission") ||
        plantOutputParams.find((p) => p.name === "total_ghg_emissions") ||
        plantOutputParams.find((p) => p.name === "total_ghg_emissions_from_process");
      if (totalEmissions) {
        setSelectedParam(
          `${totalEmissions.name}:${totalEmissions.asset_id || "plant"}`,
        );
      } else {
        const first = plantOutputParams[0];
        setSelectedParam(`${first.name}:${first.asset_id || "plant"}`);
      }
    }
  }, [plantOutputParams, selectedParam]);

  const filteredParams = useMemo(() => {
    if (!searchTerm) return plantOutputParams;
    const normalizedSearchTerm = searchTerm.toLowerCase();
    return plantOutputParams.filter((param) => {
      const assetSuffix =
        param.asset_name && param.asset_name !== "Plant Level"
          ? ` (${param.asset_name})`
          : "";
      const fullName = `${param.display_name}${assetSuffix}`.toLowerCase();
      return fullName.includes(normalizedSearchTerm);
    });
  }, [plantOutputParams, searchTerm]);

  const selectedParamObject = useMemo(() => {
    return plantOutputParams.find(
      (p) => `${p.name}:${p.asset_id || "plant"}` === selectedParam,
    );
  }, [plantOutputParams, selectedParam]);

  const unit = selectedParamObject?.unit || "tCO₂e";
  const selectedParamDisplayName = selectedParamObject?.display_name || "Value";

  // Fetch ALL trend data (without param filter) to check which params have data
  const { data: allTrendData } = useQuery({
    queryKey: ["output-trend-all", siteId],
    queryFn: async () => {
      // Fetch data for multiple years to support date range filtering and yearly view (2023-2030)
      const years = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];
      const allData: any[] = [];
      for (const year of years) {
        const response = await outputCalculationApi.getTrend(siteId, year);
        if (response.success && response.data) {
          // Add year info to each data point
          response.data.forEach((d: any) => {
            // Correctly calculate calendar year: Jan-Mar (1-3) belong to the next calendar year
            const calYear = d.month <= 3 ? year + 1 : year;
            allData.push({ ...d, calendar_year: calYear });
          });
        }
      }
      return allData;
    },
    enabled: !!siteId,
  });

  // Determine which parameters have data
  const paramsWithData = useMemo(() => {
    if (!allTrendData) return new Set<string>();
    const params = new Set<string>();
    allTrendData.forEach((d) => {
      if (d.data_value != null && d.data_value !== 0) {
        const key = `${d.param_type}:${d.asset_id || "plant"}`;
        params.add(key);
      }
    });
    return params;
  }, [allTrendData]);

  // Filter raw data by selected parameter (decomposing composite key)
  const rawData = useMemo(() => {
    if (!allTrendData || !selectedParam) return [];
    const [paramType, assetId] = selectedParam.split(":");
    const targetAssetId = assetId === "plant" ? null : assetId;

    return allTrendData.filter((d) => {
      const matchParam = d.param_type === paramType;
      const matchAsset = (d.asset_id || null) === (targetAssetId || null);
      return matchParam && matchAsset;
    });
  }, [allTrendData, selectedParam]);

  // Process data based on filters
  const processedData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    // Yearly View Logic - aggregate by calendar year
    if (viewMode === "yearly") {
      const yearlyData: any[] = [];

      // Generate years from yearlyStartYear to yearlyEndYear
      for (let year = yearlyStartYear; year <= yearlyEndYear; year++) {
        // Filter data for this calendar year
        const yearData = rawData.filter((d) => d.calendar_year === year);

        // Filter out null values for calculation
        const validData = yearData.filter(
          (d) => d.data_value !== null && d.data_value !== 0,
        );

        if (validData.length === 0) {
          yearlyData.push({
            month: year.toString(),
            calendar_year: year,
            value: null,
            isActual: false,
          });
        } else {
          // Calculate average value for the year
          const avgValue =
            validData.reduce((sum, d) => sum + (d.data_value || 0), 0) /
            validData.length;
          yearlyData.push({
            month: year.toString(),
            calendar_year: year,
            value: parseFloat(avgValue.toFixed(4)),
            isActual: true,
          });
        }
      }

      return yearlyData;
    }

    if (viewMode === "monthly") {
      // Generate all months in the range
      const monthsInRange: any[] = [];
      let currentDate = new Date(dateRange.from);
      currentDate.setDate(1); // Start of month

      while (currentDate <= dateRange.to) {
        const monthNum = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();

        // Find matching data
        const match = rawData.find((d) => {
          return d.calendar_year === year && d.month === monthNum;
        });

        monthsInRange.push({
          month: format(currentDate, "MMM"),
          month_num: monthNum,
          calendar_year: year,
          value: match ? match.data_value : null,
          isActual: match ? true : false,
        });

        // Next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      return monthsInRange;
    } else {
      // Quarterly View Logic
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
            if (!q.months.includes(d.month)) return false;
            const expectedCalYear = getCalendarYear(d.month);
            return d.calendar_year === expectedCalYear;
          });

          // Filter out null values for calculation
          const validData = qData.filter(
            (d) => d.data_value !== null && d.data_value !== 0,
          );

          if (validData.length === 0) {
            return {
              month: q.name,
              fullLabel: `${q.name} (${q.label})`,
              value: null,
              financial_year: selectedFinancialYear,
              isActual: false,
            };
          }

          // Sum values for the quarter (instead of average, since these are emissions)
          const sumValue = validData.reduce(
            (sum, d) => sum + (d.data_value || 0),
            0,
          );
          return {
            month: q.name,
            fullLabel: `${q.name} (${q.label})`,
            value: parseFloat(sumValue.toFixed(4)),
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
          const calYear = getCalendarYear(m);
          const match = rawData.find(
            (d) => d.month === m && d.calendar_year === calYear,
          );
          const date = new Date(calYear, m - 1, 1);

          return {
            month: format(date, "MMM"),
            month_num: m,
            calendar_year: calYear,
            value: match ? match.data_value : null,
            isActual: match ? true : false,
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

  const formatParamName = (param: string) => {
    return param
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const isLoading = !rawData;

  return (
    <Card className="p-6 border border-gray-200 shadow-sm h-full flex flex-col bg-white">
      {/* Header Controls */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#0A0A0A]">
            {useMemo(() => {
              const selected = plantOutputParams.find(
                (p) => `${p.name}:${p.asset_id || "plant"}` === selectedParam,
              );
              if (!selected) return "Emissions Trend";
              let title = selected.display_name;
              // Ensure "(Value)" suffix is present exactly once for total emissions,
              // regardless of whether it's already in the database name.
              if (
                selected.name === "total_ghg_emission" ||
                selected.name === "total_ghg_emissions"
              ) {
                if (!title.includes("(Value)")) {
                  title += "";
                }
              }

              if (
                selected.asset_name &&
                selected.asset_name !== "Plant Level"
              ) {
                title += ` (${selected.asset_name})`;
              }
              return title;
            }, [plantOutputParams, selectedParam])}
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

            {/* Parameter Selector */}
            <Popover
              open={isParamSelectorOpen}
              onOpenChange={setIsParamSelectorOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isParamSelectorOpen}
                  className="w-[350px] h-9 justify-between font-normal border-gray-200"
                >
                  <span className="truncate">
                    {selectedParam
                      ? (() => {
                          const selected = plantOutputParams.find(
                            (p) =>
                              `${p.name}:${p.asset_id || "plant"}` ===
                              selectedParam,
                          );
                          if (!selected) return "Select Parameter";
                          const assetSuffix =
                            selected.asset_name &&
                            selected.asset_name !== "Plant Level"
                              ? ` (${selected.asset_name})`
                              : "";
                          return `${selected.display_name}${assetSuffix}`;
                        })()
                      : "Select Parameter"}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="end">
                <div className="flex items-center border-b px-3 h-10">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input
                    placeholder="Search parameter..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 border-none focus-visible:ring-0 px-0"
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1">
                  {filteredParams.length === 0 ? (
                    <div className="py-6 text-center text-sm text-gray-500">
                      No parameter found.
                    </div>
                  ) : (
                    filteredParams.map((param) => {
                      const key = `${param.name}:${param.asset_id || "plant"}`;
                      const isSelected = selectedParam === key;
                      const hasData = paramsWithData.has(key);
                      const assetSuffix =
                        param.asset_name && param.asset_name !== "Plant Level"
                          ? ` (${param.asset_name})`
                          : "";

                      return (
                        <div
                          key={key}
                          className={cn(
                            "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-gray-100 hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                            !hasData && "opacity-40",
                          )}
                          onClick={() => {
                            setSelectedParam(key);
                            setIsParamSelectorOpen(false);
                            setSearchTerm("");
                          }}
                        >
                          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                            {isSelected && <Check className="h-4 w-4" />}
                          </span>
                          <span className="truncate">
                            {param.display_name}
                            {assetSuffix}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

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
                  <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
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
            {chartType === "line" ? (
              <LineChart
                data={processedData}
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
                    value: unit,
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
                      data.value !== null && data.value !== undefined;

                    return (
                      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
                        <p className="font-medium text-gray-900 mb-1">
                          {label}
                        </p>
                        {hasActual ? (
                          <p className="text-sm text-gray-600">
                            <span className="inline-block w-2 h-2 rounded-full bg-[#074D47] mr-2" />
                            {selectedParamDisplayName}:{" "}
                            <span className="font-medium">
                              {data.value?.toFixed(4)}
                            </span>{" "}
                            {unit}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">
                            No data available
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={selectedParamDisplayName}
                  stroke="#074D47"
                  strokeWidth={2}
                  dot={{
                    r: 4,
                    fill: "#074D47",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
                  activeDot={{ r: 6, fill: "#074D47" }}
                  connectNulls={false}
                />
              </LineChart>
            ) : (
              <BarChart
                data={processedData}
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
                    value: unit,
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
                />
                <Bar
                  dataKey="value"
                  name={selectedParamDisplayName}
                  fill="#074D47"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
});
