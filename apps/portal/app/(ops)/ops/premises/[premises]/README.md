# [premises]

    page.tsx                 SCR-PTY-07  one premises, by its register record (PRM- and eight characters)
    provenance/page.tsx      SCR-PTY-08  where each field came from; the data owner overrides one
    change/page.tsx          SCR-PTY-09  record a premises change
    history/page.tsx         SCR-PTY-10  its history, each row with the party then
    history/export/route.ts  SCR-PTY-10  the history as a CSV file

`?panel=party` opens Record party beside the page. A premises principal who opens this address, or the history's,
is answered on the premises portal: NOT_YOUR_PREMISES for a premises their party does not operate, their own list
for one it does (`features/parties/NotYourPremises.tsx`).
