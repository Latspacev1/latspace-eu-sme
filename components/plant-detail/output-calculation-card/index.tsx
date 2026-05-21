"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calculator,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { outputCalculationApi, OutputData } from "@/lib/api/output-calculation";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PARAMETER_DISPLAY_MAP,
  generateLabel,
  inferUnit,
  type OutputParameterDisplay,
} from "./parameter-display-map";

interface OutputCalculationCardProps {
  plantId: string;
  financialYear: number;
  month?: number | null;
  className?: string;
}

export function OutputCalculationCard({
  plantId,
  financialYear,
  month: initialMonth,
  className,
}: OutputCalculationCardProps) {
  const { user } = useAppStore();
  const [calculationMode, setCalculationMode] = useState<"monthly" | "yearly">(
    initialMonth !== null && initialMonth !== undefined ? "monthly" : "yearly",
  );
  const [selectedYear, setSelectedYear] = useState<number>(financialYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(
    initialMonth ?? new Date().getMonth() + 1,
  );

  const month = calculationMode === "yearly" ? null : selectedMonth;

  // Fetch existing output data
  const {
    data: outputData,
    isLoading: isLoadingData,
    refetch,
  } = useQuery({
    queryKey: ["output-data", plantId, selectedYear, month],
    queryFn: async () => {
      if (!user?.orgId) return [];
      const response = await outputCalculationApi.getForPlant(
        plantId,
        selectedYear,
        month,
      );
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    },
    enabled: !!user?.orgId,
  });

  // Calculate mutation
  const calculateMutation = useMutation({
    mutationFn: () =>
      outputCalculationApi.calculate({
        plant_id: plantId,
        financial_year: selectedYear,
        month: month ?? undefined,
      }),
    onSuccess: (response) => {
      if (response.success && response.data) {
        const periodType =
          calculationMode === "yearly" ? "yearly aggregation" : "monthly";
        toast.success(
          `${periodType.charAt(0).toUpperCase() + periodType.slice(1)} output parameters calculated successfully`,
        );
        refetch();
      } else {
        toast.error(
          response.message || "Failed to calculate output parameters",
        );
      }
    },
    onError: (error) => {
      toast.error("Failed to calculate output parameters");
      console.error("Calculation error:", error);
    },
  });

  // Calculate and save mutation
  const calculateAndSaveMutation = useMutation({
    mutationFn: () =>
      outputCalculationApi.calculateAndSave({
        plant_id: plantId,
        financial_year: selectedYear,
        month: month ?? undefined,
      }),
    onSuccess: (response) => {
      if (response.success && response.data) {
        const periodType =
          calculationMode === "yearly" ? "yearly aggregation" : "monthly";
        toast.success(
          `${periodType.charAt(0).toUpperCase() + periodType.slice(1)} output parameters calculated and saved successfully`,
        );
        refetch();
      } else {
        toast.error(
          response.message || "Failed to calculate and save output parameters",
        );
      }
    },
    onError: (error) => {
      toast.error("Failed to calculate and save output parameters");
      console.error("Save error:", error);
    },
  });

  // Create display data from API response
  const displayData: OutputParameterDisplay[] = (outputData || [])
    .filter((item) => item.param_type)
    .map((item) => {
      const config = PARAMETER_DISPLAY_MAP[item.param_type];
      return {
        key: item.param_type || "unknown",
        label: config?.label || generateLabel(item.param_type),
        value: item.data_value,
        unit: config?.unit || inferUnit(item.param_type),
        description: config?.description,
      };
    });

  const isCalculating = calculateMutation.isPending;
  const isSaving = calculateAndSaveMutation.isPending;
  const hasData = outputData && outputData.length > 0;

  return (
    <Card className={cn("p-6", className)}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-foreground">
            Output Calculations
          </h3>
          <div className="flex items-center gap-3">
            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>

            {calculationMode === "monthly" && (
              <Select
                value={selectedMonth.toString()}
                onValueChange={(v) => setSelectedMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {new Date(2000, m - 1).toLocaleString("default", {
                        month: "long",
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Tabs
              value={calculationMode}
              onValueChange={(v) =>
                setCalculationMode(v as "monthly" | "yearly")
              }
            >
              <TabsList className="h-8 bg-gray-100 p-1">
                <TabsTrigger
                  value="monthly"
                  className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                >
                  Monthly
                </TabsTrigger>
                <TabsTrigger
                  value="yearly"
                  className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                >
                  Yearly
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        <p className="text-sm text-foreground/60 mb-4">
          {calculationMode === "yearly" ? (
            <>
              GHG emission calculations for Financial Year {selectedYear}{" "}
              (Yearly Aggregation - Jan to Dec)
            </>
          ) : (
            <>
              GHG emission calculations for{" "}
              {new Date(selectedYear, selectedMonth - 1).toLocaleString(
                "en-IN",
                {
                  month: "long",
                  year: "numeric",
                },
              )}
            </>
          )}
        </p>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => calculateMutation.mutate()}
            disabled={isCalculating || isSaving}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Calculator className="h-4 w-4" />
            {isCalculating ? "Calculating..." : "Calculate"}
          </Button>

          <Button
            onClick={() => calculateAndSaveMutation.mutate()}
            disabled={isCalculating || isSaving}
            size="sm"
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Calculate & Save"}
          </Button>

          {hasData && (
            <Button
              onClick={() => refetch()}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Status */}
      {!hasData && !isLoadingData && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              No calculations found
            </p>
            <p className="text-sm text-amber-700">
              Click &quot;Calculate&quot; to compute output parameters or
              &quot;Calculate &amp; Save&quot; to compute and store them.
            </p>
          </div>
        </div>
      )}

      {hasData && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">
              Calculations available
            </p>
            <p className="text-sm text-green-700">
              {outputData.length} output parameters calculated and ready to
              view.
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoadingData && (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-sm text-gray-500">
            Loading output calculations...
          </p>
        </div>
      )}

      {/* Output Parameters Grid */}
      {!isLoadingData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayData.map((param) => (
            <div
              key={param.key}
              className={cn(
                "p-4 rounded-lg border bg-white transition-all",
                param.value !== null
                  ? "border-green-200 bg-green-50/50"
                  : "border-gray-200 bg-gray-50/30",
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-gray-700 leading-tight">
                  {param.label}
                </p>
                {param.value !== null && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-green-50 text-green-700 border-green-200"
                  >
                    Calculated
                  </Badge>
                )}
              </div>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-xl font-bold text-gray-900">
                  {param.value !== null
                    ? param.value.toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 0,
                      })
                    : "--"}
                </span>
                <span className="text-sm text-gray-500">{param.unit}</span>
              </div>

              {param.description && (
                <p className="text-xs text-gray-500 leading-relaxed">
                  {param.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer separator */}
      <Separator className="mt-6" />

      <div className="mt-4 text-xs text-gray-500 text-center">
        Output calculations are based on emission data and conversion factors
        for the selected period.
      </div>
    </Card>
  );
}
