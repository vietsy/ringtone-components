# cases

    page.tsx                 the nav's Cases: SCR-CAS-02 for an account holder, the cases their party raised
    new/page.tsx             SCR-CAS-01  raise a case, on the account route or the one that needs no account
    [reference]/page.tsx     SCR-CAS-02  my case, by its reference, where a request addressed to the reader is answered
    [reference]/appeal/      SCR-CAS-08  lodge an appeal against the decision on it

The CAS family's public intake, on the premises portal for a signed-in principal and on the public surface for
anyone else. Three of the four pages need no account and nothing on them offers to create one (BR-CAS-01): they
ask `currentPrincipal()` only to choose the shell and the route, and the reference is the credential on
SCR-CAS-02 and 08. The list asks `requirePrincipal()`. Every read and act goes through `lib/api/cases.ts` to the
mock backend (`lib/mock/backend/cases.ts`), whose table the case console (`app/(ops)/ops/cases`) works on too: a
case raised here waits RECEIVED until an officer acts on it, and every step the console takes is read here next.
Signed in, the party register decides who acts on the party's cases (PTY, DR-201): the principal on every one; a
delegate only on a case about a premises her delegation names - a decision, an inspection record or answer, a device
of it - and on no other, which she is refused ROLE_OUT_OF_SCOPE.

No canvas board and no Figma frame draws a CAS screen; the pages are built from `design/03-screen-specifications.md`
and `design/02-wireframes.md` of the CAS family with the premises portal's pattern. Each directory's README lists
its review views and every deviation.
