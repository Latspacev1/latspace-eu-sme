// Core domain types
export type Sector = "Cement" | "Steel" | "Chemicals" | "PulpPaper";

export type UserRole = "GroupExec" | "CorporateHead" | "PlantManager" | "ItAdmin" | "SuperAdmin";

export type UploadStatus = "Processing" | "Completed" | "Failed";

// Time Series Point
export interface TimePoint {
    month: string;
    actual: number;
    target: number;
    intensity?: number;
}

// Filter state
export interface FilterState {
    year: number;
    sector?: Sector;
    bu?: string;
    region?: string;
    companyId?: string; // For filtering by company
}

// Allowance data
export interface AllowanceData {
    bu: string;
    sector: Sector;
    surplus_tco2e: number;
    deficit_tco2e: number;
}
