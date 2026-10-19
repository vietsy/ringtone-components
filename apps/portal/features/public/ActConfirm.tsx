"use client";

import { useRef, useState } from "react";
import { Button, Dialog, FactList, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Variant = "primary" | "secondary" | "quiet" | "danger";

/**
 * A console act the spec asks to confirm (Withdraw on SCR-PUB-15 and 16), in a form of its own: the button opens a
 * dialog that names what is acted on and what follows, with the facts and the reason the act needs; its primary action
 * sends the form to the server action. The way out closes the dialog and sends nothing. While `disabledReason` is set
 * the act is not this reader's, and the sentence says why beside it.
 */
export function ActConfirm({
  action,
  fields,
  label,
  icon,
  variant = "secondary",
  disabledReason,
  dialog,
  reason,
  locale,
}: {
  action: (form: FormData) => Promise<void>;
  fields: Readonly<Record<string, string>>;
  label: string;
  icon?: string;
  variant?: Variant;
  disabledReason?: string | null;
  dialog: { title: string; description: string; confirm: string; confirmVariant?: Variant; back: string; facts?: { label: string; value: string; kind?: "datetime" | "mono" }[] };
  reason?: { label: string; helper?: string; value: string };
  locale: Locale;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [why, setWhy] = useState(reason?.value ?? "");
  const off = disabledReason !== undefined && disabledReason !== null;
  return (
    <form ref={form} action={action} noValidate>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {reason !== undefined ? <input type="hidden" name="reason" value={why} /> : null}
      <Button variant={variant} size="sm" {...(icon !== undefined ? { icon } : {})} {...(off ? { disabled: true, disabledReason } : {})} onClick={() => setOpen(true)} locale={locale}>
        {label}
      </Button>
      {open ? (
        <Dialog
          title={dialog.title}
          description={dialog.description}
          primaryAction={{
            label: dialog.confirm,
            variant: dialog.confirmVariant ?? variant,
            loading: sending,
            onClick: () => {
              setSending(true);
              form.current?.requestSubmit();
            },
          }}
          secondaryAction={{ label: dialog.back, onClick: () => setOpen(false) }}
          onClose={() => setOpen(false)}
          open
          placement="viewport"
          align="start"
          density="console"
          width="var(--container-lg)"
          locale={locale}
        >
          {dialog.facts !== undefined && dialog.facts.length > 0 ? <FactList items={dialog.facts} density="console" locale={locale} /> : null}
          {reason !== undefined ? (
            <TextField label={reason.label} {...(reason.helper !== undefined ? { helper: reason.helper } : {})} value={why} onChange={setWhy} multiline rows={3} required density="console" locale={locale} />
          ) : null}
        </Dialog>
      ) : null}
    </form>
  );
}
