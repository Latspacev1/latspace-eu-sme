/**
 * Binding from in-app VSME answers (question id + field id) → VSME Digital
 * Template cells.
 *
 * Template reference: EFRAG VSME Digital Template v1.2.0 (2026-02-27).
 *
 * Layout notes (from auditing the template's merged cells & formula cells):
 *   - Column C frequently holds disclosure labels in merged ranges (e.g.
 *     C5:F5). The user inputs sit in the *next* merged range to the right
 *     (e.g. G5:K5). When writing to a merged range we always target the
 *     top-left anchor cell of that range — ExcelJS / openpyxl both refuse
 *     to write to a non-anchor merged cell.
 *   - Computed/derived cells (e.g. SOC!D11 = Total − Permanent; ENV!D311
 *     = withdrawn − discharged) are intentionally NOT bound — letting the
 *     template's own formulas drive them keeps validation consistent.
 *   - Column I/L is the validation-status column on every disclosure
 *     sheet; we never touch it.
 */

export interface FieldBinding {
  kind: "field";
  questionId: string;
  fieldId: string;
  sheet: string;
  cell: string;
  /** Optional value transformer. */
  transform?:
    | "dateFromIso"
    | "yesNoFromBool"
    | "yesNoString"
    | "boolean"
    | "year";
}

export interface TableBinding {
  kind: "table";
  questionId: string;
  sheet: string;
  /** First row of block N=0. */
  anchorRow: number;
  /** Rows added per subsequent row (usually 1). */
  rowStride: number;
  /** Column letter for each field id in the row. */
  columns: Record<string, { col: string; transform?: FieldBinding["transform"] }>;
  /** Max rows we will write (protects us from exceeding the template's provision). */
  maxRows: number;
}

export type Binding = FieldBinding | TableBinding;

const GI = "General Information";
const ENV = "Environmental Disclosures";
const SOC = "Social Disclosures";
const GOV = "Governance Disclosures";

