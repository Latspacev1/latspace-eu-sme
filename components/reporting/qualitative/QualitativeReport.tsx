"use client";

import { useCallback, useState } from "react";
import { genId } from "@/lib/reporting/qualitative/storage";
import type { Block, Proposal } from "@/lib/reporting/qualitative/types";
import { AssistantPane, CollapsedAssistantRail, useAssistantPane } from "./AssistantPane";
import { DocumentEditor } from "./DocumentEditor";
import { downloadDocx } from "./exportDocx";
import { Connected, Download, Pencil } from "./icons";
import { useQualitativeDoc } from "./useQualitativeDoc";
import { outputParamCodeFromId } from "./DocumentEditor";
import { OutputParametersTab } from "@/components/reporting/OutputParametersTab";

interface Props {
  frameworkId: string;
  frameworkName: string;
}

type Tab = "requirements" | "document";

export function QualitativeReport({ frameworkId, frameworkName }: Props) {
  const { doc, setDoc } = useQualitativeDoc(frameworkId);
  const [tab, setTab] = useState<Tab>("document");
  const [editingTitle, setEditingTitle] = useState(false);
  // The Requirements tab's selected row, lifted into this parent so clicking
  // an embedded output-parameter pill in the document can jump straight to
  // the matching detail view.
  const [requirementsSelectedCode, setRequirementsSelectedCode] = useState<string | null>(null);
  const { state: assistant, setState: setAssistant } = useAssistantPane();

  // --- AI proposals ---------------------------------------------------------
  // Add a streamed proposal to the doc. Re-keys block ids so they don't
  // collide with anything already in the document.
  const addProposal = useCallback(
    (incoming: Omit<Proposal, "id" | "createdAt" | "blocks"> & { blocks: Proposal["blocks"] }) => {
      const proposalId = genId("p");
      const proposal: Proposal = {
        id: proposalId,
        afterBlockId: incoming.afterBlockId,
        blocks: incoming.blocks.map((b) => ({ ...b, id: genId("b") }) as Proposal["blocks"][number]),
        rationale: incoming.rationale,
        sources: incoming.sources,
        createdAt: new Date().toISOString(),
      };
      setDoc((prev) => ({
        ...prev,
        proposals: [...(prev.proposals ?? []), proposal],
      }));
      return proposal;
    },
    [setDoc]
  );

  // Accept: splice the proposal's blocks into doc.blocks at the right
  // position, then remove the proposal.
  const acceptProposal = useCallback(
    (proposalId: string) => {
      setDoc((prev) => {
        const proposals = prev.proposals ?? [];
        const proposal = proposals.find((p) => p.id === proposalId);
        if (!proposal) return prev;
        const remaining = proposals.filter((p) => p.id !== proposalId);

        let nextBlocks: Block[];
        if (proposal.afterBlockId === null) {
          // Prepend, but keep the title heading (b_title / first heading) at top
          // when present so we don't push the doc title down.
          nextBlocks = [...proposal.blocks, ...prev.blocks];
        } else {
          const idx = prev.blocks.findIndex((b) => b.id === proposal.afterBlockId);
          if (idx < 0) {
            // Block disappeared — fall back to appending.
            nextBlocks = [...prev.blocks, ...proposal.blocks];
          } else {
            nextBlocks = prev.blocks.slice();
            nextBlocks.splice(idx + 1, 0, ...proposal.blocks);
          }
        }
        return { ...prev, blocks: nextBlocks, proposals: remaining };
      });
    },
    [setDoc]
  );

  const rejectProposal = useCallback(
    (proposalId: string) => {
      setDoc((prev) => ({
        ...prev,
        proposals: (prev.proposals ?? []).filter((p) => p.id !== proposalId),
      }));
    },
    [setDoc]
  );

  // Used by the chat-side card to scroll the editor to the proposal.
  const scrollToProposal = useCallback((proposalId: string) => {
    setTab("document");
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-proposal-id="${proposalId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  const handleExport = () => {
    void downloadDocx(doc);
  };

  // Clicking a `requirement-ref` block jumps to the Requirements tab.
  // If the embed is backed by an output parameter (id prefixed with
  // OUTPUT:<code>), pre-select that row so the user lands directly on its
  // detail view. Otherwise just switch tabs.
  const openRequirementFromDoc = (id: string) => {
    const code = outputParamCodeFromId(id);
    if (code) setRequirementsSelectedCode(code);
    setTab("requirements");
  };

  return (
    <div className="flex h-full flex-col">
      <Header
        title={doc.title}
        onTitleChange={(t) => setDoc((prev) => ({ ...prev, title: t }))}
        editingTitle={editingTitle}
        onToggleEditTitle={() => setEditingTitle((e) => !e)}
        frameworkName={frameworkName}
        onExport={handleExport}
      />
      <Tabs tab={tab} onChange={setTab} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {tab === "document" ? (
            <DocumentEditor
              doc={doc}
              setDoc={setDoc}
              onOpenRequirement={openRequirementFromDoc}
              onAcceptProposal={acceptProposal}
              onRejectProposal={rejectProposal}
            />
          ) : (
            // Output parameters registry — same surface used inside the VSME
            // and CDP questionnaires. The narrative report can't deep-link
            // back to a structured question, so `onOpenQuestion` is omitted
            // and "Used in" entries render as plain rows. Selection is
            // controlled so the parent can jump straight to a row when the
            // user clicks an embedded output-parameter pill in the doc.
            <OutputParametersTab
              frameworkId="vsme-narrative"
              selectedCode={requirementsSelectedCode}
              onSelectionChange={setRequirementsSelectedCode}
            />
          )}
        </div>
        {assistant.collapsed ? (
          <CollapsedAssistantRail
            onExpand={() => setAssistant((s) => ({ ...s, collapsed: false }))}
          />
        ) : (
          <AssistantPane
            width={assistant.width}
            onWidthChange={(width) => setAssistant((s) => ({ ...s, width }))}
            onCollapse={() => setAssistant((s) => ({ ...s, collapsed: true }))}
            doc={doc}
            onAddProposal={addProposal}
            onAcceptProposal={acceptProposal}
            onRejectProposal={rejectProposal}
            onScrollToProposal={scrollToProposal}
            frameworkId={frameworkId}
          />
        )}
      </div>
    </div>
  );
}

function Header({
  title,
  onTitleChange,
  editingTitle,
  onToggleEditTitle,
  frameworkName,
  onExport,
}: {
  title: string;
  onTitleChange: (t: string) => void;
  editingTitle: boolean;
  onToggleEditTitle: () => void;
  frameworkName: string;
  onExport: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <a href="/" className="text-slate-500 hover:text-slate-900">
          Disclosures and reports
        </a>
        <span className="text-slate-300">›</span>
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={title}
            onBlur={(e) => {
              onTitleChange(e.target.value || title);
              onToggleEditTitle();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") onToggleEditTitle();
            }}
            className="min-w-[260px] border border-slate-200 px-2 py-1 text-sm font-medium text-slate-900 outline-none focus:border-brand"
          />
        ) : (
          <span className="truncate text-slate-900" title={title}>
            {title}
          </span>
        )}
        <button
          onClick={onToggleEditTitle}
          className="p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          title="Rename"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <span className="ml-3 hidden text-xs text-slate-400 sm:inline">{frameworkName}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
          <Connected className="h-3 w-3" /> Connected
        </span>
        <button
          onClick={onExport}
          className="ml-1 inline-flex items-center gap-1 border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>
    </header>
  );
}

function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="border-b border-slate-200 bg-white px-6">
      <div className="flex gap-6 text-sm">
        <TabButton active={tab === "requirements"} onClick={() => onChange("requirements")}>
          Requirements
        </TabButton>
        <TabButton active={tab === "document"} onClick={() => onChange("document")}>
          Document
        </TabButton>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 py-2.5 ${
        active
          ? "border-brand font-medium text-slate-900"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}
