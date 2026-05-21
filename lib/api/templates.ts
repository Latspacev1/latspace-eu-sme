/**
 * Templates API - Deterministic Excel template generation and parsing
 */
import { APIResponse, getBackendUrl } from "./client";
import { useAppStore } from "../store/useAppStore";

// Types for template operations
export interface GenerateTemplateRequest {
  plant_id: string;
  financial_year: number;
  month?: number;
}

export interface ParseUploadResponse {
  upload_record_id: string;
  filename: string;
  total_cells: number;
  valid_cells: number;
  warning_cells: number;
  error_cells: number;
  validation_errors: string[];
  anomalies: AnomalyInfo[];
  schema_match: boolean | null;
  status: string;
}

export interface AnomalyInfo {
  field_name: string;
  current_value: number;
  moving_average: number;
  deviation_percentage: number;
  severity: "warning" | "critical";
  lookback_months: number;
}

export interface ParsedCellData {
  cell_ref: string;
  row: number;
  col: number;
  param_id: string;
  param_name: string;
  param_display_name: string;
  param_unit: string | null;
  param_category: "input" | "output" | "emission" | null;
  is_calculated: boolean;
  asset_id: string | null;
  asset_name: string | null;
  raw_value: number | string | null;
  parsed_value: number | null;
  validation_status: "valid" | "warning" | "error";
  validation_message: string | null;
}

export interface DeterministicUploadRecord {
  id: string;
  plant_id: string;
  org_id: string;
  uploaded_by: string;
  filename: string;
  file_hash: string;
  schema_hash: string;
  financial_year: number;
  month: number;
  template_generated_at: string | null;
  parsed_at: string;
  total_cells: number;
  valid_cells: number;
  warning_cells: number;
  error_cells: number;
  validation_errors: string[];
  anomalies_detected: AnomalyInfo[];
  parsed_cells: ParsedCellData[];
  status: string;
  logbook_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadRecordSummary {
  id: string;
  filename: string;
  plant_id: string;
  financial_year: number;
  month: number;
  status: string;
  total_cells: number;
  valid_cells: number;
  error_cells: number;
  anomalies_count: number;
  created_at: string;
}

export interface SchemaHashResponse {
  plant_id: string;
  schema_hash: string;
  param_count: number;
  asset_count: number;
}

export interface SubmitResponse {
  logbook_entry_id: string;
  status: string;
  period: string;
}

export interface DetailedUploadResponse {
  upload_record_id: string;
  filename: string;
  financial_year: number;
  month: number;
  total_cells: number;
  valid_cells: number;
  warning_cells: number;
  error_cells: number;
  validation_errors: string[];
  anomalies: AnomalyInfo[];
  status: string;
  parsed_cells: ParsedCellData[];
}

export interface UpdateCellRequest {
  cell_ref: string;
  new_value: number;
}

export interface UpdateCellsResponse {
  updated_count: number;
  valid_cells: number;
  warning_cells: number;
  error_cells: number;
}

export interface ExistingDataEntry {
  id: string;
  period: string;
  status: string;
  submitted_by: string;
  submitted_at: string | null;
}

export interface CheckExistingDataResponse {
  exists: boolean;
  period: string;
  entries: ExistingDataEntry[];
}

// Helper to get auth token
function getAuthToken(): string | null {
  try {
    const state = useAppStore.getState();
    return state.token || null;
  } catch {
    return null;
  }
}

export const templatesApi = {
  /**
   * Generate an Excel template for a plant
   * Returns a blob that can be downloaded
   */
  async generateTemplate(
    plantId: string,
    financialYear: number,
    month?: number,
  ): Promise<
    { blob: Blob; filename: string; schemaHash: string } | { error: string }
  > {
    const token = getAuthToken();
    if (!token) {
      return { error: "Not authenticated" };
    }

    const baseUrl = getBackendUrl();
    const params = new URLSearchParams({
      token: token,
    });

    const body: GenerateTemplateRequest = {
      plant_id: plantId,
      financial_year: financialYear,
    };
    if (month) {
      body.month = month;
    }

    try {
      const response = await fetch(
        `${baseUrl}/api/templates/generate?${params.toString()}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { error: errorData.detail || "Failed to generate template" };
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `template_FY${financialYear}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) {
          filename = match[1];
        }
      }
      const schemaHash = response.headers.get("X-Schema-Hash") || "";

      return { blob, filename, schemaHash };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  },

  /**
   * Parse an uploaded Excel file
   */
  async parseUpload(
    file: File,
    plantId: string,
    financialYear: number,
    month: number,
  ): Promise<APIResponse<ParseUploadResponse>> {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: "Not authenticated" };
    }

