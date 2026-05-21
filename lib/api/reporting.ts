// frontend/lib/api/reporting.ts
/**
 * API client for reporting module endpoints.
 * Follows the pattern of lib/api/benchmarking.ts.
 */
import { apiClient, type APIResponse } from "./client";

// ── Domain types ──────────────────────────────────────────────────────────────

export interface FrameworkDef {
  id: string;
  name: string;
  cadence: string;
  status: string;
}

export interface ReportingInstanceSummary {
  id: string;
  framework_id: string;
  report_type: string;
  financial_year: number;
  period_label: string;
  progress_pct: number;
  last_autofilled_at: string | null;
}

export interface SectionState {
  section_id: string;
  status: "not_started" | "in_progress" | "completed";
  values: Record<string, unknown>;
  assignees: string[];
  comment: string;
  last_synced_at: string | null;
  autofill_confidence: number | null;
}

export interface ReportingInstanceDetail extends ReportingInstanceSummary {
  org_id: string;
  plant_id: string;
  financial_year: number;
  report_type: string;
  total_sections: number;
  sections: SectionState[];
}

export interface CreateInstanceRequest {
  plant_id: string;
  framework_id: string;
  report_type: string;
  financial_year: number;
  period_label: string;
  total_sections: number;
}

// ── API methods ───────────────────────────────────────────────────────────────

export const reportingApi = {
  listFrameworks(): Promise<APIResponse<FrameworkDef[]>> {
    return apiClient.get<FrameworkDef[]>("/api/reporting/frameworks");
  },

  listInstances(plantId?: string): Promise<APIResponse<ReportingInstanceSummary[]>> {
    const qs = plantId ? `?plant_id=${plantId}` : "";
    return apiClient.get<ReportingInstanceSummary[]>(`/api/reporting/instances${qs}`);
  },

  createInstance(body: CreateInstanceRequest): Promise<APIResponse<{ id: string }>> {
    return apiClient.post<{ id: string }>("/api/reporting/instances", body);
  },

  getInstance(id: string): Promise<APIResponse<ReportingInstanceDetail>> {
    return apiClient.get<ReportingInstanceDetail>(`/api/reporting/instances/${id}`);
  },

  patchSection(
    instanceId: string,
    sectionId: string,
    values: Record<string, unknown>,
  ): Promise<APIResponse<{ progress_pct: number }>> {
    return apiClient.patch<{ progress_pct: number }>(
      `/api/reporting/instances/${instanceId}/sections/${sectionId}`,
      { values },
    );
  },

  completeSection(
    instanceId: string,
    sectionId: string,
  ): Promise<APIResponse<{ progress_pct: number }>> {
    return apiClient.post<{ progress_pct: number }>(
      `/api/reporting/instances/${instanceId}/sections/${sectionId}/complete`,
      {},
    );
  },

  reopenSection(
    instanceId: string,
    sectionId: string,
  ): Promise<APIResponse<{ progress_pct: number }>> {
    return apiClient.post<{ progress_pct: number }>(
      `/api/reporting/instances/${instanceId}/sections/${sectionId}/reopen`,
      {},
    );
  },

  resetSection(
    instanceId: string,
    sectionId: string,
  ): Promise<APIResponse<{ progress_pct: number }>> {
    return apiClient.post<{ progress_pct: number }>(
      `/api/reporting/instances/${instanceId}/sections/${sectionId}/reset`,
      {},
    );
  },

  triggerAutofill(instanceId: string): Promise<APIResponse<{ job_id: string }>> {
    return apiClient.post<{ job_id: string }>(
      `/api/reporting/instances/${instanceId}/autofill`,
      {},
    );
  },

  triggerSectionAutofill(
    instanceId: string,
    sectionId: string,
  ): Promise<APIResponse<{ job_id: string }>> {
    return apiClient.post<{ job_id: string }>(
      `/api/reporting/instances/${instanceId}/sections/${sectionId}/autofill`,
      {},
    );
  },

  getAutofillStatus(instanceId: string): Promise<
    APIResponse<{ autofill_job_id: string | null; last_autofilled_at: string | null }>
  > {
    return apiClient.get<{ autofill_job_id: string | null; last_autofilled_at: string | null }>(
      `/api/reporting/instances/${instanceId}/autofill/status`,
    );
  },

  patchSectionAssignees(
    instanceId: string,
    sectionId: string,
    userIds: string[],
  ): Promise<APIResponse<{ progress_pct: number }>> {
    return apiClient.patch<{ progress_pct: number }>(
      `/api/reporting/instances/${instanceId}/sections/${sectionId}/assignees`,
      { user_ids: userIds },
    );
  },
};
