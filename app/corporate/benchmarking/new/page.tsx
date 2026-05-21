"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { benchmarkingApi, type BenchmarkingSegment, type CriteriaSet } from "@/lib/api/benchmarking";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

import {
  Step1ProjectDetails,
  type Step1Data,
} from "@/components/benchmarking/step1-project-details";
import {
  Step2PeerPicker,
  type Step2Data,
} from "@/components/benchmarking/step2-peer-picker";
import {
  Step3CriteriaSelector,
  type Step3Data,
} from "@/components/benchmarking/step3-criteria-selector";
import { Step4ReviewSummary } from "@/components/benchmarking/step4-review-summary";

// ── Step configuration ────────────────────────────────────────────────────────

const STEPS = [
  { label: "Project", number: 1 },
  { label: "Peers", number: 2 },
  { label: "Criteria", number: 3 },
  { label: "Review", number: 4 },
];

// ── Step progress indicator ───────────────────────────────────────────────────

function StepProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, idx) => (
        <div key={step.number} className="flex items-center">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
              step.number < current
                ? "bg-[#074D47] text-white"
                : step.number === current
                  ? "bg-[#074D47] text-white ring-4 ring-[#074D47]/20"
                  : "bg-[#0A0A0A]/10 text-[#0A0A0A]/40"
            }`}
            aria-current={step.number === current ? "step" : undefined}
          >
            {step.number < current ? "✓" : step.number}
          </div>
          <span
            className={`ml-2 text-sm font-medium hidden sm:inline ${
              step.number <= current ? "text-[#0A0A0A]" : "text-[#0A0A0A]/40"
            }`}
          >
            {step.label}
          </span>
          {idx < STEPS.length - 1 && (
            <div
              className={`mx-4 h-px w-12 sm:w-20 ${
                step.number < current ? "bg-[#074D47]" : "bg-[#0A0A0A]/15"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Wizard page ───────────────────────────────────────────────────────────────

export default function NewBenchmarkingProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step data
  const [step1, setStep1] = useState<Step1Data>({ name: "", segment: "" });
  const [step2, setStep2] = useState<Step2Data>({
    selectedPeers: [],
    customPeers: [],
  });
  const [step3, setStep3] = useState<Step3Data>({
    criteriaSet: "",
    customCriteria: [],
  });

  // ── Validation per step ──────────────────────────────────────────────────

  const isStep1Valid = step1.name.trim().length > 0 && step1.segment !== "";

  const isStep2Valid =
    step2.selectedPeers.length > 0 || step2.customPeers.length > 0;

  const isStep3Valid =
    step3.criteriaSet !== "" &&
    (step3.criteriaSet !== "custom" || step3.customCriteria.length > 0);

  const canProceed =
    (step === 1 && isStep1Valid) ||
    (step === 2 && isStep2Valid) ||
    (step === 3 && isStep3Valid) ||
    step === 4;

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleNext = () => {
    if (step < 4 && canProceed) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleStartAnalysis = async () => {
    if (!isStep1Valid || !isStep2Valid || !isStep3Valid) return;
    setIsSubmitting(true);
    try {
      const createRes = await benchmarkingApi.createProject({
        name: step1.name.trim(),
        segment: step1.segment as BenchmarkingSegment,
        peer_ids: step2.selectedPeers.map((p) => p.id),
        criteria_set: step3.criteriaSet as CriteriaSet,
        custom_criteria:
          step3.criteriaSet === "custom" ? step3.customCriteria : undefined,
      });

      if (!createRes.success || !createRes.data) {
        toast.error(createRes.message || "Failed to create project");
        return;
      }

      const projectId = createRes.data.project_id;

      const runRes = await benchmarkingApi.runProject(projectId);

      if (!runRes.success) {
        toast.error(runRes.message || "Failed to start analysis");
        return;
      }

      toast.success("Analysis started!");
      router.push(`/corporate/benchmarking/${projectId}/run`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white min-h-screen">
      <div className="container mx-auto px-6 py-8 max-w-3xl">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-[#0A0A0A] tracking-tight mb-1">
            New Benchmarking Project
          </h1>
          <p className="text-sm text-[#0A0A0A]/50">
            Follow the steps below to set up peer ESG analysis.
          </p>
        </div>

        {/* Step progress */}
        <div className="mb-10">
          <StepProgress current={step} />
        </div>

        {/* Step content */}
        <div className="border border-[#0A0A0A]/10 rounded-xl p-8 min-h-[360px]">
          {step === 1 && (
            <Step1ProjectDetails data={step1} onChange={setStep1} />
          )}
          {step === 2 && (
            <Step2PeerPicker data={step2} onChange={setStep2} />
          )}
          {step === 3 && (
            <Step3CriteriaSelector data={step3} onChange={setStep3} />
          )}
          {step === 4 && (
            <Step4ReviewSummary
              name={step1.name}
              segment={step1.segment}
              selectedPeers={step2.selectedPeers}
              customPeers={step2.customPeers}
              criteriaSet={step3.criteriaSet}
              customCriteria={step3.customCriteria}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={step === 1 || isSubmitting}
            className="text-[#0A0A0A]/60"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          {step < 4 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="bg-[#074D47] text-white hover:bg-[#074D47]/90"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleStartAnalysis}
              disabled={isSubmitting || !isStep1Valid || !isStep2Valid || !isStep3Valid}
              className="bg-[#074D47] text-white hover:bg-[#074D47]/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                "Start Analysis"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
