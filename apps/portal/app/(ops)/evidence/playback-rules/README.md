# playback-rules

The loudness and transition rule set SCR-PLR-15 names beside each day's playback decisions (FR-PLR-022, FR-PLR-045),
on the evidence console, for the evidence operator (ACT-EVD). Every version with its rules and effective period; Draft
saves the next in DRAFT, refused NO_EFFECTIVE_PERIOD without a start day; Approve, on each draft, with an optional
note the audit record keeps, refused EFFECTIVE_PERIOD_OVERLAPS naming the approved version in the way, and closes the
period of the version before it. SCR-PLR-15 then names, for each day, the version in force on that day.

- The specification gives POST /playback-rule-set-versions and its approval no screen; this page opens from
  SCR-PLR-15's rules panel ("Các phiên bản") and stays under that rail entry.
- One set applies to every premises (BR-PLR-18): the form takes no premises, and the API refuses one
  (RULES_NOT_PREMISES_SCOPED).
- Version 2's board gives its number and date only, so its rules read "Bảng thiết kế không ghi toàn văn".
