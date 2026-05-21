-- Adds a derived headline metric: renewable energy share of total energy.
-- ChainCraft's electricity is 100% renewable (Vattenfall GvO EU Wind) and
-- biogas is classified renewable. So:
--   renewable_share = (electricity_mwh + biogas_self_mwh) / total_energy_mwh
--
-- Stored as a new output parameter + formula so it lives alongside everything
-- else and is recomputed on every recalc.

insert into parameters (code, display_name, unit, category, section, vsme_cell, is_calculated, display_order)
values
  ('renewable_share', 'Renewable energy share', '%', 'output', 'vsme_b3_energy', '—', true, 95)
on conflict (code) do update set display_name=excluded.display_name, unit=excluded.unit, section=excluded.section;

insert into formulas (output_param_id, expression, expression_human, dependencies, description)
values
  ((select id from parameters where code = 'renewable_share'),
   '(electricity_mwh + biogas_self_mwh) / total_energy_mwh * 100',
   '(Electricity + Biogas) ÷ Total energy × 100',
   ARRAY['electricity_mwh', 'biogas_self_mwh', 'total_energy_mwh']::text[],
   '100% renewable electricity (GvO EU Wind) + biogas classified renewable.')
on conflict (output_param_id, version) do update set expression=excluded.expression, dependencies=excluded.dependencies;
