// Allowed `section` values for parameters. Since 0004 made parameters.section
// free text, this is the curated list the extraction agent picks from and the
// commit route validates against — it keeps sections consistent across uploads
// instead of letting the model invent a new spelling each time.
//
// NOTE: the agent runner cannot import from `@/lib` (it ships standalone into
// the sandbox), so it re-declares this same list in
// agent-runner/lib/agent/param-sections.ts. Keep the two in sync — same
// duplication convention as lib/dispatcher/frameworks.ts.

export const ALLOWED_SECTIONS = [
  // Input sections
  "energy",
  "feedstock",
  "water",
  "wastewater",
  "air",
  "hazardous_waste",
  "workforce",
  "governance",
  "conversion",
  // Output (VSME module) sections
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
  // Catch-all for metrics that don't fit a curated section yet.
  "other",
] as const;

export type AllowedSection = (typeof ALLOWED_SECTIONS)[number];

export function isAllowedSection(s: string): s is AllowedSection {
  return (ALLOWED_SECTIONS as readonly string[]).includes(s);
}
