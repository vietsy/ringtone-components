"use client";

import { useState } from "react";
import { Button, ButtonRow, ChoiceList, DateField, Panel, Select } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { SubmitButton } from "./SubmitButton";

export interface ClaimFormCopy {
  addClaim: string;
  kindLegend: string;
  kindOptions: { value: string; label: string }[];
  layerLabel: string;
  layerPlaceholder: string;
  layerOptions: { value: string; label: string }[];
  periodLabel: string;
  periodHelp: string;
  fromLabel: string;
  toLabel: string;
  addTheClaim: string;
  cancel: string;
}

/**
 * SCR-REG-04's claim form: Add a claim opens it in place, Cancel closes it, and Add the claim sends it. A
 * refused claim comes back open, with the answers as entered and the refusal under its field.
 */
export function ClaimForm({
  copy,
  action,
  initial,
  period,
  today,
  phone,
  locale,
}: {
  copy: ClaimFormCopy;
  action: (formData: FormData) => Promise<void>;
  /** The form as the last attempt left it; null while it is closed. */
  initial: { kind: string; layer: string | null; from: string; to: string; layerError: string | null; periodError: string | null } | null;
  /** The registered period, which the claim must fall within. */
  period: { from: string; to: string };
  today: string;
  phone: boolean;
  locale: Locale;
}) {
  const [open, setOpen] = useState(initial !== null);
  if (!open) {
    return (
      <div style={{ display: "flex", flexDirection: phone ? "column" : "row", alignItems: phone ? "stretch" : "flex-start" }}>
        <Button variant="secondary" size="md" icon="plus" fullWidth={phone} onClick={() => setOpen(true)} locale={locale}>
          {copy.addClaim}
        </Button>
      </div>
    );
  }
  return (
    <form action={action}>
      <Panel variant="sunken" level={3} title={copy.addClaim} as="fieldset" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <ChoiceList
            legend={copy.kindLegend}
            options={copy.kindOptions}
            value={initial?.kind ?? "NON_USE"}
            required
            name="kind"
            layout="list"
            density="portal"
            locale={locale}
          />
          <Select
            label={copy.layerLabel}
            options={copy.layerOptions}
            value={initial?.layer ?? ""}
            placeholder={copy.layerPlaceholder}
            {...(initial?.layerError ? { error: initial.layerError } : {})}
            required
            width="var(--container-xs)"
            name="rights_layer"
            density="portal"
            locale={locale}
          />
          <DateField
            label={copy.periodLabel}
            helper={copy.periodHelp}
            range
            value={initial?.from ?? period.from}
            to={initial?.to ?? period.to}
            fromLabel={copy.fromLabel}
            toLabel={copy.toLabel}
            min={period.from}
            max={period.to}
            today={today}
            {...(initial?.periodError ? { error: initial.periodError } : {})}
            required
            name="claim_period"
            density="portal"
            locale={locale}
          />
          <ButtonRow>
            <SubmitButton variant="secondary" size="md" fullWidth={phone} locale={locale}>
              {copy.addTheClaim}
            </SubmitButton>
            <Button variant="quiet" size="md" fullWidth={phone} onClick={() => setOpen(false)} locale={locale}>
              {copy.cancel}
            </Button>
          </ButtonRow>
        </div>
      </Panel>
    </form>
  );
}
