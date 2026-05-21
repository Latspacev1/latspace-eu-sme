# ChainCraft VSME — Database Plan

End-to-end plan to take `ChainCraft_VSME_Input_Output_FY2025.xlsx` and turn it into a
proper database backing the platform's **Dashboard** (Output metrics as KPI tiles)
and **Reporting** flow (Input data entry that auto-populates VSME disclosures).

---

## 1. What the Excel actually is

| Sheet | Content | Counts |
|---|---|---|
| **Input** | Raw measured data + emission factors + conversion parameters | 9 sections, 69 hardcoded inputs, 12 input-side formulas (e.g. peak+offpeak totals, monthly sums) |
| **Output** | VSME disclosure metrics, **63 of 65 are calculated** from Input cells | 10 sections, 65 metrics |

Sections in **Input**: Energy · Feedstock · Water · Wastewater pollutants · Air pollutant · Hazardous waste · Workforce · Governance/Financial · Emission factors & conversions.

Sections in **Output**: Energy (B3) · Scope 1 · Scope 2 · Scope 3 · Consolidated GHG/Intensity · Water (B6) · Pollution (B4) · Waste (B7) · Material mass-flow (B7) · Workforce & Governance (B8–B11/C9).

Every Output cell is either `=Input!Nxx*Input!Nyy/1000` style arithmetic or a `=SUM(...)` over other Output rows. **There are no functions Postgres can't trivially evaluate.**

---

## 2. Two paths — pick one

You already have a backend at the other end of `lib/api/*.ts` exposing
`/api/dynamic-params`, `/api/formulas`, `/api/output-calculation`. That backend's
data model is identical to what we need: `parameters` (input/output/emission),
`formulas` with `expression` + `output_param`, and an evaluator that returns
results with full provenance/trace.

### Path A — Reuse the existing backend (fastest, no DB work)
Just **seed it** with the 69 input parameters and 63 formulas from the Excel:
1. Map each Input row → `POST /api/dynamic-params` (category `INPUT`, with unit and section).
2. Map each Input emission factor → category `EMISSION`.
3. Map each Output row → `POST /api/dynamic-params` (category `OUTPUT`, `is_calculated: true`).
4. Map each Output formula → `POST /api/formulas` (translate cell refs to parameter names).
5. Dashboard already calls `outputCalculationApi.getForPlant()` — wire its results to KPI tiles.

**Pros:** Zero schema work. Provenance/trace already implemented.
**Cons:** You're locked to that backend.

### Path B — Own the database in Supabase (recommended for ChainCraft)
Build a thin Supabase schema purpose-built for VSME, with a small formula
evaluator in TypeScript. You control versioning, RLS, and exports.

The rest of this doc designs **Path B**, but the table shape mirrors what the
existing backend uses so you can flip between them.

---

## 3. Supabase schema

Four tables. Everything is keyed by `(organization_id, reporting_period)` so the
same ChainCraft instance can hold FY2025, FY2026, multi-entity, etc.

```
organizations  ──┐
                 │
reporting_periods ──┐
                    │
parameters ─────────┤
                    │
data_points ────────┤   (one row per parameter per period; monthly array optional)
                    │
formulas ───────────┤   (expression referencing parameter codes)
                    │
calculated_metrics ─┘   (cached output values + trace; rebuilt on input change)
```

### 3.1 `organizations`
Already exists or trivial. For ChainCraft: one row `chaincraft-bv`.

### 3.2 `reporting_periods`
```sql
create table reporting_periods (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  code        text not null,                       -- "FY2025"
  start_date  date not null,
  end_date    date not null,
  status      text not null default 'open',         -- open | locked | filed
  created_at  timestamptz not null default now(),
  unique (org_id, code)
);
```

### 3.3 `parameters` — the catalogue of every input + output metric
```sql
create type param_category as enum ('input', 'emission_factor', 'output');
create type param_section  as enum (
  'energy','feedstock','water','wastewater','air',
  'hazardous_waste','workforce','governance','conversion',
  'vsme_b3_energy','vsme_b3_scope1','vsme_b3_scope2','vsme_b3_scope3',
  'vsme_b3_consolidated','vsme_b6_water','vsme_b4_pollution',
  'vsme_b7_waste','vsme_b7_materials','vsme_b8_b11_workforce_gov'
);

create table parameters (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  code            text not null,           -- 'electricity_peak', 'scope1_total' — stable key used in formulas
  display_name    text not null,           -- 'Electricity purchased — Peak (Piek)'
  unit            text not null,           -- 'kWh', 'tCO2e', '%', etc.
  category        param_category not null,
  section         param_section not null,
  vsme_cell       text,                    -- 'G12' — link back to VSME Digital Template
  source_note     text,                    -- 'Source: 42121431 – Verbruik 2025 per dag.xlsx'
  is_monthly      boolean not null default false,   -- true → monthly array in data_points
  is_calculated   boolean not null default false,   -- true → produced by a formula
  display_order   int  not null default 0,
  created_at      timestamptz not null default now(),
  unique (org_id, code)
);
create index on parameters (org_id, section);
create index on parameters (org_id, category);
```

