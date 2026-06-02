"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import {
  emptyOnboardingProfile,
  REPORT_OPTIONS,
  VSME_MODULE_OPTIONS,
  type OnboardingProfile,
  type ReportType,
  type VsmeModules,
} from "@/lib/types/onboarding";

const TOTAL_STEPS = 3;
const BRAND = "#074D47";

const labelClass =
  "block text-[11px] text-[#074D47] tracking-[0.15em] uppercase font-medium";
const inputClass =
  "w-full border border-gray-200 rounded-sm bg-white px-4 py-3 text-sm outline-none transition-colors hover:border-gray-300 focus:border-[#074D47] disabled:opacity-50 disabled:cursor-not-allowed";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState<OnboardingProfile>(() =>
    emptyOnboardingProfile(),
  );

  const update = (patch: Partial<OnboardingProfile>) =>
    setProfile((p) => ({ ...p, ...patch }));

  const toggleReport = (value: ReportType) =>
    setProfile((p) => {
      const has = p.reports.includes(value);
      const reports = has
        ? p.reports.filter((r) => r !== value)
        : [...p.reports, value];
      // Keep the vsme sub-object in sync with whether VSME is selected.
      const vsme = reports.includes("vsme")
        ? p.vsme ?? { purpose: "", modules: "basic" as VsmeModules }
        : null;
      return { ...p, reports, vsme };
    });

  const vsmeSelected = profile.reports.includes("vsme");

  // Per-step validation gates the "Continue" / "Finish" button.
  const stepValid = useMemo(() => {
    if (step === 1) return profile.companyName.trim().length > 0;
    if (step === 2) {
      if (profile.reports.length === 0) return false;
      // VSME requires a module choice (purpose is optional).
      if (vsmeSelected && !profile.vsme?.modules) return false;
      return true;
    }
    if (step === 3) {
      return (
        profile.reportingYear !== null &&
        Number.isInteger(profile.reportingYear)
      );
    }
    return false;
  }, [step, profile, vsmeSelected]);

  const next = () => {
    setError("");
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  };
  const back = () => {
    setError("");
    if (step > 1) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.companyName.trim(),
          profile,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (res.ok && data.ok) {
        router.push("/corporate/overview");
        router.refresh();
        return;
      }

      setSubmitting(false);
      setError(data.error || "Unable to create organization. Please try again.");
    } catch {
      setSubmitting(false);
      setError("An error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden">
      <div className="w-full max-w-[520px] mx-4">
        <div className="bg-white border border-gray-200 rounded-sm p-12 shadow-sm">
          <div className="flex flex-col items-center mb-8">
            <Image
              src="/latspace-logo.svg"
              alt="LatSpace"
              width={56}
              height={56}
              priority
              className="mb-6"
            />
            <h1 className="font-semibold text-[24px] text-[#0A0A0A] tracking-[-0.01em] text-center">
              Set up your organization
            </h1>
            <p className="text-[13px] text-gray-500 mt-3 text-center leading-relaxed">
              A few details so we can tailor your reports and the AI assistant.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: n === step ? 28 : 16,
                  backgroundColor: n <= step ? BRAND : "#E5E7EB",
                }}
              />
            ))}
          </div>

          {error && (
            <div className="text-red-600 text-[13px] mb-5">{error}</div>
          )}

          {/* Step 1 — Company */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="company-name" className={labelClass}>
                  Company name
                </label>
                <input
                  id="company-name"
                  type="text"
                  value={profile.companyName}
                  onChange={(e) => update({ companyName: e.target.value })}
                  autoFocus
                  maxLength={120}
                  disabled={submitting}
                  placeholder="Acme Inc."
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="website-url" className={labelClass}>
                  Website URL
                </label>
                <input
                  id="website-url"
                  type="url"
                  value={profile.websiteUrl}
                  onChange={(e) => update({ websiteUrl: e.target.value })}
                  maxLength={300}
                  disabled={submitting}
                  placeholder="https://acme.com"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Step 2 — Which reports */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <span className={labelClass}>Which reports?</span>
                <div className="space-y-2.5">
                  {REPORT_OPTIONS.map((opt) => {
                    const checked = profile.reports.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleReport(opt.value)}
                        className={`w-full text-left border rounded-sm px-4 py-3 transition-colors ${
                          checked
                            ? "border-[#074D47] bg-[#074D47]/[0.04]"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[3px] border ${
                              checked
                                ? "border-[#074D47] bg-[#074D47] text-white"
                                : "border-gray-300"
                            }`}
                          >
                            {checked && (
                              <svg
                                viewBox="0 0 12 12"
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                              </svg>
                            )}
                          </span>
                          <span>
                            <span className="block text-sm font-medium text-[#0A0A0A]">
                              {opt.label}
                            </span>
                            <span className="block text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                              {opt.description}
                            </span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* VSME sub-questions, conditional */}
              {vsmeSelected && (
                <div className="space-y-5 border-t border-gray-100 pt-5">
                  <div className="space-y-2">
                    <label htmlFor="vsme-purpose" className={labelClass}>
                      Purpose of VSME
                    </label>
                    <textarea
                      id="vsme-purpose"
                      value={profile.vsme?.purpose ?? ""}
                      onChange={(e) =>
                        update({
                          vsme: {
                            purpose: e.target.value,
                            modules: profile.vsme?.modules ?? "basic",
                          },
                        })
                      }
                      maxLength={1000}
                      rows={3}
                      disabled={submitting}
                      placeholder="e.g. Requested by our bank for a green loan; customer ESG questionnaire."
                      className={`${inputClass} resize-none`}
                    />
                  </div>

                  <div className="space-y-3">
                    <span className={labelClass}>Module scope</span>
                    <div className="space-y-2.5">
                      {VSME_MODULE_OPTIONS.map((opt) => {
                        const selected = profile.vsme?.modules === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              update({
                                vsme: {
                                  purpose: profile.vsme?.purpose ?? "",
                                  modules: opt.value,
                                },
                              })
                            }
                            className={`w-full text-left border rounded-sm px-4 py-3 transition-colors ${
                              selected
                                ? "border-[#074D47] bg-[#074D47]/[0.04]"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                                  selected
                                    ? "border-[#074D47]"
                                    : "border-gray-300"
                                }`}
                              >
                                {selected && (
                                  <span className="h-2 w-2 rounded-full bg-[#074D47]" />
                                )}
                              </span>
                              <span>
                                <span className="block text-sm font-medium text-[#0A0A0A]">
                                  {opt.label}
                                </span>
                                <span className="block text-[12px] text-gray-500 mt-0.5">
                                  {opt.description}
                                </span>
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Reporting year */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="reporting-year" className={labelClass}>
                  Reporting year
                </label>
                <input
                  id="reporting-year"
                  type="number"
                  inputMode="numeric"
                  min={2000}
                  max={2100}
                  value={profile.reportingYear ?? ""}
                  onChange={(e) =>
                    update({
                      reportingYear:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  autoFocus
                  disabled={submitting}
                  placeholder="2025"
                  className={inputClass}
                />
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  The fiscal year this report covers.
                </p>
              </div>
            </div>
          )}

          {/* Footer nav */}
          <div className="flex items-center gap-3 mt-10">
            {step > 1 && (
              <button
                type="button"
                onClick={back}
                disabled={submitting}
                className="px-5 py-3.5 rounded-sm border border-gray-200 text-[13px] tracking-wider uppercase font-medium text-[#0A0A0A]/70 hover:border-gray-300 transition-colors disabled:opacity-50"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={step === TOTAL_STEPS ? handleSubmit : next}
              disabled={submitting || !stepValid}
              className="flex-1 bg-[#074D47] hover:bg-[#22867C] disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3.5 rounded-sm transition-colors text-[13px] tracking-wider uppercase font-medium flex items-center justify-center gap-3"
            >
              {submitting && (
                <span
                  className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                  aria-hidden="true"
                />
              )}
              {step === TOTAL_STEPS
                ? submitting
                  ? "Creating..."
                  : "Create organization"
                : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
