"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store/useAppStore";
import { reportingApi, type ReportingInstanceSummary } from "@/lib/api/reporting";
import type { FrameworkDef } from "@/lib/reporting/frameworks";
import PeriodPicker, { type PeriodType, buildPeriodLabel } from "./PeriodPicker";

interface ReportInstanceModalProps {
  framework: FrameworkDef;
  instances: ReportingInstanceSummary[];
  isOpen: boolean;
  onClose: () => void;
  mode?: "open" | "export";
  onExportInstance?: (instance: ReportingInstanceSummary) => void;
}

export default function ReportInstanceModal({
  framework,
  instances,
  isOpen,
  onClose,
  mode = "open",
  onExportInstance,
}: ReportInstanceModalProps) {
  const router = useRouter();
  const { user } = useAppStore();
  const selectedPlantId = user?.plantId;
  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");
  const [period, setPeriod] = useState<{
    type: PeriodType;
    fy: number;
    value: string;
    label: string;
  } | null>(null);

  // When a parent framework is clicked, show instances for all its children
  const relevantFrameworkIds = useMemo(() => {
    if (framework.isParent && framework.children) {
      return framework.children.map((c) => c.id);
    }
    return [framework.id];
  }, [framework]);

  const frameworkInstances = useMemo(
    () => instances.filter((i) => relevantFrameworkIds.includes(i.framework_id)),
    [instances, relevantFrameworkIds],
  );

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedPlantId || !period) {
        return Promise.reject(new Error("Missing plant or period"));
      }
      const reportTypeMap: Record<string, string> = {
        ccts: "pro_forma_cement",
        rco: "rco_quarterly",
      };
      return reportingApi.createInstance({
        plant_id: selectedPlantId,
        framework_id: framework.id,
        report_type: reportTypeMap[framework.id] ?? framework.id,
        financial_year: period.fy,
        period_label: period.label,
        total_sections: framework.sections.length,
      });
    },
    onSuccess: (resp) => {
      if (resp.data?.id) {
        toast.success("Report created");
        router.push(`/reporting/${framework.id}?instance=${resp.data.id}`);
        onClose();
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create report");
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{framework.shortName}</h2>
            <p className="text-sm text-slate-500">{framework.description}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 18 18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("existing")}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === "existing"
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {mode === "export" ? "Select Report to Export" : `Existing Reports (${frameworkInstances.length})`}
          </button>
          {mode !== "export" && (
            <button
              onClick={() => setActiveTab("new")}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === "new"
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Create New
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {activeTab === "existing" && (
            <div className="space-y-2">
              {frameworkInstances.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No existing reports. Create one to get started.
                </p>
              ) : (
                frameworkInstances.map((inst) => (
                  <button
                    key={inst.id}
                    onClick={() => {
                      if (mode === "export" && onExportInstance) {
                        onExportInstance(inst);
                        onClose();
                      } else {
                        router.push(`/reporting/${inst.framework_id}?instance=${inst.id}`);
                        onClose();
                      }
                    }}
                    className="w-full flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">{inst.period_label}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">
                          Progress: {inst.progress_pct}% · FY {inst.financial_year}
                        </span>
                        {framework.isParent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {inst.report_type === "pro_forma_cement" && "Pro-Forma"}
                            {inst.report_type === "rco_quarterly" && "RCO"}
                          </span>
                        )}
                      </div>
                      {inst.last_autofilled_at && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Last updated: {new Date(inst.last_autofilled_at).toLocaleDateString("en-GB")}
                        </div>
                      )}
                    </div>
                    {mode === "export" ? (
                      <span className="text-xs text-slate-500">Export</span>
                    ) : (
                      <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {activeTab === "new" && (
            <div className="space-y-4">
              {!selectedPlantId && (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                  Please select a plant before creating a report.
                </div>
              )}

              <PeriodPicker onChange={setPeriod} />

              <button
                onClick={() => createMutation.mutate()}
                disabled={!selectedPlantId || !period || createMutation.isPending}
                className="w-full rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? "Creating…" : "Create Report"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
