"use client";

import { useState, type ReactNode } from "react";
import { Button, ButtonRow, Divider, Select } from "@/components/r1";
import { Text } from "@/components/Text";
import type { Locale } from "@/lib/i18n/translate";
import { SubmitButton } from "./SubmitButton";

/**
 * SCR-VEN-01's form: the premises to enrol and Enrol this premises, unavailable until a premises is chosen. The
 * result panel is the live region: it holds the last answer for the premises it was given about, and the idle line
 * once another premises is chosen, so a refusal is never read against the wrong premises.
 */
export function EnrolForm({
  copy,
  options,
  chosen,
  answeredFor,
  answer,
  action,
  backHref,
  phone,
  locale,
}: {
  copy: { premises: string; choose: string; help: string; resultLabel: string; idle: string; enrol: string; chooseFirst: string; back: string };
  options: { value: string; label: string }[];
  chosen: string | null;
  /** The premises the answer below is about. */
  answeredFor: string | null;
  answer: ReactNode;
  action: (formData: FormData) => Promise<void>;
  backHref: string;
  phone: boolean;
  locale: Locale;
}) {
  const [value, setValue] = useState(chosen ?? "");
  const unchosen = value === "";
  const showAnswer = answer !== null && value === answeredFor;
  const enrol = (
    <SubmitButton variant="primary" size="md" fullWidth={phone} disabled={unchosen} {...(unchosen ? { disabledReason: copy.chooseFirst } : {})} locale={locale}>
      {copy.enrol}
    </SubmitButton>
  );
  const back = (
    <Button variant="quiet" size="md" href={backHref} fullWidth={phone} locale={locale}>
      {copy.back}
    </Button>
  );
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <Select
        label={copy.premises}
        name="premises_id"
        helper={copy.help}
        options={options}
        {...(value !== "" ? { value } : {})}
        placeholder={copy.choose}
        required
        onChange={(next) => setValue(next)}
        density="portal"
        locale={locale}
      />
      <Divider />
      <section aria-live="polite" aria-label={copy.resultLabel} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {showAnswer ? answer : <Text size="base" tone="secondary">{copy.idle}</Text>}
      </section>
      <Divider />
      {phone ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {enrol}
          {back}
        </div>
      ) : (
        <ButtonRow>
          {enrol}
          {back}
        </ButtonRow>
      )}
    </form>
  );
}
