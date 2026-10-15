"use client";

import { useState, type ReactNode } from "react";
import { Button, ButtonRow, Checkbox, Panel } from "@/components/r1";
import { Text } from "@/components/Text";
import type { Locale } from "@/lib/i18n/translate";
import { SubmitButton } from "./SubmitButton";

export interface AttestCopy {
  confirmTitle: string;
  box1: string;
  box1Help: string;
  box2: string;
  box2Help: string;
  recordLine: string;
  confirm: string;
  sending: string;
  offUntick: string;
  back: string;
}

/**
 * SCR-REG-06's form: the two confirmations, and Confirm and send, which waits until both are ticked. The
 * page puts what happens after sending and any refusal between the boxes and the button, as `children`.
 */
export function AttestForm({
  copy,
  action,
  confirmed,
  changeDutyAcknowledged,
  box2Error,
  variant,
  pending,
  backHref,
  phone,
  locale,
  children,
}: {
  copy: AttestCopy;
  action: (formData: FormData) => Promise<void>;
  confirmed: boolean;
  changeDutyAcknowledged: boolean;
  box2Error: string | null;
  /** Secondary when a refusal above offers the way on instead. */
  variant: "primary" | "secondary";
  pending: boolean;
  backHref: string;
  phone: boolean;
  locale: Locale;
  children: ReactNode;
}) {
  const [box1, setBox1] = useState(confirmed);
  const [box2, setBox2] = useState(changeDutyAcknowledged);
  const ticked = (set: (value: boolean) => void) => (event: unknown) => {
    const target = (event as { target?: { checked?: unknown } }).target;
    set(target?.checked === true);
  };
  const off = !box1 || !box2;
  return (
    <form action={action}>
      <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        <Panel variant="plain" level={2} title={copy.confirmTitle} density="portal" locale={locale}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Checkbox
              label={copy.box1}
              helper={copy.box1Help}
              checked={box1}
              onChange={ticked(setBox1)}
              required
              name="confirmed"
              layout="card"
              density="portal"
              locale={locale}
            />
            <Checkbox
              label={copy.box2}
              helper={copy.box2Help}
              checked={box2}
              onChange={ticked(setBox2)}
              {...(box2Error !== null ? { error: box2Error } : {})}
              required
              name="change_duty_acknowledged"
              layout="card"
              density="portal"
              locale={locale}
            />
          </div>
          <Text size="sm" tone="secondary">
            {copy.recordLine}
          </Text>
        </Panel>
        {children}
        <ButtonRow>
          <SubmitButton
            variant={variant}
            size="md"
            pending={pending}
            loadingLabel={copy.sending}
            disabled={off}
            {...(off ? { disabledReason: copy.offUntick } : {})}
            fullWidth={phone}
            locale={locale}
          >
            {copy.confirm}
          </SubmitButton>
          <Button variant="quiet" size="md" href={backHref} fullWidth={phone} locale={locale}>
            {copy.back}
          </Button>
        </ButtonRow>
      </Panel>
    </form>
  );
}
