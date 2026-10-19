# parties

    page.tsx                         SCR-PTY-01  party search and list, the Parties and premises workspace's landing
    [party]/page.tsx                 SCR-PTY-02  party detail, with Add person and Record principal beside it
    [party]/identification/page.tsx  SCR-PTY-03  identification, by the source or a manual declaration

The party family (PTY) on the operations console, in the "Chủ thể và cơ sở" workspace. Every page asks for its
roles first (`requireStaff`: the operations officer acts, assurance reads) and reads the world's party register
through `lib/api/parties.ts`; the mock backend (`lib/mock/backend/parties.ts`) checks every act again. A party is
identified only here: SEC-203 forbids a party identifying itself, so no portal screen declares one. Granting an
authority is the principal's act on the premises portal, so the console lists a party's authorities and grants
none. `?view=loading`, `error`, `cursor-invalid` and `not-found` draw the states the data never reaches, for review.
