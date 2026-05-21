// VSME (Voluntary Sustainability Reporting Standard for non-listed micro,
// small and medium-sized undertakings) questionnaire — based on the EFRAG
// VSME Digital Template v1.2.0 (published 2026-02-27).
//
// Structure mirrors the official template:
//   General Information   — B1, B2 + C1, C2 (Comprehensive add-ons)
//   Environmental         — B3, B4, B5, B6, B7 + C3, C4
//   Social                — B8, B9, B10        + C5, C6, C7
//   Governance            — B11                + C8, C9
//
// Each question id corresponds to a disclosure code in the standard (e.g.
// "B1.5" is "Basic module disclosure 1, question 5"). The Excel template
// has matching cells; bindings live in lib/reporting/vsmeExport/map.ts.

import type { Section } from "./frameworkTypes";
import { currencies } from "./codeLists";

// VSME-specific enumerations — drawn from the "Enumeration Lists" sheet
// of the template. Only the values the user can type are listed here;
// the template itself stores them in the same display form.

const basisForPreparation = [
  "Option A (Basic Module only)",
  "Option B (Basic Module and Comprehensive Module)",
] as const;

const basisForReporting = ["Consolidated", "Individual"] as const;

const undertakingLegalForm = [
  "private limited liability undertaking",
  "sole proprietorship",
  "partnership",
  "public limited liability undertaking",
  "cooperative",
  "other (please specify the legal form)",
] as const;

const employeeCountingMethodology = [
  "At the end of the reporting period",
  "Average across the reporting period",
] as const;

const employeeCountingUnit = ["Headcount", "Full-time Equivalent (FTE)"] as const;

const yesNo = ["YES", "NO"] as const;

const transitionPlanStatus = [
  "Plan adopted",
  "Plan in development",
  "No plan yet — foreseen",
  "No plan and none foreseen",
] as const;

const biodiversityLocation = [
  "Located in biodiversity sensitive areas",
  "Located near biodiversity sensitive areas",
] as const;

const areaUnit = ["hectares", "m²"] as const;

const pollutantUnit = ["kg", "tonne"] as const;

const wasteHazardClass = ["Hazardous", "Non-Hazardous"] as const;

const wasteTreatment = [
  "Recovery / Recycling",
  "Re-use",
  "Disposal / Landfill",
  "Incineration",
  "Other",
] as const;

