"use client";

import { useState, type ReactNode } from "react";
import { Button, ButtonRow, Divider, Panel, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { ConfirmSubmit } from "./ConfirmSubmit";

export interface WithdrawalWords {
  instruction: string;
  ref: string;
  refHelp: string;
  reason: string;
  reasonHelp: string;
  record: string;
  recordWhy: string;
  cancel: string;
  /** Carries {i}, the instruction's reference. */
  dlgTitle: string;
  dlgText: string;
  dlgBack: string;
}

/**
 * SCR-REG-15's form: the reference of the applicant's instruction, required, and their reason as given. Record the
 * withdrawal waits for the reference and asks before it sends, naming the application, the instruction and what
 * ends with it; the act cannot be undone, so the dialog's action is the danger one.
 */
export function WithdrawalFields({
  formId,
  words,
  initial,
  refError,
  heldBy,
  records,
  cancelHref,
  locale,
}: {
  formId: string;
  words: WithdrawalWords;
  initial: { instruction: string; reason: string };
  refError: string | null;
  /** Why the withdrawal cannot be recorded in this state; null when it can. */
  heldBy: string | null;
  /** What the withdrawal records, as the page states it. */
  records: ReactNode;
  cancelHref: string;
  locale: Locale;
}) {
  const [instruction, setInstruction] = useState(initial.instruction);
  const [reason, setReason] = useState(initial.reason);
  return (
    <Panel gap="xl" locale={locale}>
      <Panel variant="plain" level={2} title={words.instruction} compact locale={locale}>
        <TextField
          label={words.ref}
          helper={words.refHelp}
          name="instruction_ref"
          value={instruction}
          onChange={setInstruction}
          required
          {...(refError !== null ? { error: refError } : {})}
          density="console"
          locale={locale}
        />
        <TextField label={words.reason} helper={words.reasonHelp} name="reason_text" value={reason} onChange={setReason} density="console" locale={locale} />
      </Panel>
      <Divider />
      {records}
      <Divider />
      <ButtonRow>
        <ConfirmSubmit
          formId={formId}
          label={words.record}
          disabledReason={heldBy ?? (instruction.trim() === "" ? words.recordWhy : null)}
          dialog={{ title: words.dlgTitle.replace("{i}", instruction.trim()), description: words.dlgText, confirm: words.record, confirmVariant: "danger", back: words.dlgBack }}
          locale={locale}
        />
        <Button variant="quiet" size="sm" href={cancelHref} locale={locale}>
          {words.cancel}
        </Button>
      </ButtonRow>
    </Panel>
  );
}
