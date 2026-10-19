"use client";

import { useRef, useState } from "react";
import { Button, ButtonRow, ChoiceList, Dialog, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { useHydrated } from "./ShortcutButton";

type Decision = "APPROVE" | "REFUSE";

interface Props {
  action: (form: FormData) => Promise<void>;
  /** The designation or appointment decided, sent with the decision. */
  id: string;
  words: {
    decision: string;
    approve: string;
    refuse: string;
    reason: string;
    reasonHelp: string;
    record: string;
    close?: string;
    cancel: string;
  };
  /** As the last send left them, or Approve with no reason. */
  initial: { decision: Decision; reason: string };
  reasonError: string | null;
  /** Why the reader may not decide (DR-746 rows 1 and 2): the controls are unavailable and say so. */
  barred: string | null;
  /** The confirmation an approval asks for (design/03); a refusal is sent as it is, with its reason. */
  confirm: { title: string; description: string };
  closeHref?: string;
  /** The board draws the decision's button the width of its panel on SCR-VER-12. */
  fullWidth?: boolean;
  locale: Locale;
}

/**
 * SCR-VER-10 and SCR-VER-12 Record the decision: Approve or Refuse, a reason needed to refuse. Approving asks for
 * confirmation, naming who or what is approved and from when; the server decides the rest (DR-746).
 */
export function DecisionForm({ action, id, words, initial, reasonError, barred, confirm, closeHref, fullWidth = false, locale }: Props) {
  const [decision, setDecision] = useState<Decision>(initial.decision);
  const [confirming, setConfirming] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const hydrated = useHydrated();
  // The fields are unavailable with the decision; the reason is said once, under the button that records it.
  const fieldsOff = barred !== null ? { disabled: true } : {};
  const off = barred !== null ? { disabled: true, disabledReason: barred } : {};

  return (
    // display: contents keeps the fields in the panel's own rhythm; the form only carries them to the action.
    <form ref={form} action={action} style={{ display: "contents" }}>
      <input type="hidden" name="id" value={id} />
      <ChoiceList
        legend={words.decision}
        name="decision"
        options={[
          { value: "APPROVE", label: words.approve },
          { value: "REFUSE", label: words.refuse },
        ]}
        value={decision}
        onChange={(event) => {
          const value = (event as { target?: { value?: unknown } }).target?.value;
          if (value === "APPROVE" || value === "REFUSE") setDecision(value);
        }}
        required
        layout="inline"
        {...fieldsOff}
        density="console"
        locale={locale}
      />
      <TextField
        label={words.reason}
        name="reason"
        value={initial.reason}
        helper={words.reasonHelp}
        {...(reasonError !== null ? { error: reasonError } : {})}
        multiline
        rows={3}
        maxLength={1000}
        {...fieldsOff}
        density="console"
        locale={locale}
      />
      <ButtonRow>
        <Button
          variant="primary"
          size="sm"
          icon="check"
          fullWidth={fullWidth}
          {...(hydrated ? { shortcut: "Alt+R" } : {})}
          {...off}
          onClick={() => (decision === "APPROVE" ? setConfirming(true) : form.current?.requestSubmit())}
          locale={locale}
        >
          {words.record}
        </Button>
        {closeHref !== undefined && words.close !== undefined && (
          <Button variant="quiet" size="sm" href={closeHref} locale={locale}>
            {words.close}
          </Button>
        )}
      </ButtonRow>
      {confirming && (
        <Dialog
          title={confirm.title}
          description={confirm.description}
          primaryAction={{ label: words.record, variant: "primary", onClick: () => form.current?.requestSubmit() }}
          secondaryAction={{ label: words.cancel, onClick: () => setConfirming(false) }}
          onClose={() => setConfirming(false)}
          open
          placement="overlay"
          align="start"
          density="console"
          locale={locale}
        />
      )}
    </form>
  );
}
