/**
 * Agent Parse API methods for AI-powered Excel parsing
 *
 * This API client communicates with the agents_v1 backend endpoints
 * for intelligent Excel parsing that can handle any format.
 */
import { APIResponse, getBackendUrl } from "./client";
import { useAppStore } from "../store/useAppStore";

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

export interface CreateJobResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface AgentParseJobStatus {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  filename: string;
  financial_year: number;
  month: number;
  total_cells: number;
  valid_cells: number;
  warning_cells: number;
  error_cells: number;
  anomalies_count: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface AgentParsedCell {
  cell_ref: string;
  row: number;
  col: number;
  param_id: string | null;
  param_name: string;
  param_display_name: string;
  param_unit: string | null;
  param_category: string | null;
  is_calculated: boolean;
  asset_id: string | null;
  asset_name: string | null;
  raw_value: string | null;
  parsed_value: number | null;
  validation_status: "valid" | "warning" | "error";
  validation_message: string | null;
}

export interface AnomalyFieldInfo {
  field_name: string;
  current_value: number;
  moving_average: number | null;
  deviation_percentage: number;
  severity: "warning" | "critical";
  lookback_months: number;
}

export interface AgentParseJobDetail {
  job_id: string;
  status: string;
  progress: number;
  filename: string;
  financial_year: number;
  month: number;
  total_cells: number;
  valid_cells: number;
  warning_cells: number;
  error_cells: number;
  validation_errors: string[];
  anomalies: AnomalyFieldInfo[];
  unmapped_columns: number[];
  parsing_notes: string[];
  parsed_cells: AgentParsedCell[];
}

export interface AgentParseJobSummary {
  job_id: string;
  filename: string;
  plant_id: string;
  financial_year: number;
  month: number;
  status: string;
  progress: number;
  total_cells: number;
  valid_cells: number;
  error_cells: number;
  anomalies_count: number;
  created_at: string;
}

export interface UpdateCellRequest {
  cell_ref: string;
  new_value: number;
}

export interface SubmitResponse {
  logbook_entry_id: string;
  status: string;
  period: string;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function getAuthToken(): string | null {
  return useAppStore.getState().token;
}

// -----------------------------------------------------------------------------
// API Client
// -----------------------------------------------------------------------------

export const agentParseApi = {
  /**
   * Upload an Excel file and start AI-powered parsing
   * Returns job_id immediately, poll getJobStatus for progress
   */
  async uploadAndParse(
    file: File,
    plantId: string,
    financialYear: number,
    month: number,
    sheetName?: string,
  ): Promise<APIResponse<CreateJobResponse>> {
    const token = getAuthToken();
    if (!token) {
      return {
        success: false,
        message: "Not authenticated",
        error: "No auth token",
      };
    }

    const formData = new FormData();
    formData.append("file", file);

    // Build query params
    const params = new URLSearchParams({
      plant_id: plantId,
      financial_year: financialYear.toString(),
      month: month.toString(),
      token: token,
    });
    if (sheetName) {
      params.append("sheet_name", sheetName);
    }

    try {
      const backendUrl = getBackendUrl();
      const url = backendUrl
        ? `${backendUrl}/api/agent-parse/upload?${params.toString()}`
        : `/api/agent-parse/upload?${params.toString()}`;

      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: "Upload failed" }));
        return {
          success: false,
          message: errorData.detail || errorData.message || "Upload failed",
          error: errorData.detail || errorData.message,
        };
      }

      const data = await response.json();

      if (data.success && data.data) {
        return {
          success: true,
          message: data.message,
          data: data.data,
        };
      }

      return {
        success: false,
        message: data.message || "Upload failed",
        error: data.error,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  },

  /**
   * Get status of a parsing job (for polling)
   */
  async getJobStatus(jobId: string): Promise<APIResponse<AgentParseJobStatus>> {
    const token = getAuthToken();
    if (!token) {
      return {
        success: false,
        message: "Not authenticated",
        error: "No auth token",
      };
    }

    try {
      const backendUrl = getBackendUrl();
      const params = new URLSearchParams({ token });
      const url = backendUrl
        ? `${backendUrl}/api/agent-parse/jobs/${jobId}?${params.toString()}`
        : `/api/agent-parse/jobs/${jobId}?${params.toString()}`;

      const response = await fetch(url, {
        method: "GET",
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: "Failed to get job status" }));
        return {
          success: false,
          message: errorData.detail || "Failed to get job status",
          error: errorData.detail,
        };
      }

      const data = await response.json();

      if (data.success && data.data) {
        return {
          success: true,
          message: data.message,
          data: data.data,
        };
      }

      return {
        success: false,
        message: data.message || "Failed to get job status",
        error: data.error,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  },

