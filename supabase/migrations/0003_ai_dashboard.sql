-- AI Dashboard — pinned charts.
-- One dashboard per user (in this single-tenant ChainCraft deployment),
-- many tiles per dashboard. Each tile stores a self-contained ChartSpec
-- jsonb so the renderer can paint it without any other lookups.
--
-- user_id is text (not uuid) because this app uses a custom demo-token
-- auth system whose subject ids are plain strings like "u-corp-001". The
-- application layer enforces scoping; there is no FK to auth.users.

create table dashboards (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  name        text not null default 'My dashboard',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index dashboards_user_idx on dashboards (user_id);

create trigger dashboards_set_updated_at
  before update on dashboards
  for each row execute function set_updated_at();

create table dashboard_tiles (
  id            uuid primary key default gen_random_uuid(),
  dashboard_id  uuid not null references dashboards(id) on delete cascade,
  spec          jsonb not null,                       -- validated ChartSpec
  layout        jsonb not null,                       -- { x, y, w, h }
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index dashboard_tiles_dashboard_idx on dashboard_tiles (dashboard_id);

create trigger dashboard_tiles_set_updated_at
  before update on dashboard_tiles
  for each row execute function set_updated_at();

-- RLS — same pattern as the rest of the schema: authenticated reads/writes
-- gated by the app-level service-role client. The chat/tiles routes always
-- pass through the service-role client and enforce user scoping in code.
alter table dashboards       enable row level security;
alter table dashboard_tiles  enable row level security;

create policy "auth read dashboards"       on dashboards       for select using (auth.role() = 'authenticated');
create policy "auth write dashboards"      on dashboards       for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth read dashboard_tiles"  on dashboard_tiles  for select using (auth.role() = 'authenticated');
create policy "auth write dashboard_tiles" on dashboard_tiles  for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
