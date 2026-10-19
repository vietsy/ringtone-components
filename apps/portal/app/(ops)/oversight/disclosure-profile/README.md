# disclosure-profile

    page.tsx   SCR-PUB-20  the fields a public answer of each record type may carry, now or on a past day

Read by the DPO (ACT-DPO) and the security officer (ACT-SEC); anyone else on staff is refused NOT_AUTHORISED. The
profile is the version of `PUB-DISCLOSURE-PROFILE` GOV approved that is in effect at the instant read (the world's
register in `lib/mock/backend/public.ts`, `ALG-458`), the same one SCR-PUB-05 and 06 apply: each field with the version
or decision that admits it, and each entry withheld with its finding (a protected field with no decision,
DECISION_REF_MISSING; personal data beyond the minimum, NOT_ATTRIBUTED while DAT offers no purpose attribution). A world
starts with no version approved, the tested default, so the minimum profile applies; no screen of the portal approves
one, since GOV's rule register is not played by the mock. A day not yet come is INSTANT_INVALID at the field. `?view=policy-read-unavailable`, `loading` and `error`
draw those states for review.
