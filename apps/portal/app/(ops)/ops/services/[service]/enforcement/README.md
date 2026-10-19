# enforcement

    page.tsx   SCR-VEN-14  suspend, restrict or revoke the service on a ground the enforcement policy lists

Record the action asks first, then opens the case file; a refusal comes back above the action row, fields kept.

- Effective at is a choice: "Ngay khi ghi nhận" (the default) sends no time, and the service takes the instant it
  records the action, so a form left open for minutes is never refused; "Vào thời điểm khác" opens the date and time,
  and only a typed time before the current minute is refused EFFECTIVE_AT_IN_PAST, beside the field. The
  specification has one mandatory date and time ("Vietnam time, now or later"; empty is RECORD_INCOMPLETE), which
  the second choice keeps: left blank there, it is still RECORD_INCOMPLETE.
