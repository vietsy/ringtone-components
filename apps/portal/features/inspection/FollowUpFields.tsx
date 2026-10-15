"use client";

import { useState, type ComponentProps } from "react";
import { DateField, Select } from "@/components/r1";
import type { FollowUpKind } from "@/lib/api/inspection";
import type { Locale } from "@/lib/i18n/translate";

type Options = ComponentProps<typeof Select>["options"];

/** Every follow-up but none runs to a date (`follow_up_by`, required unless NONE: srs/02 conclusions). */
const UNDATED: FollowUpKind = "NONE";

interface Props {
  kind: { label: string; options: Options; value: string };
  date: { label: string; value: string; error: string | null };
  locale: Locale;
}

/**
 * SCR-VER-05's follow-up and its date. A follow-up needs a date (FOLLOW_UP_DATE_INVALID: "a follow-up needs a
 * date"; the contract requires `follow_up_by` unless NONE), so the field shows for every follow-up but none and
 * follows the choice at once, as the outcome's fields do.
 */
export function FollowUpFields({ kind, date, locale }: Props) {
  const [chosen, setChosen] = useState(kind.value);

  return (
    <>
      <Select
        label={kind.label}
        name="follow_up_kind"
        options={kind.options}
        value={chosen}
        required
        onChange={setChosen}
        density="portal"
        locale={locale}
      />
      {chosen !== UNDATED && (
        <DateField
          label={date.label}
          name="follow_up_by"
          value={date.value}
          {...(date.error !== null ? { error: date.error } : {})}
          required
          density="premises"
          locale={locale}
        />
      )}
    </>
  );
}
