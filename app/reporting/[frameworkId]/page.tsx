"use client";

import { useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getFramework } from "@/lib/reporting/frameworks";
import { Questionnaire } from "@/components/reporting/Questionnaire";
import { QualitativeReport } from "@/components/reporting/qualitative/QualitativeReport";
import { toast } from "sonner";

export default function ReportDetailPage() {
  const params = useParams<{ frameworkId: string }>();
  const searchParams = useSearchParams();

  const fw = getFramework(params.frameworkId);

  if (!fw) return <div className="p-8 text-slate-500">Framework not found.</div>;
  if (fw.status !== "active") {
    return (
      <div className="p-8 text-slate-500">
        {fw.shortName} is coming soon.
      </div>
    );
  }

  const initialQuestionId = searchParams.get("q") ?? undefined;

  // Qualitative documents (e.g. VSME Narrative Report) — narrative editor with
  // embedded requirements, comments, and the agent assistant.
  if (fw.variant === "qualitative") {
    return (
      <div className="h-screen flex flex-col">
        <QualitativeReport frameworkId={fw.id} frameworkName={fw.shortName} />
      </div>
    );
  }

  // Structured questionnaires (CDP, VSME Digital Template) — persisted to localStorage.
  return (
    <div className="h-screen flex flex-col">
      <LocalQuestionnaireWrapper
        frameworkId={fw.id}
        initialQuestionId={initialQuestionId}
      />
    </div>
  );
}

function LocalQuestionnaireWrapper({
  frameworkId,
  initialQuestionId,
}: {
  frameworkId: string;
  initialQuestionId?: string;
}) {
  const fw = getFramework(frameworkId)!;
  const version =
    fw.id === "cdp" ? "CDP 2026" : fw.id === "vsme" ? "v1.2.0" : undefined;

  const handleExport = useCallback(async () => {
    try {
      if (fw.id === "cdp") {
        const { exportCdpFilled } = await import("@/lib/reporting/cdpExport/export");
        await exportCdpFilled();
      } else if (fw.id === "vsme") {
        const { exportVsmeFilled } = await import("@/lib/reporting/vsmeExport/export");
        await exportVsmeFilled();
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
