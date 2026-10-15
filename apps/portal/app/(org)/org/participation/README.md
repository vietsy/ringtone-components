# participation

    page.tsx          SCR-CAT-02  my participation and represented scope (FR-CAT-002, 003), where Participation lands
    apply/page.tsx    SCR-CAT-01  participation application (FR-CAT-001)
    amend/page.tsx    SCR-CAT-03  scope amendment (FR-CAT-023)

The organisation's participation in the catalogue (SM-21), read and changed through `lib/api/participation.ts`.
With mock data the backend (`lib/mock/backend/participation.ts`) holds each organisation's draft, participation,
pending amendments, notified decisions and objections per session, seeded from the canvas: Lam Hồng participates
under PTC-2026-0107 with AMD-2026-0044 pending; Dây Đàn has its draft of 30 September; Hạc Bạch has nothing the
catalogue holds. The approvals side (SCR-CAT-20, the amendment's approval, SCR-CAT-21, 22, 26) is not built, so
an application stays APPLIED and an amendment stays pending; nothing is approved here. Every sign-in starts again
from the seed. `?view=` (and SCR-CAT-02's `?state=`, `?reader=`) draws a state the canvas drew, for review.

SCR-CAT-02 views: populated, refused, loading, error; states: active, approved, suspended, withdrawn; readers:
organisation, legal. Each review state is drawn for the organisation the board draws in it (Lam Hồng, Đĩa Than Mộc,
Bến Sậy, Sông Cầu). Without them the page reads the signed-in organisation's participation: an organisation with
none goes to SCR-CAT-01 (CAT 03, "where the organisation has no participation"); APPLIED draws, like the board's
approved state, the header and a governed empty state. `?as_of=` is the date the scope is read for, today until
one is chosen (convention 3); cleared, AS_OF_REQUIRED under the date and nothing resolved.

- The gap sentence is computed from the rows in force on the date (a right represented in some territory of the
  scope and not in another), with the earliest pending amendment that adds the combination. The suspended board
  draws no gap although its rows leave mechanical rights in Hồ Chí Minh City out; review draws it as the board does.
- Download evidence is left out: the mock keeps no file (an application records a document's name, kind and size).
- A pending amendment's line in Changes and answers has no link: the board opens SCR-CAT-03 for that amendment,
  and `routes.orgAmendScope()` takes no reference to open it by (asked of the lead).
- Answer a decision opens SCR-CAT-25 for the notified decision, and is drawn unavailable with the board's reason
  when none is notified, which is every organisation's case in the seed.
- The legal reader's Stop controls (Suspend or reinstate, Withdraw) are left out: SCR-CAT-21 and 22 have no route.
- APPLIED is not a state the board draws. Its badge reads "Chờ duyệt / Awaiting approval" (the board's word for
  awaiting approval on SCR-CAT-03), and three sentences are new: the header line (application submitted at, on),
  the governed empty state, and Propose a scope amendment's reason ("once the participation is active").
- The withdrawn table's sentence names three closed rows, as drawn; when SCR-CAT-22 is built it takes the count.
