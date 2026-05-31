"use client";

// Document extraction workspace. Upload a document → watch the agent read it
// (streaming activity) → review the proposed parameters/data-points side by
// side with the source → confirm to commit into the org's schema.

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExtractUploader, type UploadOptions } from "@/components/extract/ExtractUploader";
import { ExtractActivity, type ActivityItem } from "@/components/extract/ExtractActivity";
import { ProposalReview } from "@/components/extract/ProposalReview";
import { DocumentPreview } from "@/components/extract/DocumentPreview";
import { uploadAndExtract, type ExtractionProposal } from "@/lib/api/extract";

type Phase = "idle" | "running" | "review" | "done";

export default function ExtractPage() {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ExtractionProposal | null>(null);
  const documentIdRef = useRef<string | null>(null);

  const start = useCallback(async (opts: UploadOptions) => {
    setFile(opts.file);
    setPhase("running");
    setActivity([]);
    setText("");
    setError(null);
    setProposal(null);
    documentIdRef.current = null;

    try {
      const { documentId } = await uploadAndExtract({
        file: opts.file,
        period: opts.period,
        framework: opts.framework,
        onEvent: (ev) => {
          switch (ev.event) {
            case "activity":
              setActivity((prev) => [...prev, ev.data as ActivityItem]);
              break;
            case "text":
              setText((prev) => prev + ((ev.data as { text?: string }).text ?? ""));
              break;
            case "proposal":
              setProposal(ev.data as ExtractionProposal);
              break;
            case "error":
              setError((ev.data as { message?: string }).message ?? "Extraction failed");
              break;
            default:
              break;
          }
        },
      });
      documentIdRef.current = documentId;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      // If we got a proposal, move to review; otherwise surface the error state.
      setPhase((cur) => (cur === "running" ? "review" : cur));
    }
  }, []);

  const existingCodes = undefined; // dedup badge is best-effort; codes come back via "matches existing" once committed

  const reset = () => {
    setPhase("idle");
    setFile(null);
    setActivity([]);
    setText("");
    setError(null);
    setProposal(null);
    documentIdRef.current = null;
  };

  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">Upload &amp; extract data</h1>
          <p className="mt-1 text-sm text-slate-500">
            Drop a utility bill, invoice, or report. The assistant reads it, proposes metrics, and you review before saving.
          </p>
        </header>

        {phase === "idle" && <ExtractUploader onStart={start} />}

        {phase !== "idle" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left: source document */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Source document</h2>
                <button onClick={reset} className="text-xs text-slate-500 hover:text-slate-900">
                  ← Start over
                </button>
              </div>
              {file && (
                <div className="max-h-[80vh] overflow-auto border border-slate-200">
                  <DocumentPreview file={file} />
                </div>
              )}
            </div>

            {/* Right: activity / proposal */}
            <div className="space-y-4">
              {error && (
                <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              {(phase === "running" || (!proposal && !error)) && (
                <ExtractActivity items={activity} text={text} running={phase === "running"} />
              )}

              {phase === "review" && proposal && (
                <ProposalReview
                  proposal={proposal}
                  documentId={documentIdRef.current}
                  existingCodes={existingCodes}
                  onCommitted={() => {
                    setPhase("done");
                    qc.invalidateQueries({ queryKey: ["metrics"] });
                  }}
                />
              )}

              {phase === "review" && !proposal && !error && (
                <div className="text-sm text-slate-500">No metrics were proposed for this document.</div>
              )}

              {phase === "done" && (
                <div className="space-y-3">
                  <div className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    Saved. Your dashboard and reporting now include this data.
                  </div>
                  <button onClick={reset} className="bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90">
                    Upload another document
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
