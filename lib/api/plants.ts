/**
 * Plants API methods (mapped to sites in frontend)
 */
import { apiClient, APIResponse } from "./client";
import type { Site, Sector } from "../types";

export interface Plant {
  id: string;
  name: string;
  description: string;
  address: string;
  plant_emission_params: string[];
  plant_output_params: string[];
  organization_id: string;
  registration_number?: string;
  sector?: string;
  sub_sector?: string;
  baseline_product_output?: number;
  baseline_year?: number;
  baseline_gei?: number;
  target_year?: number;
  target_gei?: number;
  target_reduction_pct?: number;
  created_at: string;
  updated_at: string;
}

export interface PlantKPIs {
  plant_id: string;
  plant_name: string;
  baseline_gei: number | null;
  baseline_year: number;
  current_gei: number | null;
  current_period: string | null;
  target_gei: number | null;
  target_year: number;
  target_status: "ON_TRACK" | "NEAR_TARGET" | "OFF_TRACK" | "NO_DATA";
  variance_percentage: number | null;
  has_data: boolean;
  baseline_configured?: boolean;
  target_configured?: boolean;
  ytd_production: number | null;
}

export interface PlantSettings {
  plant_id: string;
  plant_name: string;
  available_years: number[];
  selectable_years: number[];
  has_gei_data: boolean;
  baseline: {
    year: number | null;
    gei: number | null;
    configured_by: string | null;
    configured_by_name: string | null;
    configured_at: string | null;
  };
  target: {
    year: number | null;
    gei: number | null;
    reduction_pct: number | null;
    configured_by: string | null;
    configured_by_name: string | null;
    configured_at: string | null;
  };
}

export interface YearGEI {
  year: number;
  average_gei: number;
  data_points: number;
  min_gei: number;
  max_gei: number;
  is_complete: boolean;
  months_present: number[];
  missing_months: number[];
}

export interface AvailableYears {
  available_years: number[];
  selectable_years: number[];
  has_data: boolean;
  earliest_year: number | null;
  latest_year: number | null;
}

export interface SetBaselineRequest {
  baseline_year: number;
  baseline_gei?: number;
}

export interface SetTargetRequest {
  target_year: number;
  target_gei?: number;
  target_reduction_pct?: number;
}

export interface BaselineUploadMonthStatus {
  fy_month: number;
  calendar_month: number;
  label: string;
  status:
    | "not_started"
    | "pending_review"
    | "reviewed"
    | "in_logbook"
    | "approved"
    | "failed";
  has_committed_data: boolean;
  latest_upload: {
    id: string;
    filename: string;
    status: string;
    total_cells: number;
    valid_cells: number;
    error_cells: number;
    created_at: string | null;
  } | null;
}

export interface BaselineUploadStatus {
  plant_id: string;
  plant_name: string;
  baseline_year: number | null;
  baseline_gei: number | null;
  all_months_committed: boolean;
  months: BaselineUploadMonthStatus[];
}

export interface CreatePlantRequest {
  name: string;
  description: string;
  address: string;
  plant_emission_params: string[];
  organization_id: string;
}

export interface UpdatePlantRequest {
  name?: string;
  description?: string;
  address?: string;
  plant_emission_params?: string[];
}

/**
 * Transform backend plant to frontend site
 */
function transformPlantToSite(plant: any): Site {
  // Handle both dict and object formats, and both id and _id fields
  const id =
    plant.id ||
    plant._id ||
    (typeof plant.id === "object" ? String(plant.id) : plant.id);
  const orgId =
    plant.organization_id ||
    plant.organizationId ||
    (typeof plant.organization_id === "object"
      ? String(plant.organization_id)
      : plant.organization_id);

  return {
    id: String(id),
    name: plant.name || "",
    sector: (plant.sector as Sector) || "Cement",
    bu: plant.sub_sector || "Default BU",
    region: plant.address || "Default Region",
    baselineYear: plant.baseline_year || 2020,
    gridRegion: "Default Grid",
    companyId: String(orgId),
    registrationNumber: plant.registration_number,
    subSector: plant.sub_sector,
    baselineProductOutput: plant.baseline_product_output,
    baselineGei: plant.baseline_gei,
    targetYear: plant.target_year,
    targetGei: plant.target_gei,
    targetReductionPct: plant.target_reduction_pct,
  };
}

