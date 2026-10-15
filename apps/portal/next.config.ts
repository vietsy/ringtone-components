import path from "node:path";
import type { NextConfig } from "next";

/**
 * The public verification page is the strictest budget in the product: it is the page most likely
 * to be opened on a poor connection by an inspector in the field or by a member of the public with
 * no reason to wait. 300 KB total transfer, against 200 KB of JavaScript per route elsewhere.
 * Enforcement is at the release gate; this config keeps the defaults that make it achievable.
 */
const config: NextConfig = {
  // One image for every environment. `standalone` emits a server with only the files it traced,
  // which is what the container copies; anything environment-specific is read when a request
  // arrives, never inlined at build (no NEXT_PUBLIC_* value may differ between environments).
  output: "standalone",
  // The workspace root, so the trace follows the pnpm workspace packages above this directory.
  // `next build` always runs from apps/portal.
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@rightone/tokens", "@rightone/ui", "@rightone/formatting"],
  typedRoutes: true,
};

export default config;
