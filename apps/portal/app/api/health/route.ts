/**
 * Liveness, and which build is running. See README.md in this directory.
 *
 * `force-dynamic`: the values are read from the environment of the running container. Rendered at
 * build time, every environment would report the build machine's values.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    {
      status: "ok",
      service: "rightone-portal",
      revision: process.env["PLW_REVISION"] ?? null,
      build: process.env["PLW_BUILD"] ?? null,
      builtAt: process.env["PLW_BUILT_AT"] ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
