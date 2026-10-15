# evidence

    page.tsx    SCR-REG-04  evidence and claims: the documents the rules ask for, and claims that lower the fee

Views: populated, uploading, claim-form, all-received, after-submission, empty, document-invalid,
duplicate-claim, period-invalid, rulebook-not-approved, loading, error. Without `?view=` the page reads the
session's draft.

- Add a document opens the browser's file chooser; the file's name, type and size are recorded against the
  item (server action `addDocument`), and the row shows it received today. No file is kept: there is no
  document store yet. An empty file, or one with no type, is refused DOCUMENT_INVALID beside its row.
- Stop the upload, drawn in the uploading view, has nothing behind it: there is no upload in flight to stop.
- Add a claim opens the claim form in place; Add the claim records the claim (server action `addClaim`) with
  the document a claim asks for, or comes back open with the refusal under its field (ASSERTION_DUPLICATE,
  ASSERTION_PERIOD_INVALID, RIGHTS_LAYER_UNKNOWN). A claim cannot be removed, as the board says above the
  control.
- Still needed lists every item, the unanswered questions included (FR-REG-006); with one item it says "Still
  needed: 1 item" (new copy, the board's sentence for one).
- A claim's title for a direct licence is not drawn; it uses the board's title pattern with the board's own
  words for a direct licence.