### 3.4 `data_points` — actual values per period
```sql
create table data_points (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  period_id    uuid not null references reporting_periods(id) on delete cascade,
  parameter_id uuid not null references parameters(id) on delete cascade,
  value_annual numeric,                          -- annual total (always populated for non-monthly)
  values_monthly numeric[12],                    -- Jan..Dec; null entries allowed
  notes        text,
  source_file  text,
  entered_by   uuid references auth.users(id),
  entered_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (period_id, parameter_id)
);
create index on data_points (org_id, period_id);
```

### 3.5 `formulas` — how outputs derive from inputs
```sql
create table formulas (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  output_param_id   uuid not null references parameters(id) on delete cascade,
  expression        text not null,            -- e.g. 'electricity_total / 1000'
  expression_human  text,                     -- '638,724 kWh ÷ 1,000'
  dependencies      text[] not null,          -- ['electricity_peak','electricity_offpeak']
  description       text,                     -- methodology note from Excel col G
  version           int not null default 1,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (org_id, output_param_id, version)
);
create index on formulas (org_id, output_param_id) where is_active = true;
```

### 3.6 `calculated_metrics` — cached evaluation results
```sql
create table calculated_metrics (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  period_id     uuid not null references reporting_periods(id) on delete cascade,
  parameter_id  uuid not null references parameters(id) on delete cascade,
  formula_id    uuid not null references formulas(id) on delete cascade,
  value         numeric,
  trace         jsonb,                 -- { inputs: {electricity_peak: 312349, ...}, steps: [...] }
  computed_at   timestamptz not null default now(),
  is_stale      boolean not null default false,
  unique (period_id, parameter_id)
);
```
A trigger on `data_points` writes `is_stale = true` for every metric whose
formula depends on the updated parameter — that's what tells the dashboard to
recompute (or shows a "Recalculate" button).

### 3.7 RLS — table-level
Standard Supabase pattern: every table has `org_id`; an `org_members(user_id, org_id, role)` table; one policy per table:

```sql
alter table parameters enable row level security;
create policy "members read" on parameters
  for select using (org_id in (select org_id from org_members where user_id = auth.uid()));
create policy "editors write" on parameters
  for all using (
    org_id in (select org_id from org_members where user_id = auth.uid() and role in ('editor','admin'))
  );
```
Repeat for the other four tables.

---

## 4. Seed data — exactly what to insert

**81 parameters total** (69 inputs + 12 input-side formula rows are unified — the
peak+offpeak totals become an output-style "is_calculated" input) + **63 output
parameters** = ~144 rows in `parameters`. Plus 12 monthly inputs that go into
`data_points.values_monthly`, 57 annual-only inputs into `value_annual`, and 63
formulas in `formulas`.

I'll generate a fully populated `supabase/seed/chaincraft_fy2025.sql` script
once you confirm Path B. The mechanics:

| Excel | DB field |
|---|---|
| Input row col A → `display_name`. Slugified → `code`. |
| Input section header (`1 · ENERGY`) → `section: 'energy'`. |
| Input cols B–M → `data_points.values_monthly[0..11]`. |
| Input col N → `data_points.value_annual` (also stored even when derived from monthly). |
| Input col O → `parameters.unit`. |
| Input col P → `data_points.source_file` + `parameters.source_note`. |
| Output row col B → `display_name`, slugified → `code`. |
| Output col C → `parameters.vsme_cell` (e.g. `G12`). |
| Output col D formula → `formulas.expression` after cell-ref translation. |
| Output col E → `parameters.unit`. |
| Output col G → `formulas.description`. |

### 4.1 Cell-reference translation (the only non-trivial bit)
The Excel formulas reference `Input!N8`, `Input!N9`, etc. We translate row-number
→ parameter code by row order. Examples:

| Excel formula | Parsed |
|---|---|
| `=Input!N8/1000` | `electricity_total / 1000` |
| `=Input!N10*Input!N11/100*Input!N77/3.6/1000` | `biogas_produced * biogas_ch4_fraction / 100 * biogas_ch4_hhv / 3.6 / 1000` |
| `=SUM(Input!N42:N46)*Input!N97/1000` | `(hazwaste_07_01_01 + hazwaste_06_02_05 + hazwaste_06_01_06 + hazwaste_07_01_03 + hazwaste_16_05_06) * ef_hazwaste_incineration / 1000` |
| `=D6+D7+D8` (intra-Output) | `electricity_mwh + biogas_self_mwh + natural_gas_mwh` |

A one-off Python script (~80 lines, openpyxl) generates the seed SQL. I can write that next.

---

## 5. Formula evaluator (TypeScript)

