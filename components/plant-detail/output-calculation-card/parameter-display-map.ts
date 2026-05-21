export interface OutputParameterDisplay {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  description?: string;
}

// Map parameter types to display labels and units
export const PARAMETER_DISPLAY_MAP: Record<
  string,
  { label: string; unit: string; description?: string }
> = {
  // Output Metrics
  biomass_cofiring_pct: {
    label: "Biomass Cofiring %",
    unit: "%",
    description: "Percentage of biomass used in cofiring",
  },
  ghg_emission_factor_fuel: {
    label: "GHG Emission Factor (Fuel)",
    unit: "tCO2e/GJ",
    description: "Greenhouse gas emission factor for fuel",
  },
  power_gen_emission_intensity: {
    label: "Power Gen Emission Intensity",
    unit: "tCO2e/MWh",
    description: "CO2 emissions per megawatt hour of power generated",
  },
  coal_co2_emissions: {
    label: "Coal CO2 Emissions",
    unit: "tCO2",
    description: "CO2 emissions from coal combustion",
  },
  hsd_co2_emissions: {
    label: "HSD CO2 Emissions",
    unit: "tCO2",
    description: "CO2 emissions from high speed diesel",
  },
  ldo_co2_emissions: {
    label: "LDO CO2 Emissions",
    unit: "tCO2",
    description: "CO2 emissions from light diesel oil",
  },
  ng_co2_emissions: {
    label: "Natural Gas CO2 Emissions",
    unit: "tCO2",
    description: "CO2 emissions from natural gas",
  },
  export_power_co2_credit: {
    label: "Export Power CO2 Credit",
    unit: "tCO2",
    description: "CO2 credit for exported power",
  },
  export_steam_co2_credit: {
    label: "Export Steam CO2 Credit",
    unit: "tCO2",
    description: "CO2 credit for exported steam",
  },
  total_ghg_emissions: {
    label: "Total GHG Emissions",
    unit: "tCO2e",
    description: "Total greenhouse gas emissions",
  },
  gei: {
    label: "Greenhouse Gas Emission Intensity (GEI)",
    unit: "tCO2e/t",
    description: "Greenhouse gas emission intensity per tonne of product",
  },
  equivalent_production: {
    label: "Equivalent Production",
    unit: "t",
    description: "Equivalent production in tonnes",
  },
  // Direct Emission (Scope 1)
  solid_fossil_fuel_consumption: {
    label: "Solid Fossil Fuel Consumption",
    unit: "GJ",
    description: "Consumption of solid fossil fuels",
  },
  direct_emission_generation_energy: {
    label: "Direct Emission - Generation Energy",
    unit: "tCO2e",
    description: "Direct emissions from energy generation",
  },
  direct_emission_process_energy: {
    label: "Direct Emission - Process Energy",
    unit: "tCO2e",
    description: "Direct emissions from process energy",
  },
  liquid_fossil_fuel_consumption: {
    label: "Liquid Fossil Fuel Consumption",
    unit: "GJ",
    description: "Consumption of liquid fossil fuels",
  },
  liquid_direct_emission_generation_energy: {
    label: "Liquid Direct Emission - Generation Energy",
    unit: "tCO2e",
    description: "Direct emissions from liquid fuel energy generation",
  },
  liquid_direct_emission_process_energy: {
    label: "Liquid Direct Emission - Process Energy",
    unit: "tCO2e",
    description: "Direct emissions from liquid fuel process energy",
  },
  gaseous_fossil_fuel_consumption: {
    label: "Gaseous Fossil Fuel Consumption",
    unit: "GJ",
    description: "Consumption of gaseous fossil fuels",
  },
  gaseous_direct_emission_generation_energy: {
    label: "Gaseous Direct Emission - Generation Energy",
    unit: "tCO2e",
    description: "Direct emissions from gaseous fuel energy generation",
  },
  gaseous_direct_emission_process_energy: {
    label: "Gaseous Direct Emission - Process Energy",
    unit: "tCO2e",
    description: "Direct emissions from gaseous fuel process energy",
  },
  calcination_process: {
    label: "Calcination Process Emissions",
    unit: "tCO2e",
    description: "Emissions from calcination process",
  },
  process: {
    label: "Process Emissions",
    unit: "tCO2e",
    description: "Process-related emissions",
  },
  unburnt_coal_sold_adjusted: {
    label: "Unburnt Coal Sold (Adjusted)",
    unit: "tCO2e",
    description: "Adjusted emissions for unburnt coal sold",
  },
  steam_export_adjusted: {
    label: "Steam Export (Adjusted)",
    unit: "tCO2e",
    description: "Adjusted emissions for steam export",
  },
  chilled_water_export_adjusted: {
    label: "Chilled Water Export (Adjusted)",
    unit: "tCO2e",
    description: "Adjusted emissions for chilled water export",
  },
  total_direct_emission_scope_1: {
    label: "Total Direct Emission (Scope 1)",
    unit: "tCO2e",
    description: "Total direct emissions under Scope 1",
  },
  // Indirect Emission (Scope 2)
  electricity_purchased_from_outside_plant_boundary: {
    label: "Electricity Purchased (Outside Plant Boundary)",
    unit: "MWh",
    description: "Electricity purchased from outside the plant boundary",
  },
  electricity_export_adjusted: {
    label: "Electricity Export (Adjusted)",
    unit: "MWh",
    description: "Adjusted electricity export",
  },
  electricity_export_to_colony_grid_adjusted: {
    label: "Electricity Export to Colony Grid (Adjusted)",
    unit: "MWh",
    description: "Adjusted electricity export to colony grid",
  },
  steam_import_adjusted: {
    label: "Steam Import (Adjusted)",
    unit: "tCO2e",
    description: "Adjusted emissions for steam import",
  },
  chilled_water_import_adjusted: {
    label: "Chilled Water Import (Adjusted)",
    unit: "tCO2e",
    description: "Adjusted emissions for chilled water import",
  },
  intermediary_product_import_adjustment: {
    label: "Intermediary Product Import Adjustment",
    unit: "tCO2e",
    description: "Emission adjustment for intermediary product imports",
  },
  intermediary_product_import_adjustment_energy: {
    label: "Intermediary Product Import Adjustment (Energy)",
    unit: "tCO2e",
    description:
      "Energy-related emission adjustment for intermediary product imports",
  },
  intermediary_product_import_adjustment_process: {
    label: "Intermediary Product Import Adjustment (Process)",
    unit: "tCO2e",
    description:
      "Process-related emission adjustment for intermediary product imports",
  },
  intermediary_product_export_adjustment: {
    label: "Intermediary Product Export Adjustment",
    unit: "tCO2e",
    description: "Emission adjustment for intermediary product exports",
  },
  total_indirect_emission_scope_2: {
    label: "Total Indirect Emission (Scope 2)",
    unit: "tCO2e",
    description: "Total indirect emissions under Scope 2",
  },
  // Total Emissions
  total_direct_and_indirect_emission: {
    label: "Total Direct and Indirect Emission",
    unit: "tCO2e",
    description: "Total direct and indirect emissions combined",
  },
  emission_per_ton_of_equivalent_product: {
    label: "Emission per Ton of Equivalent Product",
    unit: "tCO2e/t",
    description: "Emissions per tonne of equivalent product",
  },
  equivalent_product_for_gei: {
    label: "Equivalent Product for GEI",
    unit: "t",
    description: "Equivalent product quantity for GEI calculation",
  },
  gei_energy: {
    label: "GEI - Energy",
    unit: "tCO2e/t",
    description: "Greenhouse gas emission intensity for energy",
  },
  gei_calcination_process: {
    label: "GEI - Calcination Process",
    unit: "tCO2e/t",
    description: "Greenhouse gas emission intensity for calcination process",
  },
  gei_cementitious_product: {
    label: "GEI - Cementitious Product",
    unit: "tCO2e/t",
    description: "Greenhouse gas emission intensity for cementitious product",
  },
  clinker_factor: {
    label: "Clinker Factor",
    unit: "",
    description: "Ratio of clinker to cement",
  },
};

