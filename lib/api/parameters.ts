import { apiClient, type APIResponse } from "./client";

export enum ParamCategory {
  INPUT = "input",
  OUTPUT = "output",
  EMISSION = "emission",
}

export interface DynamicParameter {
  id: string;
  org_id: string;
  name: string;
  display_name: string;
  unit: string;
  category: ParamCategory;
  section?: string;
  data_source?: string;
  is_calculated: boolean;
  applicable_asset_types: string[];
  legacy_param_type?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateParameterRequest {
  org_id: string;
  name: string;
  display_name: string;
  unit: string;
  category: ParamCategory;
  section?: string;
  data_source?: string;
  is_calculated?: boolean;
  applicable_asset_types?: string[];
}

export interface UpdateParameterRequest {
  display_name?: string;
  unit?: string;
  category?: ParamCategory;
  section?: string;
  data_source?: string;
  is_calculated?: boolean;
  applicable_asset_types?: string[];
}

export const parametersApi = {
  /**
   * Get all parameters for an organization
   */
  getAll: async (filters?: {
    org_id?: string;
    category?: ParamCategory;
    section?: string;
    is_calculated?: boolean;
  }): Promise<APIResponse<DynamicParameter[]>> => {
    const params = new URLSearchParams();
    if (filters?.org_id) params.append("org_id", filters.org_id);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.section) params.append("section", filters.section);
    if (filters?.is_calculated !== undefined) {
      params.append("is_calculated", String(filters.is_calculated));
    }

    const queryString = params.toString();
    const endpoint = queryString
      ? `/api/dynamic-params?${queryString}`
      : "/api/dynamic-params";

    return apiClient.get<DynamicParameter[]>(endpoint);
  },

  /**
   * Get parameters for an organization by org_id
   */
  getByOrg: async (
    orgId: string,
    category?: ParamCategory,
  ): Promise<APIResponse<DynamicParameter[]>> => {
    const params = new URLSearchParams();
    if (category) params.append("category", category);
    return apiClient.get<DynamicParameter[]>(
      `/api/dynamic-params/org/${orgId}?${params.toString()}`,
    );
  },

  /**
   * Get parameters linked to a plant
   */
  getByPlant: async (
    plantId: string,
    orgId: string,
    category?: ParamCategory,
  ): Promise<APIResponse<DynamicParameter[]>> => {
    const params = new URLSearchParams();
    params.append("org_id", orgId);
    if (category) params.append("category", category);
    return apiClient.get<DynamicParameter[]>(
      `/api/dynamic-params/plant/${plantId}?${params.toString()}`,
    );
  },

  /**
   * Get a single parameter by ID
   */
  getById: async (id: string): Promise<APIResponse<DynamicParameter>> => {
    return apiClient.get<DynamicParameter>(`/api/dynamic-params/${id}`);
  },

  /**
   * Create a new parameter
   */
  create: async (
    request: CreateParameterRequest,
  ): Promise<APIResponse<DynamicParameter>> => {
    return apiClient.post<DynamicParameter>("/api/dynamic-params", request);
  },

  /**
   * Update a parameter
   */
  update: async (
    id: string,
    request: UpdateParameterRequest,
  ): Promise<APIResponse<DynamicParameter>> => {
    return apiClient.put<DynamicParameter>(
      `/api/dynamic-params/${id}`,
      request,
    );
  },

  /**
   * Delete a parameter
   */
  delete: async (id: string): Promise<APIResponse<{ message: string }>> => {
    return apiClient.delete(`/api/dynamic-params/${id}`);
  },

  /**
   * Link a parameter to a plant
   */
  linkToPlant: async (
    paramId: string,
    plantId: string,
  ): Promise<APIResponse<unknown>> => {
    return apiClient.post(
      `/api/dynamic-params/${paramId}/link/plant/${plantId}`,
      {},
    );
  },

  /**
   * Unlink a parameter from a plant
   */
  unlinkFromPlant: async (
    paramId: string,
    plantId: string,
  ): Promise<APIResponse<unknown>> => {
    return apiClient.delete(
      `/api/dynamic-params/${paramId}/link/plant/${plantId}`,
    );
  },
};
