# [claim]

    page.tsx   SCR-CAT-07  Claim detail and shares

Review views: populated (the board's default outcome, rule-absent), complete, short, over,
beneficiary-partial, not-stated, absent, whole, loading, error, refused. The board's second tweak (completeness
outcome) is folded into the one `?view=`. Live: the shares effective on the As at date (today unless the reader
picks another; a cleared date is refused AS_OF_REQUIRED) and DR-30's answer for each kind at that date, computed
by the mock backend from the claim's dated shares. No completeness rule version is in force in the canvas's
world, so the live claim reads Rule not configured on any date, as the board draws it.

Left out: Correct the record (SCR-CAT-14) and Withdraw the claim (SCR-CAT-23), gateway screens with no portal
route (G-12); the links from the work and from Võ Duy Khê to their catalogue records (SCR-CAT-09, SCR-CAT-11);
the board's catalogue-officer reader and its confirm view, which draw the operations console's validation
(SCR-CAT-19), not this portal.
