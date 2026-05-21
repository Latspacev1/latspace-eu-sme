import type { Sector, TimePoint, UploadStatus } from "./common";
import type { ComplianceItem, ComplianceStatus } from "./compliance";

// Company Entity
export interface Company {
    id: string;
    name: string;
    sector: Sector;
    description?: string;
    businessUnit: string; // e.g., "Cement Division", "Steel Division"
    headquarters?: string;
    establishedYear?: number;
    // CCTS specific
    organization_type?: string;
    pan_number?: string;
}

// Company Summary (for company list/cards)
export interface CompanySummary extends Company {
    plantCount: number;
    totalEmissions_tco2e: number;
    avgGei_tco2ePerTon: number;
    yoyChangePct: number; // year-over-year GEI change
    compliancePct: number; // % of compliant items
}

// Company KPI Summary (for company dashboard)
export interface CompanyKpiSummary {
    year: number;
    totalEmissions_tco2e: number;
    avgIntensity_tco2ePerTon: number;
    totalTarget_tco2e: number;
    variancePct: number;
    allowancePosition_tco2e: number;
    financialExposure_inr: number;
    onTimeCompliancePct: number;
    plantCount: number;
}

// Site Entity
export interface Site {
    id: string;
    name: string;
    sector: Sector;
    bu: string;
    region: string;
    baselineYear: number;
    gridRegion: string;
    companyId: string; // Reference to parent company
    // CCTS Registration fields
    registrationNumber?: string;
    subSector?: string;
    baselineProductOutput?: number;
    baselineGei?: number;
    targetYear?: number;
    targetGei?: number;
    targetReductionPct?: number;
}

// KPI Summary
export interface KpiSummary {
    year: number;
    emissionsYtd_tco2e: number;
    targetYtd_tco2e: number;
    variancePct: number; // (actual-target)/target
    allowancePosition_tco2e: number; // +surplus, -deficit
    financialExposure_inr: number;
    onTimeCompliancePct: number;
}

// Upload Job
export interface UploadJob {
    id: string;
    siteId: string;
    filename: string;
    status: UploadStatus;
    rowsIngested: number;
    rowsRejected: number;
    errors?: string[];
    mappingProfileId?: string;
    uploadedAt: string;
}

// Mapping Profile
export interface MappingProfile {
    id: string;
    name: string;
    siteId?: string;
    columnMap: Record<string, string>; // sourceCol -> canonicalField
}

// Site Summary (for detail page)
export interface SiteSummary {
    kpis: KpiSummary;
    last12: TimePoint[];
    alerts: string[];
    nextDeadlines: ComplianceItem[];
}

// Admin types
export interface Target {
    id: string;
    siteId?: string; // undefined = group level
    year: number;
    absoluteTarget_tco2e: number;
    intensityTarget_tco2ePerTon: number;
    baselineYear: number;
}

export interface EmissionFactor {
    id: string;
    name: string;
    value: number;
    unit: string;
    source: string;
    version: string;
    updatedAt: string;
}

// Site table row (extended site with computed fields)
export interface SiteTableRow extends Site {
    emissionsYtd: number;
    targetYtd: number;
    variancePct: number;
    intensity: number;
    dataQuality: number;
    nextDeadline: string;
    complianceStatus: ComplianceStatus;
}

// GEI (GHG Emissions Intensity) data point
export interface GeiDataPoint {
    month: string; // e.g., "Jan", "Feb", "Mar"
    month_num: number; // Month number (1-12)
    gei: number | null; // tCO2e per unit of production (monthly)
    isActual: boolean; // true if this is actual data, false if predicted
    financial_year: number; // Financial year
    calendar_year?: number; // Calendar year (to avoid confusion with FY)
    // Monthly values (for reference)
    total_ghg_emissions?: number | null; // Total GHG emissions for the month
    total_direct_and_indirect_emission?: number | null; // Total direct and indirect emissions (for APCW/ACW plants)
    equivalent_production?: number | null; // Equivalent production for the month
    // Pre-calculated YTD values from backend - use these directly instead of recalculating
    ytd_gei?: number | null; // Year-to-date GEI (cumulative emissions / cumulative production)
    ytd_emissions?: number | null; // Year-to-date cumulative emissions
    ytd_production?: number | null; // Year-to-date cumulative production
    // Plant type flag from backend - no need to detect in frontend
    is_apcw_or_acw?: boolean;
}
