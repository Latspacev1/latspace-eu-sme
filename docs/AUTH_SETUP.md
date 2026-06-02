# Clerk Authentication Setup

End-to-end guide for enabling sign-in via Clerk in this application.
Clerk owns the full authentication flow (Google SSO and email/password).
Supabase is no longer an auth provider — it stores organizations, memberships,
and all VSME data, accessed exclusively via the service-role client.

---

## How the flow works

```
User visits the app (any protected route)
        │
        ▼
Clerk middleware redirects unauthenticated users → /login
        │  (Clerk <SignIn> component — Google and/or email)
        ▼
User completes sign-in or sign-up
        │  (Clerk handles the credential exchange and issues a session)
        ▼
Clerk redirects to /post-auth  (server route)
        │
        ├── no memberships row for this Clerk user id
        │         → /onboarding  (user names their org, becomes owner)
        └── membership exists
                  → /corporate/overview
```

The same Clerk account (matched by Clerk user id) always maps to the same
organization row in Supabase and therefore to the same data.

---

## Step 1 — Create a Clerk application

1. Open [https://dashboard.clerk.com](https://dashboard.clerk.com) and sign in.
2. Click **Create application**, give it a name (e.g. `vsme-platform`), and
   click **Create application**.
3. Choose the sign-in methods you want to offer:

   **Google (recommended)**
   Go to **User & Authentication → Social Connections**, find Google, and
   toggle it **on**.
   - In development, Clerk provides shared OAuth credentials automatically —
     no Google Cloud Console setup is required. Your dev environment works
     immediately after enabling the toggle.
   - For production, you replace those shared credentials with your own Google
     OAuth client ID and secret in the Google connection settings inside the
     Clerk dashboard. See the
     [Clerk Google OAuth guide](https://clerk.com/docs/authentication/social-connections/google)
     for the step-by-step instructions.

   **Email / password (optional)**
   Go to **User & Authentication → Email, Phone, Username** and ensure
   **Email address** is enabled. Toggle **Password** on or off depending on
   whether you want email+password alongside Google.

---

## Step 2 — Copy API keys into .env.local

1. In the Clerk dashboard go to **API Keys**.
2. Copy the **Publishable key** (starts with `pk_`) and the **Secret key**
   (starts with `sk_`).
3. Add them to `.env.local`:

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is safe to expose in browser bundles —
  it identifies your Clerk application.
- `CLERK_SECRET_KEY` is **server-only**. Never include it in client-side code
  or commit it to version control.

---

## Step 3 — Configure Clerk route paths

The following variables are already present in `.env.local.example`. They tell
Clerk where your sign-in and sign-up pages live, and where to send users after
a successful authentication when no explicit `redirect_url` is present.

```dotenv
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/post-auth
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/post-auth
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Where the `<SignIn>` component is mounted (`/login`) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Where the `<SignUp>` component is mounted (`/sign-up`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Post-sign-in destination when no explicit `redirect_url` is set |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Post-sign-up destination when no explicit `redirect_url` is set |

Both fallback redirect URLs point to `/post-auth`, the server route that
checks Supabase memberships and routes the user to the correct destination.

---

## Step 4 — Supabase (organizations + data)

Supabase is still required — it powers multi-tenant organizations and the
entire VSME data platform. It no longer handles authentication.

### 4.1 Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key from Project Settings → API>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret key — server only, never expose>
```

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are safe to
  expose in browser bundles.
- `SUPABASE_SERVICE_ROLE_KEY` is **server-only**. It is used by the onboarding
  API route and all data API routes that read or write org-scoped data. Never
  include it in any client-side code or public bundle.

### 4.2 Database migrations

Run all migrations in order against your Supabase project. Either paste each
file into the SQL Editor in the Supabase dashboard, or use the Supabase CLI:

```bash
supabase db push
```

Migrations must be applied in this order:

| File | What it does |
|------|-------------|
| `0001_chaincraft_vsme.sql` | Original schema, RLS, triggers, metrics view |
| `0002_renewable_share.sql` | Derived metric seed |
| `0003_ai_dashboard.sql` | Dashboards and dashboard tiles |
| `0004_genericize_org_scoping.sql` | Org-scoped data tables, extraction_documents, documents bucket |
| **`0005_auth_orgs.sql`** | **organizations + memberships keyed by Clerk user ids; RLS enabled** |

Migration `0005_auth_orgs.sql` is the one that enables real multi-tenant
support. It creates:

- `organizations` — one row per tenant
- `memberships` — join table (Clerk user id ↔ org, with `owner` / `admin` /
  `member` roles). The `user_id` column is `text` and stores the Clerk user id
  directly (e.g. `user_2abc...`).

RLS is enabled on both tables. All writes and reads go through the
service-role client from server-side code; no Supabase Auth session is
required or used.

There is no seed file — all data enters through the extraction pipeline and
onboarding flow.

---

## Step 5 — Run the app

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY,
# and the three Supabase vars
npm install        # @clerk/nextjs is already listed in package.json
npm run dev        # starts on http://localhost:3000
```

Visit `http://localhost:3000` — Clerk middleware redirects you to `/login`.
Sign in (or up) and:

- **First visit** — no membership exists yet, so you are sent to `/onboarding`
  to name your organization. The onboarding API route (service-role client)
  creates the `organizations` row and a `memberships` row with `role = 'owner'`
  keyed to your Clerk user id. You then land on `/corporate/overview`.
- **Returning visit** — membership is found immediately; you go straight to
  `/corporate/overview`.

---

## Step 6 — First sign-in behavior in detail

### New user (no membership yet)

1. User signs in via Clerk (`/login` or `/sign-up`).
2. Clerk issues a session and redirects to `/post-auth`.
3. `/post-auth` calls Supabase (service-role client) and finds no row in
   `memberships` for this Clerk user id.
4. The user is redirected to `/onboarding`.
5. The user enters an organization name. The app creates an `organizations` row
   and a `memberships` row with `role = 'owner'`; `memberships.user_id` is set
   to the Clerk user id (text).
6. The user lands on `/corporate/overview` inside their new org.

### Returning user

1. User signs in — Clerk recognizes the account, issues a session, redirects
   to `/post-auth`.
2. `/post-auth` finds an existing `memberships` row for the Clerk user id.
3. The user is redirected directly to `/corporate/overview` in their org.

The Clerk user id is stable and unique; the same account always resolves to
the same organization.

---

## Local development

```bash
cp .env.local.example .env.local
# set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY (from Clerk dashboard)
# set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

No additional configuration is needed for Google sign-in in development —
Clerk's shared dev credentials are active as soon as you enable the Google
social connection in the Clerk dashboard.

---

## Troubleshooting

### "Missing publishable key" / app crashes on boot

Clerk cannot find its API keys.

**Fix:** Make sure `.env.local` contains both `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
and `CLERK_SECRET_KEY` copied from **Clerk dashboard → API Keys**. Restart the
dev server after adding or changing these values (`npm run dev`).

### Stuck redirect loop between /login and /post-auth

The user is authenticated by Clerk but keeps being sent back to `/login`, or
`/post-auth` keeps redirecting back to `/login`.

**Fix:** Check two things:
1. Confirm `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` and
   `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` are both set to `/post-auth`
   in `.env.local`.
2. Confirm that migration `0005_auth_orgs.sql` has been applied against your
   Supabase project (check for the `organizations` and `memberships` tables in
   the Supabase Table Editor). Without this migration, `/post-auth` cannot
   perform membership lookups and the routing logic will fail.

### Google sign-in option not appearing on /login

The Google social connection is not enabled in Clerk.

**Fix:** In the Clerk dashboard go to **User & Authentication → Social
Connections**, find Google, and toggle it **on**. The `<SignIn>` component
picks up the change automatically — no code changes required.
