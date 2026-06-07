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
  /** Optional — when absent the "Fill with AI" button is hidden. */
  onSync?: () => Promise<void>;
}

export function QuestionnaireHeader({ overallPct, activeId, frameworkName, version, onExport, onAutofill, onSync }: QuestionnaireHeaderProps) {
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncingData, setSyncingData] = useState(false);

  const handleSync = async () => {
    if (syncingData || !onSync) return;
    setSyncingData(true);
    try { await onSync(); } catch (e) { console.error(e); } finally { setSyncingData(false); }
  };

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
        {onSync && (
          <button
            onClick={handleSync}
            disabled={syncingData}
            className="inline-flex items-center gap-1.5 rounded-md border border-brand/30 bg-brand/5 px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-60"
            title="Compute VSME metrics from your extracted data and fill the report"
          >
            <svg viewBox="0 0 24 24" className={`h-4 w-4 ${syncingData ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
              {syncingData ? (
                <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16M3 12a9 9 0 0 1 15.36-6.36L21 8M21 3v5h-5M3 21v-5h5" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16 2.4 6.6L22 12l-6.6 2.4L13 21l-2.4-6.6L4 12l6.6-2.4L13 3Z" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
            {syncingData ? "Filling…" : "Fill with AI"}
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
