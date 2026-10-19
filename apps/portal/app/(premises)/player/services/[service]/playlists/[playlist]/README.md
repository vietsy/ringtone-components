# [playlist]

    page.tsx    SCR-VEN-07  playlist editor; the address `new` opens it for a new playlist

Items in play order, moved and removed in place; eligible tracks found by search (only those eligible now), shared
moods added from those in effect. Save sends the whole list as revision 1 or the next revision; a refused save
comes back with every item as it was, TRACK_NOT_ELIGIBLE and MOOD_NOT_EFFECTIVE beside the item named. An
archived playlist is read-only. Leaving with changes asks first. Views: not-found, not-authorised, loading, error.

- The boards draw items for Chill tối only; the other seeded playlists hold tracks drawn elsewhere on the boards.
