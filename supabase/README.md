# Supabase setup — metrics & document-extraction platform

End-to-end Supabase backing for the metrics dashboard and the document-extraction
pipeline. Multi-tenant (org-scoped), monthly arrays first-class, formulas stored
as data and re-evaluated by a tiny TS engine on demand. App-level scoping via the
service-role client; RLS is the inert `auth.role()` gate.

## File layout

```
supabase/
├── migrations/
│   ├── 0001_chaincraft_vsme.sql        ← original schema, RLS, triggers, view
│   ├── 0002_renewable_share.sql        ← (applied) seeded a derived metric
│   ├── 0003_ai_dashboard.sql           ← dashboards + dashboard_tiles
│   └── 0004_genericize_org_scoping.sql ← org_id scoping, free-text section,
│                                         extraction_documents, documents bucket

lib/
├── supabase/
│   ├── client.ts                       ← browser client (anon key)
│   ├── server.ts                       ← server + service-role clients
│   └── types.ts                        ← TS types mirroring the schema
└── metrics/
    ├── evaluator.ts                    ← arithmetic eval + topo sort
    ├── recalculate.ts                  ← orchestrates a full org+period recalc
    └── param-sections.ts              ← allowed `section` list (shared contract)

app/api/metrics/
├── route.ts                            ← GET — dashboard reads this
├── recalculate/route.ts                ← POST — rerun all formulas (org+period)
└── timeseries/route.ts                 ← GET — monthly series

app/api/extract/
├── route.ts                            ← POST — upload + dispatch extract agent
└── commit/route.ts                     ← POST — persist reviewed proposal

components/vsme/
├── KpiTile.tsx                         ← tile with click-through trace popover
└── KpiGroup.tsx                        ← section heading + grid
```

## Setup

### 1. Create a Supabase project
- New project (EU region recommended). Copy from **Project Settings → API**:
  - `Project URL`            → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` key        → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY` (server only!)

Paste them into `.env.local` (copy from `.env.local.example`).

### 2. Run the migrations
In the SQL Editor, run `0001` → `0002` → `0003` → `0004` in order (or
`supabase db push` via the CLI). `0004` truncates the legacy single-tenant data,
makes everything org-scoped, and creates the private `documents` Storage bucket.

There is **no seed** — data arrives through the extraction pipeline.

### 3. Use the app
1. Sign in, then go to **Data Collection → Upload data** (`/corporate/extract`).
2. Drop a utility bill / invoice / PDF. The agent reads it (Claude vision — no
   separate OCR), proposes parameters + data points with verbatim provenance.
3. Review and edit the proposal, then **Confirm & save** — rows land in
   `parameters` / `data_points` (org-scoped) and the `data_points_mark_stale`
   trigger flags dependent metrics.
4. `POST /api/metrics/recalculate` (the overview's **Recalculate** button)
   evaluates formulas into `calculated_metrics`.
5. The overview, AI dashboard charts, and the reporting Requirements tab all
   read the org-scoped data automatically.

## How it fits together

```
Document ──▶ /api/extract ──▶ Storage (documents bucket) + signed URL
                  │
                  ▼
        agent-runner (extract mode, Claude vision)
                  │ propose_extraction
                  ▼
        ProposalReview (user edits) ──▶ /api/extract/commit
                                              │
        ┌─────────────────────────────────────┤
        ▼                                     ▼
  data_points (raw, org-scoped)            formulas
        │                                     │
        └──────────▶ recalculate.ts (topo sort + eval) ◀───┘
                              │
                              ▼
                     calculated_metrics ──▶ /api/metrics ──▶ overview / charts
```

## Org scoping

`resolveOrgId(req)` in `lib/dashboard/auth.ts` is the single tenancy seam. Today
it reads an interim `X-Org-Id` header (attached client-side by `dashboardFetch`)
and falls back to a per-user org. Swap its body for a real JWT org-claim decode
when proper auth lands — every data route already calls through it.

## When formulas change

Update the `parameters` / `formulas` rows for the org (or insert a new `formulas`
row with `version = old + 1` and retire the old one). The trigger marks the
metric stale; recalc fills it in.
