/**
 * One-shot generator: ChainCraft Excel → Supabase seed SQL.
 *
 * Reads ChainCraft_VSME_Input_Output_FY2025.xlsx (Input + Output sheets) and
 * emits supabase/seed/chaincraft_fy2025.sql with:
 *   - 1 reporting_periods row (FY2025)
 *   - One parameters row per Input row + per Output row
 *   - One data_points row per Input row (monthly array if cells B–M populated)
 *   - One formulas row per Output formula (Excel cell refs translated to param codes)
 *
 * Usage:
 *   node scripts/generate-chaincraft-seed.mjs \
 *     --excel "C:/Users/ishan/Downloads/Chaincraft/Chaincraft/ChainCraft VSME/ChainCraft_VSME_Input_Output_FY2025.xlsx" \
 *     --out  supabase/seed/chaincraft_fy2025.sql
 */
import ExcelJS from "exceljs";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// ──────────────────────────────────────────────────────────────────────────
// CLI args
// ──────────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const EXCEL_PATH = args.excel;
const OUT_PATH   = args.out ?? "supabase/seed/chaincraft_fy2025.sql";
if (!EXCEL_PATH) {
  console.error("Missing --excel <path>");
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────
// Section mapping (Excel section header → DB enum)
// ──────────────────────────────────────────────────────────────────────────
const INPUT_SECTION_MAP = [
  { match: /ENERGY/i,                section: "energy" },
  { match: /FEEDSTOCK/i,             section: "feedstock" },
  { match: /^3 . WATER/i,            section: "water" },
  { match: /WASTEWATER/i,            section: "wastewater" },
  { match: /AIR POLLUTANT/i,         section: "air" },
  { match: /HAZARDOUS WASTE/i,       section: "hazardous_waste" },
  { match: /WORKFORCE/i,             section: "workforce" },
  { match: /GOVERNANCE/i,            section: "governance" },
  { match: /EMISSION FACTORS/i,      section: "conversion" },
];

const OUTPUT_SECTION_MAP = [
  { match: /ENERGY CONSUMPTION/i,             section: "vsme_b3_energy" },
  { match: /SCOPE 1/i,                        section: "vsme_b3_scope1" },
  { match: /SCOPE 2/i,                        section: "vsme_b3_scope2" },
  { match: /SCOPE 3/i,                        section: "vsme_b3_scope3" },
  { match: /CONSOLIDATED GHG/i,               section: "vsme_b3_consolidated" },
  { match: /^WATER/i,                         section: "vsme_b6_water" },
  { match: /POLLUTION/i,                      section: "vsme_b4_pollution" },
  { match: /^WASTE/i,                         section: "vsme_b7_waste" },
  { match: /MASS-FLOW/i,                      section: "vsme_b7_materials" },
  { match: /WORKFORCE & GOVERNANCE/i,         section: "vsme_b8_b11_workforce_gov" },
];

const sectionFor = (name, map) => map.find(m => m.match.test(name))?.section;

// Hand-curated codes for known parameters. Anything not listed gets auto-slugified
// from its display name. Codes are STABLE identifiers used in formula expressions —
// keep them short and snake_case.
const INPUT_CODES = {
  "Electricity purchased — Peak (Piek)":              "electricity_peak",
  "Electricity purchased — Off-peak (Dal)":           "electricity_offpeak",
  "Electricity purchased — Total":                    "electricity_total",
  "Natural gas consumption":                          "natural_gas",
  "Biogas produced (self-generated)":                 "biogas_produced",
  "Biogas — CH₄ fraction (median)":                   "biogas_ch4_fraction",
  "Biogas — CO₂ fraction (median)":                   "biogas_co2_fraction",
  "Biogas routed to flare (HAR → flare)":             "biogas_flared",

  "Voederbier / alcohol water — Van Triest":          "feed_alcohol_water",
  "Potato juice — Avebe":                             "feed_potato_juice",
  "Starch substrate, Crespovit — Looop":              "feed_starch_crespovit_looop",
  "Starch substrate, Crespovit — Duynie":             "feed_starch_crespovit_duynie",
  "Starch substrate, Hamino — Duynie":                "feed_starch_hamino",
  "NaOH 25% solution — Vynova":                       "naoh_25",
  "NaOH 32% solution — Vynova":                       "naoh_32",
  "Biergist / brewer's yeast — Duynie":               "brewers_yeast",
  "Ethanol water — Caldic":                           "ethanol_water",

  "Water withdrawn (municipal — Waternet)":           "water_withdrawn",
  "Water discharged (process wastewater)":            "water_discharged",

  "Phosphorus (as total P)":                          "ww_phosphorus_kg",
  "Heavy metals Group 1 (Zn, Cu, Ni, Cr, Pb, As, Ag)":"ww_heavy_metals_g1_kg",
  "Heavy metals Group 2 (Hg, Cd)":                    "ww_heavy_metals_g2_kg",
  "Chloride":                                         "ww_chloride_kg",
  "Nitrogen (Kjeldahl-N)":                            "ww_nitrogen_kg",
  "ZBS / COD (oxygen-binding substances)":            "ww_cod_kg",

  "Nitrogen oxides (NOₓ as NO₂)":                     "air_nox_tonnes",

  "07 01 01 — Organic acids":                         "hazwaste_07_01_01",
  "06 02 05 — Inorganic alkali":                      "hazwaste_06_02_05",
  "06 01 06 — Inorganic acids":                       "hazwaste_06_01_06",
  "07 01 03 — Halogenated solvents":                  "hazwaste_07_01_03",
  "16 05 06 — Other hazardous":                       "hazwaste_16_05_06",

  "Employees on permanent contract":                  "emp_permanent",
  "Employees on temporary contract":                  "emp_temporary",
  "Male employees":                                   "emp_male_fte",
  "Female employees":                                 "emp_female_fte",
  "FTE at start of period (1 Jan 2025)":              "fte_start",
  "FTE at end of period (31 Dec 2025)":               "fte_end",
  "Employees who left during the period":             "emp_leavers",
  "Hours worked per full-time employee":              "hours_per_fte",
  "Recordable work-related accidents":                "accidents_recordable",
  "Work-related fatalities":                          "fatalities",
  "Average gross hourly pay — male":                  "pay_male_eur_h",
  "Average gross hourly pay — female":                "pay_female_eur_h",
  "Employees covered by collective bargaining":       "emp_cba_covered",
  "Male employees at management level":               "mgmt_male",
  "Female employees at management level":             "mgmt_female",

  "Turnover / revenue FY2025":                        "revenue_eur",
  "Male governance-body (board) members":             "board_male",
  "Female governance-body (board) members":           "board_female",
  "Convictions — anti-corruption / bribery":          "anticorr_convictions",
  "Fines — anti-corruption / bribery":                "anticorr_fines_eur",

  "Natural gas — density":                            "ng_density",
  "Natural gas — NCV (energy-disclosure basis)":      "ng_ncv_tj_gg",
  "Natural gas — energy content (H-gas)":             "ng_energy_kwh_m3",
  "Natural gas — net CV (combustion basis)":          "ng_net_cv_mj_m3",
  "Biogas — CH₄ energy content (HHV)":                "biogas_ch4_hhv",
  "Natural gas — CO₂ emission factor":                "ef_ng_co2_kg_gj",
  "Natural gas — CH₄ emission factor":                "ef_ng_ch4_g_gj",
  "Natural gas — N₂O emission factor":                "ef_ng_n2o_g_gj",
  "GWP — CH₄ (100-yr)":                               "gwp_ch4",
  "GWP — N₂O (100-yr)":                               "gwp_n2o",
  "CH₄ — density (STP)":                              "ch4_density",
  "Biogas — handling/flare leakage rate":             "biogas_leak_pct",
  "Grid electricity EF — location-based":             "ef_grid_location",
  "Grid electricity EF — market-based":               "ef_grid_market",
  "Electricity — T&D loss rate":                      "td_loss_pct",
  "WTT — natural gas":                                "ef_wtt_ng",
  "WTT — electricity generation":                     "ef_wtt_elec",
  "NaOH (chlor-alkali) EF":                           "ef_naoh",
  "Ethanol (fermentation) EF":                        "ef_ethanol",
  "Brewer's yeast (waste-derived) EF":                "ef_yeast",
  "Alcohol water (waste-derived) EF":                 "ef_alcohol_water",
  "Starch substrate (waste-derived) EF":              "ef_starch",
  "Potato juice (waste-derived) EF":                  "ef_potato_juice",
  "Road transport EF":                                "ef_road_transport",
  "Hazardous waste incineration EF":                  "ef_hazwaste_incin",
  "NaOH 25% — concentration":                         "naoh_25_pct",
  "NaOH 32% — concentration":                         "naoh_32_pct",
  "Ethanol — purity":                                 "ethanol_purity_pct",
  "Transport — total mass transported (wet)":         "transport_mass_t",
  "Transport — weighted-average distance":            "transport_distance_km",
};

const OUTPUT_CODES = {
  "Electricity purchased":                                "electricity_mwh",
  "Self-generated energy (biogas)":                       "biogas_self_mwh",
  "Natural gas energy":                                   "natural_gas_mwh",
  "Total energy consumption":                             "total_energy_mwh",

  "Natural gas energy — combustion basis":                "ng_combustion_gj",
  "— CO₂ from natural gas combustion":                    "scope1_ng_co2",
  "— CH₄ from natural gas combustion":                    "scope1_ng_ch4",
  "— N₂O from natural gas combustion":                    "scope1_ng_n2o",
  "Natural gas combustion — subtotal":                    "scope1_ng_subtotal",
  "Fugitive CH₄ (biogas handling)":                       "scope1_fugitive_ch4",
  "Total Scope 1":                                        "scope1_total",
  "Biogenic CO₂ from flaring (memo item)":                "biogenic_co2_memo",

  "Scope 2 — location-based":                             "scope2_location",
  "Scope 2 — market-based":                               "scope2_market",

  "Cat. 1 — NaOH 25% (Vynova)":                           "scope3_cat1_naoh_25",
  "Cat. 1 — NaOH 32% (Vynova)":                           "scope3_cat1_naoh_32",
  "Cat. 1 — Ethanol water (Caldic)":                      "scope3_cat1_ethanol",
  "Cat. 1 — Brewer's yeast (Duynie)":                     "scope3_cat1_yeast",
  "Cat. 1 — Alcohol water (Van Triest)":                  "scope3_cat1_alcohol_water",
  "Cat. 1 — Starch substrates":                           "scope3_cat1_starch",
  "Cat. 1 — Potato juice (Avebe)":                        "scope3_cat1_potato",
  "Cat. 1 total — Purchased Goods & Services":            "scope3_cat1_total",
  "Cat. 3 — WTT of natural gas":                          "scope3_cat3_wtt_ng",
  "Cat. 3 — T&D losses (electricity)":                    "scope3_cat3_td_losses",
  "Cat. 3 — WTT of electricity generation":               "scope3_cat3_wtt_elec",
  "Cat. 3 total — Fuel & Energy-Related Activities":      "scope3_cat3_total",
  "Cat. 4 — Upstream Transportation":                     "scope3_cat4_transport",
  "Cat. 5 — Waste Generated in Operations":               "scope3_cat5_waste",
  "Total Scope 3":                                        "scope3_total",

  "Total Scope 1 + 2 (location-based)":                   "scope_1_2_location",
  "Total Scope 1 + 2 (market-based)":                     "scope_1_2_market",
  "Total Scope 1 + 2 + 3 (location-based)":               "scope_1_2_3_location",
  "Total Scope 1 + 2 + 3 (market-based)":                 "scope_1_2_3_market",
  "GHG intensity — location-based":                       "ghg_intensity_location",
  "GHG intensity — market-based":                         "ghg_intensity_market",

  "Total water withdrawal":                               "water_withdrawal_total",
  "Water withdrawn in high water-stress areas":           "water_high_stress",
  "Water discharge (process wastewater)":                 "water_discharge",
  "Total water consumption":                              "water_consumption",

  "Phosphorus (as total P) — to water":                   "phosphorus_to_water",
  "Heavy metals Group 1 — to water":                      "heavy_metals_g1_to_water",
  "Heavy metals Group 2 — to water":                      "heavy_metals_g2_to_water",
  "Chloride — to water":                                  "chloride_to_water",
  "Nitrogen (as total N) — to water":                     "nitrogen_to_water",
  "Total organic carbon (TOC) — to water":                "toc_to_water",
  "Nitrogen oxides (NOₓ) — to air":                       "nox_to_air",
  "Methane (CH₄) — to air":                               "ch4_to_air",

  "Total hazardous waste generated":                      "hazwaste_total",
  "Total waste generated":                                "waste_total",

  "Starch substrates (Crespovit & Hamino)":               "mass_starch",
  "Voederbier / alcohol water":                           "mass_alcohol_water",
  "NaOH 25% solution":                                    "mass_naoh_25",
  "NaOH 32% solution":                                    "mass_naoh_32",
  "Biergist (brewer's yeast)":                            "mass_yeast",
  "Potato juice":                                         "mass_potato_juice",
  "Ethanol water":                                        "mass_ethanol_water",
  "Total annual mass-flow of materials":                  "material_massflow_total",

  "Total employees":                                      "total_fte",
  "Employee turnover rate":                               "employee_turnover_rate",
  "Total hours worked by all employees":                  "total_hours_worked",
  "Rate of recordable work-related accidents":            "accident_rate_per_million_h",
  "Gender pay gap":                                       "gender_pay_gap",
  "Female-to-male ratio at management level":             "mgmt_gender_ratio",
  "Employees covered by collective bargaining":           "cba_coverage_pct",
  "Gender diversity ratio — governance body":             "board_gender_ratio",
};

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
const slugify = name =>
  name
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

const codeFor = (name, map) => map[name] ?? slugify(name);

const sqlString = v => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);

