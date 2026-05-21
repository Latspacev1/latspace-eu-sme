import { apiClient, type APIResponse } from "./client";
import type { LogbookEntry } from "@/lib/types";

export const logbookApi = {
  /**
   * Get all logbook entries with optional filters
   */
  getAll: async (filters?: {
    plant_id?: string;
    org_id?: string;
    status?: string;
  }): Promise<APIResponse<LogbookEntry[]>> => {
    const params = new URLSearchParams();
    if (filters?.plant_id) params.append("plant_id", filters.plant_id);
    if (filters?.org_id) params.append("org_id", filters.org_id);
    if (filters?.status) params.append("status_filter", filters.status);

    const queryString = params.toString();
    const endpoint = queryString
      ? `/api/logbook?${queryString}`
      : "/api/logbook";

    return apiClient.get<LogbookEntry[]>(endpoint);
  },

  /**
   * Get a single logbook entry by ID
   */
  getById: async (id: string): Promise<APIResponse<LogbookEntry>> => {
    return apiClient.get<LogbookEntry>(`/api/logbook/${id}`);
  },

  /**
   * Approve a logbook entry and save to database
   */
  approve: async (
    id: string,
    comments?: string,
  ): Promise<
    APIResponse<{
      entry: LogbookEntry;
      created_records: any[];
      errors?: string[];
    }>
  > => {
    return apiClient.post(`/api/logbook/${id}/approve`, { comments });
  },

  /**
   * Reject a logbook entry
   */
  reject: async (
    id: string,
    reason?: string,
    comments?: string,
  ): Promise<APIResponse<LogbookEntry>> => {
    return apiClient.post(`/api/logbook/${id}/reject`, { reason, comments });
  },

  /**
   * Update a logbook entry
   */
  update: async (
    id: string,
    data: { bulk_upload_data?: any[] },
  ): Promise<APIResponse<LogbookEntry>> => {
    return apiClient.put(`/api/logbook/${id}`, data);
  },

  /**
   * Delete a logbook entry
   */
  delete: async (id: string): Promise<APIResponse<{ id: string }>> => {
    return apiClient.delete(`/api/logbook/${id}`);
  },

  /**
   * Reopen and edit an approved entry (Corp Head only)
   */
  reopenEdit: async (
    id: string,
    bulkUploadData: any[],
  ): Promise<APIResponse<LogbookEntry>> => {
    return apiClient.post(`/api/logbook/${id}/reopen-edit`, {
      bulk_upload_data: bulkUploadData,
    });
  },

  /**
   * Request changes on an approved entry (Corp Head only)
   * Sends notification to Plant Manager
   */
  requestChange: async (
    id: string,
    comments: string,
  ): Promise<
    APIResponse<{
      entry: LogbookEntry;
      notification_sent: boolean;
      plant_manager_notified: string;
    }>
  > => {
    return apiClient.post(`/api/logbook/${id}/request-change`, { comments });
  },

  /**
   * Resubmit a ChangeRequested entry back for review (Plant Manager only)
   */
  resubmit: async (id: string): Promise<APIResponse<LogbookEntry>> => {
    return apiClient.post(`/api/logbook/${id}/resubmit`);
  },
};
