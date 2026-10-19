"use client";

import { useState } from "react";
import { ChoiceList, Divider } from "@/components/r1";
import { Text } from "@/components/Text";
import type { Locale } from "@/lib/i18n/translate";
import { SubmitButton } from "./SubmitButton";

/**
 * SCR-VEN-05's format and its two acts: Download the document shown, and Issue a new document, which replaces it.
 * Both send the format chosen; one left out is refused beside the field (FIELD_MISSING).
 */
export function DocumentActions({
  copy,
  initialFormat,
  formatError,
  download,
  issue,
  issueBlocked,
  locale,
}: {
  copy: { format: string; download: string; replace: string; issue: string };
  initialFormat: "pdf" | "html" | null;
  formatError: string | null;
  /** Null while no document is shown. */
  download: ((formData: FormData) => Promise<void>) | null;
  issue: (formData: FormData) => Promise<void>;
  /** Why no document can be issued now (ENTITLEMENT_PENDING's sentence). */
  issueBlocked: string | null;
  locale: Locale;
}) {
  const [format, setFormat] = useState(initialFormat ?? "");
  const chosen = <input type="hidden" name="format" value={format} />;
  return (
    <>
      <ChoiceList
        legend={copy.format}
        name="format_choice"
        required
        options={[
          { value: "pdf", label: "PDF" },
          { value: "html", label: "HTML" },
        ]}
        {...(format !== "" ? { value: format } : {})}
        {...(formatError !== null && format === "" ? { error: formatError } : {})}
        layout="inline"
        onChange={(event) => setFormat((event as { target: { value: string } }).target.value)}
        density="portal"
        locale={locale}
      />
      {download !== null ? (
        <form action={download}>
          {chosen}
          <SubmitButton variant="secondary" size="md" icon="download" fullWidth locale={locale}>
            {copy.download}
          </SubmitButton>
        </form>
      ) : null}
      <Divider />
      <Text size="base" tone="secondary">
        {copy.replace}
      </Text>
      <form action={issue}>
        {chosen}
        <SubmitButton variant="primary" size="md" fullWidth disabled={issueBlocked !== null} {...(issueBlocked !== null ? { disabledReason: issueBlocked } : {})} locale={locale}>
          {copy.issue}
        </SubmitButton>
      </form>
    </>
  );
}
