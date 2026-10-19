# (inspector)

The inspector's two surfaces, from the VER family's canvas (SCR-VER-*):

    field/        the field client on the inspector's phone: R1 PublicShell, variant field
    inspection/   the inspection console on the authority's desk: R1 ConsoleShell, at 1280 px

An inspector of a culture inspection authority verifies a premises' record, opens an inspection from that
verification, records what was found, concludes it and issues the record, and on the desk requests the lists
of premises to visit. Every page asks `requireInspector()` first: signed out, the reader is sent to RightOne
ID's sign-in (`/id/sign-in`, account `ngocdiep.au@kiemtra.example`).

Flow (field): home `field/` -> scan and verify `field/scan/` -> the answer `field/answers/[answer]/` -> start
`field/inspections/new/` -> in progress `field/inspections/[inspection]/` -> conclude
`.../[inspection]/conclude/` -> the record `field/records/[record]/`. Console: lists `inspection/lists/` ->
one supply `inspection/lists/[list]/`; the authority's inspections and records `inspection/records/` -> a
correction `inspection/records/[record]/correct/`. A person moves only through the screens' own controls.

The inspector acts under appointments the operations console records and decides (SCR-VER-09 to 12): a suspended
appointment refuses the acts made under it (APPOINTMENT_SUSPENDED) in the field client and on the console until an
approver reinstates it, and an ended one leaves the inspector's open inspections to the authority to close.

Every page reads through `lib/api/inspection.ts`. With `RIGHTONE_DATA=mock` a page reads the signed-in
session's own state from the mock backend (`lib/mock/backend/inspection.ts`): every act is a server action in
`features/inspection/actions.ts` that calls the backend's command, and the next screen shows what it did (the
new VRA-, ISP-, IRC- or ILS- reference, the new state, the row added). A refused act comes back to the screen
it was made on with the values typed and the refusal where the board draws it (`lib/api/flash.ts`). Every
sign-in starts from the seed, which is the canvas's own data (`lib/mock/inspection.ts`, the section "the
canvas's world").

`?view=<state>` shows any state a board drew, with the board's data, for design review; acts made from a review
state still act on the session's data. Words come from `messages/screens/ver.{vi,en}.json`; refusal sentences
are the family's refusal catalogue (design/04), verbatim.

The field client is phone-first: its column keeps the phone's width at every window size
(`features/inspection/FieldFrame.tsx`). Its connectivity and verification key strip shows the phone's own
state, which the backend keeps per session since the web stand-in has no store on a device: online, and keys
refreshed at sign-in (the field client refreshes them on every connection, srs/10) for CFG-778's 7 days.
