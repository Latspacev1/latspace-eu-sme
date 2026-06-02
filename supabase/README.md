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
│   ├── 0004_genericize_org_scoping.sql ← org_id scoping, free-text section,
│   │                                     extraction_documents, documents bucket
│   └── 0005_auth_orgs.sql             ← organizations + memberships
│                                         (keyed by Clerk text user ids)

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
In the SQL Editor, run `0001` → `0002` → `0003` → `0004` → `0005` in order (or
`supabase db push` via the CLI). `0004` truncates the legacy single-tenant data,
makes everything org-scoped, and creates the private `documents` Storage bucket.
`0005` adds the real-auth org/membership layer (see below).

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

---

## Organizations and multi-tenant auth (migration 0005)

Identity is handled by **Clerk**, not Supabase Auth. Supabase stores the orgs and
all tenant data; the app resolves the Clerk user via `auth()`/`currentUser()`
server-side and scopes Supabase reads/writes by org using the **service-role
client**. A Clerk user id is a `text` string (e.g. `user_2abc…`), so the tables
below key on `text`, and there is no `auth.users` table to reference.

### New tables

| Table | Purpose |
|---|---|
| `organizations` | One row per tenant. `id uuid`, `name text`, `slug text` (unique), `created_by text` (Clerk user id, nullable), timestamps. |
| `memberships` | Join table: `user_id text` (Clerk id) + `org_id uuid` + `role text` (`owner`/`admin`/`member`). Unique on `(user_id, org_id)`. |

### Critical type contract: org_id in data tables is TEXT

All existing data tables (`parameters`, `data_points`, `reporting_periods`,
`formulas`, `calculated_metrics`, `extraction_documents`, `dashboards`) store
`org_id` as **`text`**, not `uuid`. This type was fixed in migration 0004 before
`organizations` existed and must not be changed.

The value stored in those `org_id text` columns equals the organization's UUID
rendered as a plain string:

```
data_table.org_id  =  organizations.id::text
```

When scoping a query to the current org, cast at query time:

```sql
-- example: fetch parameters for a known org uuid
SELECT * FROM parameters
 WHERE org_id = $1::uuid::text;   -- or just pass the uuid as a string from TS
```

### Resolving a user's org_id

The Clerk user id comes from `auth()` (server-side). Look up the org with the
service-role client:

```ts
import { auth } from '@clerk/nextjs/server';

const { userId } = await auth();              // Clerk user id (text)
const { data } = await serviceRole
  .from('memberships')
  .select('org_id')
  .eq('user_id', userId)
  .limit(1)
  .single();
const orgId: string = data.org_id; // uuid string — matches data table org_id
```

This is exactly what `lib/auth/session.ts` (`getActiveMembership`) and the
`resolveOrgId`/`resolveUserId` seam in `lib/dashboard/auth.ts` do.

### All writes go through the service-role client

RLS is enabled on `organizations`/`memberships` with **no policies**, so the
anon/public key can read nothing. The app's only path to these tables is the
**service-role client** (`SUPABASE_SERVICE_ROLE_KEY`), which bypasses RLS —
used by the onboarding route (create org + owner membership) and the data API
routes. Never expose the service-role key to the browser.
