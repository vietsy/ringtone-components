# inspection-appointments

    page.tsx             SCR-VER-11  Inspector appointments, of one authority (`?authority=`)
    decisions/page.tsx   SCR-VER-12  Decide an appointment, reinstate a suspended inspector

SCR-VER-11 lists one authority's inspectors (KTVH-KV1 by default), in force first, records an appointment for a
second person to approve (the person reference is checked against the register, never searched by name), suspends
an inspector in force and ends or withdraws an appointment, each confirmed in a dialog. A suspension takes effect at
once: the inspector's next act under that appointment is refused APPOINTMENT_SUSPENDED in the field client and on
the inspection console, until an approver reinstates it on SCR-VER-12.
