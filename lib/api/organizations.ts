/**
 * Organizations API methods (mapped to companies in frontend)
 */
import { apiClient, APIResponse } from "./client";
import type { Company, CompanySummary, Sector } from "../types";

export interface Organization {
  id: string;
  name: string;
  description: string;
  address: string;
  org_emission_params: string[];
  email_domains?: string[];
  discord_webhook_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationRequest {
  name: string;
  description: string;
  address: string;
  org_emission_params: string[];
  email_domains?: string[];
  discord_webhook_url?: string | null;
}

export interface UpdateOrganizationRequest {
  name?: string;
  description?: string;
  address?: string;
  org_emission_params?: string[];
  email_domains?: string[];
  discord_webhook_url?: string | null;
}

/**
 * Transform backend organization to frontend company
 */
function transformOrganizationToCompany(org: any): Company {
  // Handle both dict and object formats, and both id and _id fields
  const id =
    org.id || org._id || (typeof org.id === "object" ? String(org.id) : org.id);

  return {
    id: String(id),
    name: org.name || "",
    sector: (org.sector as Sector) || "Cement",
    description: org.description || "",
    businessUnit: org.business_unit || "Default BU",
    organization_type: org.organization_type,
    pan_number: org.pan_number,
  };
}

/**
 * Transform backend organizations to frontend company summaries
 * Note: Aggregated metrics would need to be calculated from emission data
 */
function transformToCompanySummary(
  org: any,
  plants: any[] = [],
): CompanySummary {
  // Handle both dict and object formats, and both id and _id fields
  const id =
    org.id || org._id || (typeof org.id === "object" ? String(org.id) : org.id);

  return {
    id: String(id),
    name: org.name || "",
    sector: (org.sector as Sector) || "Cement",
    description: org.description || "",
    businessUnit: org.business_unit || "Default BU",
    organization_type: org.organization_type,
    pan_number: org.pan_number,
    plantCount: plants.length,
    totalEmissions_tco2e: 0, // Would need to calculate from emission data
    avgGei_tco2ePerTon: 0, // Would need to calculate from emission data
    yoyChangePct: 0, // Would need to calculate
    compliancePct: 0, // Would need to calculate
  };
}

export const organizationsApi = {
  /**
   * Get all organizations (companies)
   */
  async getAll(): Promise<APIResponse<Company[]>> {
    const response = await apiClient.get<Organization[]>("/api/organizations");

    if (response.success && response.data) {
      const companies = Array.isArray(response.data)
        ? response.data.map(transformOrganizationToCompany)
        : [];
      return {
        success: response.success,
        message: response.message,
        data: companies,
        error: response.error,
      };
    }

    return {
      success: false,
      message: response.message || "Failed to fetch organizations",
      error: response.error,
    };
  },

  /**
   * Get organization by ID
   */
  async getById(organizationId: string): Promise<APIResponse<Company>> {
    const response = await apiClient.get<Organization>(
      `/api/organizations/${organizationId}`,
    );

    if (response.success && response.data) {
      return {
        success: response.success,
        message: response.message,
        data: transformOrganizationToCompany(response.data),
        error: response.error,
      };
    }

    return {
      success: false,
      message: response.message || "Failed to fetch organization",
      error: response.error,
    };
  },

  /**
   * Get organization summaries with aggregated metrics
   * Note: This is a simplified version - full aggregation would require emission data
   */
  async getSummaries(): Promise<APIResponse<CompanySummary[]>> {
    const [orgsResponse, plantsResponse] = await Promise.all([
      apiClient.get<Organization[]>("/api/organizations"),
      apiClient.get<any[]>("/api/plants"),
    ]);

    if (orgsResponse.success && orgsResponse.data) {
      const organizations = Array.isArray(orgsResponse.data)
        ? orgsResponse.data
        : [];
      const plants =
        plantsResponse.success && Array.isArray(plantsResponse.data)
          ? plantsResponse.data
          : [];

      // Group plants by organization
      const plantsByOrg = plants.reduce(
        (acc, plant) => {
          const orgId =
            plant.organization_id ||
            plant.organizationId ||
            (typeof plant.organization_id === "object"
              ? String(plant.organization_id)
              : plant.organization_id);
          const orgIdStr = String(orgId);
          if (!acc[orgIdStr]) acc[orgIdStr] = [];
          acc[orgIdStr].push(plant);
          return acc;
        },
        {} as Record<string, any[]>,
      );

      const summaries = organizations.map((org: any) => {
        const orgId =
          org.id ||
          org._id ||
          (typeof org.id === "object" ? String(org.id) : org.id);
        return transformToCompanySummary(org, plantsByOrg[String(orgId)] || []);
      });

      return {
        success: true,
        message: "Organizations retrieved successfully",
        data: summaries,
      };
    }

    return {
      success: false,
      message: orgsResponse.message || "Failed to fetch organizations",
      error: orgsResponse.error,
    };
  },

  /**
   * Create organization
   */
  async create(
    request: CreateOrganizationRequest,
  ): Promise<APIResponse<Company>> {
    const response = await apiClient.post<Organization>(
      "/api/organizations",
      request,
    );

    if (response.success && response.data) {
      return {
        success: response.success,
        message: response.message,
        data: transformOrganizationToCompany(response.data),
        error: response.error,
      };
    }

    return {
      success: false,
      message: response.message || "Failed to create organization",
      error: response.error,
    };
  },

  /**
   * Update organization
   */
  async update(
    organizationId: string,
    request: UpdateOrganizationRequest,
  ): Promise<APIResponse<Company>> {
    const response = await apiClient.put<Organization>(
      `/api/organizations/${organizationId}`,
      request,
    );

    if (response.success && response.data) {
      return {
        success: response.success,
        message: response.message,
        data: transformOrganizationToCompany(response.data),
        error: response.error,
      };
    }

    return {
      success: false,
      message: response.message || "Failed to update organization",
      error: response.error,
    };
  },

  /**
   * Delete organization
   */
  async delete(organizationId: string): Promise<APIResponse> {
    return apiClient.delete(`/api/organizations/${organizationId}`);
  },
};