const sqlNumber = v => (v == null || v === "" || Number.isNaN(Number(v)) ? "null" : Number(v));

// Format an array of 12 numbers/nulls for Postgres `numeric[12]` literal:
// ARRAY[123, 456, NULL, ...]::numeric[]
const sqlMonthlyArray = arr => {
  if (!arr || arr.every(v => v == null)) return "null";
  const cells = arr.map(v => (v == null || v === "" ? "null" : Number(v))).join(", ");
  return `ARRAY[${cells}]::numeric[]`;
};

// ──────────────────────────────────────────────────────────────────────────
// Excel formula translator
// Handles two reference styles: Input!Nxx (cross-sheet) and Dxx (intra-Output)
// ──────────────────────────────────────────────────────────────────────────
function buildFormulaTranslator({ inputRowToCode, outputRowToCode }) {
  return function translate(excelExpr) {
    if (typeof excelExpr !== "string" || !excelExpr.startsWith("=")) return null;
    let expr = excelExpr.slice(1);

    // Expand SUM(Input!Nxx:Nyy) → param1 + param2 + ... + paramN
    expr = expr.replace(/SUM\(\s*Input!N(\d+)\s*:\s*N(\d+)\s*\)/gi, (_, a, b) => {
      const from = Math.min(+a, +b), to = Math.max(+a, +b);
      const parts = [];
      for (let r = from; r <= to; r++) {
        const code = inputRowToCode[r];
        if (code) parts.push(code);
      }
      return "(" + parts.join(" + ") + ")";
    });

    // Expand SUM(Dxx:Dyy) → output param1 + ... (intra-Output sums)
    expr = expr.replace(/SUM\(\s*D(\d+)\s*:\s*D(\d+)\s*\)/gi, (_, a, b) => {
      const from = Math.min(+a, +b), to = Math.max(+a, +b);
      const parts = [];
      for (let r = from; r <= to; r++) {
        const code = outputRowToCode[r];
        if (code) parts.push(code);
      }
      return "(" + parts.join(" + ") + ")";
    });

    // Replace Input!Nxx → input_code
    expr = expr.replace(/Input!N(\d+)/g, (_, r) => {
      const code = inputRowToCode[+r];
      if (!code) throw new Error(`No input code for Input!N${r}`);
      return code;
    });

    // Replace intra-Output Dxx → output_code
    expr = expr.replace(/(^|[^A-Za-z0-9_])D(\d+)/g, (m, pre, r) => {
      const code = outputRowToCode[+r];
      if (!code) throw new Error(`No output code for D${r}`);
      return `${pre}${code}`;
    });

    return expr.trim();
  };
}

