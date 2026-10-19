"use client";

import { R1_FORMAT } from "@rightone/formatting";
import { useState } from "react";
import { Select, StatusLine, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

/**
 * SCR-ENG-09's ground and delta. The ground is chosen from `CFG-65`'s set, never typed, because `DR-64` reads it; the
 * resulting balance is computed beside the delta as it is typed, negative included, so an operator sees *minus 30*
 * before writing an event that cannot be removed. Announced as it changes.
 */
export function CorrectionFields({
  balance,
  grounds,
  copy,
  initial,
  errors,
  locale,
}: {
  balance: number;
  grounds: readonly { value: string; label: string }[];
  copy: { ground: string; groundHelp: string; groundPick: string; delta: string; deltaHelp: string; resulting: string; resultingNegative: string; noDelta: string };
  initial: { ground: string; delta: string };
  errors: { ground: string | null; delta: string | null };
  locale: Locale;
}) {
  const [delta, setDelta] = useState(initial.delta);
  const typed = delta.trim().replace(/^[−–]/, "-");
  const whole = /^[-+]?\d+$/.test(typed) ? Number(typed) : null;
  const resulting = whole !== null ? balance + whole : null;
  const figure = (value: number) => R1_FORMAT.formatCount(value, locale) ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <Select
        label={copy.ground}
        helper={copy.groundHelp}
        name="ground"
        options={grounds.map((ground) => ({ value: ground.value, label: ground.label }))}
        placeholder={copy.groundPick}
        value={initial.ground}
        required
        {...(errors.ground !== null ? { error: errors.ground } : {})}
        density="console"
        width="var(--container-sm)"
        locale={locale}
      />
      <TextField
        label={copy.delta}
        helper={copy.deltaHelp}
        name="point_delta"
        value={delta}
        onChange={setDelta}
        inputMode="numeric"
        mono
        required
        {...(errors.delta !== null ? { error: errors.delta } : {})}
        density="console"
        width="var(--space-48)"
        locale={locale}
      />
      <StatusLine
        family={resulting !== null && resulting < 0 ? "attention" : "neutral"}
        text={resulting === null ? copy.noDelta : (resulting < 0 ? copy.resultingNegative : copy.resulting).replace("{n}", figure(resulting))}
        live
        locale={locale}
      />
    </div>
  );
}
