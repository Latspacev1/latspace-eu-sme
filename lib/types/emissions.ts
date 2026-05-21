// Emission Source Types (Simple - for basic tracking)
export type EmissionScope = "Scope1" | "Scope2" | "Scope3";
export type EmissionSourceCategory =
    | "Fuel"
    | "Electricity"
    | "Process"
    | "Transport"
    | "Waste"
    | "Other";

export interface EmissionSource {
    id: string;
    siteId: string;
    name: string;
    category: EmissionSourceCategory;
    scope: EmissionScope;
    quantity: number;
    unit: string;
    emissionFactor: number; // kg CO2e per unit
    totalEmissions_tco2e: number; // calculated
    period: string; // e.g., "2024-01", "2024-Q1"
    date: string; // ISO date
    notes?: string;
    createdAt: string;
    createdBy: string;
    updatedAt?: string;
    updatedBy?: string;
}

// Comprehensive Emission Source Configuration Types (CCTS-compliant)
export type GasType = "CO2" | "PFCs";
export type InputParameter =
    | "Clinker Production"
    | "Cement Production"
    | "Raw Material"
    | "Fuel"
    | "Electricity"
    | "Transport";
export type Methodology = "Standard Methodology" | "Mass Balance Method";
export type EmissionType =
    | "Direct Emission"
    | "Indirect Emission"
    | "Process Emission";
export type EmissionTypeCategory = "Type I" | "Type II";
export type EmissionFactorSource = "IPCC" | "DEFRA" | "Custom";
export type EmissionsAdjusted = "CCUS" | "Exported Electricity";

export interface EmissionSourceFormData {
    name: string;
    gases: GasType[];
    inputParameter: InputParameter;
    methodology: Methodology;
    emissionType?: EmissionType;
    emissionTypeCategory?: EmissionTypeCategory;
    emissionFactorSource?: EmissionFactorSource;
    emissionsAdjusted?: EmissionsAdjusted[];
    customEmissionFactor?: number;
    notes?: string;
}

export interface EmissionSourceConfig {
    id: string;
    siteId: string;
    name: string;
    gases: GasType[];
    inputParameter: InputParameter;
    methodology: Methodology;
    emissionType?: EmissionType;
    emissionTypeCategory?: EmissionTypeCategory;
    emissionFactorSource?: EmissionFactorSource;
    emissionsAdjusted?: EmissionsAdjusted[];
    customEmissionFactor?: number;
    notes?: string;
    createdAt: string;
    createdBy: string;
    updatedAt?: string;
    updatedBy?: string;
}
