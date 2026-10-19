# enrol

    page.tsx    SCR-VEN-01  enrol a premises

The premises the principal acts for, with the ward where PTY gives one; Enrol this premises is unavailable until
one is chosen. Enrolled, SCR-VEN-02 opens for the new service; refused, the answer takes the result panel, the
premises still chosen. Views: empty, loading, error.

- DR-250 is played on the boards' answers: Bùi Viện (a karaoke) is outside the direct licence and carries the scope
  and the core licence route, Đa Kao is not operated by the company now, Sala's register holds no class (the board's
  own PREMISES_CLASS_UNRESOLVED, which the refusal catalogue does not list), a premises with a service not ended is
  ALREADY_ENROLLED, and Lê Thánh Tôn, with none, enrols.
- The board's "what P1 answers" frame (SCOPE_UNAVAILABLE for every enrolment on pilot data, CR-VEN-01's tested
  default) is not what the mock answers: it plays the reads as available, so the journey can be walked.
