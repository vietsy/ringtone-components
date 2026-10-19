# signing-keys

    page.tsx   SCR-CER-10  register, retire and revoke the keys that sign status record printouts

Read in the browser's world: CK-2026-01 signs now, CK-2027-01 takes over in September 2027. The security
administrator (ACT-SEC, Lê Văn Cường) registers a key and retires or revokes one, each confirmed in a dialog; the
auditor reads with no form and no row action. Retire on the only key that signs is offered and refused
LAST_SIGNING_KEY in place of the row's actions (finding F-5). `?view=empty`, `signing-unavailable`, `loading` and
`error` draw those states for review.
