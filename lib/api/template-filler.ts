/**
 * API client for template filler endpoints.
 * Follows existing patterns from lib/api/templates.ts
 */

import { z } from "zod";
import { useAppStore } from "../store/useAppStore";
import { getBackendUrl } from "./client";

const getToken = () => useAppStore.getState().token;

// Schemas
export const PreviewRowSchema = z
  .object({
    row_number: z.number(),
  })
  .catchall(z.unknown()); // Additional columns (A, B, C, etc.)

export const SheetPreviewSchema = z.object({
  name: z.string(),
  row_count: z.number(),
  column_count: z.number(),
  columns: z.array(z.string()),
  headers: z.array(z.unknown()),
  preview_rows: z.array(PreviewRowSchema),
});

export const PreviewResponseSchema = z.object({
  file_id: z.string(),
  filename: z.string(),
  sheets: z.array(SheetPreviewSchema),
});

export const FillSummarySchema = z.object({
  total_filled: z.number(),
  total_skipped: z.number(),
  total_errors: z.number(),
});

export const MappingReportSchema = z.object({
  matches: z.array(z.unknown()),
  skipped: z.array(z.unknown()),
  errors: z.array(z.unknown()),
});

export const FillResponseSchema = z.object({
  file_id: z.string(),
  download_url: z.string(),
  summary: FillSummarySchema,
  mapping_report: MappingReportSchema,
});

// Types
export type PreviewResponse = z.infer<typeof PreviewResponseSchema>;
export type SheetPreview = z.infer<typeof SheetPreviewSchema>;
export type PreviewRow = z.infer<typeof PreviewRowSchema>;
export type FillResponse = z.infer<typeof FillResponseSchema>;
export type FillSummary = z.infer<typeof FillSummarySchema>;
export type MappingReport = z.infer<typeof MappingReportSchema>;

export interface FillTemplateRequest {
  file_id: string;
  sheet_name: string;
  target_column: string;
  start_row: number;
  plant_id: string;
  financial_year: number;
  time_type: "monthly" | "annual";
  months?: number[];
}

// API Functions
export async function uploadTemplateForPreview(file: File): Promise<PreviewResponse> {
  const formData = new FormData();
  formData.append("template_file", file);

  const token = getToken();
  const baseUrl = getBackendUrl();
  const response = await fetch(`${baseUrl}/api/template-filler/preview`, {
    method: "POST",
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || "Failed to upload template");
  }

  const data = await response.json();
  return PreviewResponseSchema.parse(data);
}

export async function fillTemplate(request: FillTemplateRequest): Promise<FillResponse> {
  const token = getToken();
  const baseUrl = getBackendUrl();
  const response = await fetch(`${baseUrl}/api/template-filler/fill`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Fill failed" }));
    throw new Error(error.detail || "Failed to fill template");
  }

  const data = await response.json();
  return FillResponseSchema.parse(data);
}

export function getDownloadUrl(fileId: string): string {
  const baseUrl = getBackendUrl();
  const token = getToken();
  // Include token in URL for download endpoint
  return `${baseUrl}/api/template-filler/download/${fileId}${token ? `?token=${token}` : ""}`;
}

// ── Async job API ─────────────────────────────────────────────────────────────

export interface FillAsyncResponse {
  job_id: string;
  status: string;
}

export interface FillJobStatus {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  error?: string | null;
  result?: FillResponse | null;
}

export async function fillTemplateAsync(request: FillTemplateRequest): Promise<FillAsyncResponse> {
  const token = getToken();
  const baseUrl = getBackendUrl();
  const response = await fetch(`${baseUrl}/api/template-filler/fill/async`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to start job" }));
    throw new Error(error.detail || "Failed to start fill job");
  }

  return response.json();
}

export async function getFillJobStatus(jobId: string): Promise<FillJobStatus> {
  const token = getToken();
  const baseUrl = getBackendUrl();
  const response = await fetch(`${baseUrl}/api/template-filler/fill/async/${jobId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to get job status" }));
    throw new Error(error.detail || "Failed to get job status");
  }

  return response.json();
}
