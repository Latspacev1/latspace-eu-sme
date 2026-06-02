-- Onboarding profile — the structured answers a user gives when creating their
-- organization (company website, which reports they're producing, VSME purpose
-- and module scope, reporting year). Surfaced later in the "AI Context" page
-- and read by the agent routes to ground the assistant in the org's situation.
--
-- Stored as a single JSONB blob on organizations rather than a normalized table:
-- it's a small, mostly-read document edited as a whole from one screen, and the
-- shape is expected to grow as the AI Context feature expands. The TS contract
-- lives in lib/types/onboarding.ts (OnboardingProfile).
--
-- Shape (all fields optional at the DB layer; the app validates):
--   {
--     "companyName":   text,            -- mirrors organizations.name, kept here too
--     "websiteUrl":    text,
--     "reports":       ["vsme","cdp_sme"],
--     "vsme": {
--       "purpose":     text,
--       "modules":     "basic" | "basic_comprehensive"
--     },
--     "reportingYear": int,
--     "updatedAt":     timestamptz (iso string)
--   }

alter table organizations
  add column if not exists onboarding_profile jsonb;
