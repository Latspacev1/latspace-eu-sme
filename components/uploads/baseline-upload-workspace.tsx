"use client";

import React, { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import {
  templatesApi,
  type ParseUploadResponse,
} from "@/lib/api/templates";
import { plantsApi } from "@/lib/api/plants";
import { ParseResultsCard } from "./template-manager";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertTriangle,
  Loader2,
  ArrowRight,
  Calendar,
  Info,
  RefreshCw,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFY } from "@/lib/utils/fy";

type BaselineStatusData = NonNullable<
  Awaited<ReturnType<typeof plantsApi.getBaselineUploadStatus>>["data"]
>;
type BaselineMonth = BaselineStatusData["months"][number];

interface BaselineUploadWorkspaceProps {
  plantId: string;
  plantName: string;
  settingsHref: string;
  baselineYear: number | null;
  baselineGei: number | null;
  baselineStatus: BaselineStatusData | null;
  isLoading: boolean;
  isGenerating: boolean;
  generateError: string | null;
  onDownloadTemplate: (financialYear: number, month: number) => Promise<void>;
  onUploadComplete: () => void;
}

export function BaselineUploadWorkspace({
  plantId,
  plantName,
  settingsHref,
  baselineYear,
  baselineGei,
  baselineStatus,
  isLoading,
  isGenerating,
  generateError,
  onDownloadTemplate,
  onUploadComplete,
}: BaselineUploadWorkspaceProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Baseline FY Upload</CardTitle>
          <CardDescription>Loading baseline upload workspace...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!baselineYear) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Baseline FY Upload</CardTitle>
          <CardDescription>
            Configure a baseline year first, then upload Apr-Mar templates for
            that financial year.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-slate-500 text-center max-w-md">
            The baseline financial year is set in plant settings. Once
            configured, you can upload monthly templates here.
          </p>
          <Button asChild>
            <Link href={settingsHref}>
              Open Baseline Settings
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const months = baselineStatus?.months ?? [];
  const completedMonths = months.filter((m) => m.has_committed_data).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Baseline FY Upload
        </CardTitle>
        <CardDescription>
          Upload monthly templates for {formatFY(baselineYear, false)}. The
          baseline GEI can only be confirmed in settings after all 12 months are
          approved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Configured Baseline
            </div>
            <div className="mt-2 text-xl font-semibold text-slate-950">
              {formatFY(baselineYear, false)}
            </div>
          </div>
          <div className="rounded-lg border bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Completion
            </div>
            <div className="mt-2 text-xl font-semibold text-slate-950">
              {completedMonths}/12 months
            </div>
          </div>
          <div className="rounded-lg border bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Baseline GEI
            </div>
            <div className="mt-2 text-xl font-semibold text-slate-950">
              {baselineGei !== null && baselineGei !== undefined
                ? `${baselineGei.toFixed(4)} tCO₂e/ton`
                : "Not confirmed"}
            </div>
          </div>
        </div>

        {generateError && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{generateError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {months.map((month) => (
            <BaselineMonthRow
              key={`${baselineYear}-${month.fy_month}`}
              plantId={plantId}
              baselineYear={baselineYear}
              month={month}
              isGenerating={isGenerating}
              onDownloadTemplate={onDownloadTemplate}
              onUploadComplete={onUploadComplete}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BaselineMonthRow({
  plantId,
  baselineYear,
  month,
  isGenerating,
  onDownloadTemplate,
  onUploadComplete,
}: {
  plantId: string;
  baselineYear: number;
  month: BaselineMonth;
  isGenerating: boolean;
  onDownloadTemplate: (financialYear: number, month: number) => Promise<void>;
  onUploadComplete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseUploadResponse | null>(null);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [existingPeriod, setExistingPeriod] = useState("");
  const [isCheckingExisting, setIsCheckingExisting] = useState(false);

  const statusMeta = getBaselineMonthStatusMeta(month.status);
  const showReplace = month.has_committed_data || !!month.latest_upload;

  const parseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      return templatesApi.parseUpload(
        selectedFile,
        plantId,
        baselineYear,
        month.fy_month,
      );
    },
    onSuccess: (result) => {
      if (result.success && result.data) {
        setParseResult(result.data);
      }
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      return templatesApi.submitToWorkflow(uploadId);
    },
    onSuccess: () => {
      setParseResult(null);
      setSelectedFile(null);
      setExpanded(false);
      onUploadComplete();
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setParseResult(null);
    }
  };

  const handleParseClick = useCallback(async () => {
    if (!selectedFile) return;

    setIsCheckingExisting(true);
    try {
      const result = await templatesApi.checkExistingData(
        plantId,
        baselineYear,
        month.fy_month,
      );
      if (result.success && result.data?.exists) {
        setExistingPeriod(result.data.period);
        setShowOverwriteDialog(true);
      } else {
        parseMutation.mutate();
      }
    } catch {
      parseMutation.mutate();
    } finally {
      setIsCheckingExisting(false);
    }
  }, [selectedFile, plantId, baselineYear, month.fy_month, parseMutation]);

  const handleConfirmOverwrite = () => {
    setShowOverwriteDialog(false);
    parseMutation.mutate();
  };

  const handleToggleExpand = () => {
    if (expanded) {
      // Collapse — reset local state
      setExpanded(false);
      setSelectedFile(null);
      setParseResult(null);
    } else {
      setExpanded(true);
    }
  };

  return (
    <div className="rounded-lg border">
      {/* Month summary row */}
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="font-medium text-slate-950">{month.label}</div>
            <Badge className={cn("border", statusMeta.className)}>
              {statusMeta.label}
            </Badge>
            {month.has_committed_data && (
              <Badge variant="secondary">Committed</Badge>
            )}
          </div>
          <div className="text-sm text-slate-500">
            {month.latest_upload
              ? `${month.latest_upload.filename} • ${month.latest_upload.valid_cells}/${month.latest_upload.total_cells} valid`
              : "No upload submitted yet"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void onDownloadTemplate(baselineYear, month.fy_month)}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download Template
          </Button>
          <Button onClick={handleToggleExpand}>
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                Collapse
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                {showReplace ? "Upload Replacement" : "Upload Data"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Inline upload section */}
      {expanded && (
        <div className="border-t bg-slate-50/50 p-4 space-y-4">
          <div className="space-y-2">
            <Label>
              Select file for {month.label}{" "}
              {formatFY(baselineYear, false)}
            </Label>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="cursor-pointer bg-white"
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
                Parse &amp; Validate
              </>
            )}
          </Button>

          {/* Overwrite confirmation */}
          <Dialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-600 text-xl">
                  <AlertTriangle className="w-6 h-6" />
                  Data Already Exists
                </DialogTitle>
                <DialogDescription className="pt-3 text-base">
                  Data for{" "}
                  <span className="font-semibold">{existingPeriod}</span>{" "}
                  already exists. Do you want to overwrite it with new data?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowOverwriteDialog(false)}
                >
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

          {parseResult && (
            <ParseResultsCard
              result={parseResult}
              onSubmit={() =>
                submitMutation.mutate(parseResult.upload_record_id)
              }
              isSubmitting={submitMutation.isPending}
              onRefresh={onUploadComplete}
            />
          )}
        </div>
      )}
    </div>
  );
}

function getBaselineMonthStatusMeta(status: BaselineMonth["status"]) {
  switch (status) {
    case "approved":
      return {
        label: "Approved",
        className: "border-green-200 bg-green-50 text-green-700",
      };
    case "in_logbook":
      return {
        label: "In Logbook",
        className: "border-sky-200 bg-sky-50 text-sky-700",
      };
    case "reviewed":
      return {
        label: "Reviewed",
        className: "border-indigo-200 bg-indigo-50 text-indigo-700",
      };
    case "pending_review":
      return {
        label: "Pending Review",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "failed":
      return {
        label: "Failed",
        className: "border-red-200 bg-red-50 text-red-700",
      };
    default:
      return {
        label: "Not Started",
        className: "border-slate-200 bg-slate-50 text-slate-700",
      };
  }
}
