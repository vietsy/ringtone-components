# health

`GET /api/health` answers 200 with the build that is running:

    { "status": "ok", "service": "rightone-portal", "revision": "…", "build": "…", "builtAt": "…" }

The deploy pipeline calls it after every rollout, and the container's own health check calls it
every 30 seconds. `revision`, `build` and `builtAt` come from `PLW_REVISION`, `PLW_BUILD` and
`PLW_BUILT_AT`, which the deploy sets on the container; they are read on each request, so the same
image reports correctly in every environment.

It is a liveness check. It does not call `rightone-api`: a portal that is up while the API is down
must still be reported as up, or a restart loop hides the real fault.
