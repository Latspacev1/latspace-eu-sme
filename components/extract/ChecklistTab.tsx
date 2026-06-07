"use client";

// VSME Data Checklist tab. Reads the org's onboarding profile from
// /api/ai-context and renders profile.checklist — the AI-generated list of data
// points to collect to fill a VSME document, grouped into the four VSME
// categories. The checklist is generated/refreshed when the user saves their AI
// Context, so the empty state points back there.
//
// Each item is a checkbox the user can tick off to track collection progress.
// Selections persist (by item title) via PATCH /api/ai-context/checklist-selection
// with optimistic UI — a failed write rolls the toggle back.

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ListChecks, Check, Download } from "lucide-react";

import {
  CHECKLIST_CATEGORIES,
  isChecklistEmpty,
  type VsmeChecklist,
} from "@/lib/types/checklist";
import { exportChecklistDocx } from "@/lib/reporting/checklistExport/export";
import type { OnboardingProfile } from "@/lib/types/onboarding";

export function ChecklistTab() {
  const [checklist, setChecklist] = useState<VsmeChecklist | null>(null);
  const [companyName, setCompanyName] = useState("");
  // Selected item titles. A Set keeps membership checks/toggles O(1).
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
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
          setError(data.error || "Failed to load checklist.");
          return;
        }
        const profile = data.profile as
          | (OnboardingProfile & {
              checklist?: VsmeChecklist;
              checklistSelected?: string[];
            })
          | undefined;
        setChecklist(profile?.checklist ?? null);
        setSelected(new Set(profile?.checklistSelected ?? []));
        setCompanyName(profile?.companyName ?? "");
      } catch {
        if (active) setError("Failed to load checklist.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Optimistically toggle an item, then persist. Roll back on failure.
  const toggleItem = async (title: string) => {
    const next = new Set(selected);
    const wasSelected = next.has(title);
    if (wasSelected) next.delete(title);
    else next.add(title);
    setSelected(next);

    try {
      const res = await fetch("/api/ai-context/checklist-selection", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected: [...next] }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json().catch(() => ({}))) as {
        checklistSelected?: string[];
      };
      // Reconcile with the server's pruned/normalized set.
      if (Array.isArray(data.checklistSelected)) {
        setSelected(new Set(data.checklistSelected));
      }
    } catch {
      // Roll back the optimistic change.
      setSelected((prev) => {
        const reverted = new Set(prev);
        if (wasSelected) reverted.add(title);
        else reverted.delete(title);
        return reverted;
      });
      toast.error("Couldn't save your selection. Please try again.");
    }
  };

  // Build and download a .docx of the checklist (with current ticked state).
  const handleDownload = async () => {
    if (!checklist || exporting) return;
    setExporting(true);
    try {
      await exportChecklistDocx(checklist, selected, companyName);
    } catch {
      toast.error("Couldn't generate the Word document.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[820px] px-6 py-20 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading checklist…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[820px] px-6 py-10">
        <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  const empty = isChecklistEmpty(checklist);

  return (
    <div className="mx-auto max-w-[820px] px-6 py-6">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-[#074D47]/[0.06]">
            <ListChecks className="h-5 w-5 text-[#074D47]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
              VSME Data Checklist
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              The data points your organization needs to collect to fill a VSME
              document, grouped by category. Auto-generated from your AI Context.
            </p>
            {checklist?.generatedAt && (
              <p className="mt-1 text-[12px] text-slate-400">
                Generated {new Date(checklist.generatedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {!empty && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={exporting}
            title="Download the checklist as a Word document"
            className="flex-shrink-0 inline-flex items-center gap-2 border border-[#074D47] text-[#074D47] hover:bg-[#074D47]/[0.04] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 rounded-sm text-[12px] tracking-wider uppercase font-medium transition-colors"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? "Preparing…" : "Download Word"}
          </button>
        )}
      </header>

      {empty ? (
        <section className="border border-gray-200 rounded-sm p-8 text-center">
          <p className="text-sm text-slate-600 max-w-[440px] mx-auto leading-relaxed">
            No checklist yet. Go to AI Context, review your company details, and
            click Save changes to generate your VSME data checklist.
          </p>
          <Link
            href="/corporate/ai-context"
            className="mt-5 inline-flex items-center justify-center bg-[#074D47] hover:bg-[#22867C] text-white px-6 py-3 rounded-sm transition-colors text-[13px] tracking-wider uppercase font-medium"
          >
            Go to AI Context
          </Link>
        </section>
      ) : (
        <div className="space-y-8">
          {CHECKLIST_CATEGORIES.map(({ key, label }) => {
            const items = checklist ? checklist[key] : [];
            const doneCount = items.filter((it) => selected.has(it)).length;
            return (
              <section
                key={key}
                className="border border-gray-200 rounded-sm p-6"
              >
                <h2 className="text-[13px] font-semibold text-[#0A0A0A] mb-5">
                  {label}{" "}
                  <span className="font-normal text-gray-400">
                    ({doneCount}/{items.length})
                  </span>
                </h2>
                {items.length === 0 ? (
                  <p className="text-[12px] text-gray-400">
                    No data points in this category.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {items.map((item, i) => {
                      const isSelected = selected.has(item);
                      return (
                        <li key={`${key}-${i}`}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isSelected}
                            onClick={() => toggleItem(item)}
                            className="group flex w-full items-start gap-3 rounded-sm px-2 py-1.5 -mx-2 text-left transition-colors hover:bg-[#074D47]/[0.03]"
                          >
                            <span
                              className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[3px] border transition-colors ${
                                isSelected
                                  ? "border-[#074D47] bg-[#074D47] text-white"
                                  : "border-gray-300 text-transparent group-hover:border-[#074D47]"
                              }`}
                            >
                              <Check className="h-3 w-3" strokeWidth={2.5} />
                            </span>
                            <span
                              className={`text-sm leading-relaxed transition-colors ${
                                isSelected
                                  ? "text-gray-400 line-through"
                                  : "text-[#0A0A0A]"
                              }`}
                            >
                              {item}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
