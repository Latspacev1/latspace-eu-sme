// Local-development dispatcher: spawns the agent runner as a child process on
// this machine instead of creating a Vercel Sandbox. Same NDJSON wire format
// as sandbox.ts so the browser stream parser doesn't need to change.
//
// Selected at request time by lib/dispatcher/index.ts when AGENT_DISPATCH_MODE
// is set to "local". See agent-runner/AGENT-SETUP.md for prod (Sandbox) setup.

import { spawn } from "node:child_process";
import path from "node:path";

export interface DispatchOptions {
  job: unknown;
  timeoutMs?: number;
}

function errorResponse(message: string, status = 500): Response {
  const body = JSON.stringify({ event: "error", data: { message } }) + "\n";
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

export async function dispatchLocal(opts: DispatchOptions): Promise<Response> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!anthropicKey) return errorResponse("ANTHROPIC_API_KEY is not set in .env.local");
  if (!voyageKey) return errorResponse("VOYAGE_API_KEY is not set in .env.local");

  const runnerCwd = path.join(process.cwd(), "agent-runner");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? "development",
    JOB_JSON: JSON.stringify(opts.job),
    ANTHROPIC_API_KEY: anthropicKey,
    VOYAGE_API_KEY: voyageKey,
  };

  // Node's --experimental-strip-types lets us run .ts directly without tsx.
  // Matches what the sandbox dispatcher does in production.
  const runner = spawn(
    process.execPath, // current node binary
    ["--experimental-strip-types", "--no-warnings", "runner.ts"],
    { cwd: runnerCwd, env, stdio: ["ignore", "pipe", "pipe"] },
  );

  const encoder = new TextEncoder();
  let stderrBuf = "";

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Boot event so the client UI matches the sandbox dispatcher's behaviour
      // (see sandbox.ts: it emits a "sandbox" event with status: ready).
      controller.enqueue(
        encoder.encode(
          JSON.stringify({
            event: "sandbox",
            data: { status: "ready", id: `local-${runner.pid}` },
          }) + "\n",
        ),
      );

      // Forward stdout verbatim — the runner already emits NDJSON line-by-line.
      // We don't try to re-buffer here; Node's chunking is typically already
      // line-aligned for small writes, and partial lines are harmless because
      // the browser parser tolerates them (sandbox.ts does extra buffering
      // because sandbox cmd.logs() can deliver mid-line; child_process stdout
      // does not have that quirk).
      runner.stdout.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });

      runner.stderr.on("data", (chunk: Buffer) => {
        // Surface to the dev terminal — easier to debug runner crashes than
        // hunting through browser network panel.
        const text = chunk.toString();
        stderrBuf += text;
        process.stderr.write(`[agent-runner] ${text}`);
      });

      runner.on("close", (code) => {
        if (code !== 0) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                event: "error",
                data: {
                  message: `Runner exited ${code}. Stderr tail: ${
                    stderrBuf.slice(-500) || "(empty)"
                  }`,
                },
              }) + "\n",
            ),
          );
        }
        controller.close();
      });

      runner.on("error", (err) => {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              event: "error",
              data: { message: `Failed to spawn runner: ${err.message}` },
            }) + "\n",
          ),
        );
        controller.close();
      });
    },
    cancel() {
      // Browser disconnected — kill the runner so we don't keep paying
      // Anthropic for tokens nobody is reading.
      runner.kill("SIGTERM");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
