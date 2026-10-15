"use client";

import { useState } from "react";
import { Button, ChoiceList } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { continueToRightOne } from "./actions";

/**
 * The organisation choice and the button that continues with it (SCR-RID-04). The button stays disabled,
 * saying why, until an organisation is chosen, so it holds the choice on the client. A refusal of the
 * submitted organisation stays beside the list until the reader chooses another.
 */
export function OrganisationPicker({
  legend,
  options,
  initial,
  error,
  label,
  workingLabel,
  working,
  pickFirst,
  locale,
}: {
  legend: string;
  options: { value: string; label: string; helper: string }[];
  initial: string | null;
  error: string | null;
  label: string;
  workingLabel: string;
  working: boolean;
  pickFirst: string;
  locale: Locale;
}) {
  const [chosen, setChosen] = useState<string | null>(initial);
  const refused = error !== null && chosen === initial;
  return (
    // display: contents keeps the list and the button in the panel's own column and spacing.
    <form action={continueToRightOne} style={{ display: "contents" }}>
      <ChoiceList
        legend={legend}
        options={options}
        {...(chosen !== null ? { value: chosen } : {})}
        layout="cards"
        required
        name="organizationId"
        {...(refused ? { error } : {})}
        density="portal"
        onChange={(event) => setChosen(valueOf(event))}
        locale={locale}
      />
      <Button
        variant="primary"
        size="md"
        type="submit"
        fullWidth
        loading={working}
        loadingLabel={workingLabel}
        disabled={chosen === null}
        {...(chosen === null ? { disabledReason: pickFirst } : {})}
        locale={locale}
      >
        {label}
      </Button>
    </form>
  );
}

function valueOf(event: unknown): string | null {
  const target = (event as { target?: { value?: unknown } } | null)?.target;
  return typeof target?.value === "string" ? target.value : null;
}