  /**
   * Get detailed parsed cells for a completed job
   */
  async getJobCells(
    jobId: string,
    filterStatus?: "valid" | "warning" | "error",
  ): Promise<APIResponse<AgentParseJobDetail>> {
    const token = getAuthToken();
    if (!token) {
      return {
        success: false,
        message: "Not authenticated",
        error: "No auth token",
      };
    }

    try {
      const backendUrl = getBackendUrl();
      const params = new URLSearchParams({ token });
      if (filterStatus) {
        params.append("filter_status", filterStatus);
      }
      const url = backendUrl
        ? `${backendUrl}/api/agent-parse/jobs/${jobId}/cells?${params.toString()}`
        : `/api/agent-parse/jobs/${jobId}/cells?${params.toString()}`;

      const response = await fetch(url, {
        method: "GET",
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: "Failed to get job cells" }));
        return {
          success: false,
          message: errorData.detail || "Failed to get job cells",
          error: errorData.detail,
        };
      }

      const data = await response.json();

      if (data.success && data.data) {
        return {
          success: true,
          message: data.message,
          data: data.data,
        };
      }

      return {
        success: false,
        message: data.message || "Failed to get job cells",
        error: data.error,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  },

  /**
   * Update cell values in a completed job
   */
  async updateJobCells(
    jobId: string,
    updates: UpdateCellRequest[],
  ): Promise<
    APIResponse<{
      updated_count: number;
      valid_cells: number;
      warning_cells: number;
      error_cells: number;
    }>
  > {
    const token = getAuthToken();
    if (!token) {
      return {
        success: false,
        message: "Not authenticated",
        error: "No auth token",
      };
    }

    try {
      const backendUrl = getBackendUrl();
      const params = new URLSearchParams({ token });
      const url = backendUrl
        ? `${backendUrl}/api/agent-parse/jobs/${jobId}/cells?${params.toString()}`
        : `/api/agent-parse/jobs/${jobId}/cells?${params.toString()}`;

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: "Failed to update cells" }));
        return {
          success: false,
          message: errorData.detail || "Failed to update cells",
          error: errorData.detail,
        };
      }

      const data = await response.json();

      if (data.success && data.data) {
        return {
          success: true,
          message: data.message,
          data: data.data,
        };
      }

      return {
        success: false,
        message: data.message || "Failed to update cells",
        error: data.error,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  },

  /**
   * List agent parse jobs with optional filters
   */
  async listJobs(
    plantId?: string,
    status?: string,
    financialYear?: number,
    limit: number = 20,
  ): Promise<APIResponse<AgentParseJobSummary[]>> {
    const token = getAuthToken();
    if (!token) {
      return {
        success: false,
        message: "Not authenticated",
        error: "No auth token",
      };
    }

    try {
      const backendUrl = getBackendUrl();
      const params = new URLSearchParams({ token, limit: limit.toString() });
      if (plantId) params.append("plant_id", plantId);
      if (status) params.append("status", status);
      if (financialYear) params.append("financial_year", financialYear.toString());

      const url = backendUrl
        ? `${backendUrl}/api/agent-parse/jobs?${params.toString()}`
        : `/api/agent-parse/jobs?${params.toString()}`;

      const response = await fetch(url, {
        method: "GET",
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: "Failed to list jobs" }));
        return {
          success: false,
          message: errorData.detail || "Failed to list jobs",
          error: errorData.detail,
        };
      }

      const data = await response.json();

      if (data.success && data.data) {
        return {
          success: true,
          message: data.message,
          data: data.data,
        };
      }

      return {
        success: false,
        message: data.message || "Failed to list jobs",
        error: data.error,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  },

  /**
   * Submit parsed data to the logbook approval workflow
   */
  async submitToWorkflow(
    jobId: string,
    notes?: string,
  ): Promise<APIResponse<SubmitResponse>> {
    const token = getAuthToken();
    if (!token) {
      return {
        success: false,
        message: "Not authenticated",
        error: "No auth token",
      };
    }

    try {
      const backendUrl = getBackendUrl();
      const params = new URLSearchParams({ token });
      const url = backendUrl
        ? `${backendUrl}/api/agent-parse/jobs/${jobId}/submit?${params.toString()}`
        : `/api/agent-parse/jobs/${jobId}/submit?${params.toString()}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: notes || null }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: "Failed to submit to workflow" }));
        return {
          success: false,
          message: errorData.detail || "Failed to submit to workflow",
          error: errorData.detail,
        };
      }

      const data = await response.json();

      if (data.success && data.data) {
        return {
          success: true,
          message: data.message,
          data: data.data,
        };
      }

      return {
        success: false,
        message: data.message || "Failed to submit to workflow",
        error: data.error,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  },
};
