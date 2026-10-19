# premises

    page.tsx                             SCR-PTY-06  the premises register of an area, its coverage, Admit premises beside it
    coverage/route.ts                    RPT-PTY-01  the coverage report of the area in view, as a CSV file
    [premises]/page.tsx                  SCR-PTY-07  one premises, with Record party beside it
    [premises]/provenance/page.tsx       SCR-PTY-08  where each field came from, and the data owner's override
    [premises]/change/page.tsx           SCR-PTY-09  record an operator change, a closure or a cessation
    [premises]/history/page.tsx          SCR-PTY-10  everything recorded against the premises, with the party then

The premises register of the party family (PTY), the third tab of the "Chủ thể và cơ sở" workspace. Every page asks
for its roles first (`requireStaff`) and reads through `lib/api/premises.ts`; the mock backend
(`lib/mock/backend/premises.ts`) checks every act again and shares the party register's relationships, so a change
recorded here is the one the party detail, the authorities and the status records read. `?view=loading`, `error`,
`not-found`, `route-unknown`, `no-provenance` and `no-population` draw the states the world never reaches, for review.
