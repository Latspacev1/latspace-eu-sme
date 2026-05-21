"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FRAMEWORKS,
  type FrameworkDef,
  type FrameworkCategory,
  type FrameworkStatus,
} from "@/lib/reporting/frameworks";
import { getFrameworkProgress } from "@/lib/reporting/progress";
import { ReportingTopBar } from "./components/ReportingTopBar";
import { ParentRow, ChildRow, FlatRow, REPORTING_GRID } from "./components/ReportingRow";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GroupedEntry {
  kind: "parent";
  fw: FrameworkDef;
  filteredChildren: FrameworkDef[];
}

interface FlatEntry {
  kind: "flat";
  fw: FrameworkDef;
}

type TableEntry = GroupedEntry | FlatEntry;

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesLeaf(
  fw: FrameworkDef,
  search: string,
  category: FrameworkCategory | "",
  status: FrameworkStatus | "",
): boolean {
  if (category && fw.category !== category) return false;
  if (status && fw.status !== status) return false;
  if (search) {
    const q = search.toLowerCase();
    const haystack = `${fw.name} ${fw.shortName} ${fw.description}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

// Frameworks that have an exporter wired up. Used to enable/disable the Export
// button on each row.
const EXPORTABLE_IDS = new Set(["cdp", "vsme", "vsme-narrative"]);

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportingPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FrameworkCategory | "">("");
  const [status, setStatus] = useState<FrameworkStatus | "">("");
  const [openParents, setOpenParents] = useState<Record<string, boolean>>(() => {
    // All parent groups start open
    const init: Record<string, boolean> = {};
    for (const fw of FRAMEWORKS) {
      if (fw.isParent) init[fw.id] = true;
    }
    return init;
  });

  // Bumped by Sync (and on mount) to re-read progress from localStorage. The
  // table is otherwise a pure function of FRAMEWORKS + this counter.
  const [progressVersion, setProgressVersion] = useState(0);

  // Refresh progress when the page becomes visible again (e.g. user returns
  // from the editor) so the bars reflect any work done there.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        setProgressVersion((v) => v + 1);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Memoised progress map — recomputed when filters change (cheap) or when the
  // user hits Sync.
  const progressByFrameworkId = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const fw of FRAMEWORKS) {
      out[fw.id] = getFrameworkProgress(fw);
      if (fw.children) {
        for (const c of fw.children) {
          out[c.id] = getFrameworkProgress(c);
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressVersion]);

  function openFramework(fw: FrameworkDef) {
    // Parent rows just toggle expand/collapse — they have no editor of their
    // own. Children navigate to the framework editor.
    if (fw.isParent) {
      toggleParent(fw.id);
      return;
    }
    router.push(`/reporting/${fw.id}`);
  }

  // Export from the table — runs the same exporter the editor uses, reading
  // from localStorage. Lazy-imported so the export libs (docx, exceljs) don't
  // ship in the table-page bundle.
  async function exportFramework(fw: FrameworkDef) {
    try {
      if (fw.id === "cdp") {
        const { exportCdpFilled } = await import("@/lib/reporting/cdpExport/export");
        await exportCdpFilled();
      } else if (fw.id === "vsme") {
        const { exportVsmeFilled } = await import("@/lib/reporting/vsmeExport/export");
        await exportVsmeFilled();
      } else if (fw.id === "vsme-narrative") {
        const [{ readDoc }, { downloadDocx }] = await Promise.all([
          import("@/lib/reporting/qualitative/storage"),
          import("@/components/reporting/qualitative/exportDocx"),
        ]);
        const doc = readDoc(fw.id);
        if (!doc) {
          toast.info("Open the report at least once before exporting.");
          return;
        }
        await downloadDocx(doc);
      } else {
        toast.info("Export not available for this framework yet.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Export failed. See browser console for details.");
    }
  }

  const handleSync = useCallback(() => {
    setProgressVersion((v) => v + 1);
    toast.success("Progress synced.");
  }, []);

  // Build filtered table entries
  const { entries, leafTotal, leafMatching } = useMemo(() => {
    const result: TableEntry[] = [];
    let total = 0;
    let matching = 0;

    for (const fw of FRAMEWORKS) {
      if (fw.isParent && fw.children) {
        // Count all children toward total
        total += fw.children.length;

        const matched = fw.children.filter((c) =>
          matchesLeaf(c, search, category, status),
        );
        matching += matched.length;

        if (matched.length > 0) {
          result.push({ kind: "parent", fw, filteredChildren: matched });
        }
      } else {
        // Flat row — framework without children (e.g. CDP).
        total += 1;
        if (matchesLeaf(fw, search, category, status)) {
          matching += 1;
          result.push({ kind: "flat", fw });
        }
      }
    }

    return { entries: result, leafTotal: total, leafMatching: matching };
  }, [search, category, status]);

  function toggleParent(id: string) {
    setOpenParents((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="px-8 py-6">
      <ReportingTopBar
        search={search}
        onSearch={setSearch}
        category={category}
        onCategory={setCategory}
        status={status}
        onStatus={setStatus}
        onSync={handleSync}
      />

      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-900">
          Available Disclosures &amp; Reports
        </h1>
        <span className="text-sm text-slate-500">
          Showing {leafMatching} of {leafTotal} results
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {/* Header */}
        <div className={`grid ${REPORTING_GRID} border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] uppercase tracking-wider text-slate-500`}>
          <div>Disclosure &amp; Report</div>
          <div>Description</div>
          <div>Progress</div>
          <div>Export</div>
        </div>

        {entries.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No frameworks match your search.
          </div>
        )}

        {entries.map((entry) => {
          if (entry.kind === "flat") {
            return (
              <FlatRow
                key={entry.fw.id}
                fw={entry.fw}
                onClick={() => openFramework(entry.fw)}
                onExportClick={() => exportFramework(entry.fw)}
                progressPct={progressByFrameworkId[entry.fw.id] ?? null}
                exportEnabled={EXPORTABLE_IDS.has(entry.fw.id)}
              />
            );
          }

          // Parent + children
          const isOpen = openParents[entry.fw.id] ?? true;
          return (
            <div key={entry.fw.id}>
              <ParentRow
                fw={entry.fw}
                open={isOpen}
                onToggle={() => toggleParent(entry.fw.id)}
                onClick={() => openFramework(entry.fw)}
                progressPct={progressByFrameworkId[entry.fw.id] ?? null}
              />
              {isOpen &&
                entry.filteredChildren.map((child) => (
                  <ChildRow
                    key={child.id}
                    fw={child}
                    onClick={() => openFramework(child)}
                    onExportClick={() => exportFramework(child)}
                    progressPct={progressByFrameworkId[child.id] ?? null}
                    exportEnabled={EXPORTABLE_IDS.has(child.id)}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
