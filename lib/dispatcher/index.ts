// Dispatcher entry-point — picks between Vercel Sandbox (prod) and a local
// child-process stub (dev) based on AGENT_DISPATCH_MODE.
//
// Default: "sandbox" (matches reportingv5 production behaviour).
// Set AGENT_DISPATCH_MODE=local in .env.local for development.

import type { DispatchOptions } from "./sandbox";

export async function dispatch(opts: DispatchOptions): Promise<Response> {
  if (process.env.AGENT_DISPATCH_MODE === "local") {
    const { dispatchLocal } = await import("./local-stub");
    return dispatchLocal(opts);
  }
  const { dispatchToSandbox } = await import("./sandbox");
  return dispatchToSandbox(opts);
}
