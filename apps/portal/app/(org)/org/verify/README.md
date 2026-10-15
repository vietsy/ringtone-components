# verify

    page.tsx             SCR-PTY-17  verify an authorisation scope (FR-PTY-046, FR-PTY-047), P1
    overlaps/page.tsx    SCR-PTY-18  the verification overlap report, refused to a collecting organisation

The organisation asks whether an authority to collect for a premises was in effect at a moment. Ask sends
POST /authority-verifications through `features/authorisation/actions.ts`; the mock backend
(`lib/mock/backend/authorisation.ts`) works the answer out from its seed for that premises and moment, records
the read with its time, and the page shows the answer, the refusal beside its field, or no answer when the
register did not reply. New enquiry opens the empty question again.

Who may ask: an organisation with an effective participation in CAT (PTY `frd/09`, UC-PTY-05). The page reads
it through `loadParticipationStanding`; without one, the question is replaced by the refusal
(NOT_A_REGISTERED_COLLECTING_ORGANISATION) and the register's premises are not loaded, so nothing about any
premises reaches the page. Lam Hồng (PTC-2026-0107) asks; Hạc Bạch and Dây Đàn are refused.

Seed, from the board's three answers and nothing more (`lib/mock/authorisation.ts`): Then Cửa Lounge &
Karaoke – Bùi Viện is held by an organisation the canvas never names, with no period drawn, so every moment
answers "another"; The Lintel Coffee – Nguyễn Trãi is Lam Hồng's from 1 Sep 2026 to 31 Aug 2027, so a moment
inside answers "yours" with that period and one outside answers "none"; The Lintel Coffee – Lý Tự Trọng is
held by nobody. A moment later than now is INSTANT_IN_FUTURE; a reference the register does not hold is
PREMISES_NOT_FOUND.

SCR-PTY-17 review views: another, yours, none, form, checking, unavailable, not-registered, future,
not-found, error. Without `?view=`, the empty question (or the last enquiry's result).

Deliberate deviations from the boards:
- The shell is always the signed-in organisation's (its name, its participation line, the nav for its
  standing); the board draws Lam Hồng, and Dây Đàn on not-registered. Review not-registered signed in as
  Dây Đàn to see it as drawn. The account is the signed-in one; the boards' "Mạc Thanh Vân" is not used.
- Checking: drawn with R1's VerificationResult in its checking state rather than the board's loose icon and
  extra-large paragraph, which would need an ink and a type size of the page's own. Live, it is the form's own
  sending: the answer area turns to it, and Ask works, while the register is asked.
- Ask is unavailable with "Choose a premises and a moment first." until both are given, read as the person fills
  the fields (`features/authorisation/AskForm.tsx`); the board draws that only in its form view.
- error: as drawn (no Ask, only Close), but its Try again sends the question again rather than reloading the
  page, which would only show the failure the last attempt kept.
- Close goes to the portal's landing (`routes.org()`): the spec says it leaves the verification surface, and
  the board gives it no destination.
- unavailable (CAT's participation could not be read, the board's P1 variant) is reachable only by `?view=`:
  the mock's standing always answers. The seam fails closed to it if the standing read ever throws.
- No refusal code is written on this page: PTY 03 and PTY 04 keep codes, state names and rule identifiers off
  the account-free surface (convention 5), and the board draws none.

SCR-PTY-18 (overlaps/): the board's organisation reader. The read is refused with OVERLAP_REPORT_RESERVED
(recorded with its code), and Verify an authorisation leads back to SCR-PTY-17. The board draws this reader
the same in all five of its views (populated, empty, not-found, loading, error), so every `?view=` shows the
refusal. The data owner's and assurance's readers are on consoles this portal does not have, and nothing on
SCR-PTY-17 links here (the spec keeps that edge absent).
