"use client";

import { useState, useCallback } from "react";
import { PreviewResponse, FillResponse } from "@/lib/api/template-filler";
import { UploadStep } from "./UploadStep";
import { PreviewStep } from "./PreviewStep";
import { ConfigureStep } from "./ConfigureStep";
import { ProcessingStep } from "./ProcessingStep";
import { ResultsStep } from "./ResultsStep";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Circle } from "lucide-react";

type Step = "upload" | "preview" | "configure" | "processing" | "results";

export interface TemplateFillConfig {
  sheetName: string;
  targetColumn: string;
  startRow: number;
  financialYear: number;
  timeType: "monthly" | "annual";
  months?: number[];
}

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "preview", label: "Select Column" },
  { key: "configure", label: "Configure" },
  { key: "processing", label: "Processing" },
  { key: "results", label: "Results" },
];

export function TemplateFiller({ plantId }: { plantId: string }) {
  const [step, setStep] = useState<Step>("upload");
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [config, setConfig] = useState<TemplateFillConfig | null>(null);
  const [fillResult, setFillResult] = useState<FillResponse | null>(null);

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  const handleUploadComplete = useCallback((data: PreviewResponse) => {
    setPreviewData(data);
    setStep("preview");
  }, []);

  const handlePreviewComplete = useCallback(
    (sheetName: string, column: string, startRow: number) => {
      setConfig({
        sheetName,
        targetColumn: column,
        startRow,
        financialYear: new Date().getFullYear(),
        timeType: "annual",
      });
      setStep("configure");
    },
    []
  );

  const handleConfigureComplete = useCallback((updatedConfig: TemplateFillConfig) => {
    setConfig(updatedConfig);
    setStep("processing");
  }, []);

  const handleProcessingComplete = useCallback((result: FillResponse) => {
    setFillResult(result);
    setStep("results");
  }, []);

  const handleReset = useCallback(() => {
    setStep("upload");
    setPreviewData(null);
    setConfig(null);
    setFillResult(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Compact progress indicator */}
      <div className="flex items-center justify-center py-2 px-1">
        <div className="flex flex-wrap items-center justify-center gap-y-1 gap-x-0">
        {STEPS.map((s, idx) => (
          <div key={s.key} className="flex items-center">
            <div className="flex items-center gap-1.5">
              {idx < currentStepIndex ? (
                <CheckCircle2 className="w-4 h-4 text-primary" />
              ) : idx === currentStepIndex ? (
                <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold">
                  {idx + 1}
                </div>
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground/50" />
              )}
              <span
                className={`text-xs ${
                  idx === currentStepIndex
                    ? "text-foreground font-medium"
                    : idx < currentStepIndex
                      ? "text-primary"
                      : "text-muted-foreground/50"
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`h-px w-6 mx-2 ${idx < currentStepIndex ? "bg-primary" : "bg-muted"}`}
              />
            )}
          </div>
        ))}
        </div>
      </div>

      {/* Step content */}
      {step === "upload" && <UploadStep onComplete={handleUploadComplete} />}

      {step === "preview" && previewData && (
        <PreviewStep
          previewData={previewData}
          onBack={() => setStep("upload")}
          onComplete={handlePreviewComplete}
        />
      )}

      {step === "configure" && config && previewData && (
        <ConfigureStep
          plantId={plantId}
          initialConfig={config}
          onBack={() => setStep("preview")}
          onComplete={handleConfigureComplete}
        />
      )}

      {step === "processing" && config && previewData && (
        <ProcessingStep
          plantId={plantId}
          fileId={previewData.file_id}
          config={config}
          onComplete={handleProcessingComplete}
          onBack={() => setStep("configure")}
        />
      )}

      {step === "results" && fillResult && (
        <ResultsStep result={fillResult} onReset={handleReset} />
      )}
    </div>
  );
}
