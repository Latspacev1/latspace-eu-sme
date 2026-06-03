"use client";

// Owns a queue of extraction runs so several documents can be extracted in
// parallel. Each run streams its own activity/text/proposal independently.
//
// Concurrency: at most MAX_CONCURRENT runs are in flight at once; the rest sit
// in "queued" and start automatically as slots free up. The cap protects
// against bursting many Vercel Sandbox VMs + Anthropic requests at once (each
// run = one dedicated sandbox + one model call), which can otherwise trigger
// sandbox / rate-limit 429s. Raise MAX_CONCURRENT only if your Vercel and
// Anthropic tiers comfortably allow more simultaneous sandboxes/requests.
//
// MAX_QUEUED bounds how many files can be staged at once (running + waiting).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  uploadAndExtract,
  type ExtractionProposal,
} from "@/lib/api/extract";
import type { ActivityItem } from "@/components/extract/ExtractActivity";

export const MAX_CONCURRENT = 4;
export const MAX_QUEUED = 12;

export type RunStatus =
  | "queued"
  | "running"
  | "review"
  | "committed"
  | "error"
  | "canceled";

export interface ExtractionRun {
  id: string;
  file: File;
  period?: string;
  framework: string;
  status: RunStatus;
  activity: ActivityItem[];
  text: string;
  proposal: ExtractionProposal | null;
  documentId: string | null;
  error: string | null;
}

export interface AddFileInput {
  file: File;
  period?: string;
  framework: string;
}

let runSeq = 0;
function nextRunId(file: File): string {
  runSeq += 1;
  return `run-${runSeq}-${file.name}`;
}

export function useExtractionQueue() {
  const [runs, setRuns] = useState<ExtractionRun[]>([]);
  // AbortControllers keyed by run id so we can cancel an in-flight stream.
  const controllers = useRef<Map<string, AbortController>>(new Map());
  // Ids we've already kicked off, so the scheduler effect never starts a run
  // twice (React may re-run the effect before state reflects "running").
  const started = useRef<Set<string>>(new Set());

  const patchRun = useCallback(
    (id: string, patch: Partial<ExtractionRun>) => {
      setRuns((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const runOne = useCallback(
    async (run: ExtractionRun) => {
      const controller = new AbortController();
      controllers.current.set(run.id, controller);
      patchRun(run.id, { status: "running", error: null });

      let documentId: string | null = null;
      try {
        const result = await uploadAndExtract({
          file: run.file,
          period: run.period,
          framework: run.framework,
          signal: controller.signal,
          onEvent: (ev) => {
            switch (ev.event) {
              case "activity":
                setRuns((prev) =>
                  prev.map((r) =>
                    r.id === run.id
                      ? { ...r, activity: [...r.activity, ev.data as ActivityItem] }
                      : r,
                  ),
                );
                break;
              case "text":
                setRuns((prev) =>
                  prev.map((r) =>
                    r.id === run.id
                      ? {
                          ...r,
                          text:
                            r.text +
                            ((ev.data as { text?: string }).text ?? ""),
                        }
                      : r,
                  ),
                );
                break;
              case "proposal":
                patchRun(run.id, {
                  proposal: ev.data as ExtractionProposal,
                });
                break;
              case "error":
                patchRun(run.id, {
                  error:
                    (ev.data as { message?: string }).message ??
                    "Extraction failed",
                });
                break;
              default:
                break;
            }
          },
        });
        documentId = result.documentId;
      } catch (e) {
        // Aborted runs surface as canceled, not error.
        if (controller.signal.aborted) {
          patchRun(run.id, { status: "canceled" });
          controllers.current.delete(run.id);
          return;
        }
        patchRun(run.id, { status: "error", error: (e as Error).message });
        controllers.current.delete(run.id);
        return;
      }

      controllers.current.delete(run.id);

      // Settle terminal state based on what streamed in. Read the latest run
      // from state so we see the proposal/error the callbacks wrote.
      setRuns((prev) =>
        prev.map((r) => {
          if (r.id !== run.id) return r;
          const docId = documentId ?? r.documentId;
          if (r.error) return { ...r, status: "error", documentId: docId };
          return {
            ...r,
            status: "review",
            documentId: docId,
          };
        }),
      );
    },
    [patchRun],
  );

  // Scheduler: whenever the set of runs changes, start queued runs up to the
  // concurrency cap. The actual kick-off is deferred to a microtask so the
  // effect body itself never triggers synchronous state updates (runOne calls
  // setState as it streams) — that would cascade renders.
  useEffect(() => {
    const runningCount = runs.filter((r) => r.status === "running").length;
    let free = MAX_CONCURRENT - runningCount;
    if (free <= 0) return;

    const toStart: ExtractionRun[] = [];
    for (const r of runs) {
      if (free <= 0) break;
      if (r.status === "queued" && !started.current.has(r.id)) {
        started.current.add(r.id);
        free -= 1;
        toStart.push(r);
      }
    }
    if (toStart.length) {
      queueMicrotask(() => {
        for (const r of toStart) void runOne(r);
      });
    }
  }, [runs, runOne]);

  const addFiles = useCallback((inputs: AddFileInput[]) => {
    setRuns((prev) => {
      const activeCount = prev.filter(
        (r) =>
          r.status === "queued" ||
          r.status === "running" ||
          r.status === "review",
      ).length;
      const room = Math.max(0, MAX_QUEUED - activeCount);
      const accepted = inputs.slice(0, room).map<ExtractionRun>((inp) => ({
        id: nextRunId(inp.file),
        file: inp.file,
        period: inp.period,
        framework: inp.framework,
        status: "queued",
        activity: [],
        text: "",
        proposal: null,
        documentId: null,
        error: null,
      }));
      return [...prev, ...accepted];
    });
  }, []);

  const cancelRun = useCallback((id: string) => {
    const controller = controllers.current.get(id);
    if (controller) controller.abort();
    else {
      // Not yet started (still queued) — mark canceled directly.
      setRuns((prev) =>
        prev.map((r) =>
          r.id === id && r.status === "queued"
            ? { ...r, status: "canceled" }
            : r,
        ),
      );
    }
  }, []);

  const removeRun = useCallback((id: string) => {
    const controller = controllers.current.get(id);
    if (controller) controller.abort();
    controllers.current.delete(id);
    started.current.delete(id);
    setRuns((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const markCommitted = useCallback(
    (id: string) => {
      patchRun(id, { status: "committed" });
    },
    [patchRun],
  );

  const clearFinished = useCallback(() => {
    setRuns((prev) =>
      prev.filter(
        (r) =>
          r.status !== "committed" &&
          r.status !== "canceled" &&
          r.status !== "error",
      ),
    );
  }, []);

  // Abort every in-flight stream on unmount so we don't leak sandboxes.
  useEffect(() => {
    const map = controllers.current;
    return () => {
      for (const c of map.values()) c.abort();
      map.clear();
    };
  }, []);

  const activeCount = runs.filter(
    (r) =>
      r.status === "queued" ||
      r.status === "running" ||
      r.status === "review",
  ).length;
  const canAddMore = activeCount < MAX_QUEUED;

  return {
    runs,
    addFiles,
    cancelRun,
    removeRun,
    markCommitted,
    clearFinished,
    canAddMore,
    remainingSlots: Math.max(0, MAX_QUEUED - activeCount),
  };
}
