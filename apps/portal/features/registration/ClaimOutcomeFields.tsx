"use client";

import { useState } from "react";
import { Button, ButtonRow, Checkbox, ChoiceList, Combobox, DateField, Divider, FactList, Panel } from "@/components/r1";
import { Text } from "@/components/Text";
import type { Locale } from "@/lib/i18n/translate";
import { ConfirmSubmit } from "./ConfirmSubmit";

export interface ClaimOutcomeWords {
  outcome: string;
  outcomes: { value: string; label: string }[];
  reason: string;
  reasonPick: string;
  reasonHelp: string;
  reasons: { value: string; label: string }[];
  scope: string;
  from: string;
  to: string;
  scopeHelp: string;
  coRecord: string;
  coHelp: string;
  effect: string;
  /** The effect sentences by outcome, the deadline sentence last. */
  effects: Readonly<Record<string, readonly string[]>>;
  record: string;
  recordWhy: string;
  cancel: string;
  /** Carries {o}, the outcome's words. */
  dlgTitle: string;
  dlgFinal: string;
  dlgBack: string;
}

/**
 * SCR-REG-12's outcome form: the outcome, its reason (one the claims standard lists, or a short code typed), the
 * accepted scope for a partial outcome, and whether the legal authority records it too. The effect follows the
 * outcome chosen. Record the outcome waits for the outcome and the reason, and asks before it sends.
 */
export function ClaimOutcomeFields({
  formId,
  words,
  initial,
  period,
  legalReader,
  reasonError,
  scopeError,
  cancelHref,
  locale,
}: {
  formId: string;
  words: ClaimOutcomeWords;
  initial: { outcome: string; reason: string; scopeFrom: string; scopeTo: string; withLegal: boolean };
  /** The claim's period, which a partly accepted scope lies within. */
  period: { from: string; to: string };
  /** The legal authority records with the box ticked and fixed. */
  legalReader: boolean;
  reasonError: string | null;
  scopeError: string | null;
  /** Null for the legal authority, who has no case file to go back to. */
  cancelHref: string | null;
  locale: Locale;
}) {
  const [outcome, setOutcome] = useState(initial.outcome);
  const [reason, setReason] = useState(initial.reason);
  const effects = words.effects[outcome] ?? [];
  const outcomeWords = words.outcomes.find((option) => option.value === outcome)?.label ?? "";
  const reasonWords = words.reasons.find((option) => option.value === reason)?.label ?? reason;
  const ready = outcome !== "" && reason.trim() !== "";
  return (
    <Panel gap="xl" locale={locale}>
      <Panel variant="plain" compact locale={locale}>
        <ChoiceList
          legend={words.outcome}
          name="outcome"
          options={words.outcomes}
          value={outcome}
          layout="inline"
          required
          onChange={(event) => setOutcome(String((event as { target: { value: string } }).target.value))}
          density="console"
          locale={locale}
        />
        <Combobox
          label={words.reason}
          name="reason_code"
          options={words.reasons}
          {...(reason !== "" ? { value: reason } : {})}
          placeholder={words.reasonPick}
          helper={words.reasonHelp}
          allowCustom
          required
          {...(reasonError !== null ? { error: reasonError } : {})}
          onChange={(value) => setReason(typeof value === "string" ? value : "")}
          density="console"
          locale={locale}
        />
        {outcome === "PARTLY_ACCEPTED" ? (
          <DateField
            range
            label={words.scope}
            fromLabel={words.from}
            toLabel={words.to}
            helper={words.scopeHelp}
            name="accepted_scope"
            value={initial.scopeFrom}
            to={initial.scopeTo}
            min={period.from}
            max={period.to}
            required
            {...(scopeError !== null ? { error: scopeError } : {})}
            density="console"
            locale={locale}
          />
        ) : null}
        <Checkbox
          label={words.coRecord}
          helper={words.coHelp}
          name="co_recorded_by_legal"
          {...(legalReader ? { checked: true, readOnly: true } : initial.withLegal ? { checked: true } : {})}
          density="console"
          locale={locale}
        />
        {/* A box fixed as ticked still sends that it is ticked. */}
        {legalReader ? <input type="hidden" name="co_recorded_by_legal" value="on" /> : null}
      </Panel>
      <Divider />
      <Panel variant="plain" level={2} title={words.effect} compact locale={locale}>
        {effects.map((line) => (
          <Text key={line} size="sm">
            {line}
          </Text>
        ))}
      </Panel>
      <Divider />
      <ButtonRow>
        <ConfirmSubmit
          formId={formId}
          label={words.record}
          shortcut="Alt+R"
          disabledReason={ready ? null : words.recordWhy}
          dialog={{
            title: words.dlgTitle.replace("{o}", outcomeWords),
            description: [...effects.slice(0, -1), words.dlgFinal].join(" "),
            confirm: words.record,
            back: words.dlgBack,
          }}
          locale={locale}
        >
          <FactList items={[{ label: words.reason, value: reasonWords }]} density="console" locale={locale} />
        </ConfirmSubmit>
        {cancelHref !== null ? (
          <Button variant="quiet" size="sm" href={cancelHref} locale={locale}>
            {words.cancel}
          </Button>
        ) : null}
      </ButtonRow>
    </Panel>
  );
}
