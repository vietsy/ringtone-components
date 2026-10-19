# notices

The notice workspace of the operations console (COM, the gateway's side), its rail entry "Thông báo".

    page.tsx                         SCR-COM-06  notice queue, a notice opened beside it (SCR-COM-07) with Reissue
    recovery/                        SCR-COM-08, 09  recovery queue and recording an alternative service
    unmet/                           SCR-COM-16  unmet obligations
    track-changes/                   SCR-COM-13  track change runs
    timeliness/                      SCR-COM-15  notice timeliness position
    policy/                          SCR-COM-01, 02, 03  policy versions, a version's classes, its approval
    templates/                       SCR-COM-04  notice templates

Every page asks `requireStaff` for the roles `features/notices/console.ts` gives its tab, and the backend
(`lib/mock/backend/notices.ts`) checks the roles again on every read and act. No board and no Figma frame draws a COM
screen: the pages are built from the family's `design/03-screen-specifications.md` and `design/02-wireframes.md` with
the console pattern of the finished pages. SCR-COM-05, 11 and 14 are not built, so no control leads to them.
