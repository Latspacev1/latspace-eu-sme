// Allowed `section` values for extracted parameters. This is a re-declaration
// of lib/metrics/param-sections.ts (the app cannot be imported from here — the
// runner ships standalone into the sandbox). Keep the two lists in sync; this
// mirrors the lib/dispatcher/frameworks.ts duplication convention.

export const ALLOWED_SECTIONS = [
  "energy",
  "feedstock",
  "water",
  "wastewater",
  "air",
  "hazardous_waste",
  "workforce",
  "governance",
  "conversion",
  "vsme_b3_energy",
  "vsme_b3_scope1",
  "vsme_b3_scope2",
  "vsme_b3_scope3",
  "vsme_b3_consolidated",
  "vsme_b6_water",
  "vsme_b4_pollution",
  "vsme_b7_waste",
  "vsme_b7_materials",
  "vsme_b8_b11_workforce_gov",
  "other",
] as const;

export type AllowedSection = (typeof ALLOWED_SECTIONS)[number];
