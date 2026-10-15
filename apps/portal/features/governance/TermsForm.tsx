"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, DateField, Dialog } from "@/components/r1";
import type { TermsVersion } from "@/lib/api/governance";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { day, govTranslator } from "./copy";

type Confirming = "on-arrival" | "by-person" | null;

/**
 * SCR-GOV-15's form: the date the terms take effect and Record the terms, confirmed in a dialog that restates the
 * retained right with the date chosen. The retained right is sent as true and is no control: there is nothing to
 * choose. A date left empty is sent as it is, and the server's refusal comes back under the field.
 *
 * The dialog the person opens covers the window; the one the canvas draws open on arrival (the confirm view)
 * stays in the page, since a dialog portalled to the window exists only in the browser.
 */
export function TermsForm({
  action,
  shortName,
  version,
  entered,
  error,
  idempotencyKey,
  confirmOnArrival,
  review,
  phone,
  locale,
}: {
  action: (formData: FormData) => Promise<void>;
  /** The organisation as the dialog's sentence names it. */
  shortName: string;
  version: TermsVersion;
  /** The date the form opens with, as an ISO date. */
  entered: string | null;
  /** The refusal's sentence for the date, when the last attempt was refused for it. */
  error: string | null;
  idempotencyKey: string;
  confirmOnArrival: boolean;
  /** A state the canvas drew, opened with `?view=`: drawn to be looked at, it sends nothing. */
  review: boolean;
  phone: boolean;
  locale: Locale;
}) {
  const t = govTranslator(locale);
  const form = useRef<HTMLFormElement>(null);
  const [from, setFrom] = useState<string | null>(entered);
  const [confirming, setConfirming] = useState<Confirming>(confirmOnArrival ? "on-arrival" : null);
  const send = () => {
    if (!review) form.current?.requestSubmit();
  };
  // With no date there is nothing to restate: the form goes as it is and the server names the field.
  const record = () => (from === null ? send() : setConfirming("by-person"));

  return (
    <form ref={form} action={action} noValidate>
      <input type="hidden" name="terms_version" value={version.version} />
      <input type="hidden" name="direct_licensing_retained" value="true" />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <DateField
          label={t("gov15.from")}
          name="effective_from"
          {...(entered !== null ? { value: entered } : {})}
          required
          onChange={(value) => setFrom(typeof value === "string" ? value : null)}
          {...(error !== null ? { error } : {})}
          density="portal"
          locale={locale}
        />
        <Controls
          onRecord={record}
          confirming={confirming}
          onConfirm={send}
          onCancel={() => setConfirming(null)}
          title={t("gov15.dlgTitle", { version: version.version })}
          text={from !== null ? t("gov15.dlgText", { org: shortName, date: day(from, locale) }) : ""}
          phone={phone}
          t={t}
          locale={locale}
        />
      </div>
    </form>
  );
}

/** Record the terms and its confirmation, inside the form so both show the act in flight. */
function Controls({
  onRecord,
  confirming,
  onConfirm,
  onCancel,
  title,
  text,
  phone,
  t,
  locale,
}: {
  onRecord: () => void;
  confirming: Confirming;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  text: string;
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const { pending } = useFormStatus();
  return (
    <>
      <div style={{ display: "flex" }}>
        <Button variant="primary" size="md" fullWidth={phone} loading={pending} onClick={onRecord} locale={locale}>
          {t("gov15.record")}
        </Button>
      </div>
      {confirming !== null ? (
        <Dialog
          title={title}
          description={text}
          primaryAction={{ label: t("gov15.dlgYes"), loading: pending, onClick: onConfirm }}
          secondaryAction={{ label: t("gov15.dlgNo"), onClick: onCancel }}
          onClose={onCancel}
          open
          placement={confirming === "on-arrival" ? "overlay" : "viewport"}
          density="portal"
          locale={locale}
        />
      ) : null}
    </>
  );
}
