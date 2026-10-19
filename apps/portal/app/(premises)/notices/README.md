# notices

    page.tsx                  the nav's Notices: SCR-COM-10 for an account holder, every notice sent to the party
    [reference]/page.tsx      SCR-COM-10  my notice, by its reference
    preferences/page.tsx      SCR-COM-12  notice preferences

The COM family's public notice surface. A notice is read by its reference with no account (BR-COM-02), so the
notice and the preferences pages ask `currentPrincipal()` only to choose the shell and whose preferences they are;
the list asks `requirePrincipal()`. Reads and acts go through `lib/api/notices.ts` to the mock backend
(`lib/mock/backend/notices.ts`), which the notice console works on too. The notices come from the other
families' events: each current decision's amount to pay (seeded, issued when the decision was) and the
acknowledgement of every case raised (SCR-CAS-01), the revocation of a track a premises plays (SCR-COM-13). Each
notice says, in the recipient's words, what happened on its way: delivered, not reached, served another way.
Signed in, the party register decides what the person may read (PTY, DR-201): the principal every notice to the party
and its preferences; a delegate only the notices about a premises her delegation names, and no preferences, which the
party holds as a whole (ROLE_OUT_OF_SCOPE).

No canvas board and no Figma frame draws a COM screen; the pages are built from the COM family's
`design/03-screen-specifications.md` and `design/02-wireframes.md` with the premises portal's pattern. Review
views on each page: loading, error.
