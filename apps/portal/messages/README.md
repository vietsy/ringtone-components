# messages

The message catalogue. Vietnamese is the product language; English is the second locale.

No user-visible string is written inline in a component. A test asserts both files carry the same
keys, because a key present in one locale and missing in the other is a screen that reads correctly
for half the users and shows a raw key to the rest.

Layout must tolerate a 30% length increase: English is usually longer than the Vietnamese it
replaces here.

`vi.json` and `en.json` hold what every surface shares: error messages by code, status labels, the
premises nav. A family's screens keep their own pair in `screens/`.
