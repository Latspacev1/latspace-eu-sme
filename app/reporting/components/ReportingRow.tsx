"use client";

import Link from "next/link";
import type { FrameworkDef } from "@/lib/reporting/frameworks";
import type { ReportingInstanceSummary } from "@/lib/api/reporting";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatLastUpdated(inst: ReportingInstanceSummary | undefined): string {
  if (!inst?.last_autofilled_at) return "—";
  const d = new Date(inst.last_autofilled_at);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `Autofilled on ${dd}/${mm}/${yyyy}`;
}

function ProgressCell({ inst }: { inst: ReportingInstanceSummary | undefined }) {
  if (!inst) return <span className="text-sm text-slate-400">—</span>;
  return (
    <>
      <div className="text-sm font-medium text-slate-900">{inst.progress_pct}%</div>
      <div className="mt-1 h-1 w-24 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-brand" style={{ width: `${inst.progress_pct}%` }} />
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

// ── Parent row ────────────────────────────────────────────────────────────────

interface ParentRowProps {
  fw: FrameworkDef;
  open: boolean;
  onToggle: () => void;
  onClick?: () => void;
  childInstances?: ReportingInstanceSummary[];
}

export function ParentRow({ fw, open, onToggle, onClick, childInstances }: ParentRowProps) {
  const reportCount = childInstances?.length ?? 0;

  return (
    <div
      className="grid grid-cols-[2fr_3fr_1.2fr_1fr_0.8fr] items-center border-b border-slate-200 px-5 py-4 bg-slate-50/80 cursor-pointer select-none hover:bg-slate-100/60"
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
      {/* Col 1: logo + name + chevron */}
      <div className="flex items-center gap-3">
        <LogoCell fw={fw} />
        <div className="min-w-0">
          <span className="font-semibold text-slate-900 truncate block">{fw.shortName}</span>
          <span className="text-xs text-slate-500">{fw.cadence}</span>
        </div>
        <button
          data-toggle
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="ml-1 rounded p-0.5 hover:bg-slate-200"
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
      </div>

      {/* Col 2: description */}
      <div className="pr-4 text-sm text-slate-600 line-clamp-2">{fw.description}</div>

      {/* Col 3: report count (no progress bar for parents) */}
      <div className="text-sm text-slate-500">
        {reportCount > 0
          ? `${reportCount} report${reportCount !== 1 ? "s" : ""}`
          : "—"}
      </div>

      {/* Col 4: last updated — dash for parent */}
      <div className="text-sm text-slate-400">—</div>

      {/* Col 5: export */}
      <div className="text-sm text-slate-300">—</div>
    </div>
  );
}

// ── Child row ─────────────────────────────────────────────────────────────────

interface ChildRowProps {
  fw: FrameworkDef;
  inst: ReportingInstanceSummary | undefined;
  instanceCount?: number;
  onClick?: () => void;
  onExportClick?: () => void;
}

export function ChildRow({ fw, inst, instanceCount = 0, onClick, onExportClick }: ChildRowProps) {
  const comingSoon = fw.status === "coming-soon";
  const href = inst ? `/reporting/${fw.id}?instance=${inst.id}` : `/reporting/${fw.id}/new`;

  return (
    <div className="grid grid-cols-[2fr_3fr_1.2fr_1fr_0.8fr] items-center border-b border-slate-100 px-5 py-4 last:border-b-0 hover:bg-slate-50/60">
      {/* Col 1: indented name */}
      <div className="flex items-center gap-3 pl-10">
        <div className="min-w-0">
          {comingSoon ? (
            <span className="font-medium text-slate-500 truncate block">{fw.shortName}</span>
          ) : onClick ? (
            <button
              onClick={onClick}
              className="font-medium text-slate-900 hover:underline truncate block text-left"
            >
              {fw.shortName}
            </button>
          ) : (
            <Link
              href={href}
              className="font-medium text-slate-900 hover:underline truncate block"
            >
              {fw.shortName}
            </Link>
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

      {/* Col 3: progress or instance count */}
      <div>
        {instanceCount > 1 ? (
          <span className="text-sm text-slate-500">{instanceCount} reports</span>
        ) : (
          <ProgressCell inst={inst} />
        )}
      </div>

      {/* Col 4: last updated — removed; shown in modal per-instance instead */}
      <div className="text-sm text-slate-400">—</div>

      {/* Col 5: export — opens modal to pick which instance */}
      <div>
        {!comingSoon && inst ? (
          <button
            onClick={onExportClick || onClick}
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

// ── Flat row (RCO-style, no parent) ──────────────────────────────────────────

interface FlatRowProps {
  fw: FrameworkDef;
  inst: ReportingInstanceSummary | undefined;
  instanceCount?: number;
  onClick?: () => void;
  onExportClick?: () => void;
}

export function FlatRow({ fw, inst, instanceCount = 0, onClick, onExportClick }: FlatRowProps) {
  const comingSoon = fw.status === "coming-soon";
  const href = inst ? `/reporting/${fw.id}?instance=${inst.id}` : `/reporting/${fw.id}/new`;

  return (
    <div className="grid grid-cols-[2fr_3fr_1.2fr_1fr_0.8fr] items-center border-b border-slate-100 px-5 py-4 last:border-b-0 hover:bg-slate-50/60">
      {/* Col 1: logo + name */}
      <div className="flex items-center gap-3">
        <LogoCell fw={fw} />
        <div className="min-w-0">
          {comingSoon ? (
            <span className="font-medium text-slate-500 truncate block">{fw.shortName}</span>
          ) : onClick ? (
            <button
              onClick={onClick}
              className="font-medium text-slate-900 hover:underline truncate block text-left"
            >
              {fw.shortName}
            </button>
          ) : (
            <Link
              href={href}
              className="font-medium text-slate-900 hover:underline truncate block"
            >
              {fw.shortName}
            </Link>
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

      {/* Col 3: progress or instance count */}
      <div>
        {instanceCount > 1 ? (
          <span className="text-sm text-slate-500">{instanceCount} reports</span>
        ) : (
          <ProgressCell inst={inst} />
        )}
      </div>

      {/* Col 4: last updated — removed; shown in modal per-instance instead */}
      <div className="text-sm text-slate-400">—</div>

      {/* Col 5: export — opens modal to pick which instance */}
      <div>
        {!comingSoon && inst ? (
          <button
            onClick={onExportClick || onClick}
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
