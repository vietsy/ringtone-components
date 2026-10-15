# claims

    page.tsx           the nav's Claims: opens SCR-CAT-07 on one claim (G-11)
    [claim]/page.tsx   SCR-CAT-07  Claim detail and shares

The claims recorded for the organisation, read from the session's live state in the mock backend
(`lib/mock/backend/submissions.ts`), seeded with the claim the board draws for Lam Hồng, CLM-2026-017734.
SCR-CAT-07 is entered from "the claim list", which no inventory holds (G-11, Q-CMO-10), so the nav's Claims
opens the organisation's latest recorded claim, or the board's words for none ("Claims can be recorded once
your participation is active.", from SCR-CAT-01's nav; "No claim is recorded for your organisation yet." for an
active participation, new copy). An unknown claim is the contract's 404; another organisation's is refused
ROLE_OUT_OF_SCOPE, as the board draws it.
