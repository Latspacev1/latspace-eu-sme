"use client";

import { useState } from "react";

interface QuestionnaireHeaderProps {
  overallPct: number;
  activeId: string;
  frameworkName: string;
  version?: string;
  onExport: () => Promise<void>;
  /** Optional — when absent (local-mode frameworks) the Autofill button is hidden. */
  onAutofill?: () => Promise<void>;
}

export function QuestionnaireHeader({ overallPct, activeId, frameworkName, version, onExport, onAutofill }: QuestionnaireHeaderProps) {
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try { await onExport(); } catch (e) { console.error(e); alert("Export failed. See browser console for details."); } finally { setExporting(false); }
  };

  const handleAutofill = async () => {
    if (syncing || !onAutofill) return;
    setSyncing(true);
    try { await onAutofill(); } catch (e) { console.error(e); } finally { setSyncing(false); }
  };

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-4">
        <a href="/reporting" className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <span className="text-lg leading-none">‹</span> Back
        </a>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-slate-900">{frameworkName}</span>
          <span className="text-xs text-slate-500">{overallPct}% complete</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500">
          {version ? `${version} · ` : ""}{activeId}
        </span>
        {onAutofill && (
          <button
            onClick={handleAutofill}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ↻ {syncing ? "Autofilling…" : "Autofill"}
          </button>
        )}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          title="Download the filled template"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {exporting ? "Generating…" : "Export"}
        </button>
      </div>
    </header>
  );
}
