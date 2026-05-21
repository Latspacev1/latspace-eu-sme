"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ComputeContext, FieldsQuestion, Question, Section } from "@/lib/reporting/frameworkTypes";
import { FieldHelp, FieldLabel, FieldRenderer, isFilled, isValid, type RowValues } from "@/components/reporting/Fields";
import { TableField } from "@/components/reporting/TableField";
import { QuestionnaireSidebar } from "@/components/reporting/QuestionnaireSidebar";
import { QuestionnaireHeader } from "@/components/reporting/QuestionnaireHeader";
import { QuestionPanel } from "@/components/reporting/QuestionPanel";
import { AssistantPane } from "@/components/reporting/AssistantPane";
import { AssistantPane as QualitativeAssistantPane } from "@/components/reporting/qualitative/AssistantPane";
import { reportingApi } from "@/lib/api/reporting";
import { ConfirmDialog, type ConfirmDialogState } from "@/components/reporting/ConfirmDialog";

// ── Types ────────────────────────────────────────────────────────────────────

export type Status = "not-started" | "in-progress" | "completed";

export interface QuestionState {
  values: RowValues;
  rows: RowValues[];
  status: Status;
  updatedAt?: string;
  comment?: string;
}

export interface QuestionnaireConfig {
  sections: Section[];
  frameworkId: string;
  frameworkName: string;
  version?: string;
  /** Set true for CBAM CT, BRSR, CDP — persists to localStorage, skips API. */
  localMode?: boolean;
  /** localStorage key when `localMode` is true. */
  storageKey?: string;
  /** Optional question id to focus on first render (used for /reporting?q=…). */
  initialQuestionId?: string;
  /** Required in API mode. */
  instanceId?: string;
  /** Required in API mode. */
  initialAnswers?: Record<string, { values: Record<string, unknown>; rows: Record<string, unknown>[]; status: string }>;
  /** Required in API mode. */
  onSectionChange?: (sectionId: string, values: Record<string, unknown>) => void;
  onCompleteSection?: (sectionId: string) => void;
  onReopenSection?: (sectionId: string) => void;
  onResetSection?: (sectionId: string) => void;
  /** Required in API mode. */
  onAutofill?: () => Promise<void>;
  onExport: () => Promise<void>;
  plantId?: string;
  orgId?: string;
  financialYear?: number;
  /** Per-section autofill confidence: { sectionId → 0–1 } */
  sectionConfidence?: Record<string, number | null>;
}

