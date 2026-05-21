import { apiClient } from "@/lib/api/client";

export interface OutputData {
  id?: string;
  param_id?: string;
  param_type: string;
  asset_id?: string | null;
  plant_id: string;
  org_id: string;
  data_value: number;
  financial_year: number;
  month?: number | null;
  quarter?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface CalculateRequest {
  plant_id: string;
  financial_year: number;
  month?: number | null;
}

export interface OutputParameter {
  name: string;
  display_name: string;
  unit: string;
  asset_id: string | null;
  asset_name: string | null;
}

export const outputCalculationApi = {
  // calculate: POST /output-calculation/calculate
  calculate: async (data: CalculateRequest) => {
    return apiClient.post<any>("/api/output-calculation/calculate", data);
  },

  // calculateAndSave: POST /output-calculation/calculate-and-save
  calculateAndSave: async (data: CalculateRequest) => {
    return apiClient.post<any>(
      "/api/output-calculation/calculate-and-save",
      data,
    );
  },

  // getForPlant: GET /output-calculation/plant/{plant_id}
  getForPlant: async (
    plantId: string,
    financialYear: number,
    month?: number | null,
    assetId?: string | null,
  ) => {
    const params = new URLSearchParams();
    params.append("financial_year", financialYear.toString());
    if (month !== undefined && month !== null) {
      params.append("month", month.toString());
    }
    if (assetId) {
      params.append("asset_id", assetId);
    }
    return apiClient.get<OutputData[]>(
      `/api/output-calculation/plant/${plantId}?${params.toString()}`,
    );
  },

  // getTrend: GET /output-calculation/trend/{plant_id}
  getTrend: async (
    plantId: string,
    financialYear: number,
    paramType?: string,
    assetId?: string | null,
  ) => {
    const params = new URLSearchParams();
    params.append("financial_year", financialYear.toString());
    if (paramType) {
      params.append("param_type", paramType);
    }
    if (assetId) {
      params.append("asset_id", assetId);
    }
    return apiClient.get<OutputData[]>(
      `/api/output-calculation/trend/${plantId}?${params.toString()}`,
    );
  },

  // getParameters: GET /output-calculation/parameters
  getParameters: async (plantId?: string) => {
    const params = new URLSearchParams();
    if (plantId) params.append("plant_id", plantId);
    const endpoint = `/api/output-calculation/parameters${params.toString() ? `?${params.toString()}` : ""}`;
    return apiClient.get<OutputParameter[]>(endpoint);
  },
};