export const plantsApi = {
  /**
   * Get all plants (sites)
   */
  async getAll(filters?: {
    name?: string;
    description?: string;
    address?: string;
    organization_id?: string;
  }): Promise<APIResponse<Site[]>> {
    const params = new URLSearchParams();
    if (filters?.name) params.append("name", filters.name);
    if (filters?.description) params.append("description", filters.description);
    if (filters?.address) params.append("address", filters.address);
    if (filters?.organization_id)
      params.append("organization_id", filters.organization_id);

    const endpoint = `/api/plants${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await apiClient.get<Plant[]>(endpoint);

    if (response.success && response.data) {
      const sites = Array.isArray(response.data)
        ? response.data.map(transformPlantToSite)
        : [];
      return {
        success: response.success,
        message: response.message,
        data: sites,
        error: response.error,
      };
    }

    return {
      success: false,
      message: response.message || "Failed to fetch plants",
      error: response.error,
    };
  },

  /**
   * Get plant by ID
   */
  async getById(plantId: string): Promise<APIResponse<Site>> {
    const response = await apiClient.get<Plant>(`/api/plants/${plantId}`);

    if (response.success && response.data) {
      return {
        success: response.success,
        message: response.message,
        data: transformPlantToSite(response.data),
        error: response.error,
      };
    }

    return {
      success: false,
      message: response.message || "Failed to fetch plant",
      error: response.error,
    };
  },

  /**
   * Create plant
   */
  async create(request: CreatePlantRequest): Promise<APIResponse<Site>> {
    const response = await apiClient.post<Plant>("/api/plants", request);

    if (response.success && response.data) {
      return {
        success: response.success,
        message: response.message,
        data: transformPlantToSite(response.data),
        error: response.error,
      };
    }

    return {
      success: false,
      message: response.message || "Failed to create plant",
      error: response.error,
    };
  },

  /**
   * Update plant
   */
  async update(
    plantId: string,
    request: UpdatePlantRequest,
  ): Promise<APIResponse<Site>> {
    const response = await apiClient.put<Plant>(
      `/api/plants/${plantId}`,
      request,
    );

    if (response.success && response.data) {
      return {
        success: response.success,
        message: response.message,
        data: transformPlantToSite(response.data),
        error: response.error,
      };
    }

    return {
      success: false,
      message: response.message || "Failed to update plant",
      error: response.error,
    };
  },

  /**
   * Delete plant
   */
  async delete(plantId: string): Promise<APIResponse> {
    return apiClient.delete(`/api/plants/${plantId}`);
  },

  /**
   * Get plant metrics with emission data
   */
  async getMetrics(
    plantId: string,
    financial_year?: number,
    month?: number,
  ): Promise<APIResponse<any>> {
    const params = new URLSearchParams();
    if (financial_year)
      params.append("financial_year", financial_year.toString());
    if (month) params.append("month", month.toString());

    const endpoint = `/api/plants/${plantId}/metrics${params.toString() ? `?${params.toString()}` : ""}`;
    return apiClient.get<any>(endpoint);
  },

  /**
   * Get raw plant data including output params
   */
  async getRawById(plantId: string): Promise<APIResponse<Plant>> {
    const response = await apiClient.get<any>(`/api/plants/${plantId}`);

    if (response.success && response.data) {
      const plant = response.data;
      const id =
        plant.id ||
        plant._id ||
        (typeof plant.id === "object" ? String(plant.id) : plant.id);
      const orgId =
        plant.organization_id ||
        plant.organizationId ||
        (typeof plant.organization_id === "object"
          ? String(plant.organization_id)
          : plant.organization_id);

      return {
        success: response.success,
        message: response.message,
        data: {
          id: String(id),
          name: plant.name || "",
          description: plant.description || "",
          address: plant.address || "",
          plant_emission_params: plant.plant_emission_params || [],
          plant_output_params: plant.plant_output_params || [],
          organization_id: String(orgId),
          created_at: plant.created_at || "",
          updated_at: plant.updated_at || "",
        },
        error: response.error,
      };
    }

    return {
      success: false,
      message: response.message || "Failed to fetch plant",
      error: response.error,
    };
  },

  /**
   * Get plant KPIs including baseline GEI, current GEI, target GEI
   */
  async getKPIs(
    plantId: string,
    baselineYear?: number,
    targetYear?: number,
  ): Promise<APIResponse<PlantKPIs>> {
    const params = new URLSearchParams();
    if (baselineYear) params.append("baseline_year", baselineYear.toString());
    if (targetYear) params.append("target_year", targetYear.toString());

    const endpoint = `/api/plants/${plantId}/kpis${params.toString() ? `?${params.toString()}` : ""}`;
    return apiClient.get<PlantKPIs>(endpoint);
  },

  // ============== Plant Settings API ==============

  /**
   * Get plant settings including baseline and target configuration
   */
  async getSettings(plantId: string): Promise<APIResponse<PlantSettings>> {
    return apiClient.get<PlantSettings>(`/api/plants/${plantId}/settings`);
  },

  /**
   * Get available years that have GEI data for baseline/target selection
   */
  async getAvailableYears(
    plantId: string,
  ): Promise<APIResponse<AvailableYears>> {
    return apiClient.get<AvailableYears>(
      `/api/plants/${plantId}/available-years`,
    );
  },

  /**
   * Get the average GEI for a specific year (for preview when selecting baseline year)
   */
  async getYearGEI(
    plantId: string,
    year: number,
  ): Promise<APIResponse<YearGEI>> {
    return apiClient.get<YearGEI>(`/api/plants/${plantId}/year-gei/${year}`);
  },

  async getBaselineUploadStatus(
    plantId: string,
  ): Promise<APIResponse<BaselineUploadStatus>> {
    return apiClient.get<BaselineUploadStatus>(
      `/api/plants/${plantId}/baseline-upload-status`,
    );
  },

  /**
   * Set the baseline year for a plant (auto-calculates GEI as average of that year)
   * Can be done by Plant Head or Corp Head
   */
  async setBaseline(
    plantId: string,
    request: SetBaselineRequest,
    userId: string,
  ): Promise<
    APIResponse<{
      plant_id: string;
      baseline_year: number;
      baseline_gei: number;
      configured_at: string;
    }>
  > {
    return apiClient.put(`/api/plants/${plantId}/baseline`, request, {
      headers: { "X-User-Id": userId },
    });
  },

  /**
   * Set the target year and GEI for a plant
   * Can provide either target_gei (absolute) or target_reduction_pct (percentage from baseline)
   * Can only be done by Corp Head
   */
  async setTarget(
    plantId: string,
    request: SetTargetRequest,
    userId: string,
  ): Promise<
    APIResponse<{
      plant_id: string;
      target_year: number;
      target_gei: number;
      target_reduction_pct: number;
      configured_at: string;
    }>
  > {
    return apiClient.put(`/api/plants/${plantId}/target`, request, {
      headers: { "X-User-Id": userId },
    });
  },

  /**
   * Get parameters linked to a plant
   * Uses unified dynamic-params endpoint with category filter
   */
  async getParameters(plantId: string): Promise<
    APIResponse<{
      emission_params: any[];
      output_params: any[];
    }>
  > {
    const [inputParams, outputParams] = await Promise.all([
      apiClient.get<any[]>(
        `/api/dynamic-params/plant/${plantId}?category=INPUT`,
      ),
      apiClient.get<any[]>(
        `/api/dynamic-params/plant/${plantId}?category=OUTPUT`,
      ),
    ]);

    if (inputParams.success && outputParams.success) {
      return {
        success: true,
        message: "Plant parameters retrieved successfully",
        data: {
          emission_params: inputParams.data || [],
          output_params: outputParams.data || [],
        },
      };
    }

    return {
      success: false,
      message: "Failed to fetch plant parameters",
      error: inputParams.error || outputParams.error,
    };
  },

  // ============== Compliance Cycle Start Date API ==============

  /**
   * Get the compliance cycle start date for a specific year
   */
  async getCycleStartDate(
    plantId: string,
    cycleYear: number,
  ): Promise<
    APIResponse<{
      plant_id: string;
      cycle_year: number;
      cycle_start_date: string | null;
    }>
  > {
    return apiClient.get(
      `/api/plants/${plantId}/cycle-start-date/${cycleYear}`,
    );
  },

  /**
   * Set the compliance cycle start date for a plant
   * Can only be done by Plant Manager
   */
  async setCycleStartDate(
    plantId: string,
    cycleYear: number,
    cycleStartDate: string,
    userId: string,
  ): Promise<
    APIResponse<{
      plant_id: string;
      cycle_year: number;
      cycle_start_date: string;
    }>
  > {
    return apiClient.put(
      `/api/plants/${plantId}/cycle-start-date`,
      {
        cycle_year: cycleYear,
        cycle_start_date: cycleStartDate,
      },
      {
        headers: { "X-User-Id": userId },
      },
    );
  },
};
