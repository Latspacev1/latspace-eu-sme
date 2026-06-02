"use client";

// AI Context — the structured profile captured during onboarding (company,
// reports, VSME scope, reporting year). Editable here; saved back to the org's
// onboarding_profile. This information grounds the AI assistant in the org's
// reporting situation. (Deeper AI Context behavior is to be wired in later.)

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

import {
  emptyOnboardingProfile,
  REPORT_OPTIONS,
  VSME_MODULE_OPTIONS,
  type OnboardingProfile,
  type ReportType,
  type VsmeModules,
} from "@/lib/types/onboarding";

const labelClass =
  "block text-[11px] text-[#074D47] tracking-[0.15em] uppercase font-medium mb-2";
const inputClass =
  "w-full border border-gray-200 rounded-sm bg-white px-4 py-3 text-sm outline-none transition-colors hover:border-gray-300 focus:border-[#074D47] disabled:opacity-50";

export default function AiContextPage() {
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [original, setOriginal] = useState<OnboardingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/ai-context");
        const data = (await res.json().catch(() => ({}))) as {
          profile?: OnboardingProfile;
          error?: string;
        };
        if (!active) return;
        if (!res.ok) {
          setError(data.error || "Failed to load AI context.");
          return;
        }
        const p = data.profile ?? emptyOnboardingProfile();
        setProfile(p);
        setOriginal(p);
      } catch {
        if (active) setError("Failed to load AI context.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const update = (patch: Partial<OnboardingProfile>) =>
    setProfile((p) => (p ? { ...p, ...patch } : p));

  const toggleReport = (value: ReportType) =>
    setProfile((p) => {
      if (!p) return p;
      const has = p.reports.includes(value);
      const reports = has
        ? p.reports.filter((r) => r !== value)
        : [...p.reports, value];
      const vsme = reports.includes("vsme")
        ? p.vsme ?? { purpose: "", modules: "basic" as VsmeModules }
        : null;
      return { ...p, reports, vsme };
    });

  const dirty = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(original),
    [profile, original],
  );

  const vsmeSelected = !!profile?.reports.includes("vsme");

  const handleSave = async () => {
    if (!profile || saving) return;
    if (!profile.companyName.trim()) {
      toast.error("Company name is required.");
      return;
    }
    if (profile.reports.length === 0) {
      toast.error("Select at least one report.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/ai-context", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        profile?: OnboardingProfile;
        error?: string;
      };
      if (res.ok && data.ok && data.profile) {
        setProfile(data.profile);
        setOriginal(data.profile);
        toast.success("AI context saved.");
      } else {
        toast.error(data.error || "Failed to save.");
      }
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <div className="mx-auto max-w-[820px] px-6 py-20 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading AI context…
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-white min-h-screen">
        <div className="mx-auto max-w-[820px] px-6 py-10">
          <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error || "No AI context available."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-[820px] px-6 py-6">
        <header className="mb-8 flex items-start gap-3">
          <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-[#074D47]/[0.06]">
            <Sparkles className="h-5 w-5 text-[#074D47]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
              AI Context
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              The information the AI assistant uses to understand your
              organization and reporting goals. Captured during onboarding —
              edit it any time.
            </p>
          </div>
        </header>

        <div className="space-y-8">
          {/* Company */}
          <section className="border border-gray-200 rounded-sm p-6">
            <h2 className="text-[13px] font-semibold text-[#0A0A0A] mb-5">
              Company
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="company-name" className={labelClass}>
                  Company name
                </label>
                <input
                  id="company-name"
                  type="text"
                  value={profile.companyName}
                  onChange={(e) => update({ companyName: e.target.value })}
                  maxLength={120}
                  disabled={saving}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="website-url" className={labelClass}>
                  Website URL
                </label>
                <input
                  id="website-url"
                  type="url"
                  value={profile.websiteUrl}
                  onChange={(e) => update({ websiteUrl: e.target.value })}
                  maxLength={300}
                  disabled={saving}
                  placeholder="https://acme.com"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Reports */}
          <section className="border border-gray-200 rounded-sm p-6">
            <h2 className="text-[13px] font-semibold text-[#0A0A0A] mb-5">
              Reports
            </h2>
            <span className={labelClass}>Which reports?</span>
            <div className="space-y-2.5">
              {REPORT_OPTIONS.map((opt) => {
                const checked = profile.reports.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleReport(opt.value)}
                    disabled={saving}
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

            {vsmeSelected && (
              <div className="mt-6 space-y-5 border-t border-gray-100 pt-5">
                <div>
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
                    disabled={saving}
                    placeholder="e.g. Requested by our bank for a green loan; customer ESG questionnaire."
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <div>
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
                          disabled={saving}
                          className={`w-full text-left border rounded-sm px-4 py-3 transition-colors ${
                            selected
                              ? "border-[#074D47] bg-[#074D47]/[0.04]"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                                selected ? "border-[#074D47]" : "border-gray-300"
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
          </section>

          {/* Reporting year */}
          <section className="border border-gray-200 rounded-sm p-6">
            <h2 className="text-[13px] font-semibold text-[#0A0A0A] mb-5">
              Reporting period
            </h2>
            <div className="max-w-[200px]">
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
                disabled={saving}
                placeholder="2025"
                className={inputClass}
              />
            </div>
          </section>
        </div>

        {/* Save bar */}
        <div className="mt-8 flex items-center justify-between">
          <span className="text-[12px] text-slate-400">
            {profile.updatedAt
              ? `Last updated ${new Date(profile.updatedAt).toLocaleString()}`
              : "Not yet saved"}
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="bg-[#074D47] hover:bg-[#22867C] disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-sm transition-colors text-[13px] tracking-wider uppercase font-medium flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
