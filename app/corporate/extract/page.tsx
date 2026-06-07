"use client";

// Document extraction workspace. Upload one or more documents → each one is
// extracted in parallel (up to a concurrency cap, the rest queued) → review the
// proposed parameters/data-points side by side with the source → confirm to
// commit into the org's schema. Each run commits independently.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExtractUploader, type UploadOptions } from "@/components/extract/ExtractUploader";
import { ExtractRunCard } from "@/components/extract/ExtractRunCard";
import { DocumentHistory } from "@/components/extract/DocumentHistory";
import { ChecklistTab } from "@/components/extract/ChecklistTab";
import {
  useExtractionQueue,
  MAX_CONCURRENT,
} from "@/components/extract/useExtractionQueue";

type Tab = "extract" | "checklist";

export default function ExtractPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("extract");
  const {
    runs,
    addFiles,
    cancelRun,
    removeRun,
    markCommitted,
    clearFinished,
    remainingSlots,
  } = useExtractionQueue();

  const handleAdd = (opts: UploadOptions[]) => addFiles(opts);

  const handleCommitted = (id: string) => {
    markCommitted(id);
    qc.invalidateQueries({ queryKey: ["metrics"] });
    qc.invalidateQueries({ queryKey: ["extraction-documents"] });
  };

  const runningCount = runs.filter((r) => r.status === "running").length;
  const queuedCount = runs.filter((r) => r.status === "queued").length;
  const hasFinished = runs.some(
    (r) =>
      r.status === "committed" ||
      r.status === "canceled" ||
      r.status === "error",
  );

  const tabClass = (active: boolean) =>
    `relative -mb-px border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
      active
        ? "border-[#074D47] text-[#074D47]"
        : "border-transparent text-slate-500 hover:text-[#0A0A0A]"
    }`;

  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <div
          role="tablist"
          aria-label="Extract sections"
          className="mb-6 flex items-center gap-6 border-b border-gray-200"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "extract"}
            onClick={() => setTab("extract")}
            className={tabClass(tab === "extract")}
          >
            Upload &amp; extract
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "checklist"}
            onClick={() => setTab("checklist")}
            className={tabClass(tab === "checklist")}
          >
            Checklist
          </button>
        </div>

        {tab === "checklist" ? (
          <ChecklistTab />
        ) : (
          <>
            <header className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
                Upload &amp; extract data
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Drop one or more utility bills, invoices, or reports. The
                assistant reads each one, proposes metrics, and you review
                before saving. Up to {MAX_CONCURRENT} run in parallel; the rest
                queue automatically.
              </p>
            </header>

            <ExtractUploader onAdd={handleAdd} remainingSlots={remainingSlots} />

            {runs.length > 0 && (
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    Extraction runs
                    {runningCount > 0 && (
                      <span className="ml-2 normal-case text-blue-600">
                        {runningCount} running
                      </span>
                    )}
                    {queuedCount > 0 && (
                      <span className="ml-2 normal-case text-slate-400">
                        {queuedCount} queued
                      </span>
                    )}
                  </h2>
                  {hasFinished && (
                    <button
                      type="button"
                      onClick={clearFinished}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Clear finished
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {runs.map((run) => (
                    <ExtractRunCard
                      key={run.id}
                      run={run}
                      onCommitted={handleCommitted}
                      onCancel={cancelRun}
                      onRemove={removeRun}
                    />
                  ))}
                </div>
              </div>
            )}

            <DocumentHistory />
          </>
        )}
      </div>
    </div>
  );
}
