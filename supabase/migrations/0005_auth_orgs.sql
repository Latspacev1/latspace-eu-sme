-- Multi-tenant organizations + memberships, keyed by Clerk user ids.
--
-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  CRITICAL TYPE CONTRACT — read before touching any data table               ║
-- ║                                                                              ║
-- ║  All existing data tables (parameters, data_points, reporting_periods,       ║
-- ║  formulas, calculated_metrics, extraction_documents, dashboards) store       ║
-- ║  org_id as TEXT.  That column equals  organizations.id::text  — i.e. the    ║
-- ║  UUID primary key of the organizations row rendered as a plain text string.  ║
-- ║                                                                              ║
-- ║  DO NOT change org_id to uuid in the data tables — the app depends on this  ║
-- ║  contract and resolves the uuid → text cast when scoping queries.           ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝
--
-- AUTH MODEL: Clerk owns identity. A Clerk user id is a TEXT string (e.g.
-- "user_2abc..."), NOT a uuid, and there is no Supabase `auth.users` table to
-- reference. So:
--   * memberships.user_id and organizations.created_by are TEXT (the Clerk id).
--   * There is no app_users mirror / auth.users trigger.
--   * Data access uses the service-role client + app-level org scoping; we do
--     NOT rely on Supabase RLS / auth.uid(). RLS is left ENABLED with no
--     policies, so the anon key can read nothing and only the service role
--     (which bypasses RLS) touches these tables. This is the same posture the
--     data tables already use.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. organizations — one row per tenant.
-- ─────────────────────────────────────────────────────────────────────────────
create table organizations (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        unique,                    -- url-friendly short name, optional
  created_by  text,                                  -- Clerk user id of the founder (nullable)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on organizations
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. memberships — which Clerk users belong to which organization, and the role.
--    Written via the service-role client during onboarding / invites.
-- ─────────────────────────────────────────────────────────────────────────────
create table memberships (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null,                  -- Clerk user id
  org_id      uuid        not null references organizations(id) on delete cascade,
  role        text        not null default 'member'
                          check (role in ('owner', 'admin', 'member')),
  created_at  timestamptz not null default now(),
  unique (user_id, org_id)
);

create index memberships_user_idx on memberships (user_id);
create index memberships_org_idx  on memberships (org_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS — enabled with NO policies.
--    The service-role key bypasses RLS entirely (that is the app's only write/
--    read path for these tables). With RLS on and no policies, the anon/public
--    key is denied by default, which is exactly what we want now that Clerk —
--    not Supabase Auth — gates access. auth.uid() is unavailable here, so no
--    policy could reference the Clerk identity anyway.
-- ─────────────────────────────────────────────────────────────────────────────
alter table organizations enable row level security;
alter table memberships   enable row level security;
