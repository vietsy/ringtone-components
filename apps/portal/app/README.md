# app

The router. One directory per route group, each with its own layout.

`layout.tsx` sets `lang` from the reader's locale (the `r1-locale` cookie), emits the design tokens as CSS
custom properties, so a hex value exists in exactly one place, loads the R1 component stylesheet, and in mock
mode says at the foot of every page that its data is sample data. `error.tsx` is the last-resort boundary and
states what failed, whether retrying is worthwhile, and the digest support can search for.

| Route group | Pages | Screens |
|---|---|---|
| `(public)` | `/`, `/scope`, `/indicative-amount`, `/verify`, `/verify/[reference]` | SCR-PUB-01 to 05 |
| | `/verify/player/[code]`, `/verify/licence/[reference]`, `/verify/proof/[reference]` | SCR-PUB-06, 07 |
| | `/a/[slug]`, `/t/[id]` | SCR-PUB-08, 09 |
| | `/legal`, `/legal/[slug]`, `/reports` | SCR-PUB-10, 11 |
| | `/help`, `/help/player` | SCR-PUB-12, 13 |
| | `/now/[premises]`, `/now/[premises]/actions` | SCR-PLR-06, 19 (now playing and the guest actions: the guest display, and a guest's phone) |
| | `/player-certification`, `/player-assurance-policy` | SCR-PLR-10, 11 (the device certification register, with Apply; the device-assurance policy) |
| `(id)` | `/id/sign-in`, `/id/register`, `/id/confirm-email`, `/id/choose-organisation`, `/id/sign-out`, `/id/reset` | SCR-RID-01, 07, 08, 04 (stand-ins for RightOne ID); signing out; resetting this browser's sample data |
| `(premises)` | `/registration/**`, `/decisions/[decision]` | SCR-REG-01 to 08 |
| | `/payments`, `/payments/[decision]`, `/payments/[decision]/pay` | SCR-FIN-03, 02, 01 |
| | `/status-records`, `/status-records/[record]`, `.../print` | SCR-CER-11, 12, 13 |
| | `/player`, `/player/enrol`, `/player/services/[service]`, `.../terms`, `.../document`, `.../playlists`, `.../playlists/[playlist]` (`new`), `.../schedule`, `.../fallbacks`, `.../overview`, `.../end` | SCR-VEN-03, 01, 04, 02, 05, 06, 07, 08, 09, 10, 11 |
| | `/player/documents/[document]` | SCR-VEN-05's download: the document as its printable file |
| | `/player/devices`, `/player/devices/[device]`, `/player/pairing` | the premises' devices; SCR-PLR-04, 05 (a device past its offline limit); SCR-IAM-06 |
| | `/cases`, `/cases/new`, `/cases/[reference]` | the principal's cases; SCR-CAS-01, 02 (both open without an account too) |
| | `/cases/[reference]/appeal` | SCR-CAS-08 (opens without an account too, by the case's reference) |
| | `/notices`, `/notices/[reference]`, `/notices/preferences` | the principal's notices; SCR-COM-10, 12 (both open by a notice's reference too) |
| | `/decisions/[decision]/fee`, `/registration/[application]/review/fee/[calculation]` | SCR-TAR-14 (how the fee on the decision, or the one a review showed, was calculated) |
| | `/inspection-records`, `/inspection-records/[record]`, `.../print`, `/reconsideration-requests/new` | SCR-VER-13, 14 (the premises' inspection records, a request to reconsider) |
| | `/authorities`, `/authorities/new`, `/authorities/[authority]`, `.../amend` | SCR-PTY-11, 12, 13, and 12 to amend (who may act for the party; the Premises section until its portfolio exists) |
| | `/engagement`, `/engagement/balance`, `/engagement/points`, `/engagement/events/[event]` | SCR-ENG-01, 02, 03, 04 (the participant's own engagement record) |
| `(inspector)` | `/field/**` | SCR-VER-17, 01 to 06 (the field client) |
| | `/inspection/lists`, `/inspection/lists/[list]` | SCR-VER-07, 08 (the console) |
| | `/inspection/records`, `/inspection/records/[record]/correct` | SCR-VER-18, 15 (the console) |
| `(org)` | `/org` (landing), `/org/mandate`, `/org/terms` | SCR-GOV-14, 15 |
| | `/org/participation`, `/org/participation/apply`, `/org/participation/amend`, `/org/objections/new` | SCR-CAT-02, 01, 03, 25 |
| | `/org/submissions/**`, `/org/claims/**` | SCR-CAT-04, 05, 24, 07 |
| | `/org/verify`, `/org/verify/overlaps` | SCR-PTY-17, 18 (refused to a CMO) |
| `(ops)` | `/ops` | the gateway staff's landing ("Việc của tôi"); each workspace adds its rows below |
| | `/ops/parties`, `/ops/parties/[party]`, `.../identification`, `/ops/identification-reviews`, `.../[review]` | SCR-PTY-01, 02, 03, 04, 05 (the Parties and premises workspace) |
| | `/ops/premises`, `/ops/premises/coverage`, `/ops/premises/[premises]`, `.../provenance`, `.../change`, `.../history` (and `.../export`) | SCR-PTY-06 and RPT-PTY-01's CSV, 07, 08, 09, 10 and its CSV (the Parties and premises workspace: the premises register; 08 on the register data console for the data owner) |
| | `/ops/reconciliation`, `/ops/reconciliation/exceptions` | SCR-PTY-14, 15 (the register data console) |
| | `/ops/entitlement-dispositions`, `.../[change]` | SCR-PTY-16's queue and one change (the business approvals console; the operations console reads it) |
| | `/ops/finance`, `/ops/finance/corrections`, `/ops/finance/write-offs/[amount]` | SCR-FIN-14, 10, 15 (the Finance workspace) |
| | `/ops/tariff`, `/ops/tariff/calculations/[calculation]`, `/ops/tariff/declared-classifications` | SCR-TAR-08, 09, 12 (the Tariff workspace) |
| | `/policy/mandate-scope-changes` | SCR-TAR-13 (the policy console) |
| | `/policy`, `/policy/documents/[document]/new`, `/policy/versions/[version]`, `.../review`, `/policy/currency` | SCR-PUB-14, 15, 16, 17 (the policy console: public documents, their versions and publication currency) |
| | `/ops/help-routes` | SCR-PUB-18 (the Help routes workspace of the operations console) |
| | `/ops/inspection-authorities`, `.../decisions`, `/ops/inspection-appointments`, `.../decisions` | SCR-VER-09, 10, 11, 12 (the Inspection workspace) |
| | `/oversight/inspections`, `/oversight/inspections/export` | SCR-VER-16 and its CSV (the oversight console) |
| | `/ops/status-records`, `.../[record]`, `.../[record]/approve`, `.../[record]/propose`, `.../[record]/history`, `.../[record]/print` | SCR-CER-01, 02, 03, 05, 09, and the printout an officer makes (the Status records workspace) |
| | `/ops/status-records/reviews`, `.../reviews/[review]`, `/ops/status-records/follow-ups`, `.../follow-ups/[followUp]` | SCR-CER-04, 06, 07, 08 (the Status records workspace) |
| | `/security/signing-keys` | SCR-CER-10 (the security console) |
| | `/security/authorities`, `/security/authorities/[authority]` | SCR-PTY-11, 13 read only (the security console: authority to act) |
| | `/oversight/verification-counts`, `/oversight/disclosure-profile` | SCR-PUB-19, 20 (the oversight console: public verification and disclosure profile) |
| | `/ops/data/provenance`, `/ops/privacy/geography-policy` | SCR-DAT-04, 16 (the Data governance and Privacy operations workspaces) |
| | `/security/availability`, `/security/locations` | SCR-SVC-13, 14 (the security console: service continuity) |
| | `/ops/registration`, `/ops/registration/applications/[application]`, `.../evidence-request`, `.../claims/[claim]`, `.../proposal`, `.../withdrawal`, `/ops/registration/approvals` | SCR-REG-09, 10, 11, 12, 13, 15, 14 (the Registrations workspace) |
| | `/ops/reports/registration`, `.../policy`, `.../use-starts` | SCR-REG-16, 17, 18 (the Reports workspace: reporting and policy) |
| | `/ops/notices`, `/ops/notices/recovery`, `.../recovery/[notice]`, `/ops/notices/unmet`, `/ops/notices/track-changes`, `.../track-changes/[run]`, `/ops/notices/timeliness` | SCR-COM-06 (with SCR-COM-07's content beside it), 08, 09, 16, 13, 15 (the Notices workspace) |
| | `/ops/notices/policy`, `.../policy/[version]`, `.../policy/[version]/approve`, `/ops/notices/templates` | SCR-COM-01, 02, 03, 04 (the Notices workspace: notice policy and approvals) |
| | `/ops/cases`, `/ops/cases/[reference]`, `.../evidence`, `.../decision`, `.../remedy`, `.../reopening` | SCR-CAS-03, 04, 06, 07, 10, 15 (the Cases workspace) |
| | `/ops/cases/approvals`, `.../approvals/appeals/[appeal]`, `/ops/cases/intake-matrix`, `/ops/cases/policy` | the dispute authority's queue, SCR-CAS-09, 16, 18 (the Cases workspace: approvals and policy) |
| | `/ops/services`, `/ops/services/[service]`, `.../enforcement`, `.../reinstatement`, `.../scope-exit` | SCR-VEN-12, 13, 14, 15, 16 (the Player services workspace) |
| | `/ops/shared-moods`, `/ops/shared-moods/[version]` | SCR-VEN-17, 18 (the Shared moods workspace) |
| | `/ops/devices`, `/ops/devices/[device]`, `/ops/devices/enrol` | SCR-PLR-01, 02, 03 (the Player devices workspace) |
| | `/ops/device-register`, `/ops/device-register/[credential]` | SCR-IAM-07, 08 (the Device register workspace) |
| | `/evidence/acceptance`, `/evidence/playback-decisions` (and `.../export`), `/evidence/offline-continuity`, `/evidence/certification` | SCR-PLR-07, 15 and its CSV, 13, 10 (the evidence console) |
| | `/ops/engagement`, `.../release`, `.../qualifying-actions`, `.../support`, `.../events/[event]`, `.../corrections/new`, `.../corrections/[correction]`, `.../metrics` | the workspace's home, SCR-ENG-12, 08, 10, 04 (under a support read), 09, 11 (the Engagement workspace) |
| | `/policy/engagement`, `/policy/engagement/versions/[version]`, `/policy/engagement/disclosure` | SCR-ENG-06, 07, 13 (the policy console: engagement rules) |
| `(artist)` | one page | reserved |
| `(dev)` | `/design-system` | every R1 component (mock mode only) |

Every path is built in `lib/routes.ts` or one of its groups in `lib/route-groups/`; a page links only through
`routes`. Every page of `(premises)`, `(inspector)`, `(org)` and `(ops)` asks `lib/api/session.ts` first and sends a
reader without the right session to sign in.
