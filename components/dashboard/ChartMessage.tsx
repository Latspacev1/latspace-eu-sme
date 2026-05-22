"use client";

// Inline chart rendered inside the chat panel. Shows the spec title, the
// chart itself, and a "Pin to dashboard" button that pushes the spec into
// the tiles API.

import { Pin, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { ChartRenderer } from "@/components/dashboard/ChartRenderer";
import type { ChartSpec, ChartData } from "@/lib/dashboard/chart-spec";
import { dashboardFetch } from "@/lib/dashboard/client-fetch";
import { cn } from "@/lib/utils";

interface ChartMessageProps {
  spec: ChartSpec;
  data: ChartData;
  pinned?: boolean;
  onPinned?: () => void;
}

export function ChartMessage({ spec, data, pinned, onPinned }: ChartMessageProps) {
  const pin = useMutation({
    mutationFn: async () => {
      const res = await dashboardFetch("/api/dashboard/tiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Pinned to dashboard");
      onPinned?.();
    },
    onError: (e) => toast.error(`Pin failed: ${(e as Error).message}`),
  });

  const isPinned = pinned || pin.isSuccess;

  return (
    <div className="bg-white border border-[#0A0A0A]/10">
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#0A0A0A]/[0.06]">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-[#0A0A0A] truncate">{spec.title}</h4>
          <p className="text-[11px] text-[#0A0A0A]/50 mt-0.5">
            {data.period_label} · {spec.granularity} · {spec.parameter_codes.length} series
          </p>
        </div>
        <button
          type="button"
          onClick={() => !isPinned && !pin.isPending && pin.mutate()}
          disabled={isPinned || pin.isPending}
          className={cn(
            "flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[11px] uppercase tracking-wider font-medium transition-colors",
            isPinned
              ? "border-[#1F5F5B]/30 text-[#1F5F5B] bg-[#1F5F5B]/5 cursor-default"
              : "border-[#0A0A0A]/15 text-[#0A0A0A]/80 hover:bg-[#0A0A0A]/[0.03] disabled:opacity-50",
          )}
        >
          {isPinned ? <Check className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
          {isPinned ? "Pinned" : pin.isPending ? "Pinning…" : "Pin"}
        </button>
      </div>
      <div className="p-3">
        <ChartRenderer spec={spec} data={data} height={240} />
      </div>
    </div>
  );
}
