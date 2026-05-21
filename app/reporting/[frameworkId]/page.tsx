"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store/useAppStore";
import { getFramework, isLocalMode } from "@/lib/reporting/frameworks";
import { reportingApi } from "@/lib/api/reporting";
import { Questionnaire } from "@/components/reporting/Questionnaire";
import { QualitativeReport } from "@/components/reporting/qualitative/QualitativeReport";
import { exportCctsFilled } from "@/lib/reporting/cctsExport";
import { exportRcoFilled } from "@/lib/reporting/rcoExport/export";
import { toast } from "sonner";

export default function ReportDetailPage() {
  const params = useParams<{ frameworkId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const frameworkId = params.frameworkId;
  const fw = getFramework(frameworkId);

  if (!fw) return <div className="p-8 text-slate-500">Framework not found.</div>;
  if (fw.status !== "active") {
    return (
      <div className="p-8 text-slate-500">
        {fw.shortName} is coming soon.
      </div>
    );
  }

  // ── Local mode (hybrid storage) ─────────────────────────────────────────
  // CBAM CT, BRSR, CDP, CBAM MMD persist to localStorage and skip the API.
  if (isLocalMode(fw)) {
    const initialQuestionId = searchParams.get("q") ?? undefined;

    if (fw.variant === "qualitative") {
      return (
        <div className="h-screen flex flex-col">
          <QualitativeReport frameworkId={fw.id} frameworkName={fw.shortName} />
        </div>
      );
    }

    return (
      <div className="h-screen flex flex-col">
        <LocalQuestionnaireWrapper
          frameworkId={fw.id}
          initialQuestionId={initialQuestionId}
        />
      </div>
    );
  }

  // ── API mode (CCTS, RCO) ────────────────────────────────────────────────
  return <ApiQuestionnaireWrapper frameworkId={frameworkId} />;
}

// ── Local-mode wrapper ──────────────────────────────────────────────────────

function LocalQuestionnaireWrapper({
  frameworkId,
  initialQuestionId,
}: {
  frameworkId: string;
  initialQuestionId?: string;
}) {
  const fw = getFramework(frameworkId)!;
  const version =
    fw.id === "cbam"
      ? "v2.1.1"
      : fw.id === "brsr"
        ? "SEBI Annexure I"
        : fw.id === "cdp"
          ? "CDP 2026"
          : undefined;

  const handleExport = useCallback(async () => {
    try {
      if (fw.id === "cbam") {
        const { exportCbamFilled } = await import("@/lib/reporting/cbamExport/export");
        await exportCbamFilled();
      } else if (fw.id === "brsr") {
        const { exportBrsrFilled } = await import("@/lib/reporting/brsrExport/export");
        await exportBrsrFilled();
      } else if (fw.id === "cdp") {
        const { exportCdpFilled } = await import("@/lib/reporting/cdpExport/export");
        await exportCdpFilled();
      } else {
        toast.info("Export not available for this framework yet.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Export failed. See browser console for details.");
    }
  }, [fw.id]);

  return (
    <Questionnaire
      config={{
        sections: fw.sections,
        frameworkId: fw.id,
        frameworkName: fw.shortName,
        version,
        storageKey: fw.storageKey,
        localMode: true,
        onExport: handleExport,
        initialQuestionId,
      }}
    />
  );
}

// ── API-mode wrapper ────────────────────────────────────────────────────────

function ApiQuestionnaireWrapper({ frameworkId }: { frameworkId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAppStore();
  const selectedPlantId = user?.plantId;
  const fw = getFramework(frameworkId)!;
  const instanceId = searchParams.get("instance");

  const { data: instanceResp, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["reporting-instance", instanceId],
    queryFn: () => reportingApi.getInstance(instanceId!),
    enabled: !!instanceId,
  });

  const instance = instanceResp?.data;

  const initialAnswers = useMemo(() => {
    if (!instance) return {};
    return Object.fromEntries(
      instance.sections.map((sec) => [
        sec.section_id,
        { values: sec.values, rows: [], status: sec.status },
      ]),
    );
  }, [instance]);

  const sectionConfidence = useMemo(() => {
    if (!instance) return {};
    return Object.fromEntries(
      instance.sections.map((sec) => [sec.section_id, sec.autofill_confidence ?? null]),
    );
  }, [instance]);

  const patchMutation = useMutation({
    mutationFn: ({ sectionId, values }: { sectionId: string; values: Record<string, unknown> }) =>
      reportingApi.patchSection(instanceId!, sectionId, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reporting-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["reporting-instances"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (sectionId: string) => reportingApi.completeSection(instanceId!, sectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reporting-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["reporting-instances"] });
      toast.success("Section marked as complete.");
    },
    onError: () => toast.error("Failed to complete section."),
  });

  const reopenMutation = useMutation({
    mutationFn: (sectionId: string) => reportingApi.reopenSection(instanceId!, sectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reporting-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["reporting-instances"] });
      toast.success("Section reopened for editing.");
    },
    onError: () => toast.error("Failed to reopen section."),
  });

  const resetMutation = useMutation({
    mutationFn: (sectionId: string) => reportingApi.resetSection(instanceId!, sectionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reporting-instance", instanceId] });
      qc.invalidateQueries({ queryKey: ["reporting-instances"] });
      toast.success("Section reset — all values cleared.");
    },
    onError: () => toast.error("Failed to reset section."),
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);
  const handleSectionChange = useCallback(
    (sectionId: string, values: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        patchMutation.mutate({ sectionId, values });
      }, 800);
    },
    [patchMutation],
  );

  const autofillMutation = useMutation({
    mutationFn: () => reportingApi.triggerAutofill(instanceId!),
    onSuccess: () => {
      toast.success("Autofill started — fields will populate shortly.");
      qc.invalidateQueries({ queryKey: ["reporting-instance", instanceId] });
    },
    onError: () => toast.error("Autofill failed. Please try again."),
  });

  const handleExport = useCallback(async () => {
    if (!instance || !fw) return;
    const answers: Record<string, { values: Record<string, unknown>; rows?: Record<string, unknown>[] }> = {};
    const secMap = new Map(instance.sections.map((s) => [s.section_id, s]));
    for (const section of fw.sections) {
      const saved = secMap.get(section.id);
      if (!saved) continue;
      for (const q of section.questions) {
        answers[q.id] = { values: saved.values };
      }
    }
    try {
      if (frameworkId === "ccts") await exportCctsFilled(answers);
      else if (frameworkId === "rco") await exportRcoFilled(answers);
      else toast.info("Export not available for this framework yet.");
    } catch (e) {
      console.error(e);
      toast.error("Export failed. See browser console for details.");
    }
  }, [instance, frameworkId, fw]);

  if (!instanceId) {
    router.replace(`/reporting/${frameworkId}/new`);
    return null;
  }

  if (isError) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load this report instance. Please try again.";
    return (
      <div className="flex h-screen items-center justify-center px-6">
        <div className="max-w-xl rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="font-medium">Could not open this report.</div>
          <div className="mt-1 break-words">{message}</div>
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => refetch()}
              className="rounded bg-rose-600 px-3 py-1 text-xs font-medium text-white hover:bg-rose-700"
            >
              Try again
            </button>
            <button
              onClick={() => router.push("/reporting")}
              className="rounded border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
            >
              Back to reports
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !instance) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Questionnaire
        config={{
          sections: fw.sections,
          frameworkId: fw.id,
          frameworkName: fw.shortName,
          version: fw.id === "ccts" ? "BEE Cement PPC Pro-Forma" : "30-Sep-2025",
          instanceId: instanceId,
          initialAnswers,
          onSectionChange: handleSectionChange,
          onCompleteSection: (sectionId: string) => completeMutation.mutate(sectionId),
          onReopenSection: (sectionId: string) => reopenMutation.mutate(sectionId),
          onResetSection: (sectionId: string) => resetMutation.mutate(sectionId),
          onAutofill: async () => { await autofillMutation.mutateAsync(); },
          onExport: handleExport,
          plantId: selectedPlantId ?? "",
          orgId: user?.orgId ?? "",
          financialYear: instance.financial_year,
          sectionConfidence,
        }}
      />
    </div>
  );
}