The formulas are pure arithmetic: `+ - * / ( )` and named identifiers. No need
for a full expression parser — use [`expr-eval`](https://www.npmjs.com/package/expr-eval)
(2 KB) or write a 40-line shunting-yard. The evaluator:

```ts
// lib/chaincraft/evaluator.ts
import { Parser } from 'expr-eval';

export type ParamValues = Record<string, number>;

export function evaluate(
  expression: string,
  inputs: ParamValues,
): { value: number; trace: { inputs: ParamValues; expression: string } } {
  const parser = new Parser();
  const expr = parser.parse(expression);
  const referenced = expr.variables();
  const usedInputs = Object.fromEntries(referenced.map(k => [k, inputs[k] ?? 0]));
  const value = expr.evaluate(usedInputs);
  return { value, trace: { inputs: usedInputs, expression } };
}
```

Recalculation flow:
1. User saves a `data_point`.
2. A Postgres trigger sets `calculated_metrics.is_stale = true` for any metric whose formula depends on the changed parameter.
3. Next dashboard load (or explicit "Recalculate" button) calls a Next.js Route Handler `/api/chaincraft/recalculate` that:
   - Loads all `parameters`, all `data_points`, all active `formulas` for the period.
   - Topologically sorts formulas (some outputs feed others — Scope 1 total → consolidated total).
   - Evaluates each, writes `calculated_metrics` rows with `value` + `trace`.

---

## 6. Dashboard integration

Today: `app/corporate/overview/page.tsx` renders **3 KPIs per plant card**: Current GEI, Target GEI, Delta GEI, plus YTD production and penalty. That layout was built for cement.

For ChainCraft VSME you want a **VSME KPI strip / dashboard** showing the headline numbers from the Output sheet. Suggested KPI tiles, grouped:

**Climate (B3)**
- Total energy consumption (MWh) — `total_energy_mwh`
- Scope 1 emissions (tCO₂e) — `scope1_total`
- Scope 2 market-based (tCO₂e) — `scope2_market`
- Scope 3 total (tCO₂e) — `scope3_total`
- GHG intensity, market-based (tCO₂e/€) — `ghg_intensity_market`

**Water (B6)**
- Total water withdrawal (m³) — `water_withdrawal_total`
- Water consumption (m³) — `water_consumption`

**Waste (B7)**
- Total hazardous waste (kg) — `hazwaste_total`
- Total annual mass-flow (kg) — `material_massflow_total`

**Pollution (B4)**
- NOₓ to air (t) — `nox_to_air`
- Total P to water (t) — `phosphorus_to_water`

**Workforce / Governance (B8–B11)**
- Total employees (FTE) — `total_fte`
- Gender pay gap (%) — `gender_pay_gap`
- Employee turnover (%) — `employee_turnover_rate`
- Board gender diversity ratio — `board_gender_ratio`

Each tile reads one row from `calculated_metrics` for the active period, shows
`value` + `unit`, and on click pops the `trace` panel: "Computed from
electricity_peak (312,349) + electricity_offpeak (326,375) = 638,724 kWh ÷ 1,000".
That trace panel is the secret weapon — auditors love it.

### Implementation in your repo
1. New route: `app/(dashboard)/vsme/page.tsx` (or repurpose `app/corporate/overview` for VSME orgs).
2. New API route: `app/api/chaincraft/metrics/route.ts` — `GET ?period=FY2025` returns `{ [paramCode]: { value, unit, trace } }`.
3. New components:
   - `components/vsme/KpiTile.tsx` — value, unit, sparkline (when we have multiple periods), click → trace.
   - `components/vsme/KpiGroup.tsx` — section heading + grid of tiles.
   - `components/vsme/TracePanel.tsx` — popover showing inputs that fed the formula.
4. Data entry route: `app/(reporting)/inputs/page.tsx` — table of all `parameters` with `category='input'`, grouped by section, monthly inputs get a 12-cell row. Saves to `data_points`.

---

## 7. What I need from you to proceed

Decision points before I write code:

1. **Path A (seed existing backend) or Path B (Supabase, owned schema)?**
2. **Multi-org or single-tenant?** Schema above is multi-org-ready. If you only ever have ChainCraft, we can drop `org_id` columns and simplify.
3. **Monthly data**: keep the 12-cell array, or skip and only store annual totals? Only Energy and Feedstock have monthly data in the Excel — everything else is annual-only.
4. **Dashboard placement**: replace `app/corporate/overview` for VSME orgs, or new sibling route `app/vsme-dashboard`?

Once those are answered I'll:
- Write `supabase/migrations/0001_chaincraft_vsme.sql` (schema + RLS).
- Write `scripts/seed-chaincraft-from-excel.mjs` (one-shot Excel → seed SQL generator).
- Write `lib/chaincraft/evaluator.ts` + `app/api/chaincraft/metrics/route.ts`.
- Stub the dashboard tiles wired to live data.

---

## 8. Why this design

- **Formulas as data, not code.** Same shape your existing backend uses. Methodology changes (e.g. switching grid EF from 0.268 to 0.272) are a `data_points` update, not a deploy.
- **Trace built in.** Every Output value carries its inputs in `calculated_metrics.trace`. Required for VSME assurance.
- **Period-scoped.** FY2026 is a new `reporting_periods` row; same parameters and formulas, new `data_points`. Year-over-year charts come for free.
- **Slim.** 5 tables. Postgres. RLS. No queues, no triggers more complex than "mark stale on write", no materialized views.
