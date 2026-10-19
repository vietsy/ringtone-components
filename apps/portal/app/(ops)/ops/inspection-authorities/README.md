# inspection-authorities

    page.tsx             SCR-VER-09  Inspection authorities
    decisions/page.tsx   SCR-VER-10  Decide a designation

The operations console's inspection workspace (`components/shells/ops-nav.ts`, "inspection"). The operations
officer (ACT-OPS) reads the designations, in force first, records a new one for a second person to approve, ends
one in force from a date or withdraws one still waiting, each confirmed in a dialog. An approver without ACT-OPS is
sent to the designations waiting for a decision, the approver's own screen. A row opens what is done with it next:
the appointments under it while it is in force (SCR-VER-11), its decision while it waits (SCR-VER-10).
Everything reads and acts on `lib/mock/backend/inspection.ts`; a refusal comes back where the board draws it.
