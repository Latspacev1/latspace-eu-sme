"use client";

import type { FrameworkDef } from "@/lib/reporting/frameworks";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ProgressCell({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-sm text-slate-400">—</span>;
  return (
    <>
      <div className="text-sm font-medium text-slate-900">{pct}%</div>
      <div className="mt-1 h-1 w-24 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}

function LogoCell({ fw }: { fw: FrameworkDef }) {
  if (fw.logoSrc) {
    return (
      <img
        src={fw.logoSrc}
        alt={`${fw.shortName} logo`}
        className="h-10 w-10 shrink-0 rounded-md object-contain bg-white border border-slate-100"
      />
    );
  }
  return (
    <div
      className={`h-10 w-10 shrink-0 rounded-md grid place-items-center text-[10px] font-bold ${fw.logoColor}`}
    >
      {fw.logoInitials}
    </div>
  );
}

// Grid template shared by header and rows. 4 columns: name | description |
// progress | export.
export const REPORTING_GRID = "grid-cols-[2fr_3fr_1.2fr_0.8fr]";

// ── Parent row ────────────────────────────────────────────────────────────────

interface ParentRowProps {
  fw: FrameworkDef;
  open: boolean;
  onToggle: () => void;
  onClick?: () => void;
  progressPct: number | null;
}

export function ParentRow({ fw, open, onToggle, onClick, progressPct }: ParentRowProps) {
  return (
    <div
      className={`grid ${REPORTING_GRID} items-center border-b border-slate-200 px-5 py-4 bg-slate-50/80 cursor-pointer select-none hover:bg-slate-100/60`}
      onClick={(e) => {
        // Clicking chevron area toggles, clicking elsewhere opens modal
        const target = e.target as HTMLElement;
        if (target.closest("[data-toggle]")) {
          onToggle();
        } else if (onClick) {
          onClick();
        }
      }}
    >
      {/* Col 1: chevron + logo + name */}
      <div className="flex items-center gap-3">
        <button
          data-toggle
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="rounded p-0.5 hover:bg-slate-200"
        >
          <svg
            className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <LogoCell fw={fw} />
        <div className="min-w-0">
          <span className="font-semibold text-slate-900 truncate block">{fw.shortName}</span>
          <span className="text-xs text-slate-500">{fw.cadence}</span>
        </div>
      </div>

      {/* Col 2: description */}
      <div className="pr-4 text-sm text-slate-600 line-clamp-2">{fw.description}</div>

      {/* Col 3: progress — average across children */}
      <div>
        <ProgressCell pct={progressPct} />
      </div>

      {/* Col 4: export — parents don't export directly */}
      <div className="text-sm text-slate-300">—</div>
    </div>
  );
}

// ── Child row ─────────────────────────────────────────────────────────────────

interface ChildRowProps {
  fw: FrameworkDef;
  onClick?: () => void;
  onExportClick?: () => void;
  progressPct: number | null;
  exportEnabled: boolean;
}

export function ChildRow({ fw, onClick, onExportClick, progressPct, exportEnabled }: ChildRowProps) {
  const comingSoon = fw.status === "coming-soon";

  return (
    <div className={`grid ${REPORTING_GRID} items-center border-b border-slate-100 px-5 py-4 last:border-b-0 hover:bg-slate-50/60`}>
      {/* Col 1: indented name */}
      <div className="flex items-center gap-3 pl-10">
        <div className="min-w-0">
          {comingSoon ? (
            <span className="font-medium text-slate-500 truncate block">{fw.shortName}</span>
          ) : (
            <button
              onClick={onClick}
              className="font-medium text-slate-900 hover:underline truncate block text-left"
            >
              {fw.shortName}
            </button>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500">{fw.cadence}</span>
            {comingSoon && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                Coming soon
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Col 2: description */}
      <div className="pr-4 text-sm text-slate-600 line-clamp-2">{fw.description}</div>

      {/* Col 3: progress */}
      <div>
        <ProgressCell pct={progressPct} />
      </div>

      {/* Col 4: export */}
      <div>
        {!comingSoon && exportEnabled ? (
          <button
            onClick={onExportClick}
            className="inline-flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900"
          >
            <ExportIcon />
            Export
          </button>
        ) : (
          <span className="text-sm text-slate-300">Export</span>
        )}
      </div>
    </div>
  );
}

// ── Flat row (no parent — for top-level frameworks shown without children) ──────────────────────────────────────────

interface FlatRowProps {
  fw: FrameworkDef;
  onClick?: () => void;
  onExportClick?: () => void;
  progressPct: number | null;
  exportEnabled: boolean;
}

export function FlatRow({ fw, onClick, onExportClick, progressPct, exportEnabled }: FlatRowProps) {
  const comingSoon = fw.status === "coming-soon";

  return (
    <div className={`grid ${REPORTING_GRID} items-center border-b border-slate-100 px-5 py-4 last:border-b-0 hover:bg-slate-50/60`}>
      {/* Col 1: logo + name */}
      <div className="flex items-center gap-3">
        <LogoCell fw={fw} />
        <div className="min-w-0">
          {comingSoon ? (
            <span className="font-medium text-slate-500 truncate block">{fw.shortName}</span>
          ) : (
            <button
              onClick={onClick}
              className="font-medium text-slate-900 hover:underline truncate block text-left"
            >
              {fw.shortName}
            </button>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500">{fw.cadence}</span>
            {comingSoon && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                Coming soon
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Col 2: description */}
      <div className="pr-4 text-sm text-slate-600 line-clamp-2">{fw.description}</div>

      {/* Col 3: progress */}
      <div>
        <ProgressCell pct={progressPct} />
      </div>

      {/* Col 4: export */}
      <div>
        {!comingSoon && exportEnabled ? (
          <button
            onClick={onExportClick}
            className="inline-flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900"
          >
            <ExportIcon />
            Export
          </button>
        ) : (
          <span className="text-sm text-slate-300">Export</span>
        )}
      </div>
    </div>
  );
}

// ── Shared icon ───────────────────────────────────────────────────────────────

function ExportIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