/** Generate a readable label from a snake_case param_type */
export function generateLabel(paramType: string | undefined | null): string {
  if (!paramType || paramType === "unknown") {
    return "Unknown Parameter";
  }
  return paramType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Infer a unit from a param_type string, falling back to PARAMETER_DISPLAY_MAP */
export function inferUnit(paramType: string | undefined | null): string {
  if (!paramType || paramType === "unknown") {
    return "";
  }
  const lowerType = paramType.toLowerCase();

  if (
    lowerType.includes("gei") ||
    lowerType.includes("emission_intensity") ||
    lowerType.includes("emission_per_ton")
  ) {
    return "tCO2e/t";
  }
  if (lowerType.includes("emission") && !lowerType.includes("intensity")) {
    return "tCO2e";
  }
  if (lowerType.includes("consumption") || lowerType.includes("fuel")) {
    return "GJ";
  }
  if (lowerType.includes("electricity")) {
    return "MWh";
  }
  if (
    lowerType.includes("factor") ||
    lowerType.includes("pct") ||
    lowerType.includes("percentage")
  ) {
    return lowerType.includes("pct") || lowerType.includes("percentage")
      ? "%"
      : "";
  }
  if (lowerType.includes("production") || lowerType.includes("product")) {
    return "t";
  }

  const config = PARAMETER_DISPLAY_MAP[paramType];
  return config?.unit || "";
}