export const bindings: Binding[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Report Information (GI rows 3-13)
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "GI.entity", fieldId: "name",             sheet: GI, cell: "D3" },
  { kind: "field", questionId: "GI.entity", fieldId: "identifier",       sheet: GI, cell: "E4" },
  { kind: "field", questionId: "GI.entity", fieldId: "identifierScheme", sheet: GI, cell: "D4" },
  { kind: "field", questionId: "GI.entity", fieldId: "currency",         sheet: GI, cell: "D5" },

  // Reporting period — the template splits dates into Y/M/D triplets at
  // D6/D7/D8 (start) and D10/D11/D12 (end), with D9 / D13 themselves being
  // computed cells. We write the year part of an ISO date to D6 / D10 so
  // the rest of the formula chain produces something useful; users can
  // refine month/day in Excel if needed.
  { kind: "field", questionId: "GI.period", fieldId: "startDate", sheet: GI, cell: "D6",  transform: "year" },
  { kind: "field", questionId: "GI.period", fieldId: "endDate",   sheet: GI, cell: "D10", transform: "year" },

  // Previous reporting period
  { kind: "field", questionId: "GI.previous", fieldId: "containsUnchanged",   sheet: GI, cell: "E18",  transform: "boolean" },
  { kind: "field", questionId: "GI.previous", fieldId: "previousReportUrl",   sheet: GI, cell: "E119" },

  // List of unchanged disclosures — rows 19-118 (100 rows; column E)
  {
    kind: "table",
    questionId: "GI.previousList",
    sheet: GI,
    anchorRow: 19,
    rowStride: 1,
    maxRows: 100,
    columns: {
      code: { col: "E" },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // B1 — Basis for preparation
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "B1.basis", fieldId: "module", sheet: GI, cell: "E122" },

  // Other undertaking details
  { kind: "field", questionId: "B1.entityDetails", fieldId: "basisReporting",          sheet: GI, cell: "E177" },
  { kind: "field", questionId: "B1.entityDetails", fieldId: "legalForm",               sheet: GI, cell: "E178" },
  { kind: "field", questionId: "B1.entityDetails", fieldId: "legalFormOther",          sheet: GI, cell: "E179" },
  { kind: "field", questionId: "B1.entityDetails", fieldId: "balanceSheet",            sheet: GI, cell: "E280" },
  { kind: "field", questionId: "B1.entityDetails", fieldId: "turnover",                sheet: GI, cell: "E281" },
  { kind: "field", questionId: "B1.entityDetails", fieldId: "numberOfEmployees",       sheet: GI, cell: "E282" },
  { kind: "field", questionId: "B1.entityDetails", fieldId: "employeeCountingPeriod",  sheet: GI, cell: "E283" },
  { kind: "field", questionId: "B1.entityDetails", fieldId: "employeeCountingUnit",    sheet: GI, cell: "E284" },
  { kind: "field", questionId: "B1.entityDetails", fieldId: "countryOfPrimaryOps",     sheet: GI, cell: "E285" },

  // NACE codes — column E rows 181-280 (100 rows)
  {
    kind: "table",
    questionId: "B1.NACE",
    sheet: GI,
    anchorRow: 181,
    rowStride: 1,
    maxRows: 20,
    columns: {
      code: { col: "E" },
    },
  },

  // Subsidiaries — rows 290-389. Template columns: C=ID (already 1..100),
  // D=name, E=registered address. Country/address-detail are not separate
  // input cells in the template — keep our model rich, write what fits.
  {
    kind: "table",
    questionId: "B1.subsidiaries",
    sheet: GI,
    anchorRow: 290,
    rowStride: 1,
    maxRows: 100,
    columns: {
      name:    { col: "D" },
      address: { col: "E" },
    },
  },

  // Certifications
  { kind: "field", questionId: "B1.certifications", fieldId: "hasCertification", sheet: GI, cell: "E394", transform: "boolean" },
  { kind: "field", questionId: "B1.certifications", fieldId: "description",     sheet: GI, cell: "E395" },

  // Sites — rows 404-503. Template cols: D=address, E=postal code, F=city,
  // G=country. We map our simpler {name, country, address, lat, lng}
  // shape: name → D (template uses it as a one-line address), country → G.
  {
    kind: "table",
    questionId: "B1.sites",
    sheet: GI,
    anchorRow: 404,
    rowStride: 1,
    maxRows: 100,
    columns: {
      address: { col: "D" },
      name:    { col: "F" },
      country: { col: "G" },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // B2 — Practices, policies and future initiatives
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "B2.policies", fieldId: "hasPractices", sheet: GI, cell: "C510", transform: "boolean" },
  { kind: "field", questionId: "B2.policies", fieldId: "description",  sheet: GI, cell: "D510" },

  // Cooperative-specific (D514-D516; column E has formulas that gate visibility)
  { kind: "field", questionId: "B2.cooperative", fieldId: "participation",       sheet: GI, cell: "D514" },
  { kind: "field", questionId: "B2.cooperative", fieldId: "financialInvestment", sheet: GI, cell: "D515" },
  { kind: "field", questionId: "B2.cooperative", fieldId: "profitLimits",        sheet: GI, cell: "D516" },

  // ─────────────────────────────────────────────────────────────────────────
  // C1 — Strategy and business model (Comprehensive)
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "C1.strategy", fieldId: "productsServices",         sheet: GI, cell: "E525" },
  { kind: "field", questionId: "C1.strategy", fieldId: "markets",                  sheet: GI, cell: "E526" },
  { kind: "field", questionId: "C1.strategy", fieldId: "businessRelationships",   sheet: GI, cell: "E527" },
  { kind: "field", questionId: "C1.strategy", fieldId: "hasSustainabilityElements", sheet: GI, cell: "E528", transform: "boolean" },
  { kind: "field", questionId: "C1.strategy", fieldId: "sustainabilityElements",  sheet: GI, cell: "E529" },

  // ─────────────────────────────────────────────────────────────────────────
  // C2 — Description of practices and policies (Comprehensive)
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "C2.description", fieldId: "practiceDescription", sheet: GI, cell: "E519" },
  { kind: "field", questionId: "C2.description", fieldId: "targetDescription",   sheet: GI, cell: "E520" },
  { kind: "field", questionId: "C2.description", fieldId: "accountability",      sheet: GI, cell: "E521" },

  // Additional general
  { kind: "field", questionId: "ADD.general", fieldId: "text", sheet: GI, cell: "C533" },

  // ─────────────────────────────────────────────────────────────────────────
  // B3 — Energy and GHG (Environmental sheet) — note the G column is the
  // user-input anchor (G##:K## merged ranges). C## holds the label.
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "B3.energyTotal", fieldId: "total", sheet: ENV, cell: "G5" },

  { kind: "field", questionId: "B3.energyBreakdown", fieldId: "hasBreakdown",  sheet: ENV, cell: "G10", transform: "boolean" },
  { kind: "field", questionId: "B3.energyBreakdown", fieldId: "electricity",   sheet: ENV, cell: "G12" },
  { kind: "field", questionId: "B3.energyBreakdown", fieldId: "selfGenerated", sheet: ENV, cell: "G13" },
  // Fuels: G14 itself is driven from the Fuel Converter sheet; J14 is the
  // manual override slot ("Energy consumption in MWh").
  { kind: "field", questionId: "B3.energyBreakdown", fieldId: "fuels",         sheet: ENV, cell: "J14" },

  // GHG scopes — D21 is computed from GI; the year input is implicit. The
  // scope inputs sit in G## (anchor of G##:I## merges).
  { kind: "field", questionId: "B3.scopes", fieldId: "scope1",         sheet: ENV, cell: "G22" },
  { kind: "field", questionId: "B3.scopes", fieldId: "scope2Location", sheet: ENV, cell: "G23" },
  { kind: "field", questionId: "B3.scopes", fieldId: "scope2Market",   sheet: ENV, cell: "G24" },

  { kind: "field", questionId: "B3.scope3", fieldId: "hasScope3", sheet: ENV, cell: "G29", transform: "boolean" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat1",  sheet: ENV, cell: "G30" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat2",  sheet: ENV, cell: "G31" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat3",  sheet: ENV, cell: "G32" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat4",  sheet: ENV, cell: "G33" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat5",  sheet: ENV, cell: "G34" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat6",  sheet: ENV, cell: "G35" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat7",  sheet: ENV, cell: "G36" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat8",  sheet: ENV, cell: "G37" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat9",  sheet: ENV, cell: "G38" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat10", sheet: ENV, cell: "G39" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat11", sheet: ENV, cell: "G40" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat12", sheet: ENV, cell: "G41" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat13", sheet: ENV, cell: "G42" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat14", sheet: ENV, cell: "G43" },
  { kind: "field", questionId: "B3.scope3", fieldId: "cat15", sheet: ENV, cell: "G44" },

  // ─────────────────────────────────────────────────────────────────────────
  // C3 — GHG targets and transition (Comprehensive)
  // Targets table: rows 21-24 in the right-side block (G/H/I/J/K). The
  // template only provides 4 target rows.
  // ─────────────────────────────────────────────────────────────────────────
  {
    kind: "table",
    questionId: "C3.targets",
    sheet: ENV,
    anchorRow: 21,
    rowStride: 1,
    maxRows: 4,
    columns: {
      name:         { col: "G" },
      baselineYear: { col: "H" },
      targetYear:   { col: "I" },
      reductionPct: { col: "J" },
      scope:        { col: "K" },
    },
  },

  // The "main actions" free-text input is in the big merged label cell
  // C52:K52 — there is no separate dedicated input row, the user types
  // directly into the merged area. We write to C52 (anchor).
  { kind: "field", questionId: "C3.actions", fieldId: "description", sheet: ENV, cell: "C52" },

  // Transition plan. D56 is a *computed* high-impact-sector check —
  // intentionally NOT bound. D57 / D58 are anchors of D##:K## merged
  // ranges. D59 holds the label "Year" so the actual date input goes in
  // I59 (anchor of I59:K59).
  { kind: "field", questionId: "C3.transitionPlan", fieldId: "planStatus",        sheet: ENV, cell: "D57" },
  { kind: "field", questionId: "C3.transitionPlan", fieldId: "planDescription",   sheet: ENV, cell: "D58" },
  { kind: "field", questionId: "C3.transitionPlan", fieldId: "foreseenAdoption",  sheet: ENV, cell: "I59", transform: "year" },

  // ─────────────────────────────────────────────────────────────────────────
  // B4 — Pollution
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "B4.pollutionGate", fieldId: "requiredByLaw",     sheet: ENV, cell: "G74", transform: "boolean" },
  { kind: "field", questionId: "B4.pollutionGate", fieldId: "publiclyAvailable", sheet: ENV, cell: "G75", transform: "boolean" },
  { kind: "field", questionId: "B4.pollutionGate", fieldId: "publicUrl",         sheet: ENV, cell: "G76" },
  // The "select unit" dropdown sits in the C78:K78 merged input cell that
  // sits right under the C77:K77 label. Anchor is C78.
  { kind: "field", questionId: "B4.pollutionGate", fieldId: "unit",              sheet: ENV, cell: "C78" },

  // Pollutants table — rows 80-179. Template columns:
  //   D pollutant name (merged D:F), G air amount (merged G:I),
  //   J water amount, K soil amount. Our "medium + amount" pair gets split:
  //   we write the amount to whichever column matches the medium.
  // Since the binding system only supports one cell per field id, we use a
  // transform-style: medium decides which column. To stay simple, we map
  // pollutant→D and the per-medium amounts go to separate fields.
  {
    kind: "table",
    questionId: "B4.pollutants",
    sheet: ENV,
    anchorRow: 80,
    rowStride: 1,
    maxRows: 100,
    columns: {
      pollutant:   { col: "D" },
      amountAir:   { col: "G" },
      amountWater: { col: "J" },
      amountSoil:  { col: "K" },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // B5 — Biodiversity
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "B5.sensitiveAreas", fieldId: "hasSensitiveSites", sheet: ENV, cell: "G184", transform: "boolean" },
  // Unit selector input is C186 (anchor of C186:K186, right under the
  // label row 185).
  { kind: "field", questionId: "B5.sensitiveAreas", fieldId: "areaUnit",          sheet: ENV, cell: "C186" },

  // Sites in sensitive areas — rows 188-287. Template cols:
  //   C site ID (manual), G/J/K: location flags & area.
  //   D188 is a derived "site location" lookup formula, do not write.
  // Our model writes siteId→C, area→G, location→J (booleans aren't a
  // perfect match — the template uses two boolean columns J & K for "in"
  // and "near"; we collapse to J).
  {
    kind: "table",
    questionId: "B5.sites",
    sheet: ENV,
    anchorRow: 188,
    rowStride: 1,
    maxRows: 100,
    columns: {
      siteId:   { col: "C" },
      area:     { col: "G" },
      location: { col: "J" },
    },
  },

  // Land use — D## is the anchor of D##:F## merges. G295 holds a summary
  // formula across the block; don't write to it. The user inputs go in
  // the D-column for sealed/on-site/off-site, with totalLandUse following.
  { kind: "field", questionId: "B5.landUse", fieldId: "sealedArea",    sheet: ENV, cell: "D295" },
  { kind: "field", questionId: "B5.landUse", fieldId: "natureOnSite",  sheet: ENV, cell: "D296" },
  { kind: "field", questionId: "B5.landUse", fieldId: "natureOffSite", sheet: ENV, cell: "D297" },
  { kind: "field", questionId: "B5.landUse", fieldId: "totalLandUse",  sheet: ENV, cell: "D298" },

  // ─────────────────────────────────────────────────────────────────────────
  // B6 — Water
  // E303 / E304 are formulas that compute validation status; the user
  // value goes in D303 / D304 (the anchors of D##:D## merged ranges? no,
  // they're standalone). Looking again: actually template stores user
  // input at D303 / D304 — let me verify with a check below the table.
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "B6.withdrawal", fieldId: "totalWithdrawn",      sheet: ENV, cell: "D303" },
  { kind: "field", questionId: "B6.withdrawal", fieldId: "highStressWithdrawn", sheet: ENV, cell: "D304" },

  { kind: "field", questionId: "B6.consumption", fieldId: "hasProcessConsumption", sheet: ENV, cell: "G309", transform: "boolean" },
  { kind: "field", questionId: "B6.consumption", fieldId: "discharge",             sheet: ENV, cell: "D310" },
  // totalConsumption is derived (D311 = D303 - D310); we don't write to it.

  // ─────────────────────────────────────────────────────────────────────────
  // B7 — Circular economy and waste
  // H316 / H317 are validation/computed cells; the YES/NO selector and
  // description input go in D316 / D317.
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "B7.circular", fieldId: "applies",     sheet: ENV, cell: "D316", transform: "yesNoString" },
  { kind: "field", questionId: "B7.circular", fieldId: "description", sheet: ENV, cell: "D317" },

  // Waste — rows 323-422. Template cols: D waste type (merged D:F),
  //   G unit of measurement (merged G:I), J recycle/reuse amount,
  //   K disposal amount. Our model has a single "amount" + "treatment"
  //   select. We pick the destination column based on treatment, similar
  //   to the pollutant medium logic — to stay simple, we write the amount
  //   to J (recycle) by default and treatment text to G.
  {
    kind: "table",
    questionId: "B7.waste",
    sheet: ENV,
    anchorRow: 323,
    rowStride: 1,
    maxRows: 100,
    columns: {
      wasteType:    { col: "D" },
      unit:         { col: "G" },
      amount:       { col: "J" },
    },
  },

  { kind: "field", questionId: "B7.materials", fieldId: "operatesInMaterialSector", sheet: ENV, cell: "G433", transform: "boolean" },

  // Materials mass-flow — rows 435-534. Template cols:
  //   D material (merged D:F), G amount (merged G:I), J unit of measurement.
  {
    kind: "table",
    questionId: "B7.materialsRows",
    sheet: ENV,
    anchorRow: 435,
    rowStride: 1,
    maxRows: 100,
    columns: {
      material: { col: "D" },
      amount:   { col: "G" },
      unit:     { col: "J" },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // C4 — Climate risks (Comprehensive)
  // Labels live in C##:D## merges; user inputs live in E##:K## merges.
  // We write to E## (the anchor of each input merge).
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "C4.risks", fieldId: "hasIdentified",            sheet: ENV, cell: "E539", transform: "boolean" },
  { kind: "field", questionId: "C4.risks", fieldId: "hazardsDescription",       sheet: ENV, cell: "E540" },
  { kind: "field", questionId: "C4.risks", fieldId: "exposureAssessment",       sheet: ENV, cell: "E541" },
  { kind: "field", questionId: "C4.risks", fieldId: "timeHorizons",             sheet: ENV, cell: "E542" },
  { kind: "field", questionId: "C4.risks", fieldId: "adaptationActions",        sheet: ENV, cell: "E543" },
  { kind: "field", questionId: "C4.risks", fieldId: "potentialAdverseEffects",  sheet: ENV, cell: "E544" },

  // Additional environmental
  { kind: "field", questionId: "ADD.env", fieldId: "text", sheet: ENV, cell: "C548" },

  // ─────────────────────────────────────────────────────────────────────────
  // B8 — Workforce general characteristics (Social sheet)
  // Inputs at D10 / D18-D21 are anchors of D##:G## merges.
  // D11 (temporary) is computed (total − permanent) — do not write.
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "B8.contracts", fieldId: "permanent", sheet: SOC, cell: "D10" },

  { kind: "field", questionId: "B8.gender", fieldId: "male",        sheet: SOC, cell: "D18" },
  { kind: "field", questionId: "B8.gender", fieldId: "female",      sheet: SOC, cell: "D19" },
  { kind: "field", questionId: "B8.gender", fieldId: "other",       sheet: SOC, cell: "D20" },
  { kind: "field", questionId: "B8.gender", fieldId: "notReported", sheet: SOC, cell: "D21" },

  { kind: "field", questionId: "B8.countryGate", fieldId: "multiCountry", sheet: SOC, cell: "E27", transform: "boolean" },

  // Country breakdown — rows 29-128. Template cols: C country (merged
  // C:D), E employees (merged E:H).
  {
    kind: "table",
    questionId: "B8.countries",
    sheet: SOC,
    anchorRow: 29,
    rowStride: 1,
    maxRows: 100,
    columns: {
      country:   { col: "C" },
      employees: { col: "E" },
    },
  },

  { kind: "field", questionId: "B8.turnover", fieldId: "leavers",    sheet: SOC, cell: "D134" },
  { kind: "field", questionId: "B8.turnover", fieldId: "startCount", sheet: SOC, cell: "D135" },
  { kind: "field", questionId: "B8.turnover", fieldId: "endCount",   sheet: SOC, cell: "D136" },

  // ─────────────────────────────────────────────────────────────────────────
  // B9 — Health and safety
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "B9.accidents", fieldId: "recordable",  sheet: SOC, cell: "D140" },
  { kind: "field", questionId: "B9.accidents", fieldId: "hoursPerFTE", sheet: SOC, cell: "D141" },
  { kind: "field", questionId: "B9.accidents", fieldId: "fatalities",  sheet: SOC, cell: "D144" },

  // ─────────────────────────────────────────────────────────────────────────
  // B10 — Remuneration, bargaining, training
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "B10.minimumWage", fieldId: "atOrAboveMinimum", sheet: SOC, cell: "D147", transform: "yesNoString" },

  { kind: "field", questionId: "B10.pay", fieldId: "maleAvgHourly",   sheet: SOC, cell: "D148" },
  { kind: "field", questionId: "B10.pay", fieldId: "femaleAvgHourly", sheet: SOC, cell: "D149" },

  { kind: "field", questionId: "B10.collectiveBargaining", fieldId: "covered", sheet: SOC, cell: "D151" },

  { kind: "field", questionId: "B10.training", fieldId: "male",        sheet: SOC, cell: "D157" },
  { kind: "field", questionId: "B10.training", fieldId: "female",      sheet: SOC, cell: "D158" },
  { kind: "field", questionId: "B10.training", fieldId: "other",       sheet: SOC, cell: "D159" },
  { kind: "field", questionId: "B10.training", fieldId: "notReported", sheet: SOC, cell: "D160" },

  // ─────────────────────────────────────────────────────────────────────────
  // C5 — Additional workforce
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "C5.management", fieldId: "maleManagers",    sheet: SOC, cell: "D165" },
  { kind: "field", questionId: "C5.management", fieldId: "femaleManagers",  sheet: SOC, cell: "D166" },
  { kind: "field", questionId: "C5.management", fieldId: "selfEmployed",    sheet: SOC, cell: "D168" },
  { kind: "field", questionId: "C5.management", fieldId: "temporaryAgency", sheet: SOC, cell: "D169" },

  // ─────────────────────────────────────────────────────────────────────────
  // C6 — Human rights policies
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "C6.policy", fieldId: "hasPolicy",           sheet: SOC, cell: "D172", transform: "yesNoString" },
  { kind: "field", questionId: "C6.policy", fieldId: "childLabour",        sheet: SOC, cell: "D174", transform: "boolean" },
  { kind: "field", questionId: "C6.policy", fieldId: "forcedLabour",       sheet: SOC, cell: "D175", transform: "boolean" },
  { kind: "field", questionId: "C6.policy", fieldId: "humanTrafficking",   sheet: SOC, cell: "D176", transform: "boolean" },
  { kind: "field", questionId: "C6.policy", fieldId: "discrimination",     sheet: SOC, cell: "D177", transform: "boolean" },
  { kind: "field", questionId: "C6.policy", fieldId: "accidentPrevention", sheet: SOC, cell: "D178", transform: "boolean" },
  { kind: "field", questionId: "C6.policy", fieldId: "other",              sheet: SOC, cell: "D179", transform: "boolean" },
  { kind: "field", questionId: "C6.policy", fieldId: "otherSpecify",       sheet: SOC, cell: "D180" },
  { kind: "field", questionId: "C6.policy", fieldId: "complaintMechanism", sheet: SOC, cell: "D181", transform: "yesNoString" },

  // ─────────────────────────────────────────────────────────────────────────
  // C7 — Severe negative human rights incidents
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "C7.incidents", fieldId: "hasIncidents",     sheet: SOC, cell: "D184", transform: "yesNoString" },
  { kind: "field", questionId: "C7.incidents", fieldId: "childLabour",      sheet: SOC, cell: "D186", transform: "boolean" },
  { kind: "field", questionId: "C7.incidents", fieldId: "forcedLabour",     sheet: SOC, cell: "D187", transform: "boolean" },
  { kind: "field", questionId: "C7.incidents", fieldId: "humanTrafficking", sheet: SOC, cell: "D188", transform: "boolean" },
  { kind: "field", questionId: "C7.incidents", fieldId: "discrimination",   sheet: SOC, cell: "D189", transform: "boolean" },
  { kind: "field", questionId: "C7.incidents", fieldId: "otherType",        sheet: SOC, cell: "D190", transform: "boolean" },
  { kind: "field", questionId: "C7.incidents", fieldId: "otherSpecify",     sheet: SOC, cell: "D191" },
  { kind: "field", questionId: "C7.incidents", fieldId: "actions",          sheet: SOC, cell: "D192" },

  { kind: "field", questionId: "C7.valueChain", fieldId: "valueChainIncidents",     sheet: SOC, cell: "D193", transform: "yesNoString" },
  { kind: "field", questionId: "C7.valueChain", fieldId: "valueChainSpecification", sheet: SOC, cell: "D194" },

  // Additional social
  { kind: "field", questionId: "ADD.social", fieldId: "text", sheet: SOC, cell: "C200" },

  // ─────────────────────────────────────────────────────────────────────────
  // B11 — Convictions and fines (Governance sheet)
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "B11.convictions", fieldId: "hasIncurred",      sheet: GOV, cell: "H5", transform: "boolean" },
  { kind: "field", questionId: "B11.convictions", fieldId: "totalConvictions", sheet: GOV, cell: "H6" },
  { kind: "field", questionId: "B11.convictions", fieldId: "totalFines",       sheet: GOV, cell: "H7" },

  // ─────────────────────────────────────────────────────────────────────────
  // C8 — Revenues from certain sectors / EU benchmarks
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "C8.sectors", fieldId: "derivesRevenue",       sheet: GOV, cell: "H10",  transform: "boolean" },
  { kind: "field", questionId: "C8.sectors", fieldId: "controversialWeapons", sheet: GOV, cell: "H12" },
  { kind: "field", questionId: "C8.sectors", fieldId: "tobacco",              sheet: GOV, cell: "H13" },
  { kind: "field", questionId: "C8.sectors", fieldId: "coal",                 sheet: GOV, cell: "H14" },
  { kind: "field", questionId: "C8.sectors", fieldId: "oil",                  sheet: GOV, cell: "H15" },
  { kind: "field", questionId: "C8.sectors", fieldId: "gas",                  sheet: GOV, cell: "H16" },
  { kind: "field", questionId: "C8.sectors", fieldId: "chemicals",            sheet: GOV, cell: "H18" },

  { kind: "field", questionId: "C8.benchmarks", fieldId: "coalThreshold",        sheet: GOV, cell: "H22", transform: "boolean" },
  { kind: "field", questionId: "C8.benchmarks", fieldId: "oilThreshold",         sheet: GOV, cell: "H23", transform: "boolean" },
  { kind: "field", questionId: "C8.benchmarks", fieldId: "gasThreshold",         sheet: GOV, cell: "H24", transform: "boolean" },
  { kind: "field", questionId: "C8.benchmarks", fieldId: "electricityThreshold", sheet: GOV, cell: "H25", transform: "boolean" },
  { kind: "field", questionId: "C8.benchmarks", fieldId: "noneOfAbove",          sheet: GOV, cell: "H26", transform: "boolean" },

  // ─────────────────────────────────────────────────────────────────────────
  // C9 — Gender diversity in governance body
  // ─────────────────────────────────────────────────────────────────────────
  { kind: "field", questionId: "C9.diversity", fieldId: "hasGovernanceBody", sheet: GOV, cell: "H30", transform: "boolean" },
  { kind: "field", questionId: "C9.diversity", fieldId: "femaleBoard",       sheet: GOV, cell: "H31" },
  { kind: "field", questionId: "C9.diversity", fieldId: "maleBoard",         sheet: GOV, cell: "H32" },

  // Additional governance
  { kind: "field", questionId: "ADD.gov", fieldId: "text", sheet: GOV, cell: "C38" },
];
