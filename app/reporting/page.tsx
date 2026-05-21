"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store/useAppStore";
import { reportingApi, type ReportingInstanceSummary } from "@/lib/api/reporting";
import { useRouter } from "next/navigation";
import {
  FRAMEWORKS,
  isLocalMode,
  type FrameworkDef,
  type FrameworkCategory,
  type FrameworkStatus,
} from "@/lib/reporting/frameworks";
import { ReportingTopBar } from "./components/ReportingTopBar";
import { ParentRow, ChildRow, FlatRow } from "./components/ReportingRow";
import ReportInstanceModal from "./components/ReportInstanceModal";

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
  const { user } = useAppStore();
  const selectedPlantId = user?.plantId;

  function openFramework(fw: FrameworkDef, modalMode: "open" | "export") {
    // Local-mode frameworks (CBAM, BRSR, CDP, CBAM MMD) don't have instances —
    // jump straight to the editor. Parent rows always open the modal so the
    // user can pick which child to enter (e.g. CBAM CT vs CBAM MMD).
    if (!fw.isParent && isLocalMode(fw)) {
      router.push(`/reporting/${fw.id}`);
      return;
    }
    setModalMode(modalMode);
    setModalFw(fw);
  }

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FrameworkCategory | "">("");
  const [status, setStatus] = useState<FrameworkStatus | "">("");
  const [modalFw, setModalFw] = useState<FrameworkDef | null>(null);
  const [modalMode, setModalMode] = useState<"open" | "export">("open");
  const [openParents, setOpenParents] = useState<Record<string, boolean>>(() => {
    // All parent groups start open
    const init: Record<string, boolean> = {};
    for (const fw of FRAMEWORKS) {
      if (fw.isParent) init[fw.id] = true;
    }
    return init;
  });

  const { data: instancesResp } = useQuery({
    queryKey: ["reporting-instances", selectedPlantId],
    queryFn: () => reportingApi.listInstances(selectedPlantId ?? undefined),
    enabled: !!selectedPlantId,
  });

  const instanceMap = useMemo(() => {
    const map: Record<string, ReportingInstanceSummary> = {};
    for (const inst of instancesResp?.data ?? []) {
      map[inst.framework_id] = inst;
    }
    return map;
  }, [instancesResp]);

  // Count instances per framework for display in rows
  const instanceCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inst of instancesResp?.data ?? []) {
      counts[inst.framework_id] = (counts[inst.framework_id] || 0) + 1;
    }
    return counts;
  }, [instancesResp]);

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
        // Flat row (RCO etc.)
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

  async function handleAutofill() {
    const instances = Object.values(instanceMap);
    if (instances.length === 0) {
      toast.error("No active instances to autofill.");
      return;
    }
    await Promise.all(instances.map((inst) => reportingApi.triggerAutofill(inst.id)));
    toast.success(`Autofill started for ${instances.length} framework${instances.length !== 1 ? "s" : ""}`);
  }

  async function handleExportInstance(instance: ReportingInstanceSummary) {
    try {
      const detail = await reportingApi.getInstance(instance.id);
      if (!detail.data) {
        toast.error("Failed to load report data for export.");
        return;
      }
      const inst = detail.data;
      const frameworkId = inst.framework_id;

      // Build answers from sections
      const answers: Record<string, { values: Record<string, unknown> }> = {};
      for (const section of inst.sections) {
        answers[section.section_id] = { values: section.values };
      }

      if (frameworkId === "ccts") {
        const { exportCctsFilled } = await import("@/lib/reporting/cctsExport");
        await exportCctsFilled(answers);
      } else if (frameworkId === "rco") {
        const { exportRcoFilled } = await import("@/lib/reporting/rcoExport/export");
        await exportRcoFilled(answers);
      } else {
        toast.info("Export not available for this framework yet.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Export failed. See browser console for details.");
    }
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
        onAutofill={handleAutofill}
        autofillDisabled={Object.keys(instanceMap).length === 0}
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
                inst={instanceMap[entry.fw.id]}
                instanceCount={instanceCountMap[entry.fw.id] || 0}
                onClick={() => openFramework(entry.fw, "open")}
                onExportClick={() => openFramework(entry.fw, "export")}
              />
            );
          }

          // Parent + children
          const isOpen = openParents[entry.fw.id] ?? true;
          // Gather all instances for this parent's children
          const childIds = entry.fw.children?.map((c) => c.id) ?? [];
          const parentChildInstances = instancesResp?.data?.filter((i) =>
            childIds.includes(i.framework_id)
          ) ?? [];
          return (
            <div key={entry.fw.id}>
              <ParentRow
                fw={entry.fw}
                open={isOpen}
                onToggle={() => toggleParent(entry.fw.id)}
                onClick={() => openFramework(entry.fw, "open")}
                childInstances={parentChildInstances}
              />
              {isOpen &&
                entry.filteredChildren.map((child) => (
                  <ChildRow
                    key={child.id}
                    fw={child}
                    inst={instanceMap[child.id]}
                    instanceCount={instanceCountMap[child.id] || 0}
                    onClick={() => openFramework(child, "open")}
                    onExportClick={() => openFramework(child, "export")}
                  />
                ))}
            </div>
          );
        })}
      </div>

      {modalFw && (
        <ReportInstanceModal
          framework={modalFw}
          instances={instancesResp?.data ?? []}
          isOpen={!!modalFw}
          onClose={() => setModalFw(null)}
          mode={modalMode}
          onExportInstance={handleExportInstance}
        />
      )}
    </div>
  );
}
