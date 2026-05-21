"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store/useAppStore";
import { getFramework, isLocalMode } from "@/lib/reporting/frameworks";
import { reportingApi } from "@/lib/api/reporting";
import PeriodPicker, { type PeriodType } from "../../components/PeriodPicker";

export default function NewInstancePage() {
  const params = useParams<{ frameworkId: string }>();
  const router = useRouter();
  const { user } = useAppStore();
  const selectedPlantId = user?.plantId;
  const fw = getFramework(params.frameworkId);

  // Local-mode frameworks (CBAM, BRSR, CDP, CBAM MMD) don't have instances —
  // jump straight to the editor which uses localStorage.
  useEffect(() => {
    if (fw && isLocalMode(fw)) {
      router.replace(`/reporting/${params.frameworkId}`);
    }
  }, [fw, params.frameworkId, router]);
  const [period, setPeriod] = useState<{
    type: PeriodType;
    fy: number;
    value: string;
    label: string;
  } | null>(null);

  const createMutation = useMutation({
    mutationFn: () => {
      if (!fw) return Promise.reject(new Error("Framework not found"));
      if (!period) return Promise.reject(new Error("Select a period"));
      const reportTypeMap: Record<string, string> = {
        ccts: "pro_forma_cement",
        rco: "rco_quarterly",
      };
      const report_type = reportTypeMap[params.frameworkId] ?? params.frameworkId;
      return reportingApi.createInstance({
        plant_id: selectedPlantId!,
        framework_id: params.frameworkId,
        report_type,
        financial_year: period.fy,
        period_label: period.label,
        total_sections: fw.sections.length,
      });
    },
    onSuccess: (resp) => {
      if (resp.data?.id) {
        router.push(`/reporting/${params.frameworkId}?instance=${resp.data.id}`);
      }
    },
  });

  if (!fw) return <div className="p-8 text-slate-500">Framework not found.</div>;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md p-8 border border-slate-200 rounded-lg bg-white shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900 mb-1">New {fw.shortName}</h1>
        <p className="text-sm text-slate-500 mb-6">{fw.description}</p>

        {!selectedPlantId && (
          <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            Please select a plant before creating a report.
          </div>
        )}

        <div className="mb-6">
          <PeriodPicker onChange={setPeriod} />
        </div>

        <button
          onClick={() => createMutation.mutate()}
          disabled={!selectedPlantId || !period || createMutation.isPending}
          className="w-full rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMutation.isPending ? "Creating…" : "Create Report"}
        </button>

        {createMutation.isError && (
          <p className="mt-3 text-sm text-rose-600">Failed to create. Please try again.</p>
        )}
      </div>
    </div>
  );
}