const extractDeps = expr => {
  const matches = expr.match(/[a-z_][a-z0-9_]*/g) ?? [];
  // Filter out numeric-only and built-in operators (none here, since exprs use + - * /)
  return Array.from(new Set(matches));
};

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(EXCEL_PATH);

// --- Walk Input sheet ---
const inputSheet = wb.getWorksheet("Input");
const inputs = [];                  // { code, display, unit, section, isMonthly, isCalculated, expression?, monthly[], annual, source, row }
const inputRowToCode = {};
let currentInputSection = null;
let displayOrder = 0;

inputSheet.eachRow((row, rowNumber) => {
  if (rowNumber < 5) return;
  const a = row.getCell(1).value;     // Data Point
  const unit = row.getCell(15).value; // Unit
  const annualCell = row.getCell(14);
  const annualValue = annualCell.value;
  const source = row.getCell(16).value;

  if (!a) return;

  // Section header detection. The Excel uses merged cells across the row for
  // headers like "1 · ENERGY", so ExcelJS copies the text into every cell.
  // Real data rows have:
  //   - a numeric annual value, OR
  //   - a {formula} object in col N, OR
  //   - at least one numeric monthly cell.
  // Headers have a string in col A starting with "<digit> ·".
  const aText = typeof a === "object" && a?.richText
    ? a.richText.map(r => r.text).join("")
    : String(a);
  const isHeader = /^\s*\d+\s*[·.]/.test(aText) && typeof annualValue !== "number" && !(typeof annualValue === "object" && annualValue?.formula);
  if (isHeader) {
    const sec = sectionFor(aText, INPUT_SECTION_MAP);
    if (sec) currentInputSection = sec;
    return;
  }

  const display = typeof a === "object" && a.richText
    ? a.richText.map(r => r.text).join("")
    : String(a);

  const code = codeFor(display, INPUT_CODES);

  // Monthly cells B–M (cols 2–13). Handle both regular and shared formulas.
  const monthly = [];
  let hasMonthly = false;
  for (let c = 2; c <= 13; c++) {
    const v = row.getCell(c).value;
    if (v == null) { monthly.push(null); continue; }
    if (typeof v === "object" && (v.formula || v.sharedFormula)) {
      const r = v.result ?? null;
      if (r != null) hasMonthly = true;
      monthly.push(r);
    } else if (typeof v === "number") {
      hasMonthly = true;
      monthly.push(v);
    } else {
      monthly.push(null);
    }
  }

  // Annual: if formula (regular OR shared), take cached result; else raw number
  let annual = null;
  let annualFormula = null;
  if (typeof annualValue === "object" && annualValue && (annualValue.formula || annualValue.sharedFormula)) {
    annualFormula = "=" + (annualValue.formula ?? annualValue.sharedFormula);
    annual = annualValue.result ?? null;
  } else if (typeof annualValue === "number") {
    annual = annualValue;
  }

  const unitStr = typeof unit === "object" && unit?.richText
    ? unit.richText.map(r => r.text).join("")
    : String(unit ?? "");

  const sourceStr = source == null ? null
    : typeof source === "object" && source?.richText
      ? source.richText.map(r => r.text).join("")
      : String(source);

  // Inputs derived inside the Input sheet (e.g. "Electricity purchased — Total" = peak + offpeak)
  // are stored as OUTPUT-category parameters too so they're available to downstream formulas.
  // Simpler: keep them as 'input' but flag is_calculated=true and capture the formula.
  const isCalculated = !!annualFormula;

  // For Energy section, biogas EF (gas density etc.) is in conversion section, not here
  const category = currentInputSection === "conversion" ? "emission_factor" : "input";

  inputs.push({
    code,
    display,
    unit: unitStr,
    section: currentInputSection,
    isMonthly: hasMonthly,
    isCalculated,
    annualFormula,
    monthly,
    annual,
    source: sourceStr,
    row: rowNumber,
    category,
  });
  inputRowToCode[rowNumber] = code;
  displayOrder++;
});

