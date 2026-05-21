"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  fillTemplateAsync,
  getFillJobStatus,
  FillResponse,
  FillJobStatus,
} from "@/lib/api/template-filler";
import { Loader2, AlertCircle, ChevronLeft } from "lucide-react";
import { TemplateFillConfig } from "./TemplateFiller";

interface ProcessingStepProps {
  plantId: string;
  fileId: string;
  config: TemplateFillConfig;
  onComplete: (result: FillResponse) => void;
  onBack?: () => void;
}

const POLL_INTERVAL_MS = 3000;

export function ProcessingStep({
  plantId,
  fileId,
  config,
  onComplete,
  onBack,
}: ProcessingStepProps) {
  const [phase, setPhase] = useState<"starting" | "polling" | "error">("starting");
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasStarted = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kick off the async job once on mount
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const start = async () => {
      try {
        const { job_id } = await fillTemplateAsync({
          file_id: fileId,
          sheet_name: config.sheetName,
          target_column: config.targetColumn,
          start_row: config.startRow,
          plant_id: plantId,
          financial_year: config.financialYear,
          time_type: config.timeType,
          months: config.months,
        });
        setJobId(job_id);
        setPhase("polling");
      } catch (err) {
        setPhase("error");
        setError(err instanceof Error ? err.message : "Failed to start job");
      }
    };

    start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll job status while in polling phase
  useEffect(() => {
    if (phase !== "polling" || !jobId) return;

    const poll = async () => {
      try {
        const status: FillJobStatus = await getFillJobStatus(jobId);
        setProgress(status.progress ?? 0);

        if (status.status === "completed" && status.result) {
          onComplete(status.result);
          return;
        }

        if (status.status === "failed") {
          setPhase("error");
          setError(status.error || "Template fill failed");
          return;
        }

        // Still running — poll again
        pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        setPhase("error");
        setError(err instanceof Error ? err.message : "Failed to get job status");
      }
    };

    pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [phase, jobId, onComplete]);

  return (
    <Card>
      <CardContent className="py-12">
        <div className="flex flex-col items-center space-y-6">
          {(phase === "starting" || phase === "polling") && (
            <>
              <Loader2 className="w-16 h-16 animate-spin text-primary" />
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">
                  {phase === "starting" ? "Starting job..." : "Filling your template..."}
                </h3>
                <p className="text-muted-foreground">
                  The AI agent is matching parameters and filling cells.
                </p>
                <p className="text-sm text-muted-foreground">
                  This may take a few minutes for large templates.
                </p>
              </div>

              {phase === "polling" && (
                <div className="w-full max-w-md space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">{progress}% complete</p>
                </div>
              )}

              <div className="bg-muted p-4 rounded-lg text-sm space-y-1 w-full max-w-md">
                <p>
                  <span className="text-muted-foreground">Sheet:</span> {config.sheetName}
                </p>
                <p>
                  <span className="text-muted-foreground">Column:</span> {config.targetColumn}
                </p>
                <p>
                  <span className="text-muted-foreground">Year:</span> FY {config.financialYear}
                </p>
                <p>
                  <span className="text-muted-foreground">Range:</span>{" "}
                  {config.timeType === "annual" ? "Annual" : `${config.months?.length} months`}
                </p>
              </div>
            </>
          )}

          {phase === "error" && (
            <>
              <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>

              {onBack && (
                <Button variant="outline" onClick={onBack}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
