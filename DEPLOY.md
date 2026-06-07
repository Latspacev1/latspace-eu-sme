# Deploying to Vercel

End-to-end runbook for publishing this app to Vercel, including the AI agents
that run inside **Vercel Sandbox**.

> Requires a **Vercel Pro** plan (or a team on Pro). Sandbox and the long
> `maxDuration` streaming the agents depend on are Pro-only. On Hobby, agent
> runs are capped to ~60s and will be cut off mid-response — see
> [Plan tuning](#plan-tuning).

---

## Architecture: what actually runs where

```
Browser
  │  POST /api/reporting/chat  (and /api/extract, /api/reporting/fill, …)
  ▼
Next.js route on Vercel  ── runtime "nodejs", maxDuration 800 ──┐
  │  dispatch() → dispatchToSandbox()                            │
  ▼                                                              │
Vercel Sandbox (ephemeral Linux x64 VM, 2 vCPU)                  │
  │  • boots, fetches AGENT_RUNNER_TARBALL_URL from Vercel Blob  │
  │  • runs `node runner.ts` (Claude Agent SDK + native binary)  │
  │  • firewall: egress allowed ONLY to anthropic/voyage/        │
  │    supabase/blob hosts                                       │
  ▼                                                              │
stdout NDJSON  ─────────────────────────────────────────────────┘
  │  re-streamed line-by-line to the browser
  ▼
Browser renders tokens / tool-use / proposals live
```

Three deployable pieces:

| Piece | Where it lives | How it ships |
|---|---|---|
| Next.js app (UI + API routes) | Vercel | `git push` → Vercel build |
| `agent-runner` tarball | Vercel Blob | `npm run publish:runner` (built locally) |
| External services | Supabase, Clerk, Anthropic, Voyage | configured once, referenced via env |

The agent-runner is **excluded** from the Next build trace
(`next.config.ts → outputFileTracingExcludes`). It is not bundled into any
route — it only ever runs inside the sandbox, loaded from the tarball.

---

## Step 0 — Prerequisites

- A Vercel **Pro** account/team.
- The Vercel CLI: `npm i -g vercel` (optional but handy for env + Blob).
- This repo pushed to a GitHub/GitLab/Bitbucket remote that Vercel can import.

---

## Step 1 — Stand up the external services

The app will not boot without all four. Set these up first and collect the
credentials; you'll paste them into Vercel env in Step 3.

### 1a. Supabase (data platform — orgs, parameters, documents)

1. Create a Supabase project. Note the **Project URL** and, from
   **Project Settings → API**, the **anon** key and the **service_role** key.
2. Apply the migrations in `supabase/migrations/` **in order** (0001 → 0007).
   Either paste each file into the Supabase SQL editor, or use the Supabase
   CLI: `supabase db push`.
3. Create a public-read-disabled Storage bucket named **`documents`** (used by
   extract mode for uploaded files; the sandbox reads them via short-TTL signed
   URLs). Confirm the bucket name matches what `lib/reporting/storage.ts` uses.

Collect:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # server only — never expose
```

### 1b. Clerk (authentication)

Follow `docs/AUTH_SETUP.md`. Create a Clerk application, enable your sign-in
methods, and for production switch to **production instance** keys (the
`pk_live_…` / `sk_live_…` pair) rather than `pk_test_…`. In the Clerk dashboard
set the app's allowed origin / domain to your Vercel production URL.

Collect:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/post-auth
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/post-auth
```

### 1c. Anthropic + Voyage (the AI)

- **Anthropic**: create an API key at the Anthropic console. Used by the agent
  (inside the sandbox) and by `/api/dashboard/chat`.
- **Voyage**: create an API key at voyageai.com. Used by the RAG retriever for
  query embeddings.

Collect:
```
ANTHROPIC_API_KEY
VOYAGE_API_KEY
```

---

## Step 2 — Build and publish the agent-runner tarball

The sandbox fetches this tarball on boot. It contains `runner.ts`, the runner's
`node_modules`, and the **~250 MB native Claude Agent SDK Linux x64 binary**.
The build script forces the linux-x64 optional dependency so it works even when
you build from Windows/macOS.

You need a **Vercel Blob store** and its read-write token:

1. In the Vercel dashboard → **Storage → Create → Blob**. Create a store.
2. Get a `BLOB_READ_WRITE_TOKEN`:
   - Easiest: `vercel env pull` after linking the project (Step 3), or
   - Dashboard → the Blob store → **`.env.local`** tab copies the token, or
   - `vercel blob` CLI.

Then build + upload from this machine:

```powershell
# from the repo root
$env:BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_..."
npm run publish:runner
```

This runs `scripts/build-runner-tarball.mjs --upload`. It will:
- stage `agent-runner/`, install deps with `--os=linux --cpu=x64`,
- verify the linux-x64 binary is present,
- produce `agent-runner-<sha>.tar.gz`,
- upload it to Blob and print:

```
Set this in your Vercel project env:
  AGENT_RUNNER_TARBALL_URL=https://<store>.public.blob.vercel-storage.com/agent-runner-<sha>.tar.gz
```

Copy that URL — it goes into env in Step 3.

> **Re-publish whenever you change anything under `agent-runner/`.** The Next
> app and the runner version independently. A stale tarball means the sandbox
> runs old agent code. (See [Keeping the runner in sync](#keeping-the-runner-in-sync).)

> `@vercel/blob` is intentionally **not** a project dependency — the publish
> script imports it on demand via `npm install --no-save`. If the upload step
> complains it's missing, run `npm install --no-save @vercel/blob` once and retry.

---

## Step 3 — Import the project into Vercel and set env

1. Vercel dashboard → **Add New → Project** → import this repo.
   Framework preset: **Next.js** (auto-detected). Build command and output are
   the Next defaults; `output: "standalone"` in `next.config.ts` is handled by
   Vercel automatically — no override needed.
2. Add **Environment Variables** (Production, and Preview if you want preview
   deploys to work). Paste everything collected above, **plus**:

```
AGENT_DISPATCH_MODE=sandbox
AGENT_RUNNER_TARBALL_URL=https://<store>.public.blob.vercel-storage.com/agent-runner-<sha>.tar.gz
```

> ⚠️ Do **not** set `AGENT_DISPATCH_MODE=local` in Vercel. `local` spawns the
> runner as a child process, which only works on your dev machine. Production
> must be `sandbox` (it's also the default if the var is absent, but set it
> explicitly to be safe).

Full production env checklist:

```
# Dispatch
AGENT_DISPATCH_MODE=sandbox
AGENT_RUNNER_TARBALL_URL=...

# AI
ANTHROPIC_API_KEY=...
VOYAGE_API_KEY=...

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/post-auth
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/post-auth

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`BLOB_READ_WRITE_TOKEN` does **not** need to be in Vercel env — it's only used
locally by the publish script. (The sandbox fetches the tarball via its public
Blob URL, no token required.)

3. Deploy. Vercel builds the Next app and gives you a production URL.

---

## Step 4 — Smoke test

1. Visit the production URL → you should be redirected to `/login` (Clerk).
2. Sign up → `/post-auth` → `/onboarding` (name an org) → `/corporate/overview`.
3. Trigger an agent: open the reporting assistant and send a chat message.
   Watch the network response — you should see an early
   `{"event":"sandbox","data":{"status":"ready",...}}` line, then streamed
   `text` deltas.
4. If the agent errors immediately, check **Vercel → Project → Logs** for
   `[dispatch]` lines — they carry the sandbox HTTP status and stderr tail.

See [Troubleshooting](#troubleshooting) for the common failure modes.

---

## Plan tuning

The default config targets **Pro**. If you must run on Hobby (not recommended —
agent runs will be truncated):

| Setting | Pro | Hobby |
|---|---|---|
| Route `maxDuration` (each `/api/**` agent route) | `800` | `60` (max allowed) |
| Sandbox `timeoutMs` (`dispatchToSandbox` default) | `600_000` | `~90_000` |

On Hobby the function will close the stream at 60s regardless of the sandbox
timeout, so the user sees a cut-off response on any longer run. Upgrade to Pro
for real usage.

---

## Keeping the runner in sync

The Next app and the agent-runner deploy on **separate cadences**:

- Changing UI / API route code → just `git push`; Vercel redeploys.
- Changing anything under `agent-runner/` → **re-run `npm run publish:runner`**
  and update `AGENT_RUNNER_TARBALL_URL` in Vercel env to the new URL, then
  redeploy (or just changing the env var + redeploy is enough).

A mismatch is silent: the app works, but agents run the old tarball. If you
change runner behavior and don't see it in prod, this is almost always why.

> **Optional hardening — snapshots.** `dispatchToSandbox` prefers
> `AGENT_RUNNER_SNAPSHOT_ID` over the tarball URL if set. A snapshot boots in
> ~150ms vs 1–3s for a tarball fetch. Worth setting up later for latency; the
> tarball path is the simplest thing that works.

---

## Security note (read before going to real users)

`lib/dispatcher/sandbox.ts` is currently in an **intentional security
downgrade** (see the `SECURITY DOWNGRADE` comment around line 57):

- The original design **brokered** the Anthropic/Voyage keys at the network
  layer, so the keys never entered the sandbox VM. Vercel rejected those
  transform rules with HTTP 400 (credential brokering likely needs a
  team-level permission that isn't enabled).
- As a fallback, the keys are passed into the sandbox **env**. The firewall
  still denies all egress except `api.anthropic.com`, `api.voyageai.com`,
  `*.supabase.co`, and `*.public.blob.vercel-storage.com`, so the blast radius
  is limited — but a prompt-injection that gets the model to print `env` could
  leak the keys.

This is acceptable for launch given the locked-down egress. To restore the
stronger boundary: open a Vercel support ticket to enable credential brokering
(or move to `@vercel/sandbox@beta`), then re-add the `transform` rules and
remove the two keys from the `env` object in `dispatchToSandbox`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Neither AGENT_RUNNER_SNAPSHOT_ID nor AGENT_RUNNER_TARBALL_URL is set` | tarball URL env missing | Set `AGENT_RUNNER_TARBALL_URL` (Step 3) |
| Sandbox create fails, exitCode 6 "Couldn't resolve host" | firewall blocked a needed host (incl. DNS) | the allow-list in `getNetworkPolicy()` must include every host the sandbox contacts |
| `Runner exited N with no output` | runner crashed before emitting NDJSON | check `[dispatch] runner exit` log's `stderrTail` in Vercel logs |
| `Sandbox dispatch failed (400)` | Sandbox API rejected create params (e.g. brokering) | see Security note; check `[dispatch]` log body |
| Agent response cut off at ~60s | running on Hobby, or `maxDuration` too low | upgrade to Pro / raise `maxDuration` |
| Agent runs old code | stale tarball | re-publish runner, update URL (see Keeping in sync) |
| Stuck on `/login` loop | Clerk keys/domain mismatch | verify Clerk prod keys + allowed origin = Vercel URL |
| Extract mode can't read uploaded doc | `documents` bucket missing or signed-URL host blocked | create the bucket; confirm `*.supabase.co` in allow-list |
