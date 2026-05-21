import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow cross-origin requests for /_next/* assets when accessing via external IP in dev.
  // Next.js 16 blocks these by default - needed when the dev server is behind nginx or accessed
  // from a remote machine (e.g. EC2 instance accessed via public IP).
  // Add the server's public IP and any other origins that need access.
  allowedDevOrigins: [
    "15.207.194.38",
    "3.111.70.167",
    "localhost",
  ],
  // The agent SDK and RAG index live inside agent-runner/, which ships into
  // Vercel Sandbox at request time — neither needs to be traced into any Next
  // route bundle. The dispatcher routes only depend on @vercel/sandbox, which
  // Next traces automatically. In Next 15+ this moved out of `experimental`
  // to a top-level key.
  outputFileTracingExcludes: {
    "*": ["./agent-runner/**/*"],
  },
};

export default nextConfig;
