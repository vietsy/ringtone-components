"use client";

import { useState } from "react";
import { Button, ButtonRow, Switch } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { SaveButton } from "./SaveButton";

export interface PreferenceRow {
  classCode: string;
  label: string;
  /** For a required class: its mark, and the sentence that says why it cannot be switched off. */
  fixed: { mark: string; reason: string } | null;
  receiving: boolean;
  /** SUPPRESSION_NOT_PERMITTED from the last save, naming the class. */
  error: string | null;
}

/**
 * SCR-COM-12's classes and Save. A required class shows a fixed switch with its sentence, never a hidden row,
 * so nobody believes they switched everything off; Save is available once a switch has changed and says so
 * until then. Each class is sent as `receive.<class>`.
 */
export function PreferenceForm({
  action,
  rows,
  notice,
  copy,
  back,
  phone,
  locale,
}: {
  action: (formData: FormData) => Promise<void>;
  rows: readonly PreferenceRow[];
  notice: string | null;
  copy: { save: string; saving: string; unchanged: string; back: string };
  back: string;
  phone: boolean;
  locale: Locale;
}) {
  const [chosen, setChosen] = useState<Readonly<Record<string, boolean>>>(() => Object.fromEntries(rows.map((row) => [row.classCode, row.receiving])));
  const changed = rows.some((row) => chosen[row.classCode] !== row.receiving);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {notice !== null ? <input type="hidden" name="notice" value={notice} /> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {rows.map((row) => (
          <div key={row.classCode}>
            <input type="hidden" name={`receive.${row.classCode}`} value={chosen[row.classCode] === false ? "off" : "on"} />
            <Switch
              label={row.label}
              checked={chosen[row.classCode] !== false}
              onChange={(on) => setChosen((before) => ({ ...before, [row.classCode]: on }))}
              {...(row.fixed !== null ? { hint: row.fixed.mark, disabled: true, disabledReason: row.fixed.reason } : {})}
              {...(row.error !== null ? { error: row.error } : {})}
              density="portal"
              locale={locale}
            />
          </div>
        ))}
      </div>
      <ButtonRow align="between">
        <Button variant="quiet" size="md" icon="arrow-left" href={back} fullWidth={phone} locale={locale}>
          {copy.back}
        </Button>
        <SaveButton disabledReason={changed ? null : copy.unchanged} loadingLabel={copy.saving} fullWidth={phone} locale={locale}>
          {copy.save}
        </SaveButton>
      </ButtonRow>
    </form>
  );
}
