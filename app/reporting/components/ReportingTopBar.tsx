"use client";

import type { FrameworkCategory, FrameworkStatus } from "@/lib/reporting/frameworks";

interface ReportingTopBarProps {
  search: string;
  onSearch: (v: string) => void;
  category: FrameworkCategory | "";
  onCategory: (v: FrameworkCategory | "") => void;
  status: FrameworkStatus | "";
  onStatus: (v: FrameworkStatus | "") => void;
  /** Optional — when absent, the Autofill button is hidden. */
  onAutofill?: () => void;
  autofillDisabled?: boolean;
  /** Optional — when provided, renders a top-right Sync button. */
  onSync?: () => void;
}

export function ReportingTopBar({
  search,
  onSearch,
  category,
  onCategory,
  status,
  onStatus,
  onAutofill,
  autofillDisabled,
  onSync,
}: ReportingTopBarProps) {
  return (
    <div className="flex items-center gap-3 mb-6 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-sm">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search frameworks..."
          className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
        />
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
      </div>

      {/* Category filter */}
      <select
        value={category}
        onChange={(e) => onCategory(e.target.value as FrameworkCategory | "")}
        className="rounded-md border border-slate-200 py-2 pl-3 pr-8 text-sm outline-none focus:border-brand bg-white text-slate-700"
      >
        <option value="">All Categories</option>
        <option value="Climate">Climate</option>
        <option value="Sustainability">Sustainability</option>
        <option value="Regulatory">Regulatory</option>
      </select>

      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => onStatus(e.target.value as FrameworkStatus | "")}
        className="rounded-md border border-slate-200 py-2 pl-3 pr-8 text-sm outline-none focus:border-brand bg-white text-slate-700"
      >
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="coming-soon">Coming Soon</option>
      </select>

      {/* Right-aligned action cluster */}
      <div className="ml-auto flex items-center gap-2">
        {onAutofill && (
          <button
            onClick={onAutofill}
            disabled={autofillDisabled}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Autofill
          </button>
        )}
        {onSync && (
          <button
            onClick={onSync}
            title="Refresh progress from saved answers"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M21 12a9 9 0 0 1-15.36 6.36L3 16M3 12a9 9 0 0 1 15.36-6.36L21 8M21 3v5h-5M3 21v-5h5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Sync
          </button>
        )}
      </div>
    </div>
  );
}