    const baseUrl = getBackendUrl();
    const params = new URLSearchParams({
      token: token,
      plant_id: plantId,
      financial_year: financialYear.toString(),
      month: month.toString(),
    });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${baseUrl}/api/templates/parse?${params.toString()}`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.detail || "Failed to parse file",
          error: data.detail,
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
        error: "Network error",
      };
    }
  },

  /**
   * Get upload record details
   */
  async getUploadRecord(
    uploadId: string,
  ): Promise<APIResponse<DeterministicUploadRecord>> {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: "Not authenticated" };
    }

    const baseUrl = getBackendUrl();
    const params = new URLSearchParams({ token });

    try {
      const response = await fetch(
        `${baseUrl}/api/templates/uploads/${uploadId}?${params.toString()}`,
        { method: "GET" },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.detail || "Failed to get upload record",
          error: data.detail,
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
        error: "Network error",
      };
    }
  },

  /**
   * List upload records
   */
  async listUploads(
    plantId?: string,
    status?: string,
    financialYear?: number,
    limit: number = 20,
  ): Promise<APIResponse<UploadRecordSummary[]>> {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: "Not authenticated" };
    }

    const baseUrl = getBackendUrl();
    const params = new URLSearchParams({ token, limit: limit.toString() });
    if (plantId) params.append("plant_id", plantId);
    if (status) params.append("status", status);
    if (financialYear)
      params.append("financial_year", financialYear.toString());

    try {
      const response = await fetch(
        `${baseUrl}/api/templates/uploads?${params.toString()}`,
        { method: "GET" },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.detail || "Failed to list uploads",
          error: data.detail,
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
        error: "Network error",
      };
    }
  },

  /**
   * Submit parsed data to the logbook workflow
   */
  async submitToWorkflow(
    uploadId: string,
    notes?: string,
  ): Promise<APIResponse<SubmitResponse>> {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: "Not authenticated" };
    }

    const baseUrl = getBackendUrl();
    const params = new URLSearchParams({ token });

    try {
      const response = await fetch(
        `${baseUrl}/api/templates/uploads/${uploadId}/submit?${params.toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.detail || "Failed to submit",
          error: data.detail,
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
        error: "Network error",
      };
    }
  },

  /**
   * Get schema hash for a plant
   */
  async getSchemaHash(
    plantId: string,
  ): Promise<APIResponse<SchemaHashResponse>> {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: "Not authenticated" };
    }

    const baseUrl = getBackendUrl();
    const params = new URLSearchParams({ token });

    try {
      const response = await fetch(
        `${baseUrl}/api/templates/schema-hash/${plantId}?${params.toString()}`,
        { method: "GET" },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.detail || "Failed to get schema hash",
          error: data.detail,
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
        error: "Network error",
      };
    }
  },

  /**
   * Get detailed parsed cells for an upload record
   */
  async getUploadCells(
    uploadId: string,
    filterStatus?: "valid" | "warning" | "error",
  ): Promise<APIResponse<DetailedUploadResponse>> {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: "Not authenticated" };
    }

    const baseUrl = getBackendUrl();
    const params = new URLSearchParams({ token });
    if (filterStatus) {
      params.append("filter_status", filterStatus);
    }

    try {
      const response = await fetch(
        `${baseUrl}/api/templates/uploads/${uploadId}/cells?${params.toString()}`,
        { method: "GET" },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.detail || "Failed to get upload cells",
          error: data.detail,
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
        error: "Network error",
      };
    }
  },

  /**
   * Update cell values in an upload record
   */
  async updateUploadCells(
    uploadId: string,
    updates: UpdateCellRequest[],
  ): Promise<APIResponse<UpdateCellsResponse>> {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: "Not authenticated" };
    }

    const baseUrl = getBackendUrl();
    const params = new URLSearchParams({ token });

    try {
      const response = await fetch(
        `${baseUrl}/api/templates/uploads/${uploadId}/cells?${params.toString()}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.detail || "Failed to update cells",
          error: data.detail,
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
        error: "Network error",
      };
    }
  },

  /**
   * Check if data already exists for a plant/year/month
   * Used to warn users before overwriting existing data
   * @param isCalendarMonth - If true, month is calendar month (1=Jan). If false, month is FY month (1=April).
   */
  async checkExistingData(
    plantId: string,
    financialYear: number,
    month: number,
    isCalendarMonth: boolean = false,
  ): Promise<APIResponse<CheckExistingDataResponse>> {
    const token = getAuthToken();
    if (!token) {
      return { success: false, message: "Not authenticated" };
    }

    const baseUrl = getBackendUrl();
    const params = new URLSearchParams({
      token,
      plant_id: plantId,
      financial_year: financialYear.toString(),
      month: month.toString(),
      is_calendar_month: isCalendarMonth.toString(),
    });

    try {
      const response = await fetch(
        `${baseUrl}/api/templates/check-existing-data?${params.toString()}`,
        { method: "GET" },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.detail || "Failed to check existing data",
          error: data.detail,
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
        error: "Network error",
      };
    }
  },
};

// =============================================================================
// SAP Parsing Types
// =============================================================================

export interface SapElectricityResult {
  purchased_grid_kwh: number | null;
  renewable_wheeling_kwh: number | null;
  exported_to_grid_kwh: number | null;
  whr_gross_kwh: number | null;
  purchased_grid_lakh_kwh: number | null;
  renewable_wheeling_lakh_kwh: number | null;
  exported_to_grid_lakh_kwh: number | null;
  whr_gross_lakh_kwh: number | null;
  month: number;
  financial_year: number | null;
  plant_name: string | null;
  source_file: string;
  parse_warnings: string[];
}

export interface FuelQuantityByAsset {
  asset_name: string;
  quantity: number | null;
  unit: string;
  source_rows: number[];
}

export interface FuelNcvByAsset {
  asset_name: string;
  ncv_value: number | null;
  weighted_components: [number, number, number][];
}

export interface SapFuelResult {
  solid_fuel_process: FuelQuantityByAsset[];
  solid_fuel_power_gen: FuelQuantityByAsset[];
  liquid_fuel_dg_set: FuelQuantityByAsset[];
  liquid_fuel_cpp: FuelQuantityByAsset[];
  liquid_fuel_internal_transport: FuelQuantityByAsset[];
  ncv_kiln: FuelNcvByAsset[];
  ncv_power_gen: FuelNcvByAsset[];
  month: number;
  financial_year: number | null;
  source_file: string;
  parse_warnings: string[];
}

// =============================================================================
// SAP Parsing API Methods
// =============================================================================

/**
 * Parse SAP Electricity 302-1E Excel file for a specific month.
 */
export async function parseSapElectricity(
  file: File,
  month: number,
): Promise<SapElectricityResult> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const baseUrl = getBackendUrl();
  const params = new URLSearchParams({ token });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("month", month.toString());

  const response = await fetch(
    `${baseUrl}/api/sap/parse-electricity?${params.toString()}`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Parse failed" }));
    throw new Error(error.detail || "Failed to parse electricity file");
  }

  return response.json();
}

/**
 * Parse SAP Fuel 302 Excel file for a specific month.
 */
export async function parseSapFuel(
  file: File,
  month: number,
): Promise<SapFuelResult> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const baseUrl = getBackendUrl();
  const params = new URLSearchParams({ token });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("month", month.toString());

  const response = await fetch(
    `${baseUrl}/api/sap/parse-fuel?${params.toString()}`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Parse failed" }));
    throw new Error(error.detail || "Failed to parse fuel file");
  }

  return response.json();
}

/**
 * Generate pre-filled template from SAP data.
 *
 * @param plantId - Plant ID
 * @param financialYear - Financial year (e.g., 2024)
 * @param month - FY month (1=April, 12=March), or undefined for all 12 months as ZIP
 * @param electricityFile - Optional SAP Electricity file
 * @param fuelFile - Optional SAP Fuel file
 * @returns Blob and filename for download
 */
export async function generatePrefilledTemplate(
  plantId: string,
  financialYear: number,
  month?: number,
  electricityFile?: File,
  fuelFile?: File,
): Promise<{ blob: Blob; filename: string }> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const baseUrl = getBackendUrl();
  const params = new URLSearchParams({ token });

  const formData = new FormData();
  formData.append("plant_id", plantId);
  formData.append("financial_year", financialYear.toString());
  if (month !== undefined) {
    formData.append("month", month.toString());
  }
  if (electricityFile) {
    formData.append("electricity_file", electricityFile);
  }
  if (fuelFile) {
    formData.append("fuel_file", fuelFile);
  }

  const response = await fetch(
    `${baseUrl}/api/sap/generate-prefilled-template?${params.toString()}`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "Generation failed" }));
    throw new Error(error.detail || "Failed to generate prefilled template");
  }

  // Extract filename from Content-Disposition header
  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = month
    ? `template_FY${financialYear}_M${month.toString().padStart(2, "0")}_prefilled.xlsx`
    : `template_FY${financialYear}_yearly_prefilled.xlsx`;

  if (contentDisposition) {
    const match = contentDisposition.match(/filename="(.+)"/);
    if (match) {
      filename = match[1];
    }
  }

  const blob = await response.blob();
  return { blob, filename };
}
