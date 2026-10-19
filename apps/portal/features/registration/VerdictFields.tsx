"use client";

import { useState } from "react";
import { ButtonRow, FactList, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { ConfirmSubmit } from "./ConfirmSubmit";

export interface VerdictWords {
  note: string;
  noteHelp: string;
  approve: string;
  ret: string;
  noteFirst: string;
  approveTitle: string;
  approveText: string;
  approveConfirm: string;
  returnTitle: string;
  returnText: string;
  back: string;
}

/**
 * SCR-REG-14's verdict: the note, required to return, and Approve or Return with the note, each asking before it
 * sends. While the reader may not decide (the preparer, or a member without the approver's authority) both stay
 * unavailable with the reason beside them; the server refuses regardless.
 */
export function VerdictFields({
  formId,
  words,
  initialNote,
  noteError,
  heldBy,
  fee,
  locale,
}: {
  formId: string;
  words: VerdictWords;
  initialNote: string;
  noteError: string | null;
  /** Why the reader may not decide this proposal; null when they may. */
  heldBy: string | null;
  /** The fee the approval would issue, as the dialog states it. */
  fee: { label: string; value: string | null; missing: string };
  locale: Locale;
}) {
  const [note, setNote] = useState(initialNote);
  // Held for the same reason as Approve, the row says it once.
  const returnHeld = heldBy !== null ? "" : note.trim() === "" ? words.noteFirst : null;
  return (
    <>
      <TextField
        label={words.note}
        helper={words.noteHelp}
        name="note"
        value={note}
        onChange={setNote}
        multiline
        rows={4}
        maxLength={1000}
        {...(noteError !== null ? { error: noteError } : {})}
        density="console"
        locale={locale}
      />
      <input type="hidden" name="intent" defaultValue="APPROVED" />
      <ButtonRow>
        <ConfirmSubmit
          formId={formId}
          label={words.approve}
          shortcut="Alt+A"
          intent="APPROVED"
          disabledReason={heldBy}
          dialog={{ title: words.approveTitle, description: words.approveText, confirm: words.approveConfirm, back: words.back }}
          locale={locale}
        >
          <FactList items={[fee]} density="console" locale={locale} />
        </ConfirmSubmit>
        <ConfirmSubmit
          formId={formId}
          label={words.ret}
          variant="secondary"
          shortcut="Alt+R"
          intent="RETURNED"
          disabledReason={returnHeld}
          dialog={{ title: words.returnTitle, description: words.returnText, confirm: words.ret, back: words.back }}
          locale={locale}
        />
      </ButtonRow>
    </>
  );
}