const massVolumeUnit = ["kg", "tonne", "m³"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1. GENERAL INFORMATION
// ─────────────────────────────────────────────────────────────────────────────

const generalInformationSections: Section[] = [
  {
    id: "GI",
    title: "Report Information",
    sheetRef: 'Sheet "General Information"',
    questions: [
      {
        id: "GI.entity",
        kind: "fields",
        label: "Reporting entity",
        description:
          "Identification of the undertaking and the currency used for monetary values throughout the report.",
        fields: [
          { id: "name", kind: "text", label: "Name of the reporting entity", required: true },
          {
            id: "identifier",
            kind: "text",
            label: "Identifier of the reporting entity",
            help: "A unique ID such as LEI, EUID, or national company-register number.",
            required: true,
          },
          {
            id: "identifierScheme",
            kind: "select",
            label: "Identifier scheme",
            options: ["LEI", "EUID", "National registration number", "Other"],
            required: true,
          },
          {
            id: "currency",
            kind: "select",
            label: "Report currency",
            options: currencies,
            required: true,
          },
        ],
      },
      {
        id: "GI.period",
        kind: "fields",
        label: "Reporting period",
        description:
          "Start and end dates of the reporting period covered by this VSME report.",
        fields: [
          { id: "startDate", kind: "date", label: "Reporting period start date", required: true },
          { id: "endDate", kind: "date", label: "Reporting period end date", required: true },
        ],
      },
      {
        id: "GI.previous",
        kind: "fields",
        label: "Information on previous reporting period",
        description:
          "If this report carries forward disclosures from a prior period unchanged, list them and link the earlier report.",
        fields: [
          {
            id: "containsUnchanged",
            kind: "boolean",
            label: "This report contains disclosures from the previous reporting period that remain unchanged",
          },
          {
            id: "previousReportUrl",
            kind: "text",
            label: "Link to previous report containing disclosures that remain unchanged",
            help: "URL of the previous VSME or sustainability report.",
          },
        ],
      },
      {
        id: "GI.previousList",
        kind: "table",
        label: "List of disclosures unchanged from the previous reporting period",
        description: 'Only fill if "contains unchanged disclosures" is true. Pick disclosure codes (e.g. B3, B5, C4).',
        minRows: 1,
        maxRows: 20,
        rowLabel: (i) => `Disclosure ${i + 1}`,
        columns: [
          {
            id: "code",
            kind: "select",
            label: "Disclosure code",
            options: [
              "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "B11",
              "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9",
            ],
          },
        ],
      },
    ],
  },

  // ── B1 — Basis for preparation ─────────────────────────────────────────
  {
    id: "B1",
    title: "B1 — Basis for preparation",
    sheetRef: 'Sheet "General Information" §B1',
    questions: [
      {
        id: "B1.basis",
        kind: "fields",
        label: "Basis for preparation",
        fields: [
          {
            id: "module",
            kind: "select",
            label: "Modules covered by this report",
            options: basisForPreparation,
            required: true,
            help: "Option A reports only Basic disclosures; Option B adds the Comprehensive module.",
          },
        ],
      },
      {
        id: "B1.entityDetails",
        kind: "fields",
        label: "Other general information about the undertaking",
        fields: [
          { id: "basisReporting", kind: "select", label: "Basis for reporting", options: basisForReporting },
          { id: "legalForm", kind: "select", label: "Undertaking's legal form", options: undertakingLegalForm },
          {
            id: "legalFormOther",
            kind: "text",
            label: "Other legal form (if applicable)",
            help: 'Only required if "other" is selected as the legal form.',
          },
          {
            id: "balanceSheet",
            kind: "number",
            label: "Size of balance sheet (in report currency)",
            min: 0,
          },
          { id: "turnover", kind: "number", label: "Turnover (in report currency)", min: 0 },
          { id: "numberOfEmployees", kind: "number", label: "Number of employees", min: 0 },
          {
            id: "employeeCountingPeriod",
            kind: "select",
            label: "Employee counting methodology (period)",
            options: employeeCountingMethodology,
          },
          {
            id: "employeeCountingUnit",
            kind: "select",
            label: "Employee counting methodology (unit)",
            options: employeeCountingUnit,
          },
          { id: "countryOfPrimaryOps", kind: "selectCountry", label: "Country of primary operations" },
        ],
      },
      {
        id: "B1.NACE",
        kind: "table",
        label: "NACE sector classification code(s)",
        description:
          "Provide one or more NACE codes (rev. 2.1) — pick the leaf code, not the category.",
        minRows: 1,
        maxRows: 20,
        rowLabel: (i) => `NACE code ${i + 1}`,
        columns: [
          {
            id: "code",
            kind: "text",
            label: "NACE code",
            help: 'Format like "A.01.11 Growing of cereals" — the leaf code.',
          },
        ],
      },
      {
        id: "B1.subsidiaries",
        kind: "table",
        label: "List of subsidiaries (consolidated reporting only)",
        description: "Only required when reporting on a consolidated basis.",
        minRows: 1,
        maxRows: 100,
        rowLabel: (i) => `Subsidiary ${i + 1}`,
        columns: [
          { id: "name", kind: "text", label: "Subsidiary name" },
          { id: "identifier", kind: "text", label: "Identifier (LEI / national reg. no.)" },
          { id: "country", kind: "selectCountry", label: "Country of registration" },
          { id: "address", kind: "text", label: "Registered address" },
        ],
      },
      {
        id: "B1.certifications",
        kind: "fields",
        label: "Sustainability-related certifications or labels",
        fields: [
          {
            id: "hasCertification",
            kind: "boolean",
            label: "Has the undertaking obtained any sustainability-related certification(s) or label(s)?",
          },
          {
            id: "description",
            kind: "longtext",
            label: "Description of certifications or labels (issuer, rating level, expiry date)",
          },
        ],
      },
      {
        id: "B1.sites",
        kind: "table",
        label: "List of significant sites",
        description: "Locations of significant assets and operating sites.",
        minRows: 1,
        maxRows: 100,
        rowLabel: (i) => `Site ${i + 1}`,
        columns: [
          { id: "name", kind: "text", label: "Site name" },
          { id: "country", kind: "selectCountry", label: "Country" },
          { id: "address", kind: "text", label: "Address" },
          { id: "latitude", kind: "number", label: "Latitude", min: -90, max: 90, step: 0.0001 },
          { id: "longitude", kind: "number", label: "Longitude", min: -180, max: 180, step: 0.0001 },
        ],
      },
    ],
  },

  // ── B2 — Practices, policies and future initiatives ────────────────────
  {
    id: "B2",
    title: "B2 — Practices, policies and future initiatives",
    sheetRef: 'Sheet "General Information" §B2',
    questions: [
      {
        id: "B2.policies",
        kind: "fields",
        label: "Sustainability practices, policies and future initiatives",
        description:
          "Disclosure of practices, policies, and planned initiatives for transitioning towards a more sustainable economy.",
        fields: [
          {
            id: "hasPractices",
            kind: "boolean",
            label: "Has the undertaking put in place specific practices, policies, and/or future initiatives?",
          },
          {
            id: "description",
            kind: "longtext",
            label: "Description of these practices, policies, and future initiatives",
          },
        ],
      },
      {
        id: "B2.cooperative",
        kind: "fields",
        label: "Cooperative-specific disclosures",
        description: "Only applies if the undertaking is a cooperative.",
        fields: [
          {
            id: "participation",
            kind: "longtext",
            label:
              "Effective participation of workers, users or other interested parties in governance",
          },
          {
            id: "financialInvestment",
            kind: "longtext",
            label:
              "Financial investment in capital or assets of social-economy entities",
          },
          {
            id: "profitLimits",
            kind: "longtext",
            label: "Any limits to the distribution of profits",
          },
        ],
      },
    ],
  },

  // ── C1 — Strategy, business model and sustainability-related initiatives ─
  {
    id: "C1",
    title: "C1 — Strategy and business model (Comprehensive)",
    sheetRef: 'Sheet "General Information" §C1',
    questions: [
      {
        id: "C1.strategy",
        kind: "fields",
        label: "Strategy, business model and sustainability-related initiatives",
        description:
          "Comprehensive-module disclosure — only required for undertakings that have elected Option B.",
        fields: [
          {
            id: "productsServices",
            kind: "longtext",
            label: "Description of significant groups of products and/or services offered",
          },
          {
            id: "markets",
            kind: "longtext",
            label: "Description of significant market(s) (e.g. B2B, wholesale, retail, country)",
          },
          {
            id: "businessRelationships",
            kind: "longtext",
            label: "Description of main business relationships (key suppliers, customers, channels)",
          },
          {
            id: "hasSustainabilityElements",
            kind: "boolean",
            label: "Does the strategy have key elements that relate to or affect sustainability issues?",
          },
          {
            id: "sustainabilityElements",
            kind: "longtext",
            label: "Description of those key elements",
          },
        ],
      },
    ],
  },

  // ── C2 — Description of practices, policies, and future initiatives ────
  {
    id: "C2",
    title: "C2 — Description of practices and policies (Comprehensive)",
    sheetRef: 'Sheet "General Information" §C2',
    questions: [
      {
        id: "C2.description",
        kind: "fields",
        label: "Description of practices, policies, and future initiatives (Comprehensive)",
        fields: [
          {
            id: "practiceDescription",
            kind: "longtext",
            label: "Description of a practice, policy and/or future initiative towards a more sustainable future",
          },
          {
            id: "targetDescription",
            kind: "longtext",
            label: "Description of target(s) related to the policy",
          },
          {
            id: "accountability",
            kind: "longtext",
            label:
              "Most senior level within the workforce accountable for implementing the policy",
          },
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. ENVIRONMENTAL DISCLOSURES
// ─────────────────────────────────────────────────────────────────────────────

const environmentalSections: Section[] = [
  {
    id: "B3",
    title: "B3 — Energy and greenhouse gas emissions",
    sheetRef: 'Sheet "Environmental Disclosures" §B3',
    questions: [
      {
        id: "B3.energyTotal",
        kind: "fields",
        label: "Total energy consumption (MWh)",
        fields: [
          {
            id: "total",
            kind: "number",
            label: "Total energy consumption",
            unit: "MWh",
            min: 0,
          },
        ],
      },
      {
        id: "B3.energyBreakdown",
        kind: "fields",
        label: "Breakdown of energy consumption (MWh)",
        description:
          "Split total energy by source. Self-generated electricity is reported separately from grid electricity.",
        fields: [
          {
            id: "hasBreakdown",
            kind: "boolean",
            label:
              "Has the undertaking obtained the necessary information to provide an energy consumption breakdown?",
          },
          { id: "electricity", kind: "number", label: "Electricity (utility billings)", unit: "MWh", min: 0 },
          { id: "selfGenerated", kind: "number", label: "Self-generated electricity", unit: "MWh", min: 0 },
          { id: "fuels", kind: "number", label: "Fuels", unit: "MWh", min: 0 },
        ],
      },
      {
        id: "B3.scopes",
        kind: "fields",
        label: "Estimated greenhouse gas emissions (tCO₂e)",
        description:
          "Report Scope 1, Scope 2 (both location- and market-based) and total emissions for the reporting period.",
        fields: [
          { id: "year", kind: "date", label: "Reporting year (date)" },
          { id: "scope1", kind: "number", label: "Gross Scope 1 GHG emissions", unit: "tCO₂e", min: 0 },
          {
            id: "scope2Location",
            kind: "number",
            label: "Gross Scope 2 location-based GHG emissions",
            unit: "tCO₂e",
            min: 0,
          },
          {
            id: "scope2Market",
            kind: "number",
            label: "Gross Scope 2 market-based GHG emissions",
            unit: "tCO₂e",
            min: 0,
          },
        ],
      },
      {
        id: "B3.scope3",
        kind: "fields",
        label: "Scope 3 GHG emissions by category (tCO₂e) — Comprehensive",
        description:
          "Entity-specific Scope 3 emissions across the 15 GHG Protocol categories. Only required under Option B.",
        fields: [
          {
            id: "hasScope3",
            kind: "boolean",
            label: "Is the undertaking disclosing entity-specific information on Scope 3 emissions?",
          },
          { id: "cat1",  kind: "number", label: "1. Purchased Goods and Services", unit: "tCO₂e", min: 0 },
          { id: "cat2",  kind: "number", label: "2. Capital Goods", unit: "tCO₂e", min: 0 },
          { id: "cat3",  kind: "number", label: "3. Fuel- and Energy-Related Activities", unit: "tCO₂e", min: 0 },
          { id: "cat4",  kind: "number", label: "4. Upstream Transportation and Distribution", unit: "tCO₂e", min: 0 },
          { id: "cat5",  kind: "number", label: "5. Waste Generated in Operations", unit: "tCO₂e", min: 0 },
          { id: "cat6",  kind: "number", label: "6. Business Travel", unit: "tCO₂e", min: 0 },
          { id: "cat7",  kind: "number", label: "7. Employee Commuting", unit: "tCO₂e", min: 0 },
          { id: "cat8",  kind: "number", label: "8. Upstream Leased Assets", unit: "tCO₂e", min: 0 },
          { id: "cat9",  kind: "number", label: "9. Downstream Transportation and Distribution", unit: "tCO₂e", min: 0 },
          { id: "cat10", kind: "number", label: "10. Processing of Sold Products", unit: "tCO₂e", min: 0 },
          { id: "cat11", kind: "number", label: "11. Use of Sold Products", unit: "tCO₂e", min: 0 },
          { id: "cat12", kind: "number", label: "12. End-of-Life Treatment of Sold Products", unit: "tCO₂e", min: 0 },
          { id: "cat13", kind: "number", label: "13. Downstream Leased Assets", unit: "tCO₂e", min: 0 },
          { id: "cat14", kind: "number", label: "14. Franchises", unit: "tCO₂e", min: 0 },
          { id: "cat15", kind: "number", label: "15. Investments", unit: "tCO₂e", min: 0 },
        ],
      },
    ],
  },

  // ── B4 — Pollution ──────────────────────────────────────────────────────
  {
    id: "B4",
    title: "B4 — Pollution of air, water and soil",
    sheetRef: 'Sheet "Environmental Disclosures" §B4',
    questions: [
      {
        id: "B4.pollutionGate",
        kind: "fields",
        label: "Pollution reporting gateway",
        fields: [
          {
            id: "requiredByLaw",
            kind: "boolean",
            label:
              "Is the undertaking already required by law or other national regulations to report pollution data?",
          },
          {
            id: "publiclyAvailable",
            kind: "boolean",
            label: "Is this disclosure already publicly available?",
          },
          {
            id: "publicUrl",
            kind: "text",
            label: "URL of the public pollution disclosure",
          },
          {
            id: "unit",
            kind: "select",
            label: "Unit used for reporting pollutant amounts",
            options: pollutantUnit,
          },
        ],
      },
      {
        id: "B4.pollutants",
        kind: "table",
        label: "Reported pollutants",
        description:
          "Add one row per pollutant. Fill in the amount under whichever medium(s) it was emitted to — air, water, or soil.",
        minRows: 1,
        maxRows: 100,
        rowLabel: (i) => `Pollutant ${i + 1}`,
        columns: [
          { id: "pollutant", kind: "text", label: "Pollutant name" },
          { id: "amountAir",   kind: "number", label: "Amount — air",   min: 0 },
          { id: "amountWater", kind: "number", label: "Amount — water", min: 0 },
          { id: "amountSoil",  kind: "number", label: "Amount — soil",  min: 0 },
        ],
      },
    ],
  },

  // ── B5 — Biodiversity ───────────────────────────────────────────────────
  {
    id: "B5",
    title: "B5 — Biodiversity",
    sheetRef: 'Sheet "Environmental Disclosures" §B5',
    questions: [
      {
        id: "B5.sensitiveAreas",
        kind: "fields",
        label: "Sites in biodiversity-sensitive areas",
        fields: [
          {
            id: "hasSensitiveSites",
            kind: "boolean",
            label: "Does the undertaking have sites located in or near biodiversity-sensitive areas?",
          },
          {
            id: "areaUnit",
            kind: "select",
            label: "Unit used for the area",
            options: areaUnit,
          },
        ],
      },
      {
        id: "B5.sites",
        kind: "table",
        label: "Sites in or near biodiversity-sensitive areas",
        description: "Reference the site IDs reported in B1 site list.",
        minRows: 1,
        maxRows: 100,
        rowLabel: (i) => `Site ${i + 1}`,
        columns: [
          { id: "siteId", kind: "text", label: "Related Site ID (from B1)" },
          {
            id: "location",
            kind: "select",
            label: "Located in / near sensitive area",
            options: biodiversityLocation,
          },
          { id: "area", kind: "number", label: "Area", min: 0 },
        ],
      },
      {
        id: "B5.landUse",
        kind: "fields",
        label: "Biodiversity / land use",
        description: "Aggregate land-use figures.",
        fields: [
          { id: "sealedArea", kind: "number", label: "Total sealed area", min: 0 },
          { id: "natureOnSite", kind: "number", label: "Total nature-oriented area on-site", min: 0 },
          { id: "natureOffSite", kind: "number", label: "Total nature-oriented area off-site", min: 0 },
          { id: "totalLandUse", kind: "number", label: "Total use of land", min: 0 },
        ],
      },
    ],
  },

  // ── B6 — Water ──────────────────────────────────────────────────────────
  {
    id: "B6",
    title: "B6 — Water",
    sheetRef: 'Sheet "Environmental Disclosures" §B6',
    questions: [
      {
        id: "B6.withdrawal",
        kind: "fields",
        label: "Water withdrawal (m³)",
        fields: [
          {
            id: "totalWithdrawn",
            kind: "number",
            label: "Total amount of water withdrawn from all sites",
            unit: "m³",
            min: 0,
          },
          {
            id: "highStressWithdrawn",
            kind: "number",
            label: "Amount of water withdrawn at sites in areas of high water-stress",
            unit: "m³",
            min: 0,
          },
        ],
      },
      {
        id: "B6.consumption",
        kind: "fields",
        label: "Water consumption (m³)",
        fields: [
          {
            id: "hasProcessConsumption",
            kind: "boolean",
            label:
              "Does the undertaking have production processes that significantly consume water?",
          },
          {
            id: "discharge",
            kind: "number",
            label: "Water discharge from production processes",
            unit: "m³",
            min: 0,
          },
          {
            id: "totalConsumption",
            kind: "number",
            label: "Total water consumption",
            unit: "m³",
            min: 0,
          },
        ],
      },
    ],
  },

  // ── B7 — Resource use, circular economy and waste ──────────────────────
  {
    id: "B7",
    title: "B7 — Resource use, circular economy and waste",
    sheetRef: 'Sheet "Environmental Disclosures" §B7',
    questions: [
      {
        id: "B7.circular",
        kind: "fields",
        label: "Circular economy principles",
        fields: [
          {
            id: "applies",
            kind: "boolean",
            label: "Undertaking applies circular economy principles",
          },
          {
            id: "description",
            kind: "longtext",
            label: "Description of how it applies these principles",
          },
        ],
      },
      {
        id: "B7.waste",
        kind: "table",
        label: "Waste generated",
        description: "Add one row per waste type (EWC code level).",
        minRows: 1,
        maxRows: 100,
        rowLabel: (i) => `Waste row ${i + 1}`,
        columns: [
          { id: "wasteType", kind: "text", label: "Type of waste (EWC code / name)" },
          { id: "hazardClass", kind: "select", label: "Hazard class", options: wasteHazardClass },
          { id: "treatment", kind: "select", label: "Treatment", options: wasteTreatment },
          { id: "amount", kind: "number", label: "Amount", min: 0 },
          { id: "unit", kind: "select", label: "Unit", options: ["kg", "tonne"] },
        ],
      },
      {
        id: "B7.materials",
        kind: "fields",
        label: "Mass flow of relevant materials used",
        fields: [
          {
            id: "operatesInMaterialSector",
            kind: "boolean",
            label: "Does the undertaking operate in a sector using significant material inputs?",
          },
        ],
      },
      {
        id: "B7.materialsRows",
        kind: "table",
        label: "Annual mass flow of relevant materials used",
        description: "One row per material. Choose the right unit (mass or volume).",
        minRows: 1,
        maxRows: 100,
        rowLabel: (i) => `Material ${i + 1}`,
        columns: [
          { id: "material", kind: "text", label: "Material name" },
          { id: "amount", kind: "number", label: "Annual amount", min: 0 },
          { id: "unit", kind: "select", label: "Unit", options: massVolumeUnit },
        ],
      },
    ],
  },

  // ── C3 — GHG reduction targets and climate transition ──────────────────
  {
    id: "C3",
    title: "C3 — GHG reduction targets and climate transition (Comprehensive)",
    sheetRef: 'Sheet "Environmental Disclosures" §C3',
    questions: [
      {
        id: "C3.targets",
        kind: "table",
        label: "GHG reduction targets",
        description: "One row per target. Targets typically cover Scopes 1, 2 and (when material) Scope 3.",
        minRows: 1,
        maxRows: 10,
        rowLabel: (i) => `Target ${i + 1}`,
        columns: [
          { id: "name", kind: "text", label: "Target name" },
          { id: "baselineYear", kind: "number", label: "Baseline year", min: 1990, max: 2100, step: 1 },
          { id: "targetYear", kind: "number", label: "Target year", min: 2020, max: 2100, step: 1 },
          {
            id: "reductionPct",
            kind: "number",
            label: "Reduction vs. baseline (%)",
            min: 0,
            max: 100,
            step: 0.1,
          },
          { id: "scope", kind: "select", label: "Scope", options: ["Scope 1", "Scope 2", "Scope 1+2", "Scope 1+2+3"] },
        ],
      },
      {
        id: "C3.actions",
        kind: "fields",
        label: "Main actions to achieve targets",
        fields: [
          {
            id: "description",
            kind: "longtext",
            label: "Disclosure of list of main actions the entity is taking to achieve its targets",
          },
        ],
      },
      {
        id: "C3.transitionPlan",
        kind: "fields",
        label: "Transition plan (high-impact sectors)",
        fields: [
          {
            id: "highImpactSector",
            kind: "boolean",
            label: "Is the undertaking operating in high-climate-impact sectors?",
          },
          {
            id: "planStatus",
            kind: "select",
            label: "Status of implementation of a transition plan",
            options: transitionPlanStatus,
          },
          {
            id: "planDescription",
            kind: "longtext",
            label: "Description of the transition plan for climate change mitigation",
          },
          {
            id: "foreseenAdoption",
            kind: "date",
            label: "Date of foreseen adoption (if not yet adopted)",
          },
        ],
      },
    ],
  },

  // ── C4 — Climate risks ─────────────────────────────────────────────────
  {
    id: "C4",
    title: "C4 — Climate risks (Comprehensive)",
    sheetRef: 'Sheet "Environmental Disclosures" §C4',
    questions: [
      {
        id: "C4.risks",
        kind: "fields",
        label: "Climate-related hazards and transition events",
        fields: [
          {
            id: "hasIdentified",
            kind: "boolean",
            label:
              "Has the undertaking identified climate-related hazards and climate-related transition events?",
          },
          {
            id: "hazardsDescription",
            kind: "longtext",
            label: "Description of climate-related hazards and climate-related transition events",
          },
          {
            id: "exposureAssessment",
            kind: "longtext",
            label:
              "Disclosure of how exposure and sensitivity of assets, activities, and value chain has been assessed",
          },
          {
            id: "timeHorizons",
            kind: "longtext",
            label: "Time horizons of any climate-related hazards and transition events identified",
          },
          {
            id: "adaptationActions",
            kind: "longtext",
            label:
              "Disclosure of whether climate change adaptation actions have been undertaken",
          },
          {
            id: "potentialAdverseEffects",
            kind: "longtext",
            label: "Potential adverse effects of climate risks (financial impacts)",
          },
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. SOCIAL DISCLOSURES
// ─────────────────────────────────────────────────────────────────────────────

const socialSections: Section[] = [
  {
    id: "B8",
    title: "B8 — Workforce: general characteristics",
    sheetRef: 'Sheet "Social Disclosures" §B8',
    questions: [
      {
        id: "B8.contracts",
        kind: "fields",
        label: "Type of contract",
        description:
          'Employee counting unit / period are read from B1. Total = permanent + temporary.',
        fields: [
          { id: "permanent", kind: "number", label: "Permanent contract — number of employees", min: 0 },
          { id: "temporary", kind: "number", label: "Temporary contract — number of employees", min: 0 },
        ],
      },
      {
        id: "B8.gender",
        kind: "fields",
        label: "Gender breakdown",
        fields: [
          { id: "male", kind: "number", label: "Male", min: 0 },
          { id: "female", kind: "number", label: "Female", min: 0 },
          { id: "other", kind: "number", label: "Other", min: 0 },
          { id: "notReported", kind: "number", label: "Not reported", min: 0 },
        ],
      },
      {
        id: "B8.countryGate",
        kind: "fields",
        label: "Operations in more than one country?",
        fields: [
          {
            id: "multiCountry",
            kind: "boolean",
            label: "Does the undertaking operate in more than one country?",
          },
        ],
      },
      {
        id: "B8.countries",
        kind: "table",
        label: "Country of employment breakdown",
        description: "Add one row per country in which the undertaking employs people.",
        minRows: 1,
        maxRows: 100,
        rowLabel: (i) => `Country ${i + 1}`,
        columns: [
          { id: "country", kind: "selectCountry", label: "Country of employment" },
          { id: "employees", kind: "number", label: "Number of employees", min: 0 },
        ],
      },
      {
        id: "B8.turnover",
        kind: "fields",
        label: "Employee turnover rate",
        fields: [
          { id: "leavers", kind: "number", label: "Number of employees who left during the period", min: 0 },
          { id: "startCount", kind: "number", label: "Number of employees at the beginning of the period", min: 0 },
          { id: "endCount", kind: "number", label: "Number of employees at the end of the period", min: 0 },
        ],
      },
    ],
  },

  // ── B9 — Workforce: health and safety ─────────────────────────────────
  {
    id: "B9",
    title: "B9 — Workforce: health and safety",
    sheetRef: 'Sheet "Social Disclosures" §B9',
    questions: [
      {
        id: "B9.accidents",
        kind: "fields",
        label: "Work-related accidents and fatalities",
        fields: [
          {
            id: "recordable",
            kind: "number",
            label: "Number of recordable work-related accidents during the period",
            min: 0,
          },
          {
            id: "hoursPerFTE",
            kind: "number",
            label: "Number of hours worked by one full-time employee in the period",
            min: 0,
            help: "Default assumption is 2,000 hours per FTE.",
          },
          {
            id: "fatalities",
            kind: "number",
            label:
              "Number of fatalities as a result of work-related injuries and work-related ill health",
            min: 0,
          },
        ],
      },
    ],
  },

  // ── B10 — Workforce: remuneration, bargaining and training ────────────
  {
    id: "B10",
    title: "B10 — Workforce: remuneration, collective bargaining and training",
    sheetRef: 'Sheet "Social Disclosures" §B10',
    questions: [
      {
        id: "B10.minimumWage",
        kind: "fields",
        label: "Minimum wage compliance",
        fields: [
          {
            id: "atOrAboveMinimum",
            kind: "boolean",
            label:
              "Do all employees receive pay equal to or above the applicable minimum wage?",
          },
        ],
      },
      {
        id: "B10.pay",
        kind: "fields",
        label: "Gender pay gap",
        description:
          "Average gross hourly pay levels — required for undertakings with 150+ employees.",
        fields: [
          {
            id: "maleAvgHourly",
            kind: "number",
            label: "Average gross hourly pay — male employees",
            min: 0,
            step: 0.01,
          },
          {
            id: "femaleAvgHourly",
            kind: "number",
            label: "Average gross hourly pay — female employees",
            min: 0,
            step: 0.01,
          },
        ],
      },
      {
        id: "B10.collectiveBargaining",
        kind: "fields",
        label: "Collective bargaining coverage",
        fields: [
          {
            id: "covered",
            kind: "number",
            label: "Number of employees covered by collective bargaining agreements",
            min: 0,
          },
        ],
      },
      {
        id: "B10.training",
        kind: "fields",
        label: "Average annual training hours by gender",
        fields: [
          { id: "male", kind: "number", label: "Male — average annual training hours per employee", min: 0 },
          { id: "female", kind: "number", label: "Female — average annual training hours per employee", min: 0 },
          { id: "other", kind: "number", label: "Other — average annual training hours per employee", min: 0 },
          { id: "notReported", kind: "number", label: "Not reported — average annual training hours per employee", min: 0 },
        ],
      },
    ],
  },

  // ── C5 — Additional workforce characteristics ─────────────────────────
  {
    id: "C5",
    title: "C5 — Additional workforce characteristics (Comprehensive)",
    sheetRef: 'Sheet "Social Disclosures" §C5',
    questions: [
      {
        id: "C5.management",
        kind: "fields",
        label: "Management and non-employee workforce",
        fields: [
          { id: "maleManagers", kind: "number", label: "Number of male employees at management level", min: 0 },
          { id: "femaleManagers", kind: "number", label: "Number of female employees at management level", min: 0 },
          {
            id: "selfEmployed",
            kind: "number",
            label:
              "Total self-employed workers without personnel working exclusively for the undertaking",
            min: 0,
          },
          {
            id: "temporaryAgency",
            kind: "number",
            label: "Total temporary workers provided by employment agencies",
            min: 0,
          },
        ],
      },
    ],
  },

  // ── C6 — Human rights policies and processes ─────────────────────────
  {
    id: "C6",
    title: "C6 — Human rights policies and processes (Comprehensive)",
    sheetRef: 'Sheet "Social Disclosures" §C6',
    questions: [
      {
        id: "C6.policy",
        kind: "fields",
        label: "Human rights policy and complaint-handling mechanism",
        fields: [
          {
            id: "hasPolicy",
            kind: "select",
            label:
              "Does the undertaking have a code of conduct or human rights policy for its own workforce?",
            options: yesNo,
          },
          { id: "childLabour", kind: "boolean", label: "Policy covers child labour" },
          { id: "forcedLabour", kind: "boolean", label: "Policy covers forced labour" },
          { id: "humanTrafficking", kind: "boolean", label: "Policy covers human trafficking" },
          { id: "discrimination", kind: "boolean", label: "Policy covers discrimination" },
          { id: "accidentPrevention", kind: "boolean", label: "Policy covers accident prevention" },
          { id: "other", kind: "boolean", label: "Policy covers other content" },
          {
            id: "otherSpecify",
            kind: "text",
            label: "Specify other types of content covered",
          },
          {
            id: "complaintMechanism",
            kind: "select",
            label: "Does the undertaking have a complaint-handling mechanism for its own workforce?",
            options: yesNo,
          },
        ],
      },
    ],
  },

  // ── C7 — Severe negative human rights incidents ───────────────────────
  {
    id: "C7",
    title: "C7 — Severe negative human rights incidents (Comprehensive)",
    sheetRef: 'Sheet "Social Disclosures" §C7',
    questions: [
      {
        id: "C7.incidents",
        kind: "fields",
        label: "Confirmed incidents in own workforce",
        fields: [
          {
            id: "hasIncidents",
            kind: "select",
            label: "Does the undertaking have confirmed incidents in its own workforce?",
            options: yesNo,
          },
          { id: "childLabour", kind: "boolean", label: "Incidents related to child labour" },
          { id: "forcedLabour", kind: "boolean", label: "Incidents related to forced labour" },
          { id: "humanTrafficking", kind: "boolean", label: "Incidents related to human trafficking" },
          { id: "discrimination", kind: "boolean", label: "Incidents related to discrimination" },
          { id: "otherType", kind: "boolean", label: "Other type of incident" },
          {
            id: "otherSpecify",
            kind: "text",
            label: "Specify the other type of human rights incidents",
          },
          {
            id: "actions",
            kind: "longtext",
            label: "Description of actions taken to address the confirmed incidents",
          },
        ],
      },
      {
        id: "C7.valueChain",
        kind: "fields",
        label: "Confirmed incidents in the value chain",
        fields: [
          {
            id: "valueChainIncidents",
            kind: "select",
            label:
              "Aware of any confirmed incidents involving workers in the value chain, affected communities, consumers or end-users?",
            options: yesNo,
          },
          {
            id: "valueChainSpecification",
            kind: "longtext",
            label: "Specification of confirmed incidents in the value chain",
          },
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. GOVERNANCE DISCLOSURES
// ─────────────────────────────────────────────────────────────────────────────

const governanceSections: Section[] = [
  {
    id: "B11",
    title: "B11 — Convictions and fines for corruption and bribery",
    sheetRef: 'Sheet "Governance Disclosures" §B11',
    questions: [
      {
        id: "B11.convictions",
        kind: "fields",
        label: "Convictions and fines",
        fields: [
          {
            id: "hasIncurred",
            kind: "boolean",
            label: "Has the undertaking incurred convictions and fines during the reporting period?",
          },
          {
            id: "totalConvictions",
            kind: "number",
            label:
              "Total number of convictions for the violation of anti-corruption and anti-bribery laws",
            min: 0,
          },
          {
            id: "totalFines",
            kind: "number",
            label: "Total amount of fines for the violation of anti-corruption and anti-bribery laws",
            min: 0,
          },
        ],
      },
    ],
  },

  // ── C8 — Revenues from certain sectors and EU benchmarks ──────────────
  {
    id: "C8",
    title: "C8 — Revenues from certain sectors / EU benchmarks (Comprehensive)",
    sheetRef: 'Sheet "Governance Disclosures" §C8',
    questions: [
      {
        id: "C8.sectors",
        kind: "fields",
        label: "Revenues derived from controversial sectors",
        fields: [
          {
            id: "derivesRevenue",
            kind: "boolean",
            label: "Is the undertaking deriving revenues from one of the activities listed below?",
          },
          {
            id: "controversialWeapons",
            kind: "number",
            label: "Revenue from controversial weapons",
            min: 0,
          },
          { id: "tobacco", kind: "number", label: "Revenue from tobacco cultivation and production", min: 0 },
          { id: "coal", kind: "number", label: "Revenue derived from coal", min: 0 },
          { id: "oil", kind: "number", label: "Revenue derived from oil", min: 0 },
          { id: "gas", kind: "number", label: "Revenue derived from gas", min: 0 },
          { id: "chemicals", kind: "number", label: "Revenue derived from chemicals production", min: 0 },
        ],
      },
      {
        id: "C8.benchmarks",
        kind: "fields",
        label: "Exclusion from EU reference benchmarks",
        description:
          "Tick any that apply. Undertakings are excluded from EU Paris-aligned benchmarks if any of the thresholds below are met.",
        fields: [
          {
            id: "coalThreshold",
            kind: "boolean",
            label: "≥1% revenues from hard coal and lignite (exploration, mining, extraction, distribution, refining)",
          },
          {
            id: "oilThreshold",
            kind: "boolean",
            label: "≥10% revenues from oil fuels (exploration, extraction, distribution, refining)",
          },
          {
            id: "gasThreshold",
            kind: "boolean",
            label: "≥50% revenues from gaseous fuels (exploration, extraction, manufacturing, distribution)",
          },
          {
            id: "electricityThreshold",
            kind: "boolean",
            label: "≥50% revenues from electricity generation with GHG intensity >100g CO₂e/kWh",
          },
          { id: "noneOfAbove", kind: "boolean", label: "None of the above" },
        ],
      },
    ],
  },

  // ── C9 — Gender diversity in the governance body ──────────────────────
  {
    id: "C9",
    title: "C9 — Gender diversity in the governance body (Comprehensive)",
    sheetRef: 'Sheet "Governance Disclosures" §C9',
    questions: [
      {
        id: "C9.diversity",
        kind: "fields",
        label: "Governance body gender diversity",
        fields: [
          {
            id: "hasGovernanceBody",
            kind: "boolean",
            label: "Does the undertaking have a governance body in place?",
          },
          {
            id: "femaleBoard",
            kind: "number",
            label: "Number of female board members at the end of the reporting period",
            min: 0,
          },
          {
            id: "maleBoard",
            kind: "number",
            label: "Number of male board members at the end of the reporting period",
            min: 0,
          },
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 5. ADDITIONAL FREE-TEXT DISCLOSURES
// ─────────────────────────────────────────────────────────────────────────────

const additionalSection: Section = {
  id: "ADD",
  title: "Additional disclosures",
  sheetRef: "Various sheets",
  questions: [
    {
      id: "ADD.general",
      kind: "fields",
      label: "Other general or entity-specific information",
      fields: [
        {
          id: "text",
          kind: "longtext",
          label: "Disclosure of any other general or entity-specific information on the reporting period",
        },
      ],
    },
    {
      id: "ADD.env",
      kind: "fields",
      label: "Other environmental or entity-specific environmental disclosures",
      fields: [
        {
          id: "text",
          kind: "longtext",
          label: "Disclosure of any other environmental or entity-specific environmental disclosures",
        },
      ],
    },
    {
      id: "ADD.social",
      kind: "fields",
      label: "Other social or entity-specific social disclosures",
      fields: [
        {
          id: "text",
          kind: "longtext",
          label: "Disclosure of any other social or entity-specific social disclosures",
        },
      ],
    },
    {
      id: "ADD.gov",
      kind: "fields",
      label: "Other governance or entity-specific governance disclosures",
      fields: [
        {
          id: "text",
          kind: "longtext",
          label: "Disclosure of any other governance or entity-specific governance disclosures",
        },
      ],
    },
  ],
};

export const sections: Section[] = [
  ...generalInformationSections,
  ...environmentalSections,
  ...socialSections,
  ...governanceSections,
  additionalSection,
];

// Make tree-shaking-friendly access to the country/currency lists for any
// consumer that wants to inspect what VSME's allowed enums look like.
export const vsmeEnumerations = {
  basisForPreparation,
  basisForReporting,
  undertakingLegalForm,
  employeeCountingMethodology,
  employeeCountingUnit,
  yesNo,
  transitionPlanStatus,
  biodiversityLocation,
  areaUnit,
  pollutantUnit,
  wasteHazardClass,
  wasteTreatment,
  massVolumeUnit,
};
