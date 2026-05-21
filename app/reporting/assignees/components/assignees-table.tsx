"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reportingApi, type ReportingInstanceDetail, type SectionState } from "@/lib/api/reporting";
import { FRAMEWORKS, getFramework } from "@/lib/reporting/frameworks";
import type { Question, Section } from "@/lib/reporting/frameworkTypes";
import type { AdminUser } from "@/lib/api/admin";
import { AssigneePicker } from "./assignee-picker";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusDot({ status }: { status: SectionState["status"] }) {
  const cls =
    status === "completed"
      ? "bg-emerald-500"
      : status === "in_progress"
        ? "bg-amber-400"
        : "bg-slate-300";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

function formatUpdated(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Active leaf frameworks with real sections ─────────────────────────────────

const LEAF_FRAMEWORKS = FRAMEWORKS.flatMap(
  (fw) => fw.children ?? (fw.isParent ? [] : [fw]),
).filter((fw) => fw.status === "active" && fw.sections.length > 0);

// ── Sub-components ────────────────────────────────────────────────────────────

const COLS = "grid-cols-[2.2fr_1.2fr_1.2fr_1.4fr_0.9fr_1fr]";

function QuestionRow({
  instanceId,
  frameworkId,
  section,
  question,
  sectionState,
  users,
}: {
  instanceId: string;
  frameworkId: string;
  section: Section;
  question: Question;
  sectionState: SectionState | undefined;
  users: AdminUser[];
}) {
  const queryClient = useQueryClient();
  const assigned = sectionState?.assignees ?? [];
  const status = sectionState?.status ?? "not_started";
  const updatedAt = sectionState?.last_synced_at ?? null;

  const href = `/reporting/${frameworkId}?instance=${instanceId}&q=${encodeURIComponent(question.id)}`;

  const mutation = useMutation({
    mutationFn: (userIds: string[]) =>
      reportingApi.patchSectionAssignees(instanceId, section.id, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reporting-instance", instanceId] });
    },
    onError: () => toast.error("Failed to update assignees."),
  });

  const handleNotify = () => {
    if (assigned.length === 0) {
      toast.error("Assign someone before sending a reminder.");
      return;
    }
    const names = assigned
      .map((id) => users.find((u) => u.id === id)?.username ?? "user")
      .join(", ");
    toast.success(`Reminder sent to ${names}`);
  };

  return (
    <div
      className={`grid w-full ${COLS} items-center border-b border-slate-100 px-5 py-3 pl-16 last:border-b-0 hover:bg-slate-50/60`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot status={status} />
        <Link
          href={href}
          className="truncate text-sm text-slate-800 hover:text-brand hover:underline"
          title={question.label}
        >
          {question.id} · {question.label}
        </Link>
      </div>
      <div className="truncate text-xs text-slate-500" title={section.title}>
        {section.title}
      </div>
      <div className="truncate text-xs text-slate-500" title={question.label}>
        {question.label}
      </div>
      <div>
        <AssigneePicker
          selected={assigned}
          users={users}
          onChange={(ids) => mutation.mutate(ids)}
          disabled={mutation.isPending}
        />
      </div>
      <div className="text-xs text-slate-500">{formatUpdated(updatedAt)}</div>
      <div>
        <button
          onClick={handleNotify}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M4 4h16v12H5.17L4 17.17V4z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Notify
        </button>
      </div>
    </div>
  );
}

// ── Main table ────────────────────────────────────────────────────────────────

interface AssigneesTableProps {
  instances: ReportingInstanceDetail[];
  users: AdminUser[];
}

export function AssigneesTable({ instances, users }: AssigneesTableProps) {
  const [expandedFw, setExpandedFw] = useState<Record<string, boolean>>({});
  const [expandedSection, setExpandedSection] = useState<Record<string, boolean>>({});

  // Build a map: frameworkId → instance detail
  const instanceByFw: Record<string, ReportingInstanceDetail> = {};
  for (const inst of instances) {
    instanceByFw[inst.framework_id] = inst;
  }

  const toggleFw = (id: string) =>
    setExpandedFw((p) => ({ ...p, [id]: !p[id] }));
  const toggleSection = (key: string) =>
    setExpandedSection((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Header */}
      <div
        className={`grid ${COLS} border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] uppercase tracking-wider text-slate-500`}
      >
        <div>Name</div>
        <div>Report Section</div>
        <div>Sub-Section</div>
        <div>Assignees</div>
        <div>Last Updated</div>
        <div>Notify</div>
      </div>

      {LEAF_FRAMEWORKS.length === 0 && (
        <div className="px-5 py-10 text-center text-sm text-slate-500">
          No active frameworks yet.
        </div>
      )}

      {LEAF_FRAMEWORKS.map((fw) => {
        const instance = instanceByFw[fw.id];
        const fwOpen = expandedFw[fw.id] ?? false;

        // Count sections for the progress badge
        const totalSections = fw.sections.length;
        const completedSections = instance
          ? instance.sections.filter((s) => s.status === "completed").length
          : 0;

        return (
          <div key={fw.id}>
            {/* Framework accordion row */}
            <button
              onClick={() => toggleFw(fw.id)}
              className={`grid w-full ${COLS} items-center border-b border-slate-100 px-5 py-3 text-left hover:bg-slate-50`}
            >
              <div className="flex items-center gap-2">
                <Chevron open={fwOpen} />
                <div
                  className={`h-7 w-7 shrink-0 rounded-md grid place-items-center text-[9px] font-bold ${fw.logoColor}`}
                >
                  {fw.logoInitials}
                </div>
                <span className="font-semibold text-slate-900">{fw.shortName}</span>
                {instance && (
                  <span className="text-xs text-slate-500">
                    {completedSections}/{totalSections}
                  </span>
                )}
                {!instance && (
                  <span className="text-xs text-slate-400">(no instance)</span>
                )}
              </div>
              <div className="text-xs text-slate-400">—</div>
              <div className="text-xs text-slate-400">—</div>
              <div className="text-xs text-slate-400">—</div>
              <div className="text-xs text-slate-400">—</div>
              <div className="text-xs text-slate-400">—</div>
            </button>

            {fwOpen &&
              fw.sections.map((section) => {
                const sectionKey = `${fw.id}/${section.id}`;
                const secOpen = expandedSection[sectionKey] ?? false;
                const sectionState = instance?.sections.find(
                  (s) => s.section_id === section.id,
                );

                return (
                  <div key={sectionKey}>
                    {/* Section accordion row */}
                    <button
                      onClick={() => toggleSection(sectionKey)}
                      className={`grid w-full ${COLS} items-center border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 pl-10 text-left hover:bg-slate-50`}
                    >
                      <div className="flex items-center gap-2">
                        <Chevron open={secOpen} />
                        <span className="text-sm font-medium text-slate-800">
                          {section.title}
                        </span>
                        <span className="text-xs text-slate-500">
                          {section.questions.length} questions
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{section.title}</div>
                      <div className="text-xs text-slate-400">—</div>
                      <div className="text-xs text-slate-400">—</div>
                      <div className="text-xs text-slate-400">—</div>
                      <div className="text-xs text-slate-400">—</div>
                    </button>

                    {secOpen &&
                      instance &&
                      section.questions.map((q) => (
                        <QuestionRow
                          key={q.id}
                          instanceId={instance.id}
                          frameworkId={fw.id}
                          section={section}
                          question={q}
                          sectionState={sectionState}
                          users={users}
                        />
                      ))}

                    {secOpen && !instance && (
                      <div className="border-b border-slate-100 px-16 py-3 text-xs text-slate-400">
                        No active instance for this framework.
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