// --- Walk Output sheet ---
const outputSheet = wb.getWorksheet("Output");
const outputs = [];                // { code, display, unit, section, vsmeCell, expression, expressionRaw, description, row, hardcodedValue? }
const outputRowToCode = {};
let currentOutputSection = null;
let outDisplayOrder = 0;

outputSheet.eachRow((row, rowNumber) => {
  if (rowNumber < 5) return;
  const a = row.getCell(1).value; // section header
  const b = row.getCell(2).value; // metric name
  const c = row.getCell(3).value; // VSME cell
  const d = row.getCell(4).value; // calc value (formula or literal)
  const e = row.getCell(5).value; // unit
  const g = row.getCell(7).value; // method / notes

  // Header detection: col A is a string AND it equals col B (merged header
  // cells spread the same text across the row). Real metric rows have col A null.
  const aStr = typeof a === "string" ? a : (typeof a === "object" && a?.richText ? a.richText.map(r => r.text).join("") : null);
  const bStr = typeof b === "string" ? b : (typeof b === "object" && b?.richText ? b.richText.map(r => r.text).join("") : null);
  const isHeader = aStr && (bStr === aStr || a === b);
  if (isHeader) {
    const sec = sectionFor(aStr, OUTPUT_SECTION_MAP);
    if (sec) currentOutputSection = sec;
    return;
  }
  if (!b) return;

  const display = typeof b === "object" && b.richText
    ? b.richText.map(r => r.text).join("")
    : String(b);

  const code = codeFor(display, OUTPUT_CODES);

  const unitStr = typeof e === "object" && e?.richText
    ? e.richText.map(r => r.text).join("")
    : String(e ?? "");

  const vsmeCellStr = typeof c === "object" && c?.richText
    ? c.richText.map(r => r.text).join("")
    : c == null ? null : String(c);

  const descStr = typeof g === "object" && g?.richText
    ? g.richText.map(r => r.text).join("")
    : g == null ? null : String(g);

  let expressionRaw = null;
  let hardcodedValue = null;
  if (typeof d === "object" && d?.formula) {
    expressionRaw = "=" + d.formula;
  } else if (typeof d === "number") {
    hardcodedValue = d;
  }

  outputs.push({
    code,
    display,
    unit: unitStr,
    section: currentOutputSection,
    vsmeCell: vsmeCellStr,
    expressionRaw,
    hardcodedValue,
    description: descStr,
    row: rowNumber,
    displayOrder: outDisplayOrder++,
  });
  outputRowToCode[rowNumber] = code;
});

