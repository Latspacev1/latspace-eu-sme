/**
 * Plant Onboarding API
 *
 * Handles:
 * - Plant onboarding with manager credentials
 * - Creating plant manager credentials
 * - Getting plant managers
 * - Password reset for plant managers
 */
import { apiClient, APIResponse } from "./client";

export interface PlantManagerCredentials {
  user_id: string;
  username: string;
  email: string;
  password: string | null;
  is_existing_user: boolean;
  message?: string;
  plant_id?: string;
  plant_name?: string;
}

export interface PlantOnboardingResult {
  plant: {
    id: string;
    name: string;
    description: string;
    address: string;
    plant_emission_params: string[];
    plant_output_params: string[];
    organization_id: string;
    created_at: string;
    updated_at: string;
  };
  credentials: PlantManagerCredentials | null;
}

export interface OnboardPlantRequest {
  plant_name: string;
  plant_description: string;
  plant_address: string;
  organization_id: string;
  plant_emission_params?: string[];
  plant_output_params?: string[];
  manager_username?: string;
  manager_email?: string;
  manager_password?: string;
  // CCTS Onboarding fields
  registration_number?: string;
  sector?: string;
  sub_sector?: string;
  baseline_year?: number;
  baseline_gei?: number;
  baseline_product_output?: number;
  target_year?: number;
  target_gei?: number;
}

export interface CreatePlantManagerRequest {
  plant_id: string;
  manager_username: string;
  manager_email: string;
  manager_password?: string;
}

export interface ResetPasswordRequest {
  user_id: string;
  new_password?: string;
}

export interface PlantManager {
  user_id: string;
  username: string;
  email: string;
  created_at: string | null;
}

export interface PlantManagersResponse {
  plant_id: string;
  plant_name: string;
  managers: PlantManager[];
}

export const plantOnboardingApi = {
  /**
   * Onboard a new plant with optional plant manager credentials
   */
  async onboardPlant(
    request: OnboardPlantRequest,
  ): Promise<APIResponse<PlantOnboardingResult>> {
    return apiClient.post<PlantOnboardingResult>(
      "/api/plant-onboarding/onboard",
      request,
    );
  },

  /**
   * Create plant manager credentials for an existing plant
   */
  async createPlantManager(
    request: CreatePlantManagerRequest,
  ): Promise<APIResponse<PlantManagerCredentials>> {
    return apiClient.post<PlantManagerCredentials>(
      "/api/plant-onboarding/create-manager",
      request,
    );
  },

  /**
   * Get all plant managers for a specific plant
   */
  async getPlantManagers(
    plantId: string,
  ): Promise<APIResponse<PlantManagersResponse>> {
    return apiClient.get<PlantManagersResponse>(
      `/api/plant-onboarding/plant/${plantId}/managers`,
    );
  },

  /**
   * Reset plant manager password
   */
  async resetPassword(
    request: ResetPasswordRequest,
  ): Promise<APIResponse<PlantManagerCredentials>> {
    return apiClient.post<PlantManagerCredentials>(
      "/api/plant-onboarding/reset-password",
      request,
    );
  },
};