export interface PanesState {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const LEFT_MIN = 240;
const LEFT_MAX = 560;
const LEFT_DEFAULT = 340;
const RIGHT_MIN = 240;
const RIGHT_MAX = 520;
const RIGHT_DEFAULT = 320;

const panesDefault: PanesState = {
  leftWidth: LEFT_DEFAULT,
  rightWidth: RIGHT_DEFAULT,
  leftCollapsed: false,
  rightCollapsed: false,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function blankState(q: Question): QuestionState {
  if (q.kind === "fields") {
    const values: RowValues = {};
    for (const f of q.fields) values[f.id] = null;
    return { values, rows: [], status: "not-started" };
  }
  const rows: RowValues[] = Array.from({ length: q.minRows }, () => {
    const r: RowValues = {};
    for (const c of q.columns) r[c.id] = null;
    return r;
  });
  return { values: {}, rows, status: "not-started" };
}

export function deriveStatus(q: Question, s: QuestionState): Status {
  if (s.status === "completed") return "completed";
  if (q.kind === "fields") {
    return q.fields.some((f) => isFilled(f, s.values[f.id])) ? "in-progress" : "not-started";
  }
  return s.rows.some((r) => q.columns.some((c) => isFilled(c, r[c.id]))) ? "in-progress" : "not-started";
}

export function canComplete(q: Question, s: QuestionState): boolean {
  if (q.kind === "fields") return q.fields.every((f) => isValid(f, s.values[f.id]));
  return s.rows.every((r) => q.columns.every((c) => isValid(c, r[c.id])));
}

// ── ResizeHandle ─────────────────────────────────────────────────────────────

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="group relative w-1 shrink-0 cursor-col-resize bg-slate-200 hover:bg-brand/60 active:bg-brand"
      role="separator"
      aria-orientation="vertical"
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}

// ── CollapsedRail ────────────────────────────────────────────────────────────

function CollapsedRail({ side, label, onExpand }: { side: "left" | "right"; label: string; onExpand: () => void }) {
  const border = side === "left" ? "border-r" : "border-l";
  return (
    <aside className={`flex w-10 shrink-0 flex-col items-center ${border} border-slate-200 bg-white py-3`}>
      <button onClick={onExpand} title={`Expand ${label}`} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          {side === "left" ? (
            <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>
      <div className="mt-3 text-[11px] uppercase tracking-wider text-slate-400" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
        {label}
      </div>
    </aside>
  );
}

// ── FieldsForm ───────────────────────────────────────────────────────────────

function FieldsForm({ q, values, onChange, computeCtx }: { q: FieldsQuestion; values: RowValues; onChange: (v: RowValues) => void; computeCtx?: ComputeContext }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {q.fields.map((f) => (
        <div key={f.id} className={f.kind === "longtext" ? "md:col-span-2" : ""}>
          <FieldLabel field={f} />
          <FieldRenderer field={f} value={values[f.id]} siblings={values} onChange={(v) => onChange({ ...values, [f.id]: v })} computeCtx={computeCtx} />
          <FieldHelp field={f} />
        </div>
      ))}
    </div>
  );
}

// ── Questionnaire ────────────────────────────────────────────────────────────

export function Questionnaire({ config, initialQuestionId: initialQuestionIdProp }: { config: QuestionnaireConfig; initialQuestionId?: string }) {
  const { sections, localMode, storageKey } = config;
  const initialQuestionId = initialQuestionIdProp ?? config.initialQuestionId;
  const qc = useQueryClient();

  const allQuestions = useMemo(
    () => sections.flatMap((s) => s.questions.map((q) => ({ section: s, q }))),
    [sections],
  );

  // Initialise: API mode reads from server-provided initialAnswers; local mode
  // starts blank and hydrates from localStorage in the useEffect below.
  const [answers, setAnswers] = useState<Record<string, QuestionState>>(() => {
    const init: Record<string, QuestionState> = {};
    for (const { section, q } of allQuestions) {
      const saved = config.initialAnswers?.[section.id];
      if (saved) {
        const rawStatus = (saved.status ?? "not_started").replace(/_/g, "-") as Status;
        const state: QuestionState = {
          values: (saved.values ?? {}) as RowValues,
          rows: (saved.rows ?? []) as RowValues[],
          status: rawStatus,
        };
        if (state.status !== "completed") {
          state.status = deriveStatus(q, state);
        }
        init[q.id] = state;
      } else {
        init[q.id] = blankState(q);
      }
    }
    return init;
  });

  // Local mode: hydrate from localStorage on mount, then persist on every change.
  useEffect(() => {
    if (!localMode || !storageKey || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, QuestionState>;
      setAnswers((prev) => {
        const next = { ...prev };
        for (const { q } of allQuestions) {
          if (saved[q.id]) next[q.id] = saved[q.id];
        }
        return next;
      });
    } catch {
      // Corrupt JSON in localStorage — ignore and start fresh.
    }
  }, [localMode, storageKey, allQuestions]);

  useEffect(() => {
    if (!localMode || !storageKey || typeof window === "undefined") return;
    localStorage.setItem(storageKey, JSON.stringify(answers));
  }, [answers, localMode, storageKey]);

  const computeCtx: ComputeContext = useMemo(
    () => ({
      get: (qId: string, fId: string) => {
        const a = answers[qId];
        if (!a) return null;
        if (a.values && fId in a.values) return a.values[fId];
        if (a.rows?.[0] && fId in a.rows[0]) return a.rows[0][fId];
        return null;
      },
      num: (v: unknown) => {
        if (typeof v === "number") return Number.isFinite(v) ? v : 0;
        if (typeof v === "string" && v.trim() !== "") { const n = Number(v); return Number.isFinite(n) ? n : 0; }
        return 0;
      },
    }),
    [answers],
  );

  const [panes, setPanes] = useState<PanesState>(panesDefault);
  const dragRef = useRef<{ side: "left" | "right"; startX: number; startWidth: number } | null>(null);

  const onDragStart = useCallback(
    (side: "left" | "right") => (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { side, startX: e.clientX, startWidth: side === "left" ? panes.leftWidth : panes.rightWidth };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [panes.leftWidth, panes.rightWidth],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const delta = e.clientX - d.startX;
      if (d.side === "left") {
        setPanes((p) => ({ ...p, leftWidth: Math.min(LEFT_MAX, Math.max(LEFT_MIN, d.startWidth + delta)) }));
      } else {
        setPanes((p) => ({ ...p, rightWidth: Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, d.startWidth - delta)) }));
      }
    };
    const onUp = () => { if (!dragRef.current) return; dragRef.current = null; document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s, i) => [s.id, i < 3])),
  );
  const [activeId, setActiveId] = useState<string>(
    initialQuestionId && allQuestions.some((x) => x.q.id === initialQuestionId)
      ? initialQuestionId
      : (allQuestions[0]?.q.id ?? ""),
  );
  const [search, setSearch] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const active = allQuestions.find((x) => x.q.id === activeId);
  const completedCount = Object.values(answers).filter((a) => a.status === "completed").length;
  const inProgressCount = Object.values(answers).filter((a) => a.status === "in-progress").length;
  const notStartedCount = Object.values(answers).filter((a) => a.status === "not-started").length;
  // Match backend progress formula: completed=1.0, in-progress=0.5, not-started=0.0
  const overallPct = allQuestions.length === 0 ? 0 : Math.round(((completedCount + inProgressCount * 0.5) / allQuestions.length) * 100);

  function patch(id: string, patchData: Partial<QuestionState>) {
    setAnswers((prev) => {
      const current = prev[id];
      const found = allQuestions.find((x) => x.q.id === id)!;
      const q = found.q;
      const sectionId = found.section.id;
      const merged = { ...current, ...patchData };
      const autoStatus = deriveStatus(q, merged);
      if (patchData.values && config.onSectionChange) {
        config.onSectionChange(sectionId, patchData.values as Record<string, unknown>);
      }
      return { ...prev, [id]: { ...merged, status: autoStatus, updatedAt: new Date().toISOString() } };
    });
  }

  function setStatus(id: string, status: Status) {
    const found = allQuestions.find((x) => x.q.id === id);
    if (!found) return;
    const wasCompleted = answers[id]?.status === "completed";
    const currentState = answers[id];
    const autoStatus = deriveStatus(found.q, currentState);

    if (status === "completed" && autoStatus === "not-started") {
      setConfirmDialog({
        title: "Mark as Completed?",
        description: "This section has no values filled yet. Are you sure you want to mark it as Completed?",
        variant: "warning",
        onConfirm: () => {
          setConfirmDialog(null);
          applyStatus(id, status, found, wasCompleted);
        },
      });
      return;
    }

    if (status === "not-started" && autoStatus !== "not-started") {
      setConfirmDialog({
        title: "Reset Section?",
        description: "Resetting to Not Started will permanently clear all values in this section. This action cannot be undone.",
        variant: "destructive",
        onConfirm: () => {
          setConfirmDialog(null);
          setAnswers((prev) => ({
            ...prev,
            [id]: {
              ...blankState(found.q),
              status: "not-started",
              updatedAt: new Date().toISOString(),
            },
          }));
          if (config.onResetSection) {
            config.onResetSection(found.section.id);
          }
        },
      });
      return;
    }

    applyStatus(id, status, found, wasCompleted);
  }

  function applyStatus(
    id: string,
    status: Status,
    found: (typeof allQuestions)[number],
    wasCompleted: boolean,
  ) {
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], status, updatedAt: new Date().toISOString() } }));
    if (status === "completed" && found && config.onCompleteSection) {
      config.onCompleteSection(found.section.id);
    }
    if (wasCompleted && status !== "completed" && found && config.onReopenSection) {
      config.onReopenSection(found.section.id);
    }
  }

  function filteredSections() {
    if (!search.trim()) return sections;
    const needle = search.toLowerCase();
    return sections
      .map((s) => ({ ...s, questions: s.questions.filter((q) => q.id.toLowerCase().includes(needle) || q.label.toLowerCase().includes(needle) || (q.description ?? "").toLowerCase().includes(needle)) }))
      .filter((s) => s.questions.length > 0);
  }

  const onSectionSync = useCallback(async () => {
    if (!active) return;
    // Local mode (CBAM, BRSR, CDP) has no server-side autofill — no-op.
    if (localMode || !config.instanceId) return;
    const resp = await reportingApi.triggerSectionAutofill(config.instanceId, active.section.id);
    if (!resp.success) throw new Error(resp.message ?? "Section sync failed.");
    await qc.invalidateQueries({ queryKey: ["reporting-instance", config.instanceId] });
  }, [localMode, config.instanceId, active?.section.id, qc]);

  if (!active) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">No questions available.</div>;
  }

  // Context payload for the qualitative AssistantPane (used in local mode).
  // Mirrors reportingv5/src/components/Questionnaire.tsx — sends a compact
  // descriptor of the question the user is looking at so the agent can answer
  // in the context of that question.
  const activeQuestionContext = {
    id: active.q.id,
    label: active.q.label,
    sectionId: active.section.id,
    sectionTitle: active.section.title,
    questionKind: active.q.kind,
    description: active.q.description,
  };

  const activeAnswerSummary = (() => {
    const a = answers[active.q.id];
    if (!a) return undefined;
    let filledCount = 0;
    let totalFields = 0;
    let preview = "";
    if (active.q.kind === "fields") {
      totalFields = active.q.fields.length;
      for (const f of active.q.fields) {
        const v = a.values[f.id];
        if (isFilled(f, v)) {
          filledCount++;
          if (preview.length < 200 && (typeof v === "string" || typeof v === "number")) {
            preview += `${f.id}=${String(v).slice(0, 60)}; `;
          }
        }
      }
    } else {
      const cols = active.q.columns;
      totalFields = cols.length * a.rows.length;
      for (const r of a.rows) {
        for (const c of cols) {
          if (isFilled(c, r[c.id])) filledCount++;
        }
      }
      preview = `${a.rows.length} row${a.rows.length === 1 ? "" : "s"}`;
    }
    return {
      status: a.status,
      filledCount,
      totalFields,
      preview: preview.trim().slice(0, 200) || undefined,
    };
  })();

  return (
    <>
    <div className="flex h-full flex-col">
      <QuestionnaireHeader
        overallPct={overallPct}
        activeId={activeId}
        frameworkName={config.frameworkName}
        version={config.version}
        onExport={config.onExport}
        onAutofill={config.onAutofill}
      />
      <div className="flex flex-1 overflow-hidden">
        {panes.leftCollapsed ? (
          <CollapsedRail side="left" label="Sections" onExpand={() => setPanes((p) => ({ ...p, leftCollapsed: false }))} />
        ) : (
          <>
            <QuestionnaireSidebar
              width={panes.leftWidth}
              onCollapse={() => setPanes((p) => ({ ...p, leftCollapsed: true }))}
              sections={filteredSections()}
              answers={answers}
              activeId={activeId}
              setActiveId={setActiveId}
              openSections={openSections}
              setOpenSections={setOpenSections}
              search={search}
              setSearch={setSearch}
              overallPct={overallPct}
              completedCount={completedCount}
              inProgressCount={inProgressCount}
              notStartedCount={notStartedCount}
              totalCount={allQuestions.length}
            />
            <ResizeHandle onMouseDown={onDragStart("left")} />
          </>
        )}
        <QuestionPanel
          section={active.section}
          question={active.q}
          state={answers[active.q.id]}
          onValues={(values) => patch(active.q.id, { values })}
          onRows={(rows) => patch(active.q.id, { rows })}
          onComment={(comment) => patch(active.q.id, { comment })}
          onStatusChange={(s) => setStatus(active.q.id, s)}
          onComplete={() => canComplete(active.q, answers[active.q.id]) && setStatus(active.q.id, "completed")}
          onReopen={() => setStatus(active.q.id, "in-progress")}
          computeCtx={computeCtx}
          FieldsForm={FieldsForm}
          autofillConfidence={config.sectionConfidence?.[active.section.id] ?? null}
          onSectionSync={onSectionSync}
        />
        {panes.rightCollapsed ? (
          <CollapsedRail side="right" label="AI Assistant" onExpand={() => setPanes((p) => ({ ...p, rightCollapsed: false }))} />
        ) : (
          <>
            <ResizeHandle onMouseDown={onDragStart("right")} />
            {localMode ? (
              // Local-mode frameworks (CBAM CT, BRSR, CDP) use the qualitative
              // AssistantPane which posts to /api/reporting/chat with framework
              // context for per-framework RAG retrieval (CBAM / CDP / BRSR
              // indices).
              <QualitativeAssistantPane
                width={panes.rightWidth}
                onWidthChange={(w) => setPanes((p) => ({ ...p, rightWidth: w }))}
                onCollapse={() => setPanes((p) => ({ ...p, rightCollapsed: true }))}
                frameworkId={config.frameworkId}
                activeQuestion={activeQuestionContext}
                activeAnswer={activeAnswerSummary}
              />
            ) : (
              // API-mode frameworks (CCTS, RCO) use the simple chat pane that
              // talks to vsmev1's existing /api/chat endpoint and includes the
              // plant/instance context the backend needs.
              <AssistantPane
                width={panes.rightWidth}
                onCollapse={() => setPanes((p) => ({ ...p, rightCollapsed: true }))}
                plantId={config.plantId}
                financialYear={config.financialYear}
                instanceId={config.instanceId}
                sectionId={active.section.id}
                localMode={localMode}
              />
            )}
          </>
        )}
      </div>
    </div>

    <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </>
  );
}
