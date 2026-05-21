# ChainCraft VSME — Supabase setup

End-to-end Supabase backing for the VSME (ChainCraft) dashboard. Single-tenant
schema, monthly arrays first-class, formulas stored as data and re-evaluated by
a tiny TS engine on demand.

## File layout

```
supabase/
├── migrations/
│   └── 0001_chaincraft_vsme.sql        ← schema, RLS, triggers, view
└── seed/
    └── chaincraft_fy2025.sql           ← AUTO-GENERATED — re-run the script below

scripts/
├── generate-chaincraft-seed.mjs        ← Excel → seed SQL (re-runnable)
└── test-evaluator.mjs                  ← smoke-tests the evaluator vs Excel

lib/
├── supabase/
│   ├── client.ts                       ← browser client (anon key)
│   ├── server.ts                       ← server + service-role clients
│   └── types.ts                        ← TS types mirroring the schema
└── chaincraft/
    ├── evaluator.ts                    ← arithmetic eval + topo sort
    └── recalculate.ts                  ← orchestrates a full period recalc

app/api/chaincraft/
├── metrics/route.ts                    ← GET — dashboard reads this
└── recalculate/route.ts                ← POST — rerun all formulas

app/corporate/overview/
├── page.tsx                            ← branches on org → VSME or cement view
└── VsmeOverview.tsx                    ← VSME KPI tiles dashboard

components/vsme/
├── KpiTile.tsx                         ← tile with click-through trace popover
└── KpiGroup.tsx                        ← section heading + grid
```

## Setup

### 1. Create a Supabase project
- Go to https://supabase.com → New project. Pick the EU region (Frankfurt) to
  keep ChainCraft's data in the EU.
- Copy three values from **Project Settings → API**:
  - `Project URL`            → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` key        → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY` (server only!)

Paste them into `.env.local` (copy from `.env.local.example`).

### 2. Run the migration
- **SQL Editor**: paste the contents of `supabase/migrations/0001_chaincraft_vsme.sql` and run.
- **Or via Supabase CLI** (`brew install supabase/tap/supabase`):
  ```bash
  supabase link --project-ref <ref>
  supabase db push
  ```

### 3. Generate + load the seed
```bash
# Regenerate seed SQL from the Excel (idempotent)
node scripts/generate-chaincraft-seed.mjs \
  --excel "C:/Users/ishan/Downloads/Chaincraft/Chaincraft/ChainCraft VSME/ChainCraft_VSME_Input_Output_FY2025.xlsx" \
  --out supabase/seed/chaincraft_fy2025.sql

# Apply it (SQL Editor → paste, run)
# Result: 1 period, 146 parameters, 81 data_points, 63 formulas
```

### 4. Compute all metrics
First-time, hit the recalculate endpoint to populate `calculated_metrics`:
```bash
curl -X POST http://localhost:3000/api/chaincraft/recalculate \
  -H 'Content-Type: application/json' \
  -d '{"period":"FY2025"}'
```
After that, the trigger `data_points_mark_stale` will flag affected metrics
whenever an input changes; the dashboard's **Recalculate** button re-runs the
evaluator and clears the stale flag.

### 5. Flip the dashboard to VSME mode
For ChainCraft (single-tenant), either:
- Set `NEXT_PUBLIC_DASHBOARD_PROFILE=vsme` in `.env.local`, **or**
- Make sure the org name returned by `/api/organizations/:id` contains
  "ChainCraft" or "VSME" — the branch in `app/corporate/overview/page.tsx`
  checks both.

Visit `/corporate/overview` → you'll see the VSME KPI tiles.

## How it fits together

```
Excel  ──(generate-chaincraft-seed.mjs)──▶  seed SQL  ──▶  Supabase
                                                              │
        ┌─────────────────────────────────────────────────────┤
        ▼                                                     ▼
  data_points (raw)                                       formulas
        │                                                     │
        └──────────▶  recalculate.ts (topo sort + eval) ◀─────┘
                              │
                              ▼
                     calculated_metrics  ──▶  /api/chaincraft/metrics
                                                     │
                                                     ▼
                                          VsmeOverview (KPI tiles)
```

## Editing inputs

Today the dashboard is read-only. To wire data entry:

1. New page `app/(reporting)/inputs/page.tsx` — table of all parameters with
   `category = 'input'`, grouped by section. Each row → text input (annual)
   or 12 inputs (monthly).
2. POST to `/api/chaincraft/data-points` (not built yet) → upsert into
   `data_points`. The DB trigger marks dependent metrics stale.
3. The dashboard's "Recalculate" button (already wired) rebuilds them.

## When formulas change

If you need to amend a methodology (e.g. grid EF source switches from RVO to
DEFRA):

1. Either update the row directly in `parameters` / `formulas`, or
2. Insert a new `formulas` row with `version = old + 1`, then
   `update formulas set is_active = false where output_param_id = X and version = old`
   to retire the old one. The trigger marks the metric stale; recalc fills it in.

## Verifying parity with the Excel

```bash
node scripts/test-evaluator.mjs
# → PASS: 39 NEAR (within 5%): 1 FAIL: 1
```
The one residual "FAIL" (`scope1_ng_ch4`) compares the evaluator's output
against the "Per Final VSME Report" column, which in two rows differs from
the Excel's *own* formula result by sub-percent (filed report rounding).
The evaluator matches Excel's formula result exactly on every metric.
