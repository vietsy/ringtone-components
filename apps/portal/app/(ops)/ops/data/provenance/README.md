# provenance

    page.tsx   SCR-DAT-04  a value's class and what decided it; `?value=` names the value, `as-of` a past day to read
                           it at the end of, `fields=value` a caller that asked for the value alone
    export/    SCR-DAT-04  Xuất CSV: the value and its inputs, each with its class as a column (FR-DAT-026)

The data governance owner (ACT-DAT, Phan Gia Lượng) looks up a value: the ward's third-quarter use is imputed, decided
by its area weighting; the floor area has no class, so one can be recorded, refused PROVENANCE_CLASS_MISSING without a
class and PROVENANCE_CLASS_UNKNOWN outside the six. A caller that asked for the value alone is refused
CLASS_CANNOT_BE_OMITTED, the refused request recorded with who asked and when, and reads that above the value and its
class. A past day reads each class as recorded by its end: on 15 September 2026 the ward's inputs had none yet.
`?view=loading` and `error` draw those states for review.
