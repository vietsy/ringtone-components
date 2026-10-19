# [answer]

    page.tsx   SCR-VER-02  Verification answer

Live, the page reads the stored answer the reference names, exactly as it was given: the answers the session's
verifications and uploads made, and the canvas's own stored answers (every answer SCR-VER-02 draws, and the two about
Pasteur that SCR-VER-04 draws). A reference the session does not have, or one of an appointment the inspector no
longer holds, is ANSWER_NOT_FOUND in place of the answer; an answer of a suspended appointment, or of an authority not
in force, says so in the header (DR-740 rows 2 and 3). A result the phone checked offline and has not uploaded opens by
the key the phone gave it, headed as the offline answer, with its issue instant, the keys' refresh and, where the key
that signed it was retired after, a line saying so; uploaded, it carries its VRA- reference and Inspect this premises.
The record's state is said in the words of design/03 section 5b, whatever state CER answers (revoked, expired,
replaced and the rest), and only a current state is drawn as valid.
A current result is headed by the state; the premises is named only for a premises of the jurisdiction acted
for, otherwise the public field set says why. Inspect this premises (an answer naming a premises of the field set
and verified from no inspection) carries the answer into SCR-VER-03 (`inspectThisPremises`); Back to the
inspection opens the inspection it was verified from; Scan another opens SCR-VER-01.

Review views: unable, invalid, invalid-type, offline-keys, online, online-from-inspection, state-suspended,
public-set, no-record, no-premises, no-current-record, ambiguous, not-authenticated, offline, answer-not-found,
payload-mismatch, not-for-premises, no-appointment, premises-unavailable, not-authorised, loading, error.

Deviations: a state known only to the day (R1-CER-2026-Q4RT8XZW, suspended since 26 September) is said as a date;
one the canvas never draws (Đa Kao's) leaves "State since" out. A premises with no current record whose last
record is in another state says it in the sentence of design/03 section 5 (`ver02.noCurrentLast`, the state's words
of section 5b), where the board draws only "never issued". Retry under "a system did not answer" reads the stored
answer again.
