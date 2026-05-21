-- ChainCraft VSME — single-tenant schema (Path B)
-- Tables: reporting_periods, parameters, data_points, formulas, calculated_metrics
-- Monthly arrays are first-class; no org_id columns (single tenant).

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Reporting periods (FY2025, FY2026, ...)
-- ─────────────────────────────────────────────────────────────────────────────
create table reporting_periods (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                  -- 'FY2025'
  label       text not null,                         -- 'Fiscal Year 2025'
  start_date  date not null,
  end_date    date not null,
  status      text not null default 'open',          -- open | locked | filed
  is_current  boolean not null default false,        -- one period flagged as the active one
  created_at  timestamptz not null default now()
);

create unique index reporting_periods_only_one_current
  on reporting_periods (is_current) where is_current = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Parameter catalogue
-- ─────────────────────────────────────────────────────────────────────────────
create type param_category as enum ('input', 'emission_factor', 'output');

create type param_section as enum (
  -- Input sections (from Excel Input sheet)
  'energy',
  'feedstock',
  'water',
  'wastewater',
  'air',
  'hazardous_waste',
  'workforce',
  'governance',
  'conversion',
  -- Output sections (from Excel Output sheet, mapped to VSME modules)
  'vsme_b3_energy',
  'vsme_b3_scope1',
  'vsme_b3_scope2',
  'vsme_b3_scope3',
  'vsme_b3_consolidated',
  'vsme_b6_water',
  'vsme_b4_pollution',
  'vsme_b7_waste',
  'vsme_b7_materials',
  'vsme_b8_b11_workforce_gov'
);

create table parameters (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,            -- 'electricity_peak', 'scope1_total' — used in formula expressions
  display_name    text not null,
  unit            text not null,                   -- 'kWh', 'tCO2e', '%'
  category        param_category not null,
  section         param_section not null,
  vsme_cell       text,                            -- 'G12' — VSME Digital Template back-reference
  source_note     text,                            -- 'Source: 42121431 – Verbruik 2025 per dag.xlsx'
  is_monthly      boolean not null default false,  -- true → values_monthly array is meaningful
  is_calculated   boolean not null default false,  -- true → produced by a formula (no manual entry)
  display_order   int  not null default 0,
  created_at      timestamptz not null default now()
);

create index parameters_section_idx  on parameters (section);
create index parameters_category_idx on parameters (category);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Data points (raw measured values, one row per parameter per period)
-- ─────────────────────────────────────────────────────────────────────────────
create table data_points (
  id              uuid primary key default gen_random_uuid(),
  period_id       uuid not null references reporting_periods(id) on delete cascade,
  parameter_id    uuid not null references parameters(id)        on delete cascade,
  value_annual    numeric,
  values_monthly  numeric[12],                     -- Jan..Dec, nulls allowed
  notes           text,
  source_file     text,
  entered_by      uuid,                            -- references auth.users(id) when auth is wired
  entered_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (period_id, parameter_id)
);

create index data_points_period_idx on data_points (period_id);

-- Auto-update updated_at on row change
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger data_points_set_updated_at
  before update on data_points
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Formulas (expression → produces an output parameter)
-- ─────────────────────────────────────────────────────────────────────────────
create table formulas (
  id                uuid primary key default gen_random_uuid(),
  output_param_id   uuid not null references parameters(id) on delete cascade,
  expression        text not null,                 -- 'electricity_total / 1000'
  expression_human  text,                          -- '638,724 kWh ÷ 1,000'
  dependencies      text[] not null default '{}',  -- ['electricity_peak','electricity_offpeak']
  description       text,                          -- methodology note from Excel col G
  version           int not null default 1,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (output_param_id, version)
);

create unique index formulas_one_active_per_output
  on formulas (output_param_id) where is_active = true;

create index formulas_dependencies_gin on formulas using gin (dependencies);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Calculated metrics (cached evaluation results + trace)
-- ─────────────────────────────────────────────────────────────────────────────
create table calculated_metrics (
  id            uuid primary key default gen_random_uuid(),
  period_id     uuid not null references reporting_periods(id) on delete cascade,
  parameter_id  uuid not null references parameters(id)        on delete cascade,
  formula_id    uuid not null references formulas(id)          on delete cascade,
  value         numeric,
  trace         jsonb,                                  -- { inputs: {...}, expression: '...' }
  computed_at   timestamptz not null default now(),
  is_stale      boolean not null default false,
  unique (period_id, parameter_id)
);

create index calculated_metrics_period_idx on calculated_metrics (period_id);
create index calculated_metrics_stale_idx  on calculated_metrics (is_stale) where is_stale = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Stale-marking trigger
-- When a data_point changes, mark every calculated_metric whose formula
-- depends on that parameter as stale (for the same period).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function mark_dependent_metrics_stale() returns trigger as $$
declare
  changed_param_code text;
begin
  select code into changed_param_code from parameters where id = new.parameter_id;

  update calculated_metrics cm
     set is_stale = true
    from formulas f
   where cm.formula_id = f.id
     and cm.period_id  = new.period_id
     and f.is_active   = true
     and changed_param_code = any(f.dependencies);

  return new;
end;
$$ language plpgsql;

create trigger data_points_mark_stale
  after insert or update on data_points
  for each row execute function mark_dependent_metrics_stale();

-- Same when a formula itself changes — mark its own output metric stale across all periods
create or replace function mark_own_metric_stale() returns trigger as $$
begin
  if new.is_active then
    update calculated_metrics
       set is_stale = true
     where formula_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger formulas_mark_self_stale
  after insert or update on formulas
  for each row execute function mark_own_metric_stale();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS — single tenant, but we still gate by authenticated role
-- ─────────────────────────────────────────────────────────────────────────────
alter table reporting_periods  enable row level security;
alter table parameters         enable row level security;
alter table data_points        enable row level security;
alter table formulas           enable row level security;
alter table calculated_metrics enable row level security;

-- Authenticated users can read everything
create policy "auth read reporting_periods"  on reporting_periods  for select using (auth.role() = 'authenticated');
create policy "auth read parameters"         on parameters         for select using (auth.role() = 'authenticated');
create policy "auth read data_points"        on data_points        for select using (auth.role() = 'authenticated');
create policy "auth read formulas"           on formulas           for select using (auth.role() = 'authenticated');
create policy "auth read calculated_metrics" on calculated_metrics for select using (auth.role() = 'authenticated');

-- Authenticated users can write data_points and calculated_metrics; admin policies
-- for parameters/formulas/periods can be added when an admin role exists.
create policy "auth write data_points"        on data_points        for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth write calculated_metrics" on calculated_metrics for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth write reporting_periods"  on reporting_periods  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth write parameters"         on parameters         for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth write formulas"           on formulas           for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Convenience view: latest non-stale calculated metric per parameter per period
create or replace view v_current_metrics as
select
  cm.period_id,
  rp.code              as period_code,
  p.id                 as parameter_id,
  p.code               as parameter_code,
  p.display_name,
  p.unit,
  p.section,
  p.vsme_cell,
  cm.value,
  cm.trace,
  cm.is_stale,
  cm.computed_at
from calculated_metrics cm
join parameters         p  on p.id  = cm.parameter_id
join reporting_periods  rp on rp.id = cm.period_id;
