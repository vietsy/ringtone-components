# apply

    page.tsx    SCR-CAT-01  participation application: identity, authority evidence, contacts, requested scope

Views: populated, missing, loading, error, refused (ROLE_OUT_OF_SCOPE). Without `?view=` the page reads the
organisation's draft: Dây Đàn's as saved at 10:12 on 30 September (the board's missing state: no territory, no
authority register reference); Hạc Bạch's form empty but for its legal name, its party record and kind not
recorded (R1's dash); an organisation with a participation, unless withdrawn, is sent to SCR-CAT-02.

- Save draft keeps everything as entered and the page states the new time saved. Submit application sends
  POST /participations: accepted, SCR-CAT-02 shows the participation APPLIED; refused, the form comes back with
  every value as typed and FIELD_MISSING ("{field} is required.") under each field named, or RANGE_OVERLAP /
  PERIOD_INVALID under the period.
- Submit application waits for every mandatory field, saying why beside it: the board's sentence while the
  territory or the reference is empty, then the family's FIELD_MISSING sentence for the first other empty field.
  A field the saved draft or a refusal left empty carries its sentence until it is filled.
- Contacts are rows the person adds and removes (the last one stays). A new row's role reads "Choose a role"
  (new copy) rather than showing the first role as if chosen.
- A document is listed by name, kind and size and recorded with the draft, by whom and when; the file is not
  kept. With no document listed, R1's file upload is drawn under the list so one can be added (the board draws
  the list with Dây Đàn's document only).
- The shell's account is the signed-in administrator; the board's "Mạc Thị Lan Chi" is Dây Đàn's own.
