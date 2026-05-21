"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  benchmarkingApi,
  type ProjectStatusResponse,
  type ProjectStatus,
} from "@/lib/api/benchmarking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { intervalToDuration } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

type BadgeVariant = "secondary" | "default" | "success" | "warning" | "destructive";

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; variant: BadgeVariant }
> = {
  draft: { label: "Draft", variant: "secondary" },
  running: { label: "Running", variant: "warning" },
  complete: { label: "Complete", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureUtc(iso: string): string {
  if (/[Zz]$/.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso)) return iso;
  return iso + "Z";
}

function formatElapsedTime(startedAt: string | null, now: Date): string {
  if (!startedAt) return "—";
  const start = new Date(ensureUtc(startedAt));
  if (isNaN(start.getTime())) return "—";
  const duration = intervalToDuration({ start, end: now });
  const mins = duration.minutes ?? 0;
  const secs = duration.seconds ?? 0;
  if ((duration.hours ?? 0) > 0) {
    const h = duration.hours ?? 0;
    return `${h}h ${mins}m ${secs}s`;
  }
  if (mins > 0) return `${mins} minute${mins !== 1 ? "s" : ""} ${secs} second${secs !== 1 ? "s" : ""}`;
  return `${secs} second${secs !== 1 ? "s" : ""}`;
}

function computeProgress(
  peersCompleted: number,
  peersTotal: number,
): number {
  if (peersTotal <= 0) return 0;
  return Math.round((peersCompleted / peersTotal) * 100);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProjectStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: "secondary" as BadgeVariant };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

interface RunningPanelProps {
  statusData: ProjectStatusResponse;
  elapsed: string;
}

function RunningPanel({ statusData, elapsed }: RunningPanelProps) {
  const progress = computeProgress(
    statusData.peers_completed,
    statusData.peers_total,
  );

  return (
    <div className="space-y-8">
      {/* Progress bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#0A0A0A]/70 font-medium">
            {statusData.peers_completed} of {statusData.peers_total} peers analysed
          </span>
          <span className="text-[#0A0A0A]/50 tabular-nums">{progress}%</span>
        </div>
        <Progress
          value={progress}
          aria-label="Peer analysis progress"
          className="h-3 rounded-full bg-[#074D47]/10 [&>[data-slot=progress-indicator]]:bg-[#074D47]"
        />
      </div>

      {/* Elapsed time */}
      <div className="flex items-center gap-6 text-sm text-[#0A0A0A]/60">
        <div>
          <span className="font-medium text-[#0A0A0A]/40 uppercase tracking-wide text-xs block mb-0.5">
            Elapsed
          </span>
          <span className="font-medium text-[#0A0A0A] tabular-nums">{elapsed}</span>
        </div>
      </div>
    </div>
  );
}

interface FailedPanelProps {
  onRetry: () => void;
  isRetrying: boolean;
}

function FailedPanel({ onRetry, isRetrying }: FailedPanelProps) {
  return (
    <div className="border border-red-200 bg-red-50 rounded-lg p-6 flex flex-col items-center text-center gap-4">
      <AlertCircle className="w-10 h-10 text-red-500" />
      <div>
        <p className="font-semibold text-[#0A0A0A] mb-1">Analysis failed</p>
        <p className="text-sm text-[#0A0A0A]/60">
          Something went wrong during the analysis run. You can retry to start a
          new run.
        </p>
      </div>
      <Button
        onClick={onRetry}
        disabled={isRetrying}
        className="bg-[#074D47] text-white hover:bg-[#074D47]/90"
      >
        {isRetrying ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Retrying…
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Analysis
          </>
        )}
      </Button>
    </div>
  );
}

function CompletedPanel() {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-4">
      <CheckCircle2 className="w-12 h-12 text-[#074D47]" />
      <p className="font-semibold text-[#0A0A0A]">Analysis complete — redirecting…</p>
    </div>
  );
}

// ── Main exported component ────────────────────────────────────────────────────

interface RunProgressPanelProps {
  projectId: string;
}

export function RunProgressPanel({ projectId }: RunProgressPanelProps) {
  const router = useRouter();
  const [now, setNow] = useState<Date>(new Date());

  // Polling query
  const { data: response, isLoading } = useQuery({
    queryKey: ["benchmarking-status", projectId],
    queryFn: () => benchmarkingApi.getStatus(projectId),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      if (status === "complete" || status === "failed") return false;
      return 5000;
    },
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: () => benchmarkingApi.runProject(projectId),
  });

  const statusData = response?.data;
  const status = statusData?.status;

  // Tick every second for elapsed time display — stop on terminal status
  useEffect(() => {
    if (status === "complete" || status === "failed") return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Auto-redirect when complete
  useEffect(() => {
    if (status === "complete") {
      const timeout = setTimeout(
        () => router.push(`/corporate/benchmarking/${projectId}`),
        1500,
      );
      return () => clearTimeout(timeout);
    }
  }, [status, projectId, router]);

  const elapsed = formatElapsedTime(statusData?.run_started_at ?? null, now);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 aria-hidden="true" className="w-10 h-10 text-[#074D47] animate-spin" />
        <p className="text-[#0A0A0A]/60 text-sm">Loading run status…</p>
      </div>
    );
  }

  // ── No data / error ────────────────────────────────────────────────────────
  if (!statusData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-[#0A0A0A]/60 text-sm">Unable to load run status.</p>
      </div>
    );
  }

  // ── Draft / not started ────────────────────────────────────────────────────
  if (!status || status === "draft") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>This analysis has not been started yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status badge row */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-[#0A0A0A]/50">Status</span>
        <StatusBadge status={statusData.status} />
        {statusData.status === "running" && (
          <Loader2 aria-hidden="true" className="w-4 h-4 text-[#074D47] animate-spin" />
        )}
      </div>

      {/* Panel content based on status */}
      {statusData.status === "running" && (
        <RunningPanel statusData={statusData} elapsed={elapsed} />
      )}
      {statusData.status === "failed" && (
        <FailedPanel
          onRetry={() => retryMutation.mutate()}
          isRetrying={retryMutation.isPending}
        />
      )}
      {statusData.status === "complete" && <CompletedPanel />}
    </div>
  );
}