// --- Translate formulas ---
const translate = buildFormulaTranslator({ inputRowToCode, outputRowToCode });
for (const o of outputs) {
  if (o.expressionRaw) {
    try {
      o.expression = translate(o.expressionRaw);
      o.dependencies = extractDeps(o.expression);
    } catch (err) {
      console.warn(`⚠  Could not translate ${o.code}: ${err.message}`);
      o.expression = null;
    }
  }
}

// --- Emit SQL ---
const lines = [];
lines.push("-- Auto-generated by scripts/generate-chaincraft-seed.mjs");
lines.push("-- Source: " + EXCEL_PATH);
lines.push("-- Re-running this is safe (idempotent via ON CONFLICT).");
lines.push("");
lines.push("begin;");
lines.push("");

// Reporting period
lines.push("-- Reporting period");
lines.push(`insert into reporting_periods (code, label, start_date, end_date, status, is_current) values`);
lines.push(`  ('FY2025', 'Fiscal Year 2025', '2025-01-01', '2025-12-31', 'open', true)`);
lines.push(`  on conflict (code) do update set label=excluded.label, is_current=excluded.is_current;`);
lines.push("");

// Parameters: inputs + emission factors
lines.push("-- Parameters (inputs + emission factors)");
lines.push(`insert into parameters (code, display_name, unit, category, section, vsme_cell, source_note, is_monthly, is_calculated, display_order) values`);
const paramRows = [];
let ord = 0;
for (const i of inputs) {
  paramRows.push(
    `  (${sqlString(i.code)}, ${sqlString(i.display)}, ${sqlString(i.unit)}, ${sqlString(i.category)}::param_category, ${sqlString(i.section)}::param_section, null, ${sqlString(i.source)}, ${i.isMonthly}, ${i.isCalculated}, ${ord++})`
  );
}
for (const o of outputs) {
  paramRows.push(
    `  (${sqlString(o.code)}, ${sqlString(o.display)}, ${sqlString(o.unit)}, 'output'::param_category, ${sqlString(o.section)}::param_section, ${sqlString(o.vsmeCell)}, null, false, true, ${ord++})`
  );
}
lines.push(paramRows.join(",\n"));
lines.push(`  on conflict (code) do update set display_name=excluded.display_name, unit=excluded.unit, section=excluded.section, vsme_cell=excluded.vsme_cell, source_note=excluded.source_note, is_monthly=excluded.is_monthly, is_calculated=excluded.is_calculated;`);
lines.push("");

