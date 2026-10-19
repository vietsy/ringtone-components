"use client";

import { useRef, useState } from "react";
import { Button, ButtonRow, Checkbox, Dialog, FactList, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

interface Words {
  plain: string;
  plainHelp: string;
  reason: string;
  reasonHelp: string;
  row: string;
  approve: string;
  return: string;
  back: string;
  approveWhy: string;
  returnWhy: string;
  cancel: string;
  approveDialog: { title: string; description: string; confirm: string; facts: { label: string; value: string; kind?: "datetime" }[] };
  returnDialog: { title: string; description: string; confirm: string };
}

/**
 * SCR-PUB-16's decision: the plain-language review a page needs, the reason a return needs, and the two acts, each
 * confirmed in a dialog that names the version, the instant it takes effect or the author it goes back to. Approve
 * waits for the review to be ticked on a page and Return for a reason, as the board draws them; the server checks both
 * again. `refusedBy` is set when the reader may not decide this version at all: the controls stay, disabled, with why.
 */
export function VersionDecision({
  action,
  version,
  label,
  isPage,
  initial,
  errors,
  refusedBy,
  backHref,
  words,
  locale,
}: {
  action: (form: FormData) => Promise<void>;
  version: string;
  label: string;
  isPage: boolean;
  initial: { plain: boolean; reason: string };
  errors: { plain: string | null; reason: string | null };
  refusedBy: string | null;
  backHref: string;
  words: Words;
  locale: Locale;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [plain, setPlain] = useState(initial.plain);
  const [reason, setReason] = useState(initial.reason);
  const [asking, setAsking] = useState<"APPROVE" | "RETURN" | null>(null);
  const [sending, setSending] = useState(false);
  const decision = useRef<HTMLInputElement>(null);
  const off = refusedBy !== null;
  const approveWhy = off ? refusedBy : isPage && !plain ? words.approveWhy : null;
  // Held back for the reader, the rule is said once, under Approve; Return is held back with it.
  const returnWhy = off ? null : reason.trim() === "" ? words.returnWhy : null;

  function send() {
    if (decision.current !== null && asking !== null) decision.current.value = asking;
    setSending(true);
    form.current?.requestSubmit();
  }

  const dialog = asking === "APPROVE" ? words.approveDialog : asking === "RETURN" ? words.returnDialog : null;
  return (
    <form ref={form} action={action} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="label" value={label} />
      <input ref={decision} type="hidden" name="decision" defaultValue="APPROVE" />
      {isPage ? (
        <Checkbox
          label={words.plain}
          helper={words.plainHelp}
          name="plain_language_confirmed"
          checked={plain}
          required
          {...(errors.plain !== null ? { error: errors.plain } : {})}
          {...(off ? { disabled: true } : {})}
          onChange={(event) => setPlain(Boolean((event as { target?: { checked?: boolean } }).target?.checked))}
          density="console"
          locale={locale}
        />
      ) : null}
      <TextField
        label={words.reason}
        helper={words.reasonHelp}
        name="reason"
        value={reason}
        onChange={setReason}
        multiline
        rows={3}
        {...(errors.reason !== null ? { error: errors.reason } : {})}
        {...(off ? { disabled: true } : {})}
        density="console"
        locale={locale}
      />
      <ButtonRow label={words.row}>
        <Button variant="primary" size="sm" icon="check" {...(approveWhy !== null ? { disabled: true, disabledReason: approveWhy } : {})} onClick={() => setAsking("APPROVE")} locale={locale}>
          {words.approve}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon="arrow-left"
          {...(returnWhy !== null ? { disabled: true, disabledReason: returnWhy } : off ? { disabled: true } : {})}
          onClick={() => setAsking("RETURN")}
          locale={locale}
        >
          {words.return}
        </Button>
        <Button variant="quiet" size="sm" href={backHref} locale={locale}>
          {words.back}
        </Button>
      </ButtonRow>
      {dialog !== null ? (
        <Dialog
          title={dialog.title}
          description={dialog.description}
          primaryAction={{ label: dialog.confirm, variant: "primary", loading: sending, onClick: send }}
          secondaryAction={{ label: words.cancel, onClick: () => setAsking(null) }}
          onClose={() => setAsking(null)}
          open
          placement="viewport"
          align="start"
          density="console"
          width="var(--container-lg)"
          locale={locale}
        >
          <FactList items={asking === "APPROVE" ? words.approveDialog.facts : [{ label: words.reason, value: reason.trim() }]} density="console" locale={locale} />
        </Dialog>
      ) : null}
    </form>
  );
}
