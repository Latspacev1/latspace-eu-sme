/**
 * Admin API — thin wrappers around existing API modules plus user management
 * endpoints that have no dedicated module yet.
 */
import { apiClient, type APIResponse } from "./client";
import { auditLogsApi, type AuditLog, type PaginatedAuditLogs, type AuditLogFilters } from "./audit-logs";
import { organizationsApi } from "./organizations";
import { formulasApi, type Formula } from "./formulas";

// Re-export types used by admin pages so they only need one import
export type { AuditLog, PaginatedAuditLogs, AuditLogFilters };
export type { Formula as AdminFormula };

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  plant_id: string | null;
  organization_id: string;
  is_active?: boolean;
}

export interface AdminPlant {
  id: string;
  name: string;
  description?: string;
  address?: string;
  sector: string | null;
  sub_sector: string | null;
  registration_number: string | null;
  organization_id: string;
}

export interface AdminOrg {
  id: string;
  name: string;
  description: string;
  address: string;
  email_domains?: string[];
  discord_webhook_url?: string | null;
}

export interface SSOProvider {
  id: string;
  display_name: string;
  provider_type: string;
}

export interface OrgCopyPreviewRequest {
  plant_ids_to_include?: string[];
  users?: Array<{ name: string; email: string; role: string; plant_name?: string }>;
}

export interface OrgCopyExecuteRequest extends OrgCopyPreviewRequest {
  new_org_name: string;
  new_org_address?: string;
  new_org_description?: string;
  email_domains?: string[];
  plant_renames?: Record<string, string>;
}

export interface OrgCopyPreviewResult {
  plants_count: number;
  assets_count: number;
  formulas_count: number;
  params_count: number;
  users_count: number;
  plant_names: string[];
}

export interface OrgCopyExecuteResult {
  new_org_id: string;
  created_credentials: Array<{ email: string; password: string }>;
}

export const adminApi = {
  // ── Users ──────────────────────────────────────────────────────────────────

  listUsers: (orgId?: string): Promise<APIResponse<AdminUser[]>> => {
    const qs = orgId ? `?organization_id=${orgId}` : "";
    return apiClient.get<AdminUser[]>(`/api/users${qs}`);
  },

  createUser: (
    data: Partial<AdminUser> & { password: string },
  ): Promise<APIResponse<AdminUser>> =>
    apiClient.post<AdminUser>("/api/users", data),

  updateUser: (
    id: string,
    data: { username?: string; role?: string; plant_id?: string | null; is_active?: boolean },
  ): Promise<APIResponse<AdminUser>> =>
    apiClient.put<AdminUser>(`/api/users/${id}`, data),

  deleteUser: (id: string): Promise<APIResponse<void>> =>
    apiClient.delete<void>(`/api/users/${id}`),

  // ── Plants ─────────────────────────────────────────────────────────────────

  listPlants: (orgId?: string): Promise<APIResponse<AdminPlant[]>> => {
    const qs = orgId ? `?organization_id=${orgId}` : "";
    return apiClient.get<AdminPlant[]>(`/api/plants${qs}`);
  },

  copyPlant: (
    plantId: string,
    newName: string,
    targetOrgId?: string,
  ): Promise<APIResponse<{ plant_id: string }>> =>
    apiClient.post<{ plant_id: string }>(`/api/plants/${plantId}/copy`, {
      new_name: newName,
      ...(targetOrgId ? { target_org_id: targetOrgId } : {}),
    }),

  updatePlant: (
    plantId: string,
    data: { name?: string; description?: string; address?: string },
  ): Promise<APIResponse<AdminPlant>> =>
    apiClient.put<AdminPlant>(`/api/plants/${plantId}`, data),

  deletePlant: (plantId: string): Promise<APIResponse<void>> =>
    apiClient.delete<void>(`/api/plants/${plantId}`),

  // ── Formulas ───────────────────────────────────────────────────────────────
  // Delegates to the existing formulasApi, adding org_id filter support

  listFormulas: (orgId?: string): Promise<APIResponse<Formula[]>> => {
    const params = new URLSearchParams();
    if (orgId) params.set("organization_id", orgId);
    const qs = params.toString();
    return apiClient.get<Formula[]>(`/api/formulas${qs ? `?${qs}` : ""}`);
  },

  // ── Organizations ──────────────────────────────────────────────────────────

  listOrgs: (): Promise<APIResponse<AdminOrg[]>> =>
    apiClient.get<AdminOrg[]>("/api/organizations"),

  previewOrgCopy: (
    orgId: string,
    data: OrgCopyPreviewRequest,
  ): Promise<APIResponse<OrgCopyPreviewResult>> =>
    apiClient.post<OrgCopyPreviewResult>(`/api/organizations/${orgId}/copy/preview`, data),

  executeOrgCopy: (
    orgId: string,
    data: OrgCopyExecuteRequest,
  ): Promise<APIResponse<OrgCopyExecuteResult>> =>
    apiClient.post<OrgCopyExecuteResult>(`/api/organizations/${orgId}/copy`, data),

  // ── Audit Logs ─────────────────────────────────────────────────────────────
  // Delegates to the existing auditLogsApi

  listAuditLogs: (
    filters?: AuditLogFilters,
  ): Promise<APIResponse<PaginatedAuditLogs>> =>
    auditLogsApi.getAll(filters),

  // ── Bulk import ────────────────────────────────────────────────────────────

  bulkImportUsers: (
    file: File,
  ): Promise<APIResponse<{ created: number; errors: object[] }>> => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post<{ created: number; errors: object[] }>(
      "/api/onboarding/bulk-users",
      form,
    );
  },
};

// Re-export existing API modules for convenience
export { organizationsApi, formulasApi };
