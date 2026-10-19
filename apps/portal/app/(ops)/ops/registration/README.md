# registration

    page.tsx                                            SCR-REG-09  review queue, the Registrations workspace's landing
    applications/[application]/page.tsx                 SCR-REG-10  application case file, the hub of the console
    applications/[application]/evidence-request/        SCR-REG-11  request evidence
    applications/[application]/claims/[claim]/          SCR-REG-12  claim review
    applications/[application]/proposal/                SCR-REG-13  decision proposal
    approvals/page.tsx                                  SCR-REG-14  approve or return a proposal
    applications/[application]/withdrawal/              SCR-REG-15  record a withdrawal on instruction

The registration family on the operations console, in the Registrations workspace of the rail. Every page asks
for its roles first (`requireStaff`) and reads the world's registration state through `lib/api/registration-review.ts`;
the mock backend (`lib/mock/backend/registration.ts`) checks each act again against the roles, the record's state
and the segregation of duties, so an application the premises sends is in the queue, and a decision approved here
is on the premises' list and FIN's to collect. `?view=loading` and `?view=error` (and `cursor-invalid`,
`not-found` where the board draws them) show the states the data never reaches, for review.

Officers (ACT-OPS) land on the queue; the business approver (ACT-BIZ-APR) on the approvals; a reporting or data
reader on the reporting surface (`app/(ops)/ops/reports/registration`).

- The board's "Hàng chờ 14" count in the bar is the shell's, which `OpsFrame` does not pass; it is left out.
- Dates are the world's: today is the server's day, so rows the board draws in time can be past their expected
  date here, tinted as the specification says.
