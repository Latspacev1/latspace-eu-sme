"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { ComputeContext, FieldsQuestion, Question, Section } from "@/lib/reporting/frameworkTypes";
import { TableField } from "@/components/reporting/TableField";
import type { RowValues } from "@/components/reporting/Fields";
import type { QuestionState, Status } from "@/components/reporting/Questionnaire";
import { canComplete } from "@/components/reporting/Questionnaire";

const statusLabel: Record<Status, string> = {
  "not-started": "Not Started",
  "in-progress": "In Progress",
  completed: "Completed",
};

const statusDot: Record<Status, string> = {
  "not-started": "bg-slate-300",
  "in-progress": "bg-amber-400",
  completed: "bg-emerald-500",
};

interface QuestionPanelProps {
  section: Section;
  question: Question;
  state: QuestionState;
  onValues: (values: RowValues) => void;
  onRows: (rows: RowValues[]) => void;
  onComment: (comment: string) => void;
  onStatusChange: (s: Status) => void;
  onComplete: () => void;
  onReopen: () => void;
  computeCtx: ComputeContext;
  // FieldsForm passed as prop to avoid circular import
  FieldsForm: React.ComponentType<{ q: FieldsQuestion; values: RowValues; onChange: (v: RowValues) => void; computeCtx?: ComputeContext }>;
  onSectionSync: () => Promise<void>;
  /** Autofill confidence for this section (0–1), or null if not autofilled. */
  autofillConfidence?: number | null;
}

export function QuestionPanel({ section, question, state, onValues, onRows, onComment, onStatusChange, onComplete, onReopen, computeCtx, FieldsForm, onSectionSync, autofillConfidence }: QuestionPanelProps) {
  const valid = canComplete(question, state);
  const isCompleted = state.status === "completed";
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await onSectionSync();
    } catch (e) {
      console.error(e);
      toast.error("Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/40">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{question.id}</span>
              <span className={`h-2 w-2 rounded-full ${statusDot[state.status]}`} />
              {autofillConfidence != null && (
                <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 border border-indigo-100">
                  AI {Math.round(autofillConfidence * 100)}%
                </span>
              )}
            </div>
            <h1 className="mt-1 text-[22px] leading-snug font-medium text-slate-900">{question.label}</h1>
            <p className="mt-1 text-xs text-slate-500">{section.title} · {section.sheetRef}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ↻ {syncing ? "Syncing…" : "Sync"}
            </button>
            <select value={state.status} onChange={(e) => onStatusChange(e.target.value as Status)} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm">
              <option value="not-started">Not Started</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {question.description && (
          <div className="mt-4 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">{question.description}</div>
        )}

        <div className="mt-6">
          {question.kind === "fields" ? (
            <FieldsForm q={question} values={state.values} onChange={onValues} computeCtx={computeCtx} />
          ) : (
            <TableField q={question} rows={state.rows} onChange={onRows} computeCtx={computeCtx} />
          )}
        </div>

        <div className="mt-8">
          <div className="text-sm font-medium text-slate-800 mb-2">Comments</div>
          <textarea
            value={state.comment ?? ""}
            onChange={(e) => onComment(e.target.value)}
            placeholder="Add context, caveats, or notes for reviewers..."
            rows={3}
            className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand"
          />
        </div>

        <div className="mt-6">
          <div className="text-sm font-medium text-slate-800 mb-2">Supporting Documents</div>
          <label className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-white py-10 text-sm text-slate-500 cursor-pointer hover:bg-slate-50">
            <span className="rounded border border-slate-200 bg-white px-3 py-1.5 text-slate-700 inline-flex items-center gap-1">⬆ Upload Files</span>
            <span className="text-xs">Supported formats: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG</span>
            <input type="file" className="hidden" multiple />
          </label>
        </div>

        <div className="mt-8 mb-10 flex items-center justify-between">
          <span className="text-sm text-slate-500 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusDot[state.status]}`} />
            {statusLabel[state.status]}
            {!valid && !isCompleted && <span className="text-xs text-rose-500">· required fields missing</span>}
          </span>
          {isCompleted ? (
            <button onClick={onReopen} className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Reopen for Editing
            </button>
          ) : (
            <button onClick={onComplete} disabled={!valid} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40">
              Mark as Complete
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
