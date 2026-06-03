// Client helpers for the document-extraction flow. uploadAndExtract streams
// the agent's NDJSON events (sandbox / activity / text / proposal / done /
// error) as they arrive; commitExtraction persists the reviewed proposal.
//
// Both go through dashboardFetch so the Bearer token + X-Org-Id headers attach.

import { dashboardFetch } from "@/lib/dashboard/client-fetch";
import { readNdjson } from "@/lib/ndjson";
import type { DocumentClassification } from "@/lib/types/document-classification";

export interface ProposedParameter {
  code: string;
  display_name: string;
  unit: string;
  category: "input" | "emission_factor" | "output";
  section: string;
  is_monthly: boolean;
  is_calculated: boolean;
}

export interface ProposedDataPoint {
  parameter_code: string;
  value_annual: number | null;
  values_monthly: (number | null)[] | null;
  source_file?: string;
  source_excerpt?: string;
  source_page?: number;
  confidence?: number;
}

export interface ExtractionProposal {
  period: { code: string; label: string; start_date?: string; end_date?: string };
  classification?: DocumentClassification;
  parameters: ProposedParameter[];
  data_points: ProposedDataPoint[];
  notes?: string;
}

export interface ExtractEvent {
  event: string;
  data: unknown;
}

export interface UploadResult {
  documentId: string | null;
}

export async function uploadAndExtract(opts: {
  file: File;
  period?: string;
  framework?: string;
  onEvent: (ev: ExtractEvent) => void;
  signal?: AbortSignal;
}): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", opts.file);
  if (opts.period) form.append("period", opts.period);
  if (opts.framework) form.append("framework", opts.framework);

  // Do NOT set Content-Type — the browser adds the multipart boundary.
  const res = await dashboardFetch("/api/extract", {
    method: "POST",
    body: form,
    signal: opts.signal,
  });

  const documentId = res.headers.get("X-Extraction-Document-Id");

  if (!res.ok && !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Extract request failed: HTTP ${res.status}`);
  }

  await readNdjson(res, opts.onEvent);
  return { documentId };
}

export interface CommitResult {
  period: { code: string; label: string };
  parameters: number;
  data_points: number;
  formulas: number;
}

export async function commitExtraction(req: {
  documentId?: string | null;
  proposal: ExtractionProposal;
}): Promise<CommitResult> {
  const res = await dashboardFetch("/api/extract/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId: req.documentId ?? undefined, proposal: req.proposal }),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export interface RecordedParameter {
  code: string;
  display_name: string;
  unit: string;
  category: string;
  section: string;
  value: number | null;
}

export interface ExtractionDocumentSummary {
  id: string;
  filename: string;
  mime_type: string;
  status: "pending" | "committed" | "failed";
  created_at: string;
  period_code: string | null;
  parameters: RecordedParameter[];
  classification: DocumentClassification | null;
}

export async function listExtractionDocuments(): Promise<ExtractionDocumentSummary[]> {
  const res = await dashboardFetch("/api/extract/documents");
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  const data = (await res.json()) as { documents?: ExtractionDocumentSummary[] };
  return data.documents ?? [];
}
