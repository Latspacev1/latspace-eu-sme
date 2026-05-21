# Agent runner setup

The VSME Narrative report (qualitative editor) uses a Claude Agent SDK runner hosted in
[Vercel Sandbox](https://vercel.com/docs/vercel-sandbox). The Next.js routes
`/api/reporting/chat` and `/api/reporting/write` spawn a fresh sandbox per
request and stream NDJSON back to the browser.

## Vercel project setup

1. `vercel link` from the repo root.
2. This codebase is tuned for the **Pro plan**. Hobby plan needs the four knobs
   in the reportingv5 [DEPLOY.md § Plan tuning](https://github.com/) dialed down
   (maxDuration → 60, sandbox timeout → 90s, etc.).
3. Confirm **credential brokering** is enabled on your Vercel team.

## Required environment variables

| Variable | Where it's read |
|---|---|
| `ANTHROPIC_API_KEY` | `lib/dispatcher/sandbox.ts` — passed into the sandbox env |
| `VOYAGE_API_KEY` | `lib/dispatcher/sandbox.ts` — passed into the sandbox env |
| `AGENT_RUNNER_TARBALL_URL` | `lib/dispatcher/sandbox.ts` — Sandbox.create() source |
| `AGENT_RUNNER_SNAPSHOT_ID` | (optional) overrides tarball — faster cold start |

⚠️ The keys are currently passed into the sandbox env directly (security
downgrade). See the SECURITY DOWNGRADE comment in
[lib/dispatcher/sandbox.ts](../lib/dispatcher/sandbox.ts) for the recovery
path once Vercel credential brokering is verified to work on this team.

## CI secret

Set `BLOB_READ_WRITE_TOKEN` in the GitHub repo secrets so a publish workflow
can upload the runner tarball. Token comes from Vercel → Storage → Blob → Tokens.

## Publish the first tarball

```sh
# Locally:
npm install --no-save @vercel/blob
BLOB_READ_WRITE_TOKEN=... npm run publish:runner
# Copy the URL it prints into AGENT_RUNNER_TARBALL_URL on Vercel.
```

## Rebuilding the runner

Only required when something under `agent-runner/` changes (agent code, RAG
index, runner deps). The Next app deploys independently — pushing to Vercel
doesn't rebuild the tarball.

```sh
npm run build:runner    # build + report path, no upload
npm run publish:runner  # build + upload to Vercel Blob
```

## Stubbing for local dev (no Vercel needed)

If `ANTHROPIC_API_KEY` is missing, the dispatcher will throw at request time.
For local dev without a sandbox, comment out the `dispatchToSandbox` call in
`app/api/reporting/chat/route.ts` and `app/api/reporting/write/route.ts` and
return a stub NDJSON response.
