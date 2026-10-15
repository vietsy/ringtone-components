# new

    page.tsx   SCR-CAT-04  Submit records

Review views: populated, submitting, too-large, channel-refused, suspended, loading, error. Live: the form for
the reader's participation. Active, the administrator chooses a channel (Direct API, CSV file, or the board's
CWR file, not agreed) and a file; a JSON file is counted on select and again on the server, which checks every
record against the record shape of `srs/07` and refuses more than 50,000 with PAYLOAD_TOO_LARGE. The CSV
profile's columns are specified nowhere (WI-CAT-120), so a CSV file is recorded by name, type and size and not
counted. Accepted, the reference is issued and SCR-CAT-05 opens at RECEIVED; refused, the form comes back with
the refusal beside its field. A suspended participation draws the board's suspended state; no active
participation (Hạc Bạch, Dây Đàn) draws the same locked form with PARTICIPATION_NOT_ACTIVE.

Deviations: the file goes up in parts of 512 KB, because a server action takes at most 1 MB a request; Submit
waits for a file with the words "Choose a records file to submit." (new copy, the board always has a file);
the format offered follows the channel's profile, as the spec's "scoped by channel" says, where the board offers
both formats on every channel.