// Data points (FY2025) for every input parameter
lines.push("-- Data points for FY2025");
const dpRows = [];
for (const i of inputs) {
  // Emit the monthly array whenever the Excel actually had monthly data in
  // it. (Earlier we excluded derived inputs like "Electricity — Total" whose
  // monthly cells are themselves formulas like =B6+B7. ExcelJS sometimes has
  // stale cached results for those, but it's still better to seed what's
  // there — the dashboard reads these directly for trend charts.)
  const annual = i.annual ?? null;
  const monthly = i.isMonthly ? sqlMonthlyArray(i.monthly) : "null";
  dpRows.push(
    `  ((select id from reporting_periods where code = 'FY2025'),
   (select id from parameters where code = ${sqlString(i.code)}),
   ${sqlNumber(annual)},
   ${monthly},
   ${sqlString(i.source)})`
  );
}
if (dpRows.length) {
  lines.push("insert into data_points (period_id, parameter_id, value_annual, values_monthly, source_file) values");
  lines.push(dpRows.join(",\n"));
  lines.push("  on conflict (period_id, parameter_id) do update set value_annual=excluded.value_annual, values_monthly=excluded.values_monthly, source_file=excluded.source_file;");
  lines.push("");
}

// Formulas
lines.push("-- Formulas");
const fRows = [];
for (const o of outputs) {
  if (!o.expression) continue;
  const depsArr = `ARRAY[${o.dependencies.map(d => sqlString(d)).join(", ")}]::text[]`;
  fRows.push(
    `  ((select id from parameters where code = ${sqlString(o.code)}),
   ${sqlString(o.expression)},
   ${sqlString(o.expressionRaw)},
   ${depsArr},
   ${sqlString(o.description)})`
  );
}
if (fRows.length) {
  lines.push("insert into formulas (output_param_id, expression, expression_human, dependencies, description) values");
  lines.push(fRows.join(",\n"));
  lines.push("  on conflict (output_param_id, version) do update set expression=excluded.expression, expression_human=excluded.expression_human, dependencies=excluded.dependencies, description=excluded.description, is_active=true;");
  lines.push("");
}

