/**
 * GEI (GHG Emissions Intensity) API methods
 */
import { apiClient, APIResponse } from "./client";
import { GeiDataPoint } from "@/lib/types";

export interface PlantGEITrend {
  plant_id: string;
  plant_name: string;
  financial_year: number;
  monthly_data: GeiDataPoint[];
}

export interface PlantGEISummary {
  plant_id: string;
  plant_name: string;
  average_gei: number;
  latest_gei: number;
  monthly_data: GeiDataPoint[];
}

export interface OrganizationGEISummary {
  organization_id: string;
  financial_year: number;
  plant_count: number;
  plants: PlantGEISummary[];
}

export const geiApi = {
  /**
   * Get 12-month GEI trend for a specific plant
   */
  async getPlantTrend(
    plantId: string,
    financialYear: number = 2024,
    isPredicted: boolean = false,
  ): Promise<APIResponse<PlantGEITrend>> {
    const params = new URLSearchParams({
      financial_year: financialYear.toString(),
      is_predicted: isPredicted.toString(),
    });

    return apiClient.get<PlantGEITrend>(
      `/api/gei/plant/${plantId}/trend?${params.toString()}`,
    );
  },

  /**
   * Get aggregated GEI summary for all plants in an organization
   */
  async getOrganizationSummary(
    organizationId: string,
    financialYear: number = 2024,
    isPredicted: boolean = false,
  ): Promise<APIResponse<OrganizationGEISummary>> {
    const params = new URLSearchParams({
      financial_year: financialYear.toString(),
      is_predicted: isPredicted.toString(),
    });

    return apiClient.get<OrganizationGEISummary>(
      `/api/gei/organization/${organizationId}/summary?${params.toString()}`,
    );
  },

  /**
   * Get GEI value for a specific month
   */
  async getPlantMonthGEI(
    plantId: string,
    month: number,
    financialYear: number = 2024,
    isPredicted: boolean = false,
  ): Promise<APIResponse<any>> {
    const params = new URLSearchParams({
      financial_year: financialYear.toString(),
      is_predicted: isPredicted.toString(),
    });

    return apiClient.get<any>(
      `/api/gei/plant/${plantId}/month/${month}?${params.toString()}`,
    );
  },
};
