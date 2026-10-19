# geography

    page.tsx   where the artist's works were used, as GET /reporting/artist-geography answers it (FR-DAT-012, 037,
               038): `?area=&period=&level=` asks one province at a level of detail over a period, `&identify=yes`
               asks which venue it was; the answers the artist was given are listed beneath

No board draws this view; it is built from DAT's specification and refusal wording. The figure is the plays of the
artist's works aggregated to the level the geography policy in force and the artist's disclosure basis permit, with the
basis stated. A scope of too few venues is suppressed and says so (GEOGRAPHY_BELOW_MINIMUM), never zero; one that would
disclose a single venue beside a figure already released is refused naming that figure's scope
(DIFFERENCING_WOULD_DISCLOSE); a level the policy does not approve is LEVEL_NOT_PERMITTED; which venue it was is never
told (PREMISES_IDENTITY_NOT_DISCLOSABLE), the request recorded and the view kept at the level permitted. Every answer is
written to the artist's release log before it is shown.
