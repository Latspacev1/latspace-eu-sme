import type { Block, Comment, Metric, QualitativeDoc, Requirement } from "./types";

// Stable IDs so the seed is deterministic across reloads. Anything created
// after seeding uses genId().
const now = new Date("2026-04-01T09:00:00.000Z").toISOString();

const blocks: Block[] = [
  { id: "b_title", kind: "heading", level: 1, text: "VSME Sustainability Report — Acme SME Ltd" },

  { id: "b_intro_h", kind: "heading", level: 2, text: "1. About this report" },
  {
    id: "b_intro_p",
    kind: "paragraph",
    text: "This report is prepared in accordance with the EFRAG Voluntary Sustainability Reporting Standard for non-listed micro, small and medium-sized undertakings (VSME). It covers the Basic Module (B1–B11) and selected disclosures from the Comprehensive Module (C1–C9) for the financial year ending 31 December 2025.",
  },
  {
    id: "b_intro_req",
    kind: "requirement-ref",
    requirementId: "VSME-B1",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  {
    id: "b_practices_h",
    kind: "heading",
    level: 2,
    text: "2. Sustainability practices and future initiatives",
    sectionTag: "Sustainability practices",
  },
  {
    id: "b_practices_p",
    kind: "paragraph",
    text: "Acme SME Ltd has adopted a set of formal sustainability practices covering energy efficiency, responsible sourcing, and employee well-being. Initiatives planned for the next reporting period focus on reducing Scope 2 emissions intensity and expanding workforce training.",
  },
  {
    id: "b_practices_req",
    kind: "requirement-ref",
    requirementId: "VSME-B2",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  {
    id: "b_energy_h",
    kind: "heading",
    level: 2,
    text: "3. Energy and greenhouse gas emissions",
    sectionTag: "Energy & GHG",
  },
  {
    id: "b_energy_p",
    kind: "paragraph",
    text: "Total energy consumption and GHG emissions are disclosed below for the reporting period. Scope 1 covers direct fuel combustion at the Pune facility; Scope 2 is reported using the location-based method using the average grid emission factor for India.",
  },
  {
    id: "b_energy_table",
    kind: "table",
    columns: ["Indicator", "Unit", "Value", "Method / Source"],
    rows: [
      ["Total energy consumption", "MWh", "1,842", "Utility invoices + diesel logbook"],
      ["Renewable energy share", "%", "18", "Rooftop solar generation log"],
      ["Scope 1 GHG emissions", "tCO2e", "412", "GHG Protocol — calculation-based"],
      ["Scope 2 GHG emissions (location-based)", "tCO2e", "768", "CEA grid factor 0.71 tCO2e/MWh"],
      ["GHG intensity", "tCO2e / € million revenue", "9.8", "Derived from revenue €120m"],
    ],
  },
  {
    id: "b_energy_req",
    kind: "requirement-ref",
    requirementId: "VSME-B3",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  {
    id: "b_water_h",
    kind: "heading",
    level: 2,
    text: "4. Water",
    sectionTag: "Water",
  },
  {
    id: "b_water_p",
    kind: "paragraph",
    text: "The Pune facility is located in an area classified as water-stressed by the WRI Aqueduct tool. Water withdrawal is metered at the municipal supply point and reported below.",
  },
  {
    id: "b_water_req",
    kind: "requirement-ref",
    requirementId: "VSME-B6",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  {
    id: "b_workforce_h",
    kind: "heading",
    level: 2,
    text: "5. Workforce — general characteristics",
    sectionTag: "Workforce",
  },
  {
    id: "b_workforce_p",
    kind: "paragraph",
    text: "Headcount is reported as the number of employees at the end of the reporting period, broken down by gender and contract type, in line with VSME B8.",
  },
  {
    id: "b_workforce_table",
    kind: "table",
    columns: ["Category", "Female", "Male", "Other / Not disclosed", "Total"],
    rows: [
      ["Permanent employees", "46", "78", "1", "125"],
      ["Temporary employees", "8", "11", "0", "19"],
      ["Full-time equivalent (FTE)", "—", "—", "—", "138"],
    ],
  },
  {
    id: "b_workforce_req",
    kind: "requirement-ref",
    requirementId: "VSME-B8",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  {
    id: "b_hs_h",
    kind: "heading",
    level: 2,
    text: "6. Health and safety",
    sectionTag: "Health & safety",
  },
  {
    id: "b_hs_p",
    kind: "paragraph",
    text: "Acme operates an ISO 45001-aligned health and safety management system. The figures below cover all employees and contractors working under the operational control of the undertaking.",
  },
  {
    id: "b_hs_req",
    kind: "requirement-ref",
    requirementId: "VSME-B9",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  {
    id: "b_gov_h",
    kind: "heading",
    level: 2,
    text: "7. Anti-corruption and bribery",
    sectionTag: "Governance",
  },
  {
    id: "b_gov_p",
    kind: "paragraph",
    text: "Acme maintains a Code of Conduct and an anti-bribery policy applicable to all employees and direct suppliers. Mandatory training is delivered annually and tracked through the HR system.",
  },
  {
    id: "b_gov_req",
    kind: "requirement-ref",
    requirementId: "VSME-B11",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },

  {
    id: "b_strategy_h",
    kind: "heading",
    level: 2,
    text: "8. Strategy and business model (Comprehensive)",
    sectionTag: "Strategy",
  },
  {
    id: "b_strategy_p",
    kind: "paragraph",
    text: "This section addresses Comprehensive Module disclosure C1 — strategy, business model and key sustainability-related issues. It is included voluntarily as part of Acme's opt-in to Comprehensive reporting under B1.",
  },
  {
    id: "b_strategy_req",
    kind: "requirement-ref",
    requirementId: "VSME-C1",
    snapshot: { kind: "empty" },
    snapshotAt: now,
  },
];

const requirements: Requirement[] = [
  {
    id: "VSME-B1",
    name: "B1 — Basis for preparation",
    description:
      "Disclose whether the report is prepared under the Basic Module only or the Basic + Comprehensive Module, the reporting period, reporting boundary (entity vs consolidated), and any omitted disclosures with the reason for omission.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement seeded from VSME template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "VSME-B2",
    name: "B2 — Practices, policies and future initiatives for transitioning towards a more sustainable economy",
    description:
      "Describe the sustainability practices, policies and future initiatives the undertaking has in place, including targets, timelines and the topics covered (environment, social, governance).",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement seeded from VSME template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "VSME-B3",
    name: "B3 — Energy and greenhouse gas emissions",
    description:
      "Disclose total energy consumption (MWh) split by renewable vs non-renewable, and Scope 1 and Scope 2 GHG emissions (tCO2e). Specify the calculation method and emission factors used; Scope 2 should be reported location-based, with market-based as optional.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement seeded from VSME template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "VSME-B6",
    name: "B6 — Water",
    description:
      "Disclose total water withdrawal in m³, and whether any sites are located in areas of water stress (as defined by the WRI Aqueduct tool or equivalent). For water-stressed sites, also disclose water consumption.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement seeded from VSME template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "VSME-B8",
    name: "B8 — Workforce — general characteristics",
    description:
      "Total number of employees at the end of the reporting period, broken down by gender (and optionally by country), and by contract type (permanent / temporary) and employment type (full-time / part-time).",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement seeded from VSME template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "VSME-B9",
    name: "B9 — Workforce — health and safety",
    description:
      "Disclose the number and rate of recordable work-related accidents, and the number of fatalities resulting from work-related injuries and ill-health, covering own workforce and (where available) workers under operational control.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement seeded from VSME template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "VSME-B11",
    name: "B11 — Convictions and fines for corruption and bribery",
    description:
      "Disclose the number of convictions and the total amount of fines for violation of anti-corruption and anti-bribery laws during the reporting period. State zero if applicable.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement seeded from VSME template." }],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "VSME-C1",
    name: "C1 — Strategy: business model and sustainability-related initiatives (Comprehensive)",
    description:
      "Describe the business model, the key products and services, the markets served, and any significant sustainability-related strategy elements — including transition plans where applicable. Required only if the undertaking opts into Comprehensive reporting.",
    response: null,
    attachments: [],
    activity: [{ id: "a1", at: now, actor: "system", message: "Requirement seeded from VSME template." }],
    createdAt: now,
    updatedAt: now,
  },
];

const metrics: Metric[] = [
  { id: "M-ENERGY", name: "Total energy consumption", unit: "MWh", value: 1842, source: "Utility invoices + diesel log", updatedAt: now },
  { id: "M-RENEW", name: "Renewable energy share", unit: "%", value: 18, source: "Rooftop solar log", updatedAt: now },
  { id: "M-S1", name: "Scope 1 GHG emissions", unit: "tCO2e", value: 412, source: "GHG ledger", updatedAt: now },
  { id: "M-S2", name: "Scope 2 GHG emissions (location-based)", unit: "tCO2e", value: 768, source: "DISCOM invoices × CEA factor", updatedAt: now },
  { id: "M-WATER", name: "Water withdrawal", unit: "m³", value: 14260, source: "Municipal meter", updatedAt: now },
  { id: "M-FTE", name: "Full-time equivalent employees", unit: "FTE", value: 138, source: "HR system", updatedAt: now },
  { id: "M-LTIFR", name: "Lost-time injury frequency rate", unit: "per 1m hours", value: 1.4, source: "EHS register", updatedAt: now },
  { id: "M-REV", name: "Revenue", unit: "€ million", value: 120, source: "Audited financial statements", updatedAt: now },
];

const comments: Comment[] = [];

export function buildVsmeSeed(frameworkId: string): QualitativeDoc {
  return {
    frameworkId,
    title: "VSME Sustainability Report",
    blocks,
    requirements,
    metrics,
    comments,
    proposals: [],
    updatedAt: now,
  };
}
