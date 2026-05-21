"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FRAMEWORKS,
  type FrameworkDef,
  type FrameworkCategory,
  type FrameworkStatus,
} from "@/lib/reporting/frameworks";
import { ReportingTopBar } from "./components/ReportingTopBar";
import { ParentRow, ChildRow, FlatRow } from "./components/ReportingRow";

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

  function openFramework(fw: FrameworkDef) {
    // Parent rows just toggle expand/collapse — they have no editor of their
    // own. Children navigate to the framework editor.
    if (fw.isParent) {
      toggleParent(fw.id);
      return;
    }
    router.push(`/reporting/${fw.id}`);
  }

  // Export from the table — runs the same exporter that the editor uses,
  // reading from localStorage. Lazy-imported so the export libs (docx, exceljs)
  // don't ship in the table-page bundle.
  async function exportFramework(fw: FrameworkDef) {
    try {
      if (fw.id === "cdp") {
        const { exportCdpFilled } = await import("@/lib/reporting/cdpExport/export");
        await exportCdpFilled();
      } else if (fw.id === "vsme") {
        const { exportVsmeFilled } = await import("@/lib/reporting/vsmeExport/export");
        await exportVsmeFilled();
      } else {
        toast.info("Export not available for this framework yet.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Export failed. See browser console for details.");
    }
  }

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
        <div className="grid grid-cols-[2fr_3fr_1.2fr_1fr_0.8fr] border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] uppercase tracking-wider text-slate-500">
          <div>Disclosure &amp; Report</div>
          <div>Description</div>
          <div>Progress</div>
          <div></div>
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
                inst={undefined}
                instanceCount={0}
                onClick={() => openFramework(entry.fw)}
                onExportClick={() => exportFramework(entry.fw)}
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
                childInstances={[]}
              />
              {isOpen &&
                entry.filteredChildren.map((child) => (
                  <ChildRow
                    key={child.id}
                    fw={child}
                    inst={undefined}
                    instanceCount={0}
                    onClick={() => openFramework(child)}
                    onExportClick={() => exportFramework(child)}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
