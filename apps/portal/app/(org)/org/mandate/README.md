# mandate

    page.tsx   SCR-GOV-14  Our mandate, the portal's landing (`routes.org()` redirects here)

The page reads the session's organisation from the mock backend (`lib/mock/backend/governance.ts`). What it
draws follows the organisation's mandate:

- no mandate: the draft form (the board's empty-draft), opened with the draft saved on this device or with one
  empty row; Save draft keeps it, Submit for approval asks for confirmation with the rows and sends it;
- `SUBMITTED`: read-only under "Submitted on {date}" (the board's submitted view). It stays so: the copyright
  authority's review (SCR-GOV-02) is not built, and SM-19 forbids a submitted mandate becoming effective without it;
- `SUBMITTED` with a review that found the evidence short: the reason, in place of the submitted banner;
- `SUSPENDED`: the danger banner with the date;
- `APPROVED`, `EFFECTIVE`: read-only, no banner (the board draws none).

Seed: Hạc Bạch submitted on 18 September 2026; Dây Đàn has none (the draft form); Lam Hồng's is `EFFECTIVE`,
derived from its active participation (`BR-GOV-02`, `FR-CAT-002`, `FR-GOV-004`) with the scope SCR-CAT-02 draws,
and what nothing draws (authority, document, period) reads as not recorded.

Review views (`?view=`): submitted, empty-draft, confirm, insufficient, suspended, loading, error. They are the
canvas's data, Hạc Bạch's (Trường Xuân's for suspended), and their form sends nothing.

Refusals: `FIELD_MISSING` naming the first absent field and `PERIOD_INVALID` are drawn under the field they name
(the board draws none; SCR-CAT-01 draws field errors this way); `RANGE_OVERLAP` names no field and is a banner
with its code above the form. No evidence: Submit for approval is drawn unavailable with the board's reason.

Deviations from the board:
- The insufficient view's "Add the missing evidence" action is left out: it opens the draft of a submitted
  mandate, and the API has no command to amend one (only `POST /mandates`, which a second time overlaps).
- The draft's rows start with nothing chosen (placeholders "Choose a right type", "Choose a province"); the
  board's rows show its sample values.
- A period with an end date reads "From {from} to {to}", which the board never draws.
- The right-type select offers the two types the GOV boards draw (performers', producers'); Lam Hồng's rows
  carry SCR-CAT-02's words (performing, mechanical).
