"use client";

// Upload history for the extraction page — lists every document the org has
// uploaded (newest first) with its commit status. Rendered below the
// extraction section. Refetches on mount and whenever the ["extraction-documents"]
// query is invalidated (e.g. after a successful commit).

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import {
  listExtractionDocuments,
  type ExtractionDocumentSummary,
} from "@/lib/api/extract";

const STATUS_STYLES: Record<
  ExtractionDocumentSummary["status"],
  { label: string; className: string }
> = {
  committed: {
    label: "Committed",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  failed: {
    label: "Failed",
    className: "bg-red-50 text-red-700 border-red-200",
  },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocumentHistory() {
  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["extraction-documents"],
    queryFn: listExtractionDocuments,
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="mt-10 border-t border-slate-200 pt-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[#0A0A0A]">
            Upload history
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Documents you&apos;ve uploaded for extraction.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-sm border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading history…
        </div>
      ) : isError ? (
        <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {(error as Error)?.message ?? "Failed to load upload history."}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-sm border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
          No documents uploaded yet. Upload one above to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 font-medium">Document</th>
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5 font-medium">Parameters</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {data.map((doc) => {
                const isImage = doc.mime_type.startsWith("image/");
                const status = STATUS_STYLES[doc.status] ?? STATUS_STYLES.pending;
                const paramCount = doc.parameters.length;
                const isOpen = expanded.has(doc.id);
                const canExpand = paramCount > 0;
                return (
                  <React.Fragment key={doc.id}>
                    <tr
                      onClick={() => canExpand && toggle(doc.id)}
                      className={`border-b border-slate-100 ${
                        isOpen ? "" : "last:border-0"
                      } ${canExpand ? "cursor-pointer" : ""} hover:bg-slate-50/60`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {canExpand ? (
                            <ChevronRight
                              className={`h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform ${
                                isOpen ? "rotate-90" : ""
                              }`}
                            />
                          ) : (
                            <span className="w-3.5 flex-shrink-0" />
                          )}
                          {isImage ? (
                            <ImageIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                          ) : (
                            <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                          )}
                          <span
                            className="max-w-[300px] truncate font-medium text-[#0A0A0A]"
                            title={doc.filename}
                          >
                            {doc.filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {doc.period_code ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {paramCount > 0 ? (
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {paramCount}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {formatDate(doc.created_at)}
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="border-b border-slate-100 last:border-0 bg-slate-50/40">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="pl-6">
                            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                              Recorded parameters
                            </div>
                            <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
                              <table className="w-full text-[13px]">
                                <thead>
                                  <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-400">
                                    <th className="px-3 py-2 font-medium">Parameter</th>
                                    <th className="px-3 py-2 font-medium">Code</th>
                                    <th className="px-3 py-2 font-medium">Unit</th>
                                    <th className="px-3 py-2 font-medium">Category</th>
                                    <th className="px-3 py-2 font-medium">Section</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {doc.parameters.map((p, i) => (
                                    <tr
                                      key={`${p.code}-${i}`}
                                      className="border-b border-slate-100 last:border-0"
                                    >
                                      <td className="px-3 py-2 font-medium text-[#0A0A0A]">
                                        {p.display_name || p.code || "—"}
                                      </td>
                                      <td className="px-3 py-2 font-mono text-[12px] text-slate-500">
                                        {p.code || "—"}
                                      </td>
                                      <td className="px-3 py-2 text-slate-600">
                                        {p.unit || "—"}
                                      </td>
                                      <td className="px-3 py-2 text-slate-600">
                                        {p.category || "—"}
                                      </td>
                                      <td className="px-3 py-2 text-slate-600">
                                        {p.section || "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
