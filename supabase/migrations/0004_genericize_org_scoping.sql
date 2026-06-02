-- Genericize the schema into a multi-tenant document-extraction platform.
--
-- What changes vs. the single-tenant ChainCraft schema (0001):
--   1. parameters.section becomes free text (was the param_section enum) so
--      extraction can invent sections per org.
--   2. Every data table gains an org_id (text — matches dashboards.user_id from
--      0003 and the custom demo-token auth). Scoping is enforced in the app via
--      the service-role client; RLS stays the inert auth.role() gate.
--   3. Unique constraints / "one current period" / stale triggers / the
--      v_current_metrics view all become per-org.
--   4. New extraction_documents table + private `documents` Storage bucket back
--      the upload → extract → review → commit pipeline.
--
-- The ChainCraft seed is abandoned, so we truncate the five data tables rather
-- than backfill a sentinel org. renewable_share (seeded by 0002) goes with it;
-- we do NOT delete the applied 0002 migration.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Drop the view first — it depends on parameters.section, which we retype.
-- ─────────────────────────────────────────────────────────────────────────────
drop view if exists v_current_metrics;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Clear legacy ChainCraft rows. Order respects FKs (cascade would too, but
--    being explicit keeps intent clear).
-- ─────────────────────────────────────────────────────────────────────────────
truncate table calculated_metrics, data_points, formulas, parameters, reporting_periods cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. parameters.section: enum → free text.
-- ─────────────────────────────────────────────────────────────────────────────
alter table parameters add column section_text text;
update parameters set section_text = section::text;   -- no-op after truncate, kept for safety
alter table parameters drop column section;
alter table parameters rename column section_text to section;
alter table parameters alter column section set not null;
drop type if exists param_section;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add org_id everywhere. Tables are empty post-truncate, so NOT NULL is safe.
-- ─────────────────────────────────────────────────────────────────────────────
alter table reporting_periods  add column org_id text not null;
alter table parameters         add column org_id text not null;
alter table data_points        add column org_id text not null;
alter table formulas           add column org_id text not null;
alter table calculated_metrics add column org_id text not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Re-scope unique constraints to be per-org.
-- ─────────────────────────────────────────────────────────────────────────────
-- reporting_periods: code unique per org; one current period per org.
alter table reporting_periods drop constraint reporting_periods_code_key;
alter table reporting_periods add constraint reporting_periods_org_code_key unique (org_id, code);
drop index if exists reporting_periods_only_one_current;
create unique index reporting_periods_only_one_current_per_org
  on reporting_periods (org_id) where is_current = true;

-- parameters: code unique per org.
alter table parameters drop constraint parameters_code_key;
alter table parameters add constraint parameters_org_code_key unique (org_id, code);

-- data_points: one row per (org, period, parameter).
alter table data_points drop constraint data_points_period_id_parameter_id_key;
alter table data_points add constraint data_points_org_period_param_key unique (org_id, period_id, parameter_id);

-- calculated_metrics: one row per (org, period, parameter).
alter table calculated_metrics drop constraint calculated_metrics_period_id_parameter_id_key;
alter table calculated_metrics add constraint calculated_metrics_org_period_param_key unique (org_id, period_id, parameter_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Org indexes on the hot tables.
-- ─────────────────────────────────────────────────────────────────────────────
create index parameters_org_idx          on parameters (org_id);
create index reporting_periods_org_idx   on reporting_periods (org_id);
create index formulas_org_idx            on formulas (org_id);
create index data_points_org_period_idx  on data_points (org_id, period_id);
create index calculated_metrics_org_period_idx on calculated_metrics (org_id, period_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Org-scope the stale-marking triggers. parameter codes are no longer
--    globally unique, so an edit in one org must not flag another org's metrics.
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
     and cm.org_id     = new.org_id
     and f.is_active   = true
     and changed_param_code = any(f.dependencies);

  return new;
end;
$$ language plpgsql;

create or replace function mark_own_metric_stale() returns trigger as $$
begin
  if new.is_active then
    update calculated_metrics
       set is_stale = true
     where formula_id = new.id
       and org_id     = new.org_id;
  end if;
  return new;
end;
$$ language plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Recreate v_current_metrics carrying org_id, joining within org.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view v_current_metrics as
select
  cm.org_id,
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
join parameters         p  on p.id  = cm.parameter_id and p.org_id  = cm.org_id
join reporting_periods  rp on rp.id = cm.period_id    and rp.org_id = cm.org_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. extraction_documents — provenance/audit for each uploaded file.
-- ─────────────────────────────────────────────────────────────────────────────
create table extraction_documents (
  id            uuid primary key default gen_random_uuid(),
  org_id        text not null,
  period_id     uuid references reporting_periods(id) on delete set null,
  storage_path  text not null,
  filename      text not null,
  mime_type     text not null,
  status        text not null default 'pending',   -- pending | committed | failed
  proposal      jsonb,
  created_at    timestamptz not null default now()
);

create index extraction_documents_org_idx on extraction_documents (org_id);

alter table extraction_documents enable row level security;
create policy "auth read extraction_documents"  on extraction_documents for select using (auth.role() = 'authenticated');
create policy "auth write extraction_documents" on extraction_documents for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Private Storage bucket for uploaded documents. The app reads them via
--    short-TTL signed URLs (the runner never gets the service key).
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
