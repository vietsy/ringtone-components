# lists

    page.tsx          SCR-VER-07  Inspection lists
    [list]/page.tsx   SCR-VER-08  List supply and entries

Live, the page reads the supplies of the authority the console acts under (KTVH-KV1 at first, the authority of the
last request after that), newest first, and today's count against CFG-777's 10, counted from the supplies
requested today (Vietnam time) that did not fail. Request the list (`POST /inspection-lists`) makes a new supply
with a new ILS- reference and opens it on SCR-VER-08; refused, the request comes back as sent with
APPOINTMENT_REQUIRED beside the authority, OUTSIDE_JURISDICTION beside the areas, and at the limit the limit's
refusal in place of the control with the next instant. The kind and state filters choose among the page's rows
(`features/inspection/SupplyList.tsx`); each row, and its Open, opens the supply.

Review views: populated, p1-failed, outside, limit, appointment-required, no-appointment, suspended,
jurisdiction-not-recorded, premises-unavailable, policy-unavailable, cursor-invalid, filtered, empty,
not-authorised, loading, error.

Deviations: Close (to the console home) is left out, as is the rail's "Inspections and records" and the queue:
none has a route. In cursor-invalid the refusal stands in place of the table: a failure is never drawn as an empty
list. While loading, the request form waits for the appointments it offers. Only the state filter draws a chip, the
one the board words. The authority is asked for only with two or more appointments (design/03). The areas offered
are the jurisdiction of the authority acted under; a ward of another authority is refused when the request names
another authority. Alt+R is bound once the page has hydrated (`features/inspection/ShortcutButton.tsx`), and the
rows' J, K and Enter are listed only while the table is on the page. Retry under a header refusal reloads the page.
