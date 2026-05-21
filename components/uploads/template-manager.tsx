"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  templatesApi,
  ParseUploadResponse,
  UploadRecordSummary,
  ParsedCellData,
  DetailedUploadResponse,
  ExistingDataEntry,
  AnomalyInfo,
} from "@/lib/api/templates";
import {
  agentParseApi,
  AgentParseJobStatus,
  AgentParseJobDetail,
  AgentParsedCell,
} from "@/lib/api/agent-parse";
import { plantsApi } from "@/lib/api/plants";
import { BaselineUploadWorkspace } from "./baseline-upload-workspace";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
  Pencil,
  ChevronDown,
  Search,
  Check,
  Sparkles,
  Loader2,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useJobStatusSocket } from "@/lib/hooks/useJobStatusSocket";

interface TemplateManagerProps {
  plantId: string;
  plantName: string;
  initialTab?: TemplateManagerTab;
  settingsHref?: string;
}

type TemplateManagerTab =
  | "generate"
  | "upload"
  | "ai-upload"
  | "history"
  | "baseline";

const MONTHS = [
  { value: 1, label: "April" },
  { value: 2, label: "May" },
  { value: 3, label: "June" },
  { value: 4, label: "July" },
  { value: 5, label: "August" },
  { value: 6, label: "September" },
  { value: 7, label: "October" },
  { value: 8, label: "November" },
  { value: 9, label: "December" },
  { value: 10, label: "January" },
  { value: 11, label: "February" },
  { value: 12, label: "March" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export function TemplateManager({
  plantId,
  plantName,
  initialTab = "generate",
  settingsHref = "/plant/settings",
}: TemplateManagerProps) {
  const [activeTab, setActiveTab] = useState<TemplateManagerTab>(initialTab);

  // State for template generation
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>();

  // State for file upload
  const [uploadYear, setUploadYear] = useState(currentYear);
  const [uploadMonth, setUploadMonth] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseUploadResponse | null>(
    null,
  );

  // State for UI
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // State for overwrite confirmation dialog
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [, setExistingEntries] = useState<ExistingDataEntry[]>([]);
  const [existingPeriod, setExistingPeriod] = useState("");
  const [isCheckingExisting, setIsCheckingExisting] = useState(false);

  // State for AI parsing
  const [aiYear, setAiYear] = useState(currentYear);
  const [aiMonth, setAiMonth] = useState(1);
  const [aiSelectedFile, setAiSelectedFile] = useState<File | null>(null);
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [aiJobStatus, setAiJobStatus] = useState<AgentParseJobStatus | null>(null);
  const [aiJobDetail, setAiJobDetail] = useState<AgentParseJobDetail | null>(null);
  const [aiIsUploading, setAiIsUploading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const {
    data: plantSettings,
    isLoading: baselineSettingsLoading,
  } = useQuery({
    queryKey: ["plant-settings", plantId],
    queryFn: async () => {
      const response = await plantsApi.getSettings(plantId);
      return response.success ? response.data ?? null : null;
    },
    enabled: !!plantId,
  });

  const {
    data: baselineStatus,
    isLoading: baselineStatusLoading,
    refetch: refetchBaselineStatus,
  } = useQuery({
    queryKey: ["baseline-upload-status", plantId],
    queryFn: async () => {
      const response = await plantsApi.getBaselineUploadStatus(plantId);
      return response.success ? response.data ?? null : null;
    },
    enabled: !!plantId,
  });

  // Fetch upload history
  const {
    data: uploads,
    isLoading: uploadsLoading,
    refetch: refetchUploads,
  } = useQuery({
    queryKey: ["template-uploads", plantId],
    queryFn: async () => {
      const result = await templatesApi.listUploads(plantId);
      return result.success ? result.data || [] : [];
    },
    enabled: !!plantId,
  });

  // Generate template handler
  const handleGenerateTemplate = useCallback(async () => {
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const result = await templatesApi.generateTemplate(
        plantId,
        selectedYear,
        selectedMonth,
      );

      if ("error" in result) {
        setGenerateError(result.error);
        return;
      }

      // Trigger download
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Failed to generate template",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [plantId, selectedYear, selectedMonth]);

  // Parse upload mutation
  const parseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      return templatesApi.parseUpload(
        selectedFile,
        plantId,
        uploadYear,
        uploadMonth,
      );
    },
    onSuccess: (result) => {
      if (result.success && result.data) {
        setParseResult(result.data);
        refetchUploads();
        refetchBaselineStatus();
      }
    },
  });

  // Submit to workflow mutation
  const submitMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      return templatesApi.submitToWorkflow(uploadId);
    },
    onSuccess: () => {
      refetchUploads();
      refetchBaselineStatus();
      setParseResult(null);
      setSelectedFile(null);
    },
  });

  // File change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setParseResult(null);
    }
  };

  // Check for existing data and potentially show overwrite dialog
  const handleParseClick = async () => {
    if (!selectedFile) return;

    setIsCheckingExisting(true);
    try {
      const result = await templatesApi.checkExistingData(
        plantId,
        uploadYear,
        uploadMonth,
      );

      if (result.success && result.data?.exists) {
        // Data exists - show confirmation dialog
        setExistingEntries(result.data.entries);
        setExistingPeriod(result.data.period);
        setShowOverwriteDialog(true);
      } else {
        // No existing data - proceed with parse
        parseMutation.mutate();
      }
    } catch {
      // If check fails, proceed anyway (fail open)
      parseMutation.mutate();
    } finally {
      setIsCheckingExisting(false);
    }
  };

  // Proceed with parse after user confirms overwrite
  const handleConfirmOverwrite = () => {
    setShowOverwriteDialog(false);
    parseMutation.mutate();
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleBaselineTemplateDownload = useCallback(
    async (financialYear: number, month: number) => {
      setIsGenerating(true);
      setGenerateError(null);

      try {
        const result = await templatesApi.generateTemplate(
          plantId,
          financialYear,
          month,
        );

        if ("error" in result) {
          setGenerateError(result.error);
          return;
        }

        const url = URL.createObjectURL(result.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        setGenerateError(
          error instanceof Error ? error.message : "Failed to generate template",
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [plantId],
  );

  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TemplateManagerTab)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-5 bg-muted p-1 rounded-lg h-auto">
          <TabsTrigger
            value="generate"
            className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm py-2"
          >
            <Download className="w-4 h-4 mr-2" />
            Generate
          </TabsTrigger>
          <TabsTrigger
            value="upload"
            className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm py-2"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger
            value="ai-upload"
            className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm py-2"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            AI Parse
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm py-2"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger
            value="baseline"
            className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm py-2"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Baseline FY
          </TabsTrigger>
        </TabsList>

        {/* Generate Template Tab */}
        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Generate Excel Template
              </CardTitle>
              <CardDescription>
                Download a customized Excel template for {plantName} with all
                configured parameters and assets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Financial Year</Label>
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(v) => setSelectedYear(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          FY {year}-{(year + 1).toString().slice(-2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Month (Optional)</Label>
                  <Select
                    value={selectedMonth?.toString() || "all"}
                    onValueChange={(v) =>
                      setSelectedMonth(v === "all" ? undefined : parseInt(v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All months" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All months</SelectItem>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value.toString()}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {generateError && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>{generateError}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleGenerateTemplate}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                  </>
                )}
              </Button>

              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  The template includes all parameters configured for this
                  plant. Fill in the highlighted cells and upload to submit
                  data.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload Data Tab */}
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Filled Template
              </CardTitle>
              <CardDescription>
                Upload your filled Excel template for parsing and validation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Financial Year</Label>
                  <Select
                    value={uploadYear.toString()}
                    onValueChange={(v) => setUploadYear(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          FY {year}-{(year + 1).toString().slice(-2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select
                    value={uploadMonth.toString()}
                    onValueChange={(v) => setUploadMonth(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value.toString()}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Select File</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>

              <Button
                onClick={handleParseClick}
                disabled={!selectedFile || parseMutation.isPending || isCheckingExisting}
                className="w-full"
              >
                {isCheckingExisting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : parseMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Parse & Validate
                  </>
                )}
              </Button>

              {/* Overwrite Confirmation Dialog */}
              <Dialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600 text-xl">
                      <AlertTriangle className="w-6 h-6" />
                      Data Already Exists
                    </DialogTitle>
                    <DialogDescription className="pt-3 text-base">
                      Data for <span className="font-semibold">{existingPeriod}</span> already exists.
                      Do you want to overwrite it with new data?
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="mt-6">
                    <Button variant="outline" onClick={() => setShowOverwriteDialog(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleConfirmOverwrite}>
                      Overwrite Data
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {parseMutation.error && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    {parseMutation.error instanceof Error
                      ? parseMutation.error.message
                      : "Failed to parse file"}
                  </AlertDescription>
                </Alert>
              )}

              {/* Parse Results */}
              {parseResult && (
                <ParseResultsCard
                  result={parseResult}
                  onSubmit={() =>
                    submitMutation.mutate(parseResult.upload_record_id)
                  }
                  isSubmitting={submitMutation.isPending}
                  onRefresh={() => refetchUploads()}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Upload Tab */}
        <TabsContent value="ai-upload">
          <AIParseTab
            plantId={plantId}
            plantName={plantName}
            aiYear={aiYear}
            setAiYear={setAiYear}
            aiMonth={aiMonth}
            setAiMonth={setAiMonth}
            aiSelectedFile={aiSelectedFile}
            setAiSelectedFile={setAiSelectedFile}
            aiJobId={aiJobId}
            setAiJobId={setAiJobId}
            aiJobStatus={aiJobStatus}
            setAiJobStatus={setAiJobStatus}
            aiJobDetail={aiJobDetail}
            setAiJobDetail={setAiJobDetail}
            aiIsUploading={aiIsUploading}
            setAiIsUploading={setAiIsUploading}
            aiError={aiError}
            setAiError={setAiError}
            onRefresh={() => refetchUploads()}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Upload History</CardTitle>
                <CardDescription>
                  Previous template uploads for {plantName}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchUploads()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {uploadsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : uploads && uploads.length > 0 ? (
                <div className="space-y-2">
                  {uploads.map((upload) => (
                    <UploadHistoryItem key={upload.id} upload={upload} />
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No uploads yet
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="baseline">
          <BaselineUploadWorkspace
            plantId={plantId}
            plantName={plantName}
            settingsHref={settingsHref}
            baselineYear={plantSettings?.baseline.year ?? null}
            baselineGei={baselineStatus?.baseline_gei ?? null}
            baselineStatus={baselineStatus ?? null}
            isLoading={baselineSettingsLoading || baselineStatusLoading}
            isGenerating={isGenerating}
            generateError={generateError}
            onDownloadTemplate={handleBaselineTemplateDownload}
            onUploadComplete={() => {
              refetchBaselineStatus();
              refetchUploads();
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Parse Results Sub-component - AI Parser Style UI
export function ParseResultsCard({
  result,
  onSubmit,
  isSubmitting,
  onRefresh,
}: {
  result: ParseUploadResponse;
  onSubmit: () => void;
  isSubmitting: boolean;
  onRefresh: () => void;
}) {
  const [detailedData, setDetailedData] =
    useState<DetailedUploadResponse | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyInfo[]>(result.anomalies ?? []);
  const [isLoadingCells, setIsLoadingCells] = useState(false);
  const [editingCells, setEditingCells] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedMetrics, setExpandedMetrics] = useState(false);
  const [cellCounts, setCellCounts] = useState({
    valid: result.valid_cells,
    warning: result.warning_cells,
    error: result.error_cells,
  });

  const hasErrors = cellCounts.error > 0;
  const hasWarnings = cellCounts.warning > 0;
  const hasAnomalies = anomalies.length > 0;
  const sortedAnomalies = [...anomalies].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return b.deviation_percentage - a.deviation_percentage;
  });

  // Load detailed cell data on mount
  useEffect(() => {
    loadDetailedCells();
  }, [result.upload_record_id]);

  const loadDetailedCells = async () => {
    setIsLoadingCells(true);
    try {
      const response = await templatesApi.getUploadCells(
        result.upload_record_id,
      );
      if (response.success && response.data) {
        setDetailedData(response.data);
        setAnomalies(response.data.anomalies);
        const initialEdits: Record<string, string> = {};
        response.data.parsed_cells.forEach((cell) => {
          initialEdits[cell.cell_ref] = cell.parsed_value?.toString() ?? "";
        });
        setEditingCells(initialEdits);
      }
    } catch (error) {
      console.error("Failed to load cells:", error);
    } finally {
      setIsLoadingCells(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!detailedData) return;

    setIsSaving(true);
    try {
      const updates = detailedData.parsed_cells
        .filter((cell) => {
          const editedValue = editingCells[cell.cell_ref];
          const originalValue = cell.parsed_value?.toString() ?? "";
          return editedValue !== originalValue && editedValue !== "";
        })
        .map((cell) => ({
          cell_ref: cell.cell_ref,
          new_value: parseFloat(editingCells[cell.cell_ref]),
        }))
        .filter((u) => !isNaN(u.new_value));

      if (updates.length === 0) {
        setIsEditing(false);
        return;
      }

      const response = await templatesApi.updateUploadCells(
        result.upload_record_id,
        updates,
      );

      if (response.success && response.data) {
        setCellCounts({
          valid: response.data.valid_cells,
          warning: response.data.warning_cells,
          error: response.data.error_cells,
        });
        await loadDetailedCells();
        setIsEditing(false);
        onRefresh();
      }
    } catch (error) {
      console.error("Failed to save changes:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter cells by search term, hide calculated params unless they have a provided value
  const filteredCells =
    detailedData?.parsed_cells.filter(
      (cell) => {
        if (cell.is_calculated && cell.parsed_value === null) return false;
        return (
          cell.param_display_name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          cell.param_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cell.cell_ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (cell.asset_name || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        );
      },
    ) ?? [];

  // Build anomaly lookup for per-cell highlighting.
  // Key by "field_name|current_value" to disambiguate per-asset params with the same name.
  const anomalyMap = new Map(
    anomalies.map((a) => [`${a.field_name}|${a.current_value}`, a]),
  );
  const getCellAnomaly = (cell: ParsedCellData) =>
    anomalyMap.get(`${cell.param_display_name}|${cell.parsed_value}`);

  // Split into primary (first 15 + issues) and secondary
  // Prioritize: errors, anomalies, warnings, valid, empty
  const isSearching = searchTerm.trim().length > 0;
  const cellsWithErrors = filteredCells.filter(
    (c) => c.validation_status === "error",
  );
  const cellsWithAnomalies = filteredCells
    .filter((c) => c.validation_status !== "error" && getCellAnomaly(c))
    .sort((a, b) => {
      const aAnomaly = getCellAnomaly(a);
      const bAnomaly = getCellAnomaly(b);
      if (aAnomaly?.severity !== bAnomaly?.severity)
        return aAnomaly?.severity === "critical" ? -1 : 1;
      return (bAnomaly?.deviation_percentage ?? 0) - (aAnomaly?.deviation_percentage ?? 0);
    });
  const cellsWithWarningsAndValues = filteredCells.filter(
    (c) => c.validation_status === "warning" && c.parsed_value !== null && !getCellAnomaly(c),
  );
  const cellsValidWithValues = filteredCells.filter(
    (c) => c.validation_status === "valid" && c.parsed_value !== null && !getCellAnomaly(c),
  );
  const cellsEmpty = filteredCells.filter(
    (c) => c.parsed_value === null && c.validation_status !== "error",
  );
  const primaryFields = isSearching
    ? filteredCells
    : [...cellsWithErrors, ...cellsWithAnomalies, ...cellsWithWarningsAndValues, ...cellsValidWithValues, ...cellsEmpty].slice(0, 15);
  const secondaryFields = isSearching
    ? []
    : filteredCells.filter((f) => !primaryFields.includes(f));

  // Group secondary fields by category for display
  const getCategoryLabel = (cell: ParsedCellData) => {
    if (cell.is_calculated) return "Calculated";
    if (cell.param_category === "input") return "Input";
    if (cell.param_category === "output") return "Output";
    if (cell.param_category === "emission") return "Emission";
    return "Other";
  };

  const inputParamCount = detailedData
    ? detailedData.parsed_cells.filter((c) => !c.is_calculated).length
    : null;

  return (
    <Card className="mt-4">
      <div className="border rounded-lg bg-muted/30">
        {/* Header */}
        <div className="p-4 border-b">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Extracted Data - Review Required
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            {inputParamCount ?? result.total_cells} input parameters
            {inputParamCount !== null && ` (${result.total_cells} total)`}
            {" "}• {cellCounts.valid} valid
            • {cellCounts.warning} warnings • {cellCounts.error} errors
          </p>
        </div>

        {/* Search Box */}
        <div className="p-4 border-b bg-muted/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search parameters..."
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 max-h-[500px] overflow-y-auto">
          {isLoadingCells ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              {/* Edit Mode Guide */}
              {isEditing && (
                <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs">
                  <p className="font-semibold text-purple-900 mb-2">
                    📝 Edit Mode Active
                  </p>
                  <div className="space-y-1 text-purple-700">
                    <p>
                      • Modify any field values directly in the input boxes
                      below
                    </p>
                    <p>
                      • Click{" "}
                      <span className="font-semibold">Save Changes</span> when
                      done
                    </p>
                  </div>
                </div>
              )}

              {/* Validation Status Alert */}
              {hasErrors ? (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold text-red-900">
                        Validation Errors Detected
                      </p>
                      <p className="text-red-700">
                        <span className="font-semibold">
                          {cellCounts.error} error
                          {cellCounts.error === 1 ? "" : "s"}
                        </span>{" "}
                        found. Please fix errors before approval.
                      </p>
                    </div>
                  </div>
                </div>
              ) : hasWarnings ? (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold text-yellow-900">
                        Warnings Detected
                      </p>
                      <p className="text-yellow-700">
                        <span className="font-semibold">
                          {cellCounts.warning} warning
                          {cellCounts.warning === 1 ? "" : "s"}
                        </span>{" "}
                        found. Review before approval.
                      </p>
                    </div>
                  </div>
                </div>
              ) : !hasAnomalies ? (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-xs">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-900">
                        All validation checks passed!
                      </p>
                      <p className="text-green-700">
                        Data is ready for approval.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Anomaly Alert — shown independently alongside warnings/errors */}
              {hasAnomalies && (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold text-orange-900">
                        {anomalies.length} Anomal{anomalies.length === 1 ? "y" : "ies"} Detected
                      </p>
                      <p className="text-orange-700">
                        Significant deviations from historical averages found. You can still approve the data.
                      </p>
                      <ul className="mt-2 space-y-1 text-orange-700">
                        {sortedAnomalies.slice(0, 5).map((a, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.severity === "critical" ? "bg-red-500" : "bg-yellow-500"}`} />
                            <span>
                              <span className="font-medium">{a.field_name.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</span>
                              {": "}
                              {a.current_value?.toLocaleString() ?? "-"}
                              {a.moving_average != null && (
                                <span className="text-orange-500"> (avg {a.moving_average.toFixed(1)}, {a.deviation_percentage.toFixed(1)}% dev)</span>
                              )}
                              {a.severity === "critical" && (
                                <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 bg-red-100 text-red-700 border-red-300">CRITICAL</Badge>
                              )}
                            </span>
                          </li>
                        ))}
                        {anomalies.length > 5 && (
                          <li className="text-orange-500 italic pl-3">
                            ...and {anomalies.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Field List */}
              <div className="space-y-3 mb-4">
                {isSearching && primaryFields.length === 0 && (
                  <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      No parameters found matching &quot;{searchTerm}&quot;
                    </p>
                  </div>
                )}
                {primaryFields.map((cell) => {
                  const isError = cell.validation_status === "error";
                  const isWarning = cell.validation_status === "warning";
                  const cellAnomaly = getCellAnomaly(cell);
                  const isAnomaly = !!cellAnomaly && !isError;
                  const currentValue =
                    editingCells[cell.cell_ref] ??
                    String(cell.parsed_value ?? "");

                  return (
                    <div
                      key={cell.cell_ref}
                      className={cn(
                        "flex items-start justify-between border-b pb-3 last:border-0 transition-all duration-200",
                        isError &&
                        "bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-md border-red-200",
                        isAnomaly &&
                        "bg-orange-50 dark:bg-orange-950/20 px-3 py-2 rounded-md border-orange-200",
                        isWarning &&
                        !isError && !isAnomaly &&
                        "bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2 rounded-md border-yellow-200",
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Label className="text-xs font-semibold">
                            {cell.param_display_name}
                            {cell.asset_name && ` (${cell.asset_name})`}
                          </Label>
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {cell.cell_ref}
                          </span>
                          <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            {getCategoryLabel(cell)}
                          </span>
                          {isError && (
                            <span className="text-[10px] font-mono text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                              ERROR
                            </span>
                          )}
                          {isWarning && !isAnomaly && (
                            <span className="text-[10px] font-mono text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">
                              WARNING
                            </span>
                          )}
                          {isAnomaly && (
                            <span className={cn(
                              "text-[10px] font-mono px-1.5 py-0.5 rounded",
                              cellAnomaly.severity === "critical"
                                ? "text-red-700 bg-red-100"
                                : "text-orange-700 bg-orange-100",
                            )}>
                              ANOMALY
                            </span>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              value={currentValue}
                              onChange={(e) =>
                                setEditingCells((prev) => ({
                                  ...prev,
                                  [cell.cell_ref]: e.target.value,
                                }))
                              }
                              className={cn(
                                "text-sm font-mono max-w-[200px] h-8",
                                isError &&
                                "border-red-300 focus:border-red-500",
                              )}
                            />
                            {cell.param_unit && (
                              <span className="text-sm text-muted-foreground">
                                {cell.param_unit}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span
                            className={cn(
                              "text-sm font-mono block",
                              isError && "text-red-600 font-semibold",
                              isAnomaly && "text-orange-700 font-semibold",
                            )}
                          >
                            {currentValue || "-"} {cell.param_unit}
                          </span>
                        )}
                        {(isError || isWarning) && cell.validation_message && (
                          <p className="text-[11px] text-red-600 mt-1 flex items-start gap-1">
                            <span className="mt-0.5">⚠</span>
                            <span>{cell.validation_message}</span>
                          </p>
                        )}
                        {isAnomaly && cellAnomaly && (
                          <p className="text-[11px] text-orange-700 mt-1 flex items-start gap-1">
                            <span className="mt-0.5">⚠</span>
                            <span>
                              {cellAnomaly.deviation_percentage.toFixed(1)}% deviation from avg
                              {cellAnomaly.moving_average != null && ` (avg: ${cellAnomaly.moving_average.toLocaleString()}, ${cellAnomaly.lookback_months}mo)`}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Secondary Fields (Additional Metrics) */}
              {secondaryFields.length > 0 && (
                <div className="mt-4 space-y-1">
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => setExpandedMetrics(!expandedMetrics)}
                  >
                    <span className="text-sm font-medium">
                      {expandedMetrics ? "Hide" : "Show"} Additional Metrics (
                      {secondaryFields.length})
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform",
                        expandedMetrics && "rotate-180",
                      )}
                    />
                  </Button>

                  {expandedMetrics && (
                    <div className="mt-2 border rounded-md p-3 space-y-3 max-h-80 overflow-y-auto">
                      {secondaryFields.map((cell) => {
                        const isError = cell.validation_status === "error";
                        const isWarning = cell.validation_status === "warning";
                        const cellAnomaly2 = getCellAnomaly(cell);
                        const isAnomaly2 = !!cellAnomaly2 && !isError;
                        const currentValue =
                          editingCells[cell.cell_ref] ??
                          String(cell.parsed_value ?? "");

                        return (
                          <div
                            key={cell.cell_ref}
                            className={cn(
                              "flex items-center justify-between border-b pb-2 last:border-0",
                              isError && "bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-md border-red-200",
                              isAnomaly2 && "bg-orange-50 dark:bg-orange-950/20 px-3 py-2 rounded-md border-orange-200",
                              isWarning && !isError && !isAnomaly2 && "bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2 rounded-md border-yellow-200",
                            )}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Label className="text-xs font-semibold block">
                                  {cell.param_display_name}
                                  {cell.asset_name && ` (${cell.asset_name})`}
                                </Label>
                                <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                  {getCategoryLabel(cell)}
                                </span>
                                {isError && (
                                  <span className="text-[10px] font-mono text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                                    ERROR
                                  </span>
                                )}
                                {isWarning && !isAnomaly2 && (
                                  <span className="text-[10px] font-mono text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">
                                    WARNING
                                  </span>
                                )}
                                {isAnomaly2 && (
                                  <span className={cn(
                                    "text-[10px] font-mono px-1.5 py-0.5 rounded",
                                    cellAnomaly2.severity === "critical"
                                      ? "text-red-700 bg-red-100"
                                      : "text-orange-700 bg-orange-100",
                                  )}>
                                    ANOMALY
                                  </span>
                                )}
                              </div>
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="text"
                                    value={currentValue}
                                    onChange={(e) =>
                                      setEditingCells((prev) => ({
                                        ...prev,
                                        [cell.cell_ref]: e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      "text-sm font-mono max-w-[200px] h-8",
                                      isError && "border-red-300 focus:border-red-500",
                                    )}
                                  />
                                  {cell.param_unit && (
                                    <span className="text-sm text-muted-foreground">
                                      {cell.param_unit}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className={cn(
                                  "text-sm font-mono",
                                  isError && "text-red-600 font-semibold",
                                  isAnomaly2 && "text-orange-700 font-semibold",
                                )}>
                                  {currentValue || "-"} {cell.param_unit}
                                </span>
                              )}
                              {(isError || isWarning) && cell.validation_message && (
                                <p className="text-[11px] text-red-600 mt-1">
                                  ⚠ {cell.validation_message}
                                </p>
                              )}
                              {isAnomaly2 && cellAnomaly2 && (
                                <p className="text-[11px] text-orange-700 mt-1">
                                  ⚠ {cellAnomaly2.deviation_percentage.toFixed(1)}% deviation from avg
                                  {cellAnomaly2.moving_average != null && ` (avg: ${cellAnomaly2.moving_average.toLocaleString()}, ${cellAnomaly2.lookback_months}mo)`}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 border-t bg-white sticky bottom-0">
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            {!isEditing ? (
              <>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  EDIT
                </Button>
                <Button
                  variant="default"
                  className={cn(
                    "flex-1",
                    hasErrors
                      ? "bg-gray-400 hover:bg-gray-400 text-gray-700 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white",
                  )}
                  onClick={onSubmit}
                  disabled={hasErrors || isSubmitting}
                  title={
                    hasErrors
                      ? "Please fix errors before approval"
                      : hasWarnings || hasAnomalies
                        ? "Warnings/anomalies detected but approval is allowed"
                        : "Ready to approve!"
                  }
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {hasErrors
                        ? "APPROVE (Fix Errors First)"
                        : hasWarnings || hasAnomalies
                          ? "APPROVE (Issues Detected)"
                          : "APPROVE ✓"}
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="flex-1 bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    if (detailedData) {
                      const initialEdits: Record<string, string> = {};
                      detailedData.parsed_cells.forEach((cell) => {
                        initialEdits[cell.cell_ref] =
                          cell.parsed_value?.toString() ?? "";
                      });
                      setEditingCells(initialEdits);
                    }
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// Upload History Item Sub-component
function UploadHistoryItem({ upload }: { upload: UploadRecordSummary }) {
  const statusColors: Record<string, string> = {
    pending_review: "bg-yellow-100 text-yellow-800",
    reviewed: "bg-blue-100 text-blue-800",
    in_logbook: "bg-purple-100 text-purple-800",
    approved: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  const monthNames = [
    "",
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

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
        <div>
          <p className="font-medium">{upload.filename}</p>
          <p className="text-sm text-muted-foreground">
            {monthNames[upload.month]} FY{upload.financial_year} •{" "}
            {upload.valid_cells}/{upload.total_cells} valid
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {upload.anomalies_count > 0 && (
          <Badge variant="secondary" className="bg-yellow-100">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {upload.anomalies_count}
          </Badge>
        )}
        <Badge
          className={cn(
            "capitalize",
            statusColors[upload.status] || "bg-gray-100",
          )}
        >
          {upload.status.replace("_", " ")}
        </Badge>
      </div>
    </div>
  );
}

// AI Parse Tab Component
interface AIParseTabProps {
  plantId: string;
  plantName: string;
  aiYear: number;
  setAiYear: (year: number) => void;
  aiMonth: number;
  setAiMonth: (month: number) => void;
  aiSelectedFile: File | null;
  setAiSelectedFile: (file: File | null) => void;
  aiJobId: string | null;
  setAiJobId: (jobId: string | null) => void;
  aiJobStatus: AgentParseJobStatus | null;
  setAiJobStatus: (status: AgentParseJobStatus | null) => void;
  aiJobDetail: AgentParseJobDetail | null;
  setAiJobDetail: (detail: AgentParseJobDetail | null) => void;
  aiIsUploading: boolean;
  setAiIsUploading: (uploading: boolean) => void;
  aiError: string | null;
  setAiError: (error: string | null) => void;
  onRefresh: () => void;
}

function AIParseTab({
  plantId,
  plantName,
  aiYear,
  setAiYear,
  aiMonth,
  setAiMonth,
  aiSelectedFile,
  setAiSelectedFile,
  aiJobId,
  setAiJobId,
  aiJobStatus,
  setAiJobStatus,
  aiJobDetail,
  setAiJobDetail,
  aiIsUploading,
  setAiIsUploading,
  aiError,
  setAiError,
  onRefresh,
}: AIParseTabProps) {
  const [editingCells, setEditingCells] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedMetrics, setExpandedMetrics] = useState(false);

  const refreshAIJobStatus = useCallback(async () => {
    if (!aiJobId) return;
    const result = await agentParseApi.getJobStatus(aiJobId);
    if (!result.success || !result.data) return;

    setAiJobStatus(result.data);

    // When completed, fetch full cell data
    if (result.data.status === "completed") {
      const cellsResult = await agentParseApi.getJobCells(aiJobId);
      if (cellsResult.success && cellsResult.data) {
        setAiJobDetail(cellsResult.data);
        // Initialize editing cells
        const initialEdits: Record<string, string> = {};
        cellsResult.data.parsed_cells.forEach((cell) => {
          initialEdits[cell.cell_ref] = cell.parsed_value?.toString() ?? "";
        });
        setEditingCells(initialEdits);
      }
    }
  }, [aiJobId, setAiJobDetail, setAiJobStatus]);

  const { isConnected: isJobSocketConnected } = useJobStatusSocket({
    onJobStatusUpdate: (update) => {
      if (!aiJobId || update.job_id !== aiJobId) {
        return;
      }
      void refreshAIJobStatus();
    },
  });

  useEffect(() => {
    if (!aiJobId || aiJobStatus?.status === "completed" || aiJobStatus?.status === "failed") {
      return;
    }
    if (isJobSocketConnected) {
      return;
    }

    const fallbackInterval = setInterval(() => {
      void refreshAIJobStatus();
    }, 60_000);

    return () => clearInterval(fallbackInterval);
  }, [aiJobId, aiJobStatus?.status, isJobSocketConnected, refreshAIJobStatus]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAiSelectedFile(file);
      setAiJobId(null);
      setAiJobStatus(null);
      setAiJobDetail(null);
      setAiError(null);
    }
  };

  const handleParseWithAI = async () => {
    if (!aiSelectedFile) return;

    setAiIsUploading(true);
    setAiError(null);

    try {
      const result = await agentParseApi.uploadAndParse(
        aiSelectedFile,
        plantId,
        aiYear,
        aiMonth,
      );

      if (result.success && result.data) {
        setAiJobId(result.data.job_id);
        setAiJobStatus({
          job_id: result.data.job_id,
          status: "pending",
          progress: 0,
          filename: aiSelectedFile.name,
          financial_year: aiYear,
          month: aiMonth,
          total_cells: 0,
          valid_cells: 0,
          warning_cells: 0,
          error_cells: 0,
          anomalies_count: 0,
          error: null,
          created_at: new Date().toISOString(),
          started_at: null,
          completed_at: null,
        });
      } else {
        setAiError(result.message || "Failed to start AI parsing");
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Network error");
    } finally {
      setAiIsUploading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!aiJobId || !aiJobDetail) return;

    setIsSaving(true);
    try {
      const updates = aiJobDetail.parsed_cells
        .filter((cell) => {
          const editedValue = editingCells[cell.cell_ref];
          const originalValue = cell.parsed_value?.toString() ?? "";
          return editedValue !== originalValue && editedValue !== "";
        })
        .map((cell) => ({
          cell_ref: cell.cell_ref,
          new_value: parseFloat(editingCells[cell.cell_ref]),
        }))
        .filter((u) => !isNaN(u.new_value));

      if (updates.length === 0) {
        setIsEditing(false);
        return;
      }

      const response = await agentParseApi.updateJobCells(aiJobId, updates);

      if (response.success) {
        // Refresh cell data
        const cellsResult = await agentParseApi.getJobCells(aiJobId);
        if (cellsResult.success && cellsResult.data) {
          setAiJobDetail(cellsResult.data);
          const newEdits: Record<string, string> = {};
          cellsResult.data.parsed_cells.forEach((cell) => {
            newEdits[cell.cell_ref] = cell.parsed_value?.toString() ?? "";
          });
          setEditingCells(newEdits);
        }
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Failed to save changes:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!aiJobId) return;

    setIsSubmitting(true);
    try {
      const result = await agentParseApi.submitToWorkflow(aiJobId);
      if (result.success) {
        // Reset state for new upload
        setAiSelectedFile(null);
        setAiJobId(null);
        setAiJobStatus(null);
        setAiJobDetail(null);
        onRefresh();
      } else {
        setAiError(result.message || "Failed to submit to workflow");
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Submit failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setAiSelectedFile(null);
    setAiJobId(null);
    setAiJobStatus(null);
    setAiJobDetail(null);
    setAiError(null);
    setEditingCells({});
    setIsEditing(false);
  };

  // Filter cells by search, hide calculated params unless they have a provided value
  const filteredCells = aiJobDetail?.parsed_cells.filter(
    (cell) => {
      if (cell.is_calculated && cell.parsed_value === null) return false;
      return (
        cell.param_display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cell.param_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cell.cell_ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cell.asset_name || "").toLowerCase().includes(searchTerm.toLowerCase())
      );
    },
  ) ?? [];

  const isSearching = searchTerm.trim().length > 0;
  const cellsWithIssues = filteredCells.filter(
    (c) => c.validation_status === "error" || c.validation_status === "warning",
  );
  const cellsWithoutIssues = filteredCells.filter(
    (c) => c.validation_status === "valid",
  );
  const primaryFields = isSearching
    ? filteredCells
    : [...cellsWithIssues, ...cellsWithoutIssues].slice(0, 15);
  const secondaryFields = isSearching
    ? []
    : filteredCells.filter((f) => !primaryFields.includes(f));

  const getCategoryLabel = (cell: AgentParsedCell) => {
    if (cell.is_calculated) return "Calculated";
    if (cell.param_category === "input") return "Input";
    if (cell.param_category === "output") return "Output";
    if (cell.param_category === "emission") return "Emission";
    return "Other";
  };

  const hasErrors = aiJobDetail ? aiJobDetail.error_cells > 0 : false;
  const hasWarnings = aiJobDetail ? aiJobDetail.warning_cells > 0 : false;
  const hasAnomalies = aiJobDetail ? aiJobDetail.anomalies.length > 0 : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          AI-Powered Excel Parser
        </CardTitle>
        <CardDescription>
          Upload any Excel file and let AI extract parameters automatically.
          Works with non-standard formats.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Form (show when no job is running) */}
        {!aiJobId && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Financial Year</Label>
                <Select
                  value={aiYear.toString()}
                  onValueChange={(v) => setAiYear(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        FY {year}-{(year + 1).toString().slice(-2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Month</Label>
                <Select
                  value={aiMonth.toString()}
                  onValueChange={(v) => setAiMonth(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value.toString()}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Excel File</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {aiSelectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {aiSelectedFile.name}
                </p>
              )}
            </div>

            <Button
              onClick={handleParseWithAI}
              disabled={!aiSelectedFile || aiIsUploading}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {aiIsUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting AI Parser...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Parse with AI
                </>
              )}
            </Button>

            <Alert className="bg-purple-50 border-purple-200">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <AlertDescription className="text-purple-800">
                AI parsing can handle any Excel format - it automatically detects headers,
                matches columns to parameters, and extracts values.
              </AlertDescription>
            </Alert>
          </>
        )}

        {/* Error Display */}
        {aiError && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{aiError}</AlertDescription>
          </Alert>
        )}

        {/* Progress Display */}
        {aiJobStatus && aiJobStatus.status !== "completed" && aiJobStatus.status !== "failed" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                <span className="text-sm font-medium">
                  {aiJobStatus.status === "pending" ? "Starting..." : "AI Parsing in progress..."}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                {aiJobStatus.progress}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${aiJobStatus.progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              File: {aiJobStatus.filename}
            </p>
          </div>
        )}

        {/* Failed State */}
        {aiJobStatus?.status === "failed" && (
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertDescription>
              Parsing failed: {aiJobStatus.error || "Unknown error"}
              <Button variant="outline" size="sm" className="ml-4" onClick={handleReset}>
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Results Display */}
        {aiJobDetail && aiJobStatus?.status === "completed" && (
          <div className="border rounded-lg bg-muted/30">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  AI Extracted Data - Review Required
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {aiJobDetail.total_cells} parameters extracted • {aiJobDetail.valid_cells} valid
                  • {aiJobDetail.warning_cells} warnings • {aiJobDetail.error_cells} errors
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset}>
                New Upload
              </Button>
            </div>

            {/* Unmapped columns note */}
            {aiJobDetail.unmapped_columns.length > 0 && (
              <div className="px-4 py-2 bg-yellow-50 border-b">
                <p className="text-xs text-yellow-700">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  {aiJobDetail.unmapped_columns.length} column(s) could not be mapped to parameters
                </p>
              </div>
            )}

            {/* Search Box */}
            <div className="p-4 border-b bg-muted/20">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search parameters..."
                  className="pl-9 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Main Content */}
            <div className="p-4 max-h-[500px] overflow-y-auto">
              {/* Edit Mode Guide */}
              {isEditing && (
                <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs">
                  <p className="font-semibold text-purple-900 mb-2">
                    📝 Edit Mode Active
                  </p>
                  <p className="text-purple-700">
                    Modify field values below, then click Save Changes.
                  </p>
                </div>
              )}

              {/* Validation Status Alert */}
              {hasErrors ? (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-900">Validation Errors Detected</p>
                      <p className="text-red-700">
                        {aiJobDetail.error_cells} error(s) found. Please fix before approval.
                      </p>
                    </div>
                  </div>
                </div>
              ) : hasWarnings ? (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-yellow-900">Warnings Detected</p>
                      <p className="text-yellow-700">
                        {aiJobDetail.warning_cells} warning(s) found. Review before approval.
                      </p>
                    </div>
                  </div>
                </div>
              ) : !hasAnomalies ? (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-xs">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-green-900">All validation checks passed!</p>
                      <p className="text-green-700">Data is ready for approval.</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Anomaly Alert — shown independently alongside warnings/errors */}
              {hasAnomalies && (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold text-orange-900">
                        {aiJobDetail.anomalies.length} Anomal{aiJobDetail.anomalies.length === 1 ? "y" : "ies"} Detected
                      </p>
                      <p className="text-orange-700">
                        Significant deviations from historical averages found. You can still approve the data.
                      </p>
                      <ul className="mt-2 space-y-1 text-orange-700">
                        {aiJobDetail.anomalies.slice(0, 5).map((a: any, i: number) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.severity === "critical" ? "bg-red-500" : "bg-yellow-500"}`} />
                            <span>
                              <span className="font-medium">{a.field_name.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</span>
                              {": "}
                              {a.current_value?.toLocaleString() ?? "-"}
                              {a.moving_average != null && (
                                <span className="text-orange-500"> (avg {a.moving_average.toFixed(1)}, {a.deviation_percentage.toFixed(1)}% dev)</span>
                              )}
                              {a.severity === "critical" && (
                                <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 bg-red-100 text-red-700 border-red-300">CRITICAL</Badge>
                              )}
                            </span>
                          </li>
                        ))}
                        {aiJobDetail.anomalies.length > 5 && (
                          <li className="text-orange-500 italic pl-3">
                            ...and {aiJobDetail.anomalies.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Field List */}
              <div className="space-y-3 mb-4">
                {isSearching && primaryFields.length === 0 && (
                  <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed">
                    <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      No parameters found matching &quot;{searchTerm}&quot;
                    </p>
                  </div>
                )}
                {primaryFields.map((cell) => {
                  const isError = cell.validation_status === "error";
                  const isWarning = cell.validation_status === "warning";
                  const currentValue = editingCells[cell.cell_ref] ?? String(cell.parsed_value ?? "");

                  return (
                    <div
                      key={cell.cell_ref}
                      className={cn(
                        "flex items-start justify-between border-b pb-3 last:border-0",
                        isError && "bg-red-50 px-3 py-2 rounded-md border-red-200",
                        isWarning && !isError && "bg-yellow-50 px-3 py-2 rounded-md border-yellow-200",
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Label className="text-xs font-semibold">
                            {cell.param_display_name}
                            {cell.asset_name && ` (${cell.asset_name})`}
                          </Label>
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {cell.cell_ref}
                          </span>
                          <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            {getCategoryLabel(cell)}
                          </span>
                          {isError && (
                            <span className="text-[10px] font-mono text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                              ERROR
                            </span>
                          )}
                          {isWarning && (
                            <span className="text-[10px] font-mono text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">
                              WARNING
                            </span>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              value={currentValue}
                              onChange={(e) =>
                                setEditingCells((prev) => ({
                                  ...prev,
                                  [cell.cell_ref]: e.target.value,
                                }))
                              }
                              className={cn(
                                "text-sm font-mono max-w-[200px] h-8",
                                isError && "border-red-300 focus:border-red-500",
                              )}
                            />
                            {cell.param_unit && (
                              <span className="text-sm text-muted-foreground">{cell.param_unit}</span>
                            )}
                          </div>
                        ) : (
                          <span className={cn("text-sm font-mono block", isError && "text-red-600 font-semibold")}>
                            {currentValue || "-"} {cell.param_unit}
                          </span>
                        )}
                        {(isError || isWarning) && cell.validation_message && (
                          <p className="text-[11px] text-red-600 mt-1">
                            ⚠ {cell.validation_message}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Secondary Fields */}
              {secondaryFields.length > 0 && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => setExpandedMetrics(!expandedMetrics)}
                  >
                    <span className="text-sm font-medium">
                      {expandedMetrics ? "Hide" : "Show"} Additional Metrics ({secondaryFields.length})
                    </span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", expandedMetrics && "rotate-180")} />
                  </Button>

                  {expandedMetrics && (
                    <div className="mt-2 border rounded-md p-3 space-y-3 max-h-80 overflow-y-auto">
                      {secondaryFields.map((cell) => {
                        const isError = cell.validation_status === "error";
                        const isWarning = cell.validation_status === "warning";
                        const currentValue = editingCells[cell.cell_ref] ?? String(cell.parsed_value ?? "");

                        return (
                          <div
                            key={cell.cell_ref}
                            className={cn(
                              "flex items-center justify-between border-b pb-2 last:border-0",
                              isError && "bg-red-50 px-3 py-2 rounded-md border-red-200",
                              isWarning && !isError && "bg-yellow-50 px-3 py-2 rounded-md border-yellow-200",
                            )}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Label className="text-xs font-semibold">
                                  {cell.param_display_name}
                                  {cell.asset_name && ` (${cell.asset_name})`}
                                </Label>
                                {isError && (
                                  <span className="text-[10px] font-mono text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                                    ERROR
                                  </span>
                                )}
                                {isWarning && (
                                  <span className="text-[10px] font-mono text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">
                                    WARNING
                                  </span>
                                )}
                              </div>
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="text"
                                    value={currentValue}
                                    onChange={(e) =>
                                      setEditingCells((prev) => ({
                                        ...prev,
                                        [cell.cell_ref]: e.target.value,
                                      }))
                                    }
                                    className={cn(
                                      "text-sm font-mono max-w-[200px] h-8",
                                      isError && "border-red-300 focus:border-red-500",
                                    )}
                                  />
                                  {cell.param_unit && (
                                    <span className="text-sm text-muted-foreground">{cell.param_unit}</span>
                                  )}
                                </div>
                              ) : (
                                <span className={cn("text-sm font-mono", isError && "text-red-600 font-semibold")}>
                                  {currentValue || "-"} {cell.param_unit}
                                </span>
                              )}
                              {(isError || isWarning) && cell.validation_message && (
                                <p className="text-[11px] text-red-600 mt-1">
                                  ⚠ {cell.validation_message}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons Footer */}
            <div className="p-4 border-t bg-white sticky bottom-0">
              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                {!isEditing ? (
                  <>
                    <Button variant="secondary" className="flex-1" onClick={() => setIsEditing(true)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      EDIT
                    </Button>
                    <Button
                      variant="default"
                      className={cn(
                        "flex-1",
                        hasErrors ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700",
                      )}
                      onClick={handleSubmit}
                      disabled={hasErrors || isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          {hasErrors ? "Fix Errors First" : "APPROVE"}
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        if (aiJobDetail) {
                          const initialEdits: Record<string, string> = {};
                          aiJobDetail.parsed_cells.forEach((cell) => {
                            initialEdits[cell.cell_ref] = cell.parsed_value?.toString() ?? "";
                          });
                          setEditingCells(initialEdits);
                        }
                        setIsEditing(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={handleSaveChanges}
                      disabled={isSaving}
                    >
                      {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                      Save Changes
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
