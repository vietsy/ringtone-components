# route-groups

The routes of one group of screens each, spread into `routes` by `lib/routes.ts`, so that the work on one group
adds its paths in its own file and never edits another's. `route.ts` holds `route` and `enc`, the only places a path
is vouched for; a page still imports only `routes`.

    route.ts               the path helper every group and `lib/routes.ts` share
    <group>.ts             one group's routes, each with the screen code it opens in its comment
