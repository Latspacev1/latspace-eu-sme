"use client";

// One extraction run in the parallel queue. Renders its own status, source
// document, streamed activity, and — once the agent proposes — the editable
// review/commit panel. Each card commits independently.

import { useState } from "react";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { ExtractActivity } from "@/components/extract/ExtractActivity";
import { ProposalReview } from "@/components/extract/ProposalReview";
import { DocumentPreview } from "@/components/extract/DocumentPreview";
import type { ExtractionRun } from "@/components/extract/useExtractionQueue";

const STATUS_META: Record<
  ExtractionRun["status"],
  { label: string; className: string }
> = {
  queued: { label: "Queued", className: "bg-slate-100 text-slate-600" },
  running: { label: "Extracting", className: "bg-blue-50 text-blue-700" },
  review: { label: "Ready to review", className: "bg-amber-50 text-amber-700" },
  committed: { label: "Saved", className: "bg-emerald-50 text-emerald-700" },
  error: { label: "Failed", className: "bg-red-50 text-red-700" },
  canceled: { label: "Canceled", className: "bg-slate-100 text-slate-500" },
};

export function ExtractRunCard({
  run,
  onCommitted,
  onCancel,
  onRemove,
}: {
  run: ExtractionRun;
  onCommitted: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  // Running/review cards start expanded; terminal ones collapsed.
  const [open, setOpen] = useState(
    run.status === "running" || run.status === "review",
  );

  const meta = STATUS_META[run.status];
  const isTerminal =
    run.status === "committed" ||
    run.status === "error" ||
    run.status === "canceled";

  const StatusIcon =
    run.status === "running"
      ? Loader2
      : run.status === "queued"
        ? Clock
        : run.status === "committed"
          ? CheckCircle2
          : run.status === "error"
            ? AlertCircle
            : null;

  return (
    <div className="overflow-hidden rounded-sm border border-slate-200">
      {/* Header row */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-slate-400 hover:text-slate-700"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <span
          className="max-w-[320px] truncate text-sm font-medium text-[#0A0A0A]"
          title={run.file.name}
        >
          {run.file.name}
        </span>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
        >
          {StatusIcon && (
            <StatusIcon
              className={`h-3 w-3 ${run.status === "running" ? "animate-spin" : ""}`}
            />
          )}
          {meta.label}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {run.status === "running" && (
            <button
              type="button"
              onClick={() => onCancel(run.id)}
              className="text-xs text-slate-500 hover:text-red-600"
            >
              Cancel
            </button>
          )}
          {isTerminal && (
            <button
              type="button"
              onClick={() => onRemove(run.id)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Remove from list"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-2">
          {/* Left: source document */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Source document
            </h3>
            <div className="max-h-[60vh] overflow-auto border border-slate-200">
              <DocumentPreview file={run.file} />
            </div>
          </div>

          {/* Right: activity / proposal / terminal states */}
          <div className="space-y-4">
            {run.status === "queued" && (
              <div className="text-sm text-slate-500">
                Waiting for an open slot…
              </div>
            )}

            {run.error && (
              <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {run.error}
              </div>
            )}

            {(run.status === "running" ||
              (run.status === "review" && !run.proposal && !run.error)) && (
              <ExtractActivity
                items={run.activity}
                text={run.text}
                running={run.status === "running"}
              />
            )}

            {run.status === "review" && run.proposal && (
              <ProposalReview
                proposal={run.proposal}
                documentId={run.documentId}
                onCommitted={() => onCommitted(run.id)}
              />
            )}

            {run.status === "review" && !run.proposal && !run.error && (
              <div className="text-sm text-slate-500">
                No metrics were proposed for this document.
              </div>
            )}

            {run.status === "committed" && (
              <div className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Saved. Your dashboard and reporting now include this data.
              </div>
            )}

            {run.status === "canceled" && (
              <div className="text-sm text-slate-500">
                Extraction canceled.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
