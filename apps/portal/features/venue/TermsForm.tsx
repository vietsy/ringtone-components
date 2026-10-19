"use client";

import { useState, type ReactNode } from "react";
import { Button, ButtonRow, Checkbox } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { SubmitButton } from "./SubmitButton";

/**
 * SCR-VEN-02's attestation and Accept and start the service. The box is unticked each time the page opens, and the
 * acceptance waits for it: the attestation is the confirmation, so there is no dialog. With it go the terms version,
 * the terms document and the digest of the text rendered, which is what the person attests to.
 */
export function TermsForm({
  copy,
  terms,
  initiallyTicked,
  attestError,
  blocked,
  acceptVariant,
  refusal,
  action,
  backHref,
  phone,
  locale,
}: {
  copy: { attest: string; attestHint: string; accept: string; untick: string; back: string };
  terms: { version: string; documentId: string; digest: string };
  initiallyTicked: boolean;
  /** ATTESTATION_NOT_CONFIRMED's sentence beside the box, after a refused acceptance. */
  attestError: string | null;
  /** Why nothing can be accepted whatever is ticked: the baseline refused, the service no longer pending. */
  blocked: { reason: string; attestOff: boolean } | null;
  acceptVariant: "primary" | "secondary";
  /** The refusal above the action row, drawn by the page. */
  refusal: ReactNode;
  action: (formData: FormData) => Promise<void>;
  backHref: string;
  phone: boolean;
  locale: Locale;
}) {
  const [ticked, setTicked] = useState(initiallyTicked);
  const reason = blocked?.reason ?? (ticked ? null : copy.untick);
  const accept = (
    <SubmitButton variant={acceptVariant} size="md" fullWidth={phone} disabled={reason !== null} {...(reason !== null ? { disabledReason: reason } : {})} locale={locale}>
      {copy.accept}
    </SubmitButton>
  );
  const back = (
    <Button variant="quiet" size="md" href={backHref} fullWidth={phone} locale={locale}>
      {copy.back}
    </Button>
  );
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <input type="hidden" name="terms_version" value={terms.version} />
      <input type="hidden" name="terms_document_id" value={terms.documentId} />
      <input type="hidden" name="shown_text_digest" value={terms.digest} />
      <Checkbox
        label={copy.attest}
        hint={copy.attestHint}
        name="attestation_confirmed"
        value="true"
        checked={ticked}
        {...(attestError !== null ? { error: attestError } : {})}
        required
        disabled={blocked?.attestOff ?? false}
        onChange={(event) => setTicked((event as { target: { checked: boolean } }).target.checked)}
        density="portal"
        layout="card"
        locale={locale}
      />
      <section aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {refusal}
      </section>
      {phone ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {accept}
          {back}
        </div>
      ) : (
        <ButtonRow>
          {accept}
          {back}
        </ButtonRow>
      )}
    </form>
  );
}
