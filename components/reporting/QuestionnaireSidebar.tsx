"use client";

import type { Section } from "@/lib/reporting/frameworkTypes";
import type { QuestionState, Status } from "@/components/reporting/Questionnaire";

const statusDot: Record<Status, string> = {
  "not-started": "bg-slate-300",
  "in-progress": "bg-amber-400",
  completed: "bg-emerald-500",
};

interface SidebarProps {
  width: number;
  onCollapse: () => void;
  sections: Section[];
  answers: Record<string, QuestionState>;
  activeId: string;
  setActiveId: (id: string) => void;
  openSections: Record<string, boolean>;
  setOpenSections: (v: Record<string, boolean>) => void;
  search: string;
  setSearch: (v: string) => void;
  overallPct: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  totalCount: number;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-slate-500">
      <span className={`h-2 w-2 rounded-full ${color}`} />{label}
    </span>
  );
}

export function QuestionnaireSidebar(props: SidebarProps) {
  return (
    <aside className="shrink-0 border-r border-slate-200 bg-white flex flex-col" style={{ width: props.width }}>
      <div className="border-b border-slate-200 p-4 space-y-4">
        <div className="flex items-center text-sm">
          <span className="text-[11px] uppercase tracking-wider font-medium text-slate-500">Sections</span>
          <button onClick={props.onCollapse} title="Collapse panel" className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="relative">
          <input value={props.search} onChange={(e) => props.setSearch(e.target.value)} placeholder="Search questions..." className="w-full rounded border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand" />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span>Overall Progress</span><span>{props.overallPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-brand transition-all" style={{ width: `${props.overallPct}%` }} />
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px]">
            <LegendDot color="bg-emerald-500" label={`Completed: ${props.completedCount}`} />
            <LegendDot color="bg-amber-400" label={`In Progress: ${props.inProgressCount}`} />
            <LegendDot color="bg-slate-300" label={`Not Started: ${props.notStartedCount}`} />
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto">
        {props.sections.map((s) => {
          const total = s.questions.length;
          const status = (qId: string) => props.answers[qId]?.status ?? "not-started";
          const completed = s.questions.filter((q) => status(q.id) === "completed").length;
          const inProgress = s.questions.filter((q) => status(q.id) === "in-progress").length;
          const done = completed + inProgress;
          const open = props.openSections[s.id];
          const expanded = props.search.trim() ? true : open;
          return (
            <div key={s.id} className="border-b border-slate-100">
              <button onClick={() => props.setOpenSections({ ...props.openSections, [s.id]: !expanded })} className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50">
                <span className="flex items-center gap-2">
                  <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
                  <span className="font-medium text-slate-800 text-left">{s.title}</span>
                </span>
                <span className="text-xs text-slate-500">{done}/{total}</span>
              </button>
              {expanded && (
                <ul>
                  {s.questions.map((q) => {
                    const st = props.answers[q.id]?.status ?? "not-started";
                    const isActive = props.activeId === q.id;
                    return (
                      <li key={q.id}>
                        <button onClick={() => props.setActiveId(q.id)} className={`w-full text-left flex gap-3 px-6 py-2.5 text-sm ${isActive ? "bg-brand/5" : "hover:bg-slate-50"}`}>
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${statusDot[st] ?? "bg-slate-300"}`} />
                          <span className="min-w-0">
                            <span className="block text-[11px] uppercase tracking-wide text-slate-500">{q.id}</span>
                            <span className="block text-slate-700 truncate">{q.label}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 px-4 py-2 text-[11px] text-emerald-600 flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Auto-save enabled
      </div>
    </aside>
  );
}
