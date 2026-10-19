"use client";

import { useRef, useState, useTransition } from "react";
import { Button, ButtonRow, Columns, DateField, Dialog, ItemList, Panel, TextField, format } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { readDate } from "./fields";

/**
 * SCR-VEN-11's form: the date the service ends (blank is the earliest the ending policy allows), an optional
 * reason, and End the service, which asks first. The confirmation names the premises and the effective instant and
 * says the request cannot be withdrawn; its focus opens on its title, never on the ending.
 */
export function EndServiceForm({
  copy,
  premises,
  earliest,
  initialDate,
  initialReason,
  dateError,
  ended,
  action,
  cancelHref,
  phone,
  locale,
}: {
  copy: {
    whenTitle: string;
    endOn: string;
    endHelp: string;
    reason: string;
    reasonHelp: string;
    doesTitle: string;
    does: readonly string[];
    end: string;
    cancel: string;
    dialogTitle: string;
    dialogText: string;
    confirm: string;
    keep: string;
    endedReason: string;
  };
  premises: string;
  earliest: string;
  initialDate: string;
  initialReason: string;
  dateError: string | null;
  ended: boolean;
  action: (formData: FormData) => Promise<void>;
  cancelHref: string;
  phone: boolean;
  locale: Locale;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [date, setDate] = useState<string | null>(initialDate !== "" ? initialDate : null);
  /** The date as the field holds it when End the service is pressed: the confirmation names the instant asked for. */
  function confirm() {
    const field = form.current?.elements.namedItem("requested_effective_date");
    const typed = field instanceof HTMLInputElement ? field.value : "";
    setDate(typed.trim() === "" ? null : readDate(typed));
    setConfirming(true);
  }
  const [confirming, setConfirming] = useState(false);
  const [sending, startSending] = useTransition();
  const effective = format.date(`${date ?? earliest}T12:00:00+07:00`, locale) ?? "";
  const end = (
    <Button variant="secondary" size="md" fullWidth={phone} disabled={ended} {...(ended ? { disabledReason: copy.endedReason } : {})} onClick={confirm} locale={locale}>
      {copy.end}
    </Button>
  );
  const cancel = (
    <Button variant="quiet" size="md" fullWidth={phone} href={cancelHref} locale={locale}>
      {copy.cancel}
    </Button>
  );
  return (
    <form ref={form} action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <Columns layout="halves" single={phone}>
        <Panel title={copy.whenTitle} level={2} gap="lg" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          <DateField
            label={copy.endOn}
            name="requested_effective_date"
            helper={copy.endHelp}
            value={initialDate}
            min={earliest}
            {...(dateError !== null ? { error: dateError } : {})}
            disabled={ended}
            density="portal"
            locale={locale}
          />
          <TextField label={copy.reason} name="reason" value={initialReason} helper={copy.reasonHelp} disabled={ended} density="portal" locale={locale} />
        </Panel>
        <Panel title={copy.doesTitle} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          <ItemList items={copy.does.map((line, index) => ({ key: `e${String(index)}`, title: line }))} readOnly density="portal" label={copy.doesTitle} locale={locale} />
        </Panel>
      </Columns>
      {phone ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {end}
          {cancel}
        </div>
      ) : (
        <ButtonRow>
          {end}
          {cancel}
        </ButtonRow>
      )}
      {confirming ? (
        <Dialog
          title={copy.dialogTitle.replace("{premises}", premises).replace("{date}", effective)}
          description={copy.dialogText}
          primaryAction={{ label: copy.confirm, variant: "danger", loading: sending, onClick: () => startSending(() => form.current?.requestSubmit()) }}
          secondaryAction={{ label: copy.keep, onClick: () => setConfirming(false) }}
          onClose={() => setConfirming(false)}
          open
          placement="viewport"
          density="portal"
          locale={locale}
        />
      ) : null}
    </form>
  );
}
