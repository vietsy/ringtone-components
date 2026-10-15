import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The `@/` alias Next.js resolves from tsconfig paths has to be repeated here: vitest does not read
 * the Next config. Tests cover the parts that hold rules - the message catalogue and the error
 * presentation - rather than the rendering, which Playwright checks end to end against a real page.
 */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { include: ["test/**/*.test.ts"] },
});
