"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/lib/store/useAppStore";
import { plantsApi, PlantSettings, YearGEI } from "@/lib/api/plants";
import {
  Settings,
  Target,
  Calendar,
  TrendingDown,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { formatFY } from "@/lib/utils/fy";

const FY_MONTH_NAMES = [
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "January",
  "February",
  "March",
];

function formatMissingMonths(missingMonths: number[]): string {
  return missingMonths
    .map((month) => FY_MONTH_NAMES[month - 1] ?? `Month ${month}`)
    .join(", ");
}

export default function CorporatePlantSettingsPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const { user } = useAppStore();
  const queryClient = useQueryClient();

  // States for baseline configuration
  const [selectedBaselineYear, setSelectedBaselineYear] = useState<string>("");
  const [baselinePreview, setBaselinePreview] = useState<YearGEI | null>(null);
  const [isLoadingBaselinePreview, setIsLoadingBaselinePreview] =
    useState(false);
  const [manualBaselineGei, setManualBaselineGei] = useState<string>("");

  // States for target configuration
  const [selectedTargetYear, setSelectedTargetYear] = useState<string>("");
  const [targetInputMode, setTargetInputMode] = useState<
    "absolute" | "percentage"
  >("absolute");
  const [targetGeiInput, setTargetGeiInput] = useState<string>("");
  const [targetReductionInput, setTargetReductionInput] = useState<string>("");

  // Success/error messages
  const [baselineMessage, setBaselineMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [targetMessage, setTargetMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isCorpHead = user?.role === "CorporateHead";
  const canEditBaseline = isCorpHead;
  const canEditTarget = isCorpHead;
  const selectedBaselineYearNumber = selectedBaselineYear
    ? parseInt(selectedBaselineYear, 10)
    : null;
  const baselinePreviewComplete = baselinePreview?.is_complete ?? false;
  const baselineRequiresManualEntry =
    !baselinePreview || !baselinePreviewComplete;
  const baselineWorkspaceHref = "#";

  // Fetch plant settings
  const { data: settings, isLoading: settingsLoading } =
    useQuery<PlantSettings | null>({
      queryKey: ["plant-settings", siteId],
      queryFn: async () => {
        if (!siteId) return null;
        const response = await plantsApi.getSettings(siteId);
        if (response.success && response.data) {
          return response.data;
        }
        return null;
      },
      enabled: !!siteId,
    });

  // Initialize form values when settings load
  useEffect(() => {
    if (settings) {
      if (settings.baseline.year) {
        setSelectedBaselineYear(settings.baseline.year.toString());
      }
      if (settings.target.year) {
        setSelectedTargetYear(settings.target.year.toString());
      }
      if (settings.target.gei) {
        setTargetGeiInput(settings.target.gei.toString());
      }
      if (settings.target.reduction_pct) {
        setTargetReductionInput(settings.target.reduction_pct.toString());
      }
    }
  }, [settings]);

  // Fetch baseline year preview when selected
  useEffect(() => {
    const fetchBaselinePreview = async () => {
      if (!siteId || !selectedBaselineYear) {
        setBaselinePreview(null);
        return;
      }

      setIsLoadingBaselinePreview(true);
      try {
        const response = await plantsApi.getYearGEI(
          siteId,
          parseInt(selectedBaselineYear),
        );
        if (response.success && response.data) {
          setBaselinePreview(response.data);
        } else {
          setBaselinePreview(null);
        }
      } catch (error) {
        setBaselinePreview(null);
      }
      setIsLoadingBaselinePreview(false);
    };

    fetchBaselinePreview();
  }, [siteId, selectedBaselineYear]);

  // Calculate target GEI preview when using percentage mode
  const calculatedTargetGei = React.useMemo(() => {
    if (
      targetInputMode === "percentage" &&
      settings?.baseline.gei &&
      targetReductionInput
    ) {
      const reduction = parseFloat(targetReductionInput);
      if (!isNaN(reduction) && reduction >= 0 && reduction <= 100) {
        return settings.baseline.gei * (1 - reduction / 100);
      }
    }
    return null;
  }, [targetInputMode, settings?.baseline.gei, targetReductionInput]);

  // Mutation for setting baseline
  const setBaselineMutation = useMutation({
    mutationFn: async () => {
      if (!siteId || !user?.userId || !selectedBaselineYear) {
        throw new Error("Missing required data");
      }
      const request: { baseline_year: number; baseline_gei?: number } = {
        baseline_year: parseInt(selectedBaselineYear),
      };
      if (baselineRequiresManualEntry && manualBaselineGei) {
        request.baseline_gei = parseFloat(manualBaselineGei);
      }
      return plantsApi.setBaseline(siteId, request, user.userId);
    },
    onSuccess: (response) => {
      if (response.success) {
        setBaselineMessage({
          type: "success",
          text: "Baseline configuration saved successfully!",
        });
        queryClient.invalidateQueries({ queryKey: ["plant-settings"] });
        queryClient.invalidateQueries({ queryKey: ["plant-kpis"] });
      } else {
        setBaselineMessage({
          type: "error",
          text: response.message || "Failed to save baseline",
        });
      }
    },
    onError: (error: any) => {
      setBaselineMessage({
        type: "error",
        text: error.message || "Failed to save baseline",
      });
    },
  });

  // Mutation for setting target
  const setTargetMutation = useMutation({
    mutationFn: async () => {
      if (!siteId || !user?.userId || !selectedTargetYear) {
        throw new Error("Missing required data");
      }

      const request: {
        target_year: number;
        target_gei?: number;
        target_reduction_pct?: number;
      } = {
        target_year: parseInt(selectedTargetYear),
      };

      if (targetInputMode === "absolute" && targetGeiInput) {
        request.target_gei = parseFloat(targetGeiInput);
      } else if (targetInputMode === "percentage" && targetReductionInput) {
        request.target_reduction_pct = parseFloat(targetReductionInput);
      }

      return plantsApi.setTarget(siteId, request, user.userId);
    },
    onSuccess: (response) => {
      if (response.success) {
        setTargetMessage({
          type: "success",
          text: "Target configuration saved successfully!",
        });
        queryClient.invalidateQueries({ queryKey: ["plant-settings"] });
        queryClient.invalidateQueries({ queryKey: ["plant-kpis"] });
      } else {
        setTargetMessage({
          type: "error",
          text: response.message || "Failed to save target",
        });
      }
    },
    onError: (error: any) => {
      setTargetMessage({
        type: "error",
        text: error.message || "Failed to save target",
      });
    },
  });

  const handleSaveBaseline = () => {
    setBaselineMessage(null);
    setBaselineMutation.mutate();
  };

  const handleSaveTarget = () => {
    setTargetMessage(null);
    setTargetMutation.mutate();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not configured";
    return new Date(dateString).toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm font-mono text-gray-500">
          Loading settings...
        </div>
      </div>
    );
  }

  if (!siteId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-500">No plant selected</div>
      </div>
    );
  }

  if (!isCorpHead) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-red-500">
          Access denied. Corporate Head role required.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="container mx-auto px-12 py-8">
        {/* Back Link */}
        <Link
          href={`/corporate/plants/${siteId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Plant Details
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-gray-700" />
            <h1 className="text-3xl font-bold text-[#0A0A0A] tracking-tight">
              Plant Settings
            </h1>
          </div>
          <p className="text-gray-600">
            Configure baseline and target GEI values for{" "}
            <span className="font-semibold">
              {settings?.plant_name || "this plant"}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Baseline Configuration Card */}
          <Card className="p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#0A0A0A]">
                  Baseline Configuration
                </h2>
                <p className="text-sm text-gray-500">
                  Set by Plant Manager or Corp Head
                </p>
              </div>
            </div>

            {/* Current Configuration */}
            {settings?.baseline.year && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
                  Current Configuration
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Baseline Year</div>
                    <div className="text-lg font-semibold">
                      FY {settings.baseline.year}-
                      {(settings.baseline.year + 1).toString().slice(-2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Baseline GEI</div>
                    <div className="text-lg font-semibold">
                      {settings.baseline.gei?.toFixed(4)}{" "}
                      <span className="text-sm font-normal text-gray-500">
                        tCO₂e/ton
                      </span>
                    </div>
                  </div>
                </div>
                {settings.baseline.configured_by_name && (
                  <div className="mt-3 pt-3 border-t border-blue-200 flex items-center gap-2 text-xs text-gray-500">
                    <User className="h-3 w-3" />
                    <span>Set by {settings.baseline.configured_by_name}</span>
                    <span>•</span>
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(settings.baseline.configured_at)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Edit Form */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="baseline-year" className="text-sm font-medium">
                  Select Baseline Year
                </Label>
                <Select
                  value={selectedBaselineYear}
                  onValueChange={(value) => {
                    setSelectedBaselineYear(value);
                    setManualBaselineGei("");
                  }}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select a financial year" />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      settings?.selectable_years ||
                      settings?.available_years ||
                      []
                    ).map((year) => {
                      const hasData = settings?.available_years?.includes(year);
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          FY {year}-{(year + 1).toString().slice(-2)}
                          {hasData && (
                            <span className="ml-2 text-xs text-green-600">
                              (has data)
                            </span>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Preview or Manual Entry */}
              {selectedBaselineYear && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  {isLoadingBaselinePreview ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Checking for existing data...</span>
                    </div>
                  ) : baselinePreview ? (
                    <>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Data Preview
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">
                            Average GEI:
                          </span>
                          <span className="font-semibold">
                            {baselinePreview.average_gei.toFixed(4)} tCO₂e/ton
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">
                            Data Points:
                          </span>
                          <span className="font-medium">
                            {baselinePreview.data_points} months
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">
                            Completeness:
                          </span>
                          <span
                            className={cn(
                              "font-medium",
                              baselinePreviewComplete
                                ? "text-green-700"
                                : "text-amber-700",
                            )}
                          >
                            {baselinePreviewComplete
                              ? "12/12 months complete"
                              : `${baselinePreview.months_present.length}/12 months complete`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Range:</span>
                          <span className="font-medium">
                            {baselinePreview.min_gei.toFixed(4)} -{" "}
                            {baselinePreview.max_gei.toFixed(4)}
                          </span>
                        </div>
                      </div>

                      {!baselinePreviewComplete && (
                        <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <p className="text-sm text-amber-800">
                            Auto-calculated baseline confirmation is locked
                            until all 12 baseline months are approved. Missing
                            months:{" "}
                            {formatMissingMonths(
                              baselinePreview.missing_months,
                            )}
                          </p>
                          <div>
                            <Label
                              htmlFor="manual-baseline-gei"
                              className="text-sm font-medium"
                            >
                              Manual Baseline GEI (optional fallback)
                            </Label>
                            <Input
                              id="manual-baseline-gei"
                              type="number"
                              step="0.0001"
                              min="0"
                              placeholder="e.g., 0.8500"
                              value={manualBaselineGei}
                              onChange={(e) =>
                                setManualBaselineGei(e.target.value)
                              }
                              className="mt-1.5 bg-white"
                            />
                          </div>
                          <Button variant="outline" asChild>
                            <Link href={baselineWorkspaceHref}>
                              Open Baseline Upload Workspace
                            </Link>
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Manual Entry Required
                      </div>
                      <p className="text-sm text-gray-500 mb-3">
                        No GEI data exists for this year. Please enter the
                        baseline GEI value manually.
                      </p>
                      <div>
                        <Label
                          htmlFor="manual-baseline-gei"
                          className="text-sm font-medium"
                        >
                          Baseline GEI (tCO₂e/ton)
                        </Label>
                        <Input
                          id="manual-baseline-gei"
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="e.g., 0.8500"
                          value={manualBaselineGei}
                          onChange={(e) => setManualBaselineGei(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                      <Button variant="outline" asChild>
                        <Link href={baselineWorkspaceHref}>
                          Open Baseline Upload Workspace
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Message */}
              {baselineMessage && (
                <div
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg text-sm",
                    baselineMessage.type === "success"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700",
                  )}
                >
                  {baselineMessage.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  {baselineMessage.text}
                </div>
              )}

              <Button
                onClick={handleSaveBaseline}
                disabled={
                  !selectedBaselineYear ||
                  (baselineRequiresManualEntry &&
                    (!manualBaselineGei ||
                      parseFloat(manualBaselineGei) <= 0)) ||
                  setBaselineMutation.isPending
                }
                className="w-full"
              >
                {setBaselineMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  `Save ${selectedBaselineYearNumber ? formatFY(selectedBaselineYearNumber, false) : "Baseline"} Configuration`
                )}
              </Button>
            </div>
          </Card>

          {/* Target Configuration Card */}
          <Card className="p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Target className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#0A0A0A]">
                  Target Configuration
                </h2>
                <p className="text-sm text-gray-500">Set by Corp Head only</p>
              </div>
            </div>

            {/* Current Configuration */}
            {settings?.target.year && settings?.target.gei && (
              <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">
                  Current Configuration
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Target Year</div>
                    <div className="text-lg font-semibold">
                      FY {settings.target.year}-
                      {(settings.target.year + 1).toString().slice(-2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Target GEI</div>
                    <div className="text-lg font-semibold">
                      {settings.target.gei?.toFixed(4)}{" "}
                      <span className="text-sm font-normal text-gray-500">
                        tCO₂e/ton
                      </span>
                    </div>
                  </div>
                </div>
                {settings.target.reduction_pct && (
                  <div className="mt-2">
                    <div className="text-sm text-gray-500">
                      Reduction from Baseline
                    </div>
                    <div className="text-lg font-semibold text-emerald-600">
                      {settings.target.reduction_pct.toFixed(1)}%
                    </div>
                  </div>
                )}
                {settings.target.configured_by_name && (
                  <div className="mt-3 pt-3 border-t border-emerald-200 flex items-center gap-2 text-xs text-gray-500">
                    <User className="h-3 w-3" />
                    <span>Set by {settings.target.configured_by_name}</span>
                    <span>•</span>
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(settings.target.configured_at)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Edit Form */}
            <div className="space-y-4">
              {!settings?.baseline.gei && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-sm text-yellow-700">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  Please set a baseline first before configuring the target.
                </div>
              )}

              <div>
                <Label htmlFor="target-year" className="text-sm font-medium">
                  Select Target Year
                </Label>
                <Select
                  value={selectedTargetYear}
                  onValueChange={setSelectedTargetYear}
                  disabled={!settings?.baseline.year}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select a financial year" />
                  </SelectTrigger>
                  <SelectContent>
                    {settings?.available_years
                      .filter(
                        (year) =>
                          !settings?.baseline.year ||
                          year >= settings.baseline.year,
                      )
                      .map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          FY {year}-{(year + 1).toString().slice(-2)}
                        </SelectItem>
                      ))}
                    {/* Also allow future years */}
                    {[2025, 2026, 2027, 2028, 2029, 2030].map((year) => {
                      if (
                        !settings?.available_years.includes(year) &&
                        (!settings?.baseline.year ||
                          year >= settings.baseline.year)
                      ) {
                        return (
                          <SelectItem key={year} value={year.toString()}>
                            FY {year}-{(year + 1).toString().slice(-2)}
                          </SelectItem>
                        );
                      }
                      return null;
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">
                  Target GEI Input Method
                </Label>
                <Tabs
                  value={targetInputMode}
                  onValueChange={(v) =>
                    setTargetInputMode(v as "absolute" | "percentage")
                  }
                  className="mt-1.5"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="absolute">Absolute Value</TabsTrigger>
                    <TabsTrigger value="percentage">% Reduction</TabsTrigger>
                  </TabsList>
                  <TabsContent value="absolute" className="mt-3">
                    <div>
                      <Label
                        htmlFor="target-gei"
                        className="text-sm text-gray-500"
                      >
                        Target GEI (tCO₂e/ton)
                      </Label>
                      <Input
                        id="target-gei"
                        type="number"
                        step="0.0001"
                        placeholder="e.g., 1.75"
                        value={targetGeiInput}
                        onChange={(e) => setTargetGeiInput(e.target.value)}
                        className="mt-1"
                        disabled={!settings?.baseline.gei}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="percentage" className="mt-3">
                    <div>
                      <Label
                        htmlFor="target-reduction"
                        className="text-sm text-gray-500"
                      >
                        Reduction from Baseline (%)
                      </Label>
                      <Input
                        id="target-reduction"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="e.g., 5"
                        value={targetReductionInput}
                        onChange={(e) =>
                          setTargetReductionInput(e.target.value)
                        }
                        className="mt-1"
                        disabled={!settings?.baseline.gei}
                      />
                      {calculatedTargetGei !== null && (
                        <div className="mt-2 text-sm text-gray-500">
                          Calculated Target GEI:{" "}
                          <span className="font-semibold text-emerald-600">
                            {calculatedTargetGei.toFixed(4)}
                          </span>{" "}
                          tCO₂e/ton
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Validation warnings */}
              {settings?.baseline.gei &&
                targetGeiInput &&
                parseFloat(targetGeiInput) >= settings.baseline.gei && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    Target GEI must be less than baseline GEI (
                    {settings.baseline.gei.toFixed(4)})
                  </div>
                )}

              {/* Message */}
              {targetMessage && (
                <div
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg text-sm",
                    targetMessage.type === "success"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700",
                  )}
                >
                  {targetMessage.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  {targetMessage.text}
                </div>
              )}

              <Button
                onClick={handleSaveTarget}
                disabled={
                  !settings?.baseline.gei ||
                  !selectedTargetYear ||
                  (targetInputMode === "absolute" && !targetGeiInput) ||
                  (targetInputMode === "percentage" && !targetReductionInput) ||
                  setTargetMutation.isPending
                }
                className="w-full"
              >
                {setTargetMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Target Configuration"
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* Info Section */}
        <Card className="mt-8 p-6 border border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-[#0A0A0A] mb-4">
            How it works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Baseline GEI</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Select a financial year with existing GEI data</li>
                <li>
                  Baseline GEI is calculated as the average GEI of all months in
                  that year
                </li>
                <li>
                  This serves as the reference point for measuring improvement
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Target GEI</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Set as an absolute value or percentage reduction from baseline
                </li>
                <li>
                  Target must be less than baseline (represents improvement)
                </li>
                <li>Used to determine ON_TRACK / OFF_TRACK status</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
