"use client";

import { useState, type ReactNode } from "react";
import { Button, ButtonRow, ChoiceList, Divider, Panel, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

interface Props {
  title: string;
  outcomes: readonly { value: string; label: string; helper: string }[];
  values: { outcome: string; reason: string };
  errors: { outcome: string | null; reason: string | null };
  /** What the rule's outcome rests on, said under the outcomes. */
  help: string;
  /** Said above Resolve: a decision that could not be read, or the unmet condition that ends the period. */
  notice: ReactNode;
  cancelHref: string;
  words: { outcome: string; reason: string; reasonHelp: string; resolve: string; cancel: string; resolveWhy: string };
  locale: Locale;
}

/**
 * SCR-CER-08's resolution: the outcome the rule gives, preselected, and the reason kept with the follow-up. Resolve
 * asks for no confirmation and stays unavailable, with its reason, until a reason is written.
 */
export function ResolveFields({ title, outcomes, values, errors, help, notice, cancelHref, words, locale }: Props) {
  const [reason, setReason] = useState(values.reason);

  return (
    <Panel gap="xl" locale={locale}>
      <Panel variant="plain" level={2} title={title} compact locale={locale}>
        <ChoiceList
          legend={words.outcome}
          helper={help}
          name="outcome"
          options={outcomes.map((entry) => ({ value: entry.value, label: entry.label, helper: entry.helper }))}
          value={values.outcome}
          required
          {...(errors.outcome !== null ? { error: errors.outcome } : {})}
          density="console"
          locale={locale}
        />
        <TextField
          label={words.reason}
          helper={words.reasonHelp}
          name="reason"
          value={reason}
          onChange={setReason}
          {...(errors.reason !== null ? { error: errors.reason } : {})}
          wrap
          maxLength={2000}
          required
          width="100%"
          density="console"
          locale={locale}
        />
      </Panel>
      <Divider />
      {notice}
      <ButtonRow>
        <Button variant="primary" size="sm" type="submit" {...(reason.trim() === "" ? { disabled: true, disabledReason: words.resolveWhy } : {})} locale={locale}>
          {words.resolve}
        </Button>
        <Button variant="secondary" size="sm" href={cancelHref} locale={locale}>
          {words.cancel}
        </Button>
      </ButtonRow>
    </Panel>
  );
}
