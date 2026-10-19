"use client";

import { useState } from "react";
import { ButtonRow, ChoiceList, DateField, FactList, Panel, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { ConfirmSubmit } from "./ConfirmSubmit";

export interface AmendmentWords {
  title: string;
  description: string;
  cause: string;
  causes: { value: string; label: string }[];
  caseRef: string;
  caseRefHelp: string;
  from: string;
  fromHelp: string;
  runsTo: string;
  start: string;
  startWhy: string;
  /** Carries {c}, the cause's words. */
  dlgTitle: string;
  dlgText: string;
  dlgBack: string;
}

/**
 * SCR-REG-10's Start an amendment, for a decided application whose decision is still current: one of the officer's
 * two causes, the appeal case for an appeal outcome, and the day it takes effect, the end being the decision's own
 * and not sent (ALG-261 step 7). The act waits for what it needs and asks before it starts the draft.
 */
export function AmendmentFields({
  formId,
  words,
  initial,
  to,
  today,
  errors,
  locale,
}: {
  formId: string;
  words: AmendmentWords;
  initial: { cause: string; caseRef: string; from: string };
  /** The decision's end, which the amendment runs to. */
  to: string;
  today: string;
  /** A refusal beside the field it belongs to. */
  errors: { cause: string | null; caseRef: string | null; from: string | null };
  locale: Locale;
}) {
  const [cause, setCause] = useState(initial.cause);
  const [caseRef, setCaseRef] = useState(initial.caseRef);
  const [from, setFrom] = useState(initial.from);
  const appeal = cause === "APPEAL_OUTCOME";
  const ready = cause !== "" && from !== "" && (!appeal || caseRef.trim() !== "");
  // The cause inside the question reads in lower case ("vì kết quả giải quyết khiếu nại", "because of appeal outcome").
  const label = words.causes.find((option) => option.value === cause)?.label ?? "";
  const causeWords = label.charAt(0).toLowerCase() + label.slice(1);
  return (
    <Panel variant="plain" level={3} title={words.title} description={words.description} compact locale={locale}>
      <ChoiceList
        legend={words.cause}
        name="cause"
        options={words.causes}
        value={cause}
        required
        {...(errors.cause !== null ? { error: errors.cause } : {})}
        onChange={(event) => setCause(String((event as { target: { value: string } }).target.value))}
        density="console"
        locale={locale}
      />
      {appeal ? (
        <TextField
          label={words.caseRef}
          helper={words.caseRefHelp}
          name="cause_ref"
          value={caseRef}
          onChange={setCaseRef}
          required
          {...(errors.caseRef !== null ? { error: errors.caseRef } : {})}
          density="console"
          locale={locale}
        />
      ) : null}
      <DateField
        label={words.from}
        helper={words.fromHelp}
        name="intended_period_start"
        value={from}
        min={today}
        max={to}
        today={today}
        required
        {...(errors.from !== null ? { error: errors.from } : {})}
        onChange={(value) => setFrom(typeof value === "string" ? value : "")}
        density="console"
        locale={locale}
      />
      <FactList items={[{ label: words.runsTo, value: to, kind: "date" }]} density="console" locale={locale} />
      <ButtonRow>
        <ConfirmSubmit
          formId={formId}
          label={words.start}
          variant="secondary"
          disabledReason={ready ? null : words.startWhy}
          dialog={{ title: words.dlgTitle.replace("{c}", causeWords), description: words.dlgText, confirm: words.start, back: words.dlgBack }}
          locale={locale}
        />
      </ButtonRow>
    </Panel>
  );
}
