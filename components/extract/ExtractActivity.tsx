"use client";

// Live activity feed for an extraction run. Renders the streamed `activity` and
// `text` events the agent emits while it reads the document — same vocabulary
// the AssistantPane uses, trimmed to what extract mode produces.

import { Loader2, FileSearch, Sparkles } from "lucide-react";

export interface ActivityItem {
  kind: "guidance" | "websearch" | "webfetch" | "propose" | "tool";
  label: string;
  detail?: string;
}

export function ExtractActivity({
  items,
  text,
  running,
}: {
  items: ActivityItem[];
  text: string;
  running: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        {running ? <Loader2 className="h-4 w-4 animate-spin text-brand" /> : <Sparkles className="h-4 w-4 text-brand" />}
        {running ? "Reading your document…" : "Extraction complete"}
      </div>

      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
            {it.kind === "propose" ? (
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            ) : (
              <FileSearch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
            <span>
              {it.label}
              {it.detail ? <span className="text-slate-400"> — {it.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      {text && (
        <div className="whitespace-pre-wrap border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {text}
        </div>
      )}
    </div>
  );
}
