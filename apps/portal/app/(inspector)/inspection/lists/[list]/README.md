# [list]

    page.tsx   SCR-VER-08  List supply and entries

Live, the page reads the supply the reference names, or SUPPLY_NOT_FOUND: its statement, header, register line,
counts and entries while it is ready; SUPPLY_NOT_READY while it is being generated, ENTRIES_DISPOSED after
retention, and its cause in place of the entries when it failed. A supply requested in the session is generated at
once from the canvas's register: the entries SCR-VER-08 draws of that kind in the wards asked for, never another
premises, read from the register as the canvas's ready supply read it (version RR-2026-09-30-02). The age of a
supply and of the register's reconciliation are said from now. The area and class filters choose among the page's
entries; the entry in focus (moved to with J, K or a click, or Enter) is selected, and Copy the premises reference
copies it (`features/inspection/EntryList.tsx`). Back opens SCR-VER-07.

Review views: ready, entry-selected, kind-not-current, empty-limited, failed-register, failed-record,
failed-scope, failed-decision, failed-timeout, not-ready, disposed, no-appointment, cursor-invalid, not-found,
not-authorised, loading, error.

What the mock cannot do: the canvas counts the premises that are current, out of scope, indeterminate and not
operating for the whole of KTVH-KV1 and, for the first kind, for Phường Tân Định alone; for any other set of wards
those counts are not drawn, so the page shows the counts it has (listed, and per ward) and leaves the others out.
The canvas draws no register entries outside KTVH-KV1, so a supply for KTVH-KV3 is ready with no entry. The seeded
supply ILS-5RN8KT3WQD stays being generated, as the canvas drew it.

Deviations: in cursor-invalid the refusal stands in place of the entries table. While loading, the page draws the
header's skeleton and the entries' skeleton. The area filter offers the supply's own areas. The board's governed
empty passes level 3, which R1's Table empty does not take. Alt+C is bound once the page has hydrated, and J and K
are listed only while the table is on the page.
