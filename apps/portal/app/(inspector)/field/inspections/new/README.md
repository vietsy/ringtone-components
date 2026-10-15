# new

    page.tsx   SCR-VER-03  Start an inspection

Live, the premises, the answer and the appointment come from the answer SCR-VER-02's Inspect this premises
carried in; with nothing carried in, the page goes to SCR-VER-01 (every inspection starts from a verification).
The form opens with Routine and the time now. Start opens a new inspection (`POST /inspections`) with a new ISP-
reference and the answer attached, on SCR-VER-04; a refusal comes back with the form as sent: OBSERVED_AT_IN_FUTURE
beside the time, DELAY_REASON_REQUIRED beside the reason, ANSWER_OUTSIDE_INSPECTION_WINDOW (an answer checked more
than 24 hours before the inspection, CFG-773) beside the answer, with Start without the answer offered. Where the
inspector already has this premises open under the same appointment, Start is unavailable and Continue the open
inspection attaches the answer to it and opens it. The reason for late recording shows once the time given is more
than 24 hours ago, and follows the time as it changes (`features/inspection/ObservedFields.tsx`). The buttons send
one form, each naming its act (`features/inspection/IntentButtons.tsx`). Cancel opens SCR-VER-17.

Review views: populated, open-exists, answer-refused, last-day, late, time-in-future, offline, no-appointment,
suspended, outside, jurisdiction-not-recorded, observed-outside, premises-unavailable, policy-unavailable,
cursor-invalid, not-authorised, loading, error.

Deviation: the basis starts empty; the board's "Kế hoạch kiểm tra số 18/KH-KTVH" is what its inspector typed.
