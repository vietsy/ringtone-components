# player

    page.tsx                                         SCR-VEN-03  my premises services, where the Player item opens
    enrol/page.tsx                                   SCR-VEN-01  enrol a premises
    services/[service]/page.tsx                      SCR-VEN-04  service detail and history, the hub of a service
    services/[service]/terms/page.tsx                SCR-VEN-02  accept the service terms
    services/[service]/document/page.tsx             SCR-VEN-05  verification document
    services/[service]/playlists/page.tsx            SCR-VEN-06  playlists and the default playlist
    services/[service]/playlists/[playlist]/page.tsx SCR-VEN-07  playlist editor (`new` for a new playlist)
    services/[service]/schedule/page.tsx             SCR-VEN-08  weekly schedule
    services/[service]/fallbacks/page.tsx            SCR-VEN-09  fallbacks
    services/[service]/overview/page.tsx             SCR-VEN-10  premises service view
    services/[service]/end/page.tsx                  SCR-VEN-11  end the service
    documents/[document]/page.tsx                    SCR-VEN-05  Download: the issued document as its printable file
    devices/page.tsx                                 the devices of the premises, each opening its venue view
    devices/[device]/page.tsx                        SCR-PLR-04  venue view, SCR-PLR-05 once the offline limit ran out
    pairing/page.tsx                                 SCR-IAM-06  issue a pairing authorisation

The RightOne Player service of the premises the principal acts for. A service is addressed by its entitlement code
(RPS-7K2MQXB4TD), a device by its reference (PLY-0023). Every page asks for the signed-in principal first and reads
through `lib/api/venue.ts`; with mock data `lib/mock/backend/venue.ts` (VEN) and `lib/mock/backend/player.ts` (PLR
and IAM's pairing) play the API, so each act changes what the next screen shows, in the browser's world.
`?view=` shows a state no act reaches (loading, an outage, a read refused); the lists in `lib/mock/venue.ts` name
them per screen.

SCR-VEN-03 views: empty, loading, error. The boards' five services are seeded; an enrolment is added at the top.

- "Thiết bị Player của các cơ sở" under the list is not on the board: it is the way to the device screens (SCR-PLR-04,
  05) and the pairing screen (SCR-IAM-06), which the specification reaches from "the premises portal".
