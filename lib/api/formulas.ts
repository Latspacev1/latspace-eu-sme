import { apiClient, APIResponse } from "./client";

export interface Formula {
  id: string;
  name: string;
  expression: string;
  output_param: string;
  description?: string;
  scope: string;
  status: string;
  plant_id?: string | null;
  version?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  dependencies?: {
    emission_params: string[];
    output_params: string[];
    conversion_factors: string[];
  };
}

export interface FormulaParamsResponse {
  emission_params: string[];
  output_params: string[];
  conversion_factors: string[];
  asset_params: Record<string, Record<string, string[]>>; // asset_type -> asset_name -> params[]
}

export const formulasApi = {
  update: async (
    formulaId: string,
    data: { name?: string; expression?: string; description?: string; scope?: string },
  ) => {
    const response = await apiClient.put<Formula>(`/api/formulas/${formulaId}`, data);
    return response;
  },

  list: async (status?: string, plantId?: string) => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (plantId) params.append("plant_id", plantId);
    const qs = params.toString();
    const response = await apiClient.get<Formula[]>(`/api/formulas${qs ? `?${qs}` : ""}`);
    return response;
  },

  getAvailableParams: async () => {
    const response = await apiClient.get<FormulaParamsResponse>(
      "/api/formulas/params/available",
    );
    return response;
  },

  create: async (data: {
    name: string;
    expression: string;
    output_param: string;
    description?: string;
    scope?: string;
    plant_id?: string | null;
  }) => {
    const response = await apiClient.post<Formula>("/api/formulas", data);
    return response;
  },

  validate: async (expression: string) => {
    const response = await apiClient.post<{
      valid: boolean;
      errors?: string[];
    }>("/api/formulas/validate", {
      expression,
    });
    return response;
  },

  preview: async (data: {
    expression: string;
    plant_id: string;
    financial_year: number;
    month?: number;
  }) => {
    const response = await apiClient.post<{
      result: number;
      provenance?: Record<string, {
        value: number;
        source: string;
        plant_override?: boolean;
        param_id?: string;
        formula_id?: string;
      }>;
      trace_steps?: Record<string, unknown>[];
    }>(
      "/api/formulas/preview",
      data,
    );
    return response;
  },

  // Bulk upload methods - token must be passed from component (from useAppStore)
  downloadTemplate: async (token: string) => {
    const response = await fetch("/api/formulas/bulk/template", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error("Failed to download template");
    return response.blob();
  },

  validateBulkUpload: async (file: File, token: string, plantId?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    const params = plantId ? `?plant_id=${plantId}` : "";
    const response = await fetch(`/api/formulas/bulk/validate${params}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    return response.json();
  },

  importBulkUpload: async (
    file: File,
    token: string,
    skipInvalid: boolean = true,
    plantId?: string,
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    const params = new URLSearchParams({ skip_invalid: String(skipInvalid) });
    if (plantId) params.append("plant_id", plantId);
    const response = await fetch(
      `/api/formulas/bulk/import?${params}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      },
    );
    return response.json();
  },

  importWithResolutions: async (
    file: File,
    token: string,
    resolutions: Record<
      string,
      {
        action: string;
        use_param?: string;
        unit?: string;
        display_name?: string;
        param_type?: string;
      }
    >,
    plantId?: string,
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("resolutions", JSON.stringify(resolutions));
    const params = plantId ? `?plant_id=${plantId}` : "";
    const response = await fetch(`/api/formulas/bulk/import-with-resolutions${params}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    return response.json();
  },
};
