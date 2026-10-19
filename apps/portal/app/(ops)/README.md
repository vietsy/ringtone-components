# (ops)

The operations console: queues, cases, catalogue, licensing, finance, reporting, fleet health.

Thirty-two screens, mostly tables, used for six hours a day by people whose complaints are cheap to
ignore. Density and keyboard operation are requirements here. So are the table rules: sorting and
filtering server-side, cursor pagination rather than an offset over a growing table, a keyboard
path to every row action, and virtualisation beyond a hundred rows.

Segregation of duties applies: an officer cannot approve their own action, and the console must not
imply otherwise by rendering a button the server will refuse.

`/ops` is the landing, "Việc của tôi": the workspaces of every console the member's roles open
(`components/shells/ops-nav.ts`). Every page here calls `requireStaff(...)` first and draws itself in
`components/shells/OpsFrame.tsx`, with the console its board names (Vận hành, Chính sách, Giám sát). Each workspace's
pages live under `ops/<workspace>/`, each with its own README.
