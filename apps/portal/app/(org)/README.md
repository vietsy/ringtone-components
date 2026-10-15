# (org)

The organisation portal of a rights organisation (CMO): its administrator (`ACT-CMO-ADM`) signed in,
acting for their own organisation only. Every page asks `requireCmo()` first and every read is scoped to
that organisation. An organisation can never widen its own mandate here (`D-CMO-02`).

The screens are the twelve the CMO side of the specification holds, listed with their requirements,
boards and Figma frames in `rightone-platform/pm/RightOne_CMO_Danh-sach-man_v1.0.xlsx`:

    org/                        the landing: the organisation's mandate (Q-CMO-04)
    org/mandate, org/terms      SCR-GOV-14, SCR-GOV-15
    org/participation/**        SCR-CAT-01, 02, 03
    org/submissions/**          SCR-CAT-04, 05, 24
    org/claims/**               SCR-CAT-07
    org/objections/**           SCR-CAT-25
    org/verify/**               SCR-PTY-17, SCR-PTY-18 (refused to a CMO)

`SCR-FIN-17` (recipient accounts) is not built here: its board draws only the gateway's finance officer,
and the CMO finance officer's view is undesigned (Q-CMO-07).
