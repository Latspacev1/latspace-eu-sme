/**
 * Audit Logs API methods
 */
import { apiClient, APIResponse } from "./client";

export interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  action_details: Record<string, any>;
  action_date: string;
  collection_name: string;
  document_id: string;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AuditLogFilters {
  limit?: number;
  page?: number;
  sort?: string;
  order?: string;
  user_id?: string;
  action_type?: string;
  collection_name?: string;
  document_id?: string;
  organization_id?: string;
}

export interface PaginatedAuditLogs {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

export interface DocVersion {
  id: string;
  collection_name: string;
  document_id: string;
  version: number;
  snapshot: Record<string, any>;
  action: string;
  actor_id: string;
  timestamp: string;
}

export interface VersionComparison {
  version_a: { version: number; snapshot: Record<string, any> };
  version_b: { version: number; snapshot: Record<string, any> };
}

export const auditLogsApi = {
  /**
   * Get all audit logs with optional filters (paginated)
   */
  async getAll(
    filters?: AuditLogFilters
  ): Promise<APIResponse<PaginatedAuditLogs>> {
    const params = new URLSearchParams();
    if (filters?.limit) params.append("limit", filters.limit.toString());
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.sort) params.append("sort", filters.sort);
    if (filters?.order) params.append("order", filters.order);
    if (filters?.user_id) params.append("user_id", filters.user_id);
    if (filters?.action_type) params.append("action_type", filters.action_type);
    if (filters?.collection_name)
      params.append("collection_name", filters.collection_name);
    if (filters?.document_id) params.append("document_id", filters.document_id);
    if (filters?.organization_id) params.append("organization_id", filters.organization_id);

    const endpoint = `/api/audit-logs${params.toString() ? `?${params.toString()}` : ""}`;
    return apiClient.get<PaginatedAuditLogs>(endpoint);
  },

  /**
   * Get audit log by ID
   */
  async getById(auditLogId: string): Promise<APIResponse<AuditLog>> {
    return apiClient.get<AuditLog>(`/api/audit-logs/${auditLogId}`);
  },

  /**
   * Get audit logs for a specific document
   */
  async getForDocument(
    collectionName: string,
    documentId: string,
    limit: number = 50
  ): Promise<APIResponse<AuditLog[]>> {
    return apiClient.get<AuditLog[]>(
      `/api/audit-logs/documents/${collectionName}/${documentId}/history?limit=${limit}`
    );
  },

  /**
   * Get version history for a document
   */
  async getDocumentVersions(
    collectionName: string,
    documentId: string,
    limit: number = 50
  ): Promise<APIResponse<DocVersion[]>> {
    return apiClient.get<DocVersion[]>(
      `/api/audit-logs/versions/${collectionName}/${documentId}?limit=${limit}`
    );
  },

  /**
   * Get a specific version of a document
   */
  async getDocumentAtVersion(
    collectionName: string,
    documentId: string,
    version: number
  ): Promise<APIResponse<Record<string, any>>> {
    return apiClient.get<Record<string, any>>(
      `/api/audit-logs/versions/${collectionName}/${documentId}/${version}`
    );
  },

  /**
   * Compare two versions of a document
   */
  async compareVersions(
    collectionName: string,
    documentId: string,
    versionA: number,
    versionB: number
  ): Promise<APIResponse<VersionComparison>> {
    return apiClient.get<VersionComparison>(
      `/api/audit-logs/versions/${collectionName}/${documentId}/compare?version_a=${versionA}&version_b=${versionB}`
    );
  },
};
