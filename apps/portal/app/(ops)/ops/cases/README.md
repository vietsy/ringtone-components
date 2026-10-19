# cases

    page.tsx                                SCR-CAS-03  case queue, the case workspace's landing
    new/page.tsx                            SCR-CAS-01  raise a case, recorded by the support-line agent for a caller
    [reference]/                            SCR-CAS-04  case detail and triage, and the screens a case moves on to
    approvals/                              the approvals surface's queue, and SCR-CAS-09 under it
    intake-matrix/page.tsx                  SCR-CAS-16  case-intake matrix
    policy/page.tsx                         SCR-CAS-18  case policy register

The CAS family on the operations console, for the case officers (ACT-CAS), the dispute authority (ACT-DSP), the
business approver (ACT-BIZ-APR), the support-line agent (ACT-SUP), and the security owner and data protection
officer (ACT-SEC, ACT-DPO) who keep the protected categories' policies; each page calls `requireStaff(...)` with the
roles its screen names, and the backend checks every act again, segregation of duties included. Every read and act
goes through `lib/api/cases.ts` to `lib/mock/backend/cases.ts`, the same table the premises' SCR-CAS-01, 02 and 08
work on.

No canvas board and no Figma frame draws a CAS screen: the pages are built from `design/03-screen-specifications.md`
and `design/02-wireframes.md` of the CAS family with the console pattern of the other workspaces. Review views on
every page: `?view=loading`, `?view=error`; the queue also `page-lost` and `no-scope`.