// Hardcoded-value outputs (e.g. biogenic CO₂ memo item, water_high_stress = 0)
const hardcoded = outputs.filter(o => o.hardcodedValue != null && !o.expression);
if (hardcoded.length) {
  lines.push("-- Outputs with hardcoded values (no formula) — stored as a constant data_point");
  for (const o of hardcoded) {
    lines.push(`-- ${o.code}: ${o.hardcodedValue} ${o.unit} (${o.description ?? ""})`);
  }
  lines.push("-- (Stored via calculated_metrics seed below)");
  lines.push("");
}

lines.push("commit;");
lines.push("");

// Summary
const summary = {
  inputs: inputs.length,
  outputs: outputs.length,
  formulas: outputs.filter(o => o.expression).length,
  withoutFormula: outputs.filter(o => o.hardcodedValue != null).length,
};
lines.push("-- Summary:");
lines.push(`--   ${summary.inputs} input parameters (incl. emission factors)`);
lines.push(`--   ${summary.outputs} output parameters`);
lines.push(`--   ${summary.formulas} formulas translated`);
lines.push(`--   ${summary.withoutFormula} outputs with hardcoded values (no formula)`);

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, lines.join("\n"), "utf8");

console.log(`✓ Wrote ${OUT_PATH}`);
console.log(`  ${summary.inputs} inputs · ${summary.outputs} outputs · ${summary.formulas} formulas`);
if (summary.withoutFormula) {
  console.log(`  ${summary.withoutFormula} outputs are hardcoded (no formula expression)`);
}
