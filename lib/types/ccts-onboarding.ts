/**
 * CCTS GEI Onboarding Data Types
 *
 * This represents the data structure from CCTS_GEI_ONBOARDING.json
 * which contains pre-populated plant data with baseline and target GEI values.
 */

export interface CCTSOnboardingEntity {
  obligated_entity_registration_number: string;
  obligated_entity_name: string;
  address: string;
  sector: string;
  sub_sector: string;
  confirmation_of_baseline_year: string; // e.g., "FY 2023-24"
  baseline_product_output_tonne: number;
  baseline_gei_tco2e_per_tonne: number;
  annual_gei_targets_25_26: number[]; // Usually single value array
  annual_gei_targets_26_27: number[]; // Usually single value array
}

export type TargetYear = "25-26" | "26-27";

export interface TargetYearOption {
  value: TargetYear;
  label: string;
  fiscalYear: string;
  geiValue: number | null;
}

/**
 * Parse fiscal year string (e.g., "FY 2023-24") to get the start year
 */
export function parseBaselineYear(fyString: string): number {
  const match = fyString.match(/FY\s*(\d{4})/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 2023; // Default fallback
}

/**
 * Get available target year options from entity data
 */
export function getTargetYearOptions(
  entity: CCTSOnboardingEntity,
): TargetYearOption[] {
  const options: TargetYearOption[] = [];

  if (entity.annual_gei_targets_25_26.length > 0) {
    options.push({
      value: "25-26",
      label: "FY 2025-26",
      fiscalYear: "2025-26",
      geiValue: entity.annual_gei_targets_25_26[0],
    });
  }

  if (entity.annual_gei_targets_26_27.length > 0) {
    options.push({
      value: "26-27",
      label: "FY 2026-27",
      fiscalYear: "2026-27",
      geiValue: entity.annual_gei_targets_26_27[0],
    });
  }

  return options;
}

/**
 * Search entities by registration number (case-insensitive partial match)
 */
export function searchByRegistrationNumber(
  entities: CCTSOnboardingEntity[],
  query: string,
): CCTSOnboardingEntity[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase().trim();
  return entities.filter(
    (entity) =>
      entity.obligated_entity_registration_number
        .toLowerCase()
        .includes(lowerQuery) ||
      entity.obligated_entity_name.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Find exact entity by registration number
 */
export function findByRegistrationNumber(
  entities: CCTSOnboardingEntity[],
  registrationNumber: string,
): CCTSOnboardingEntity | undefined {
  return entities.find(
    (entity) =>
      entity.obligated_entity_registration_number === registrationNumber,
  );
}
