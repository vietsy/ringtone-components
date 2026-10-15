"use client";

import { useState } from "react";
import { DateField, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/** CFG-773: an inspection recorded more than 24 hours after it took place needs a reason for the delay. */
const RECORDING_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface Props {
  observed: { label: string; on: string; time: string; error: string | null };
  delay: { label: string; value: string; error: string | null };
  /** The reason is asked for on arrival: the time sent was already late. */
  late: boolean;
  locale: Locale;
}

/**
 * SCR-VER-03 Took place, and the reason for late recording, which shows once the time given is older than the
 * recording interval (design/03 SCR-VER-03, Delay reason) and follows the time as it is changed.
 */
export function ObservedFields({ observed, delay, late, locale }: Props) {
  const [askReason, setAskReason] = useState(late);

  return (
    <>
      <DateField
        label={observed.label}
        name="observed_at"
        withTime
        value={observed.on}
        time={observed.time}
        {...(observed.error !== null ? { error: observed.error } : {})}
        onChange={(value) => {
          if (typeof value === "string") setAskReason(Date.now() - Date.parse(value) > RECORDING_INTERVAL_MS);
        }}
        required
        density="premises"
        locale={locale}
      />
      {askReason && (
        <TextField
          label={delay.label}
          name="delay_reason"
          value={delay.value}
          multiline
          rows={3}
          required
          {...(delay.error !== null ? { error: delay.error } : {})}
          maxLength={1000}
          density="portal"
          locale={locale}
        />
      )}
    </>
  );
}
