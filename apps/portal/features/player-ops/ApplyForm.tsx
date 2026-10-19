"use client";

import { useRef, useState } from "react";
import { Banner, Button, Dialog, Select, TextField } from "@/components/r1";
import type { ApplyInput } from "@/lib/api/player";
import type { Locale } from "@/lib/i18n/translate";
import { applyForCertification } from "./actions";

/**
 * SCR-PLR-10's Apply, open to any supplier with no account: the supplier's name and the published criteria version the
 * application is assessed against, the one in effect offered first. A refusal names what is wrong and reopens the
 * dialogue with what was typed.
 */
export function ApplyForm({
  versions,
  initial,
  refusal,
  nameError,
  fullWidth,
  words,
  locale,
}: {
  versions: readonly { value: string; label: string }[];
  initial: ApplyInput | null;
  refusal: { code: string; title: string; text: string } | null;
  nameError: string | null;
  fullWidth: boolean;
  words: { apply: string; title: string; text: string; applicant: string; applicantHelp: string; version: string; chooseVersion: string; submit: string; cancel: string };
  locale: Locale;
}) {
  const [open, setOpen] = useState(initial !== null);
  const [applicant, setApplicant] = useState(initial?.applicant ?? "");
  const [version, setVersion] = useState(initial?.version ?? versions[0]?.value ?? "");
  const [sending, setSending] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  return (
    <>
      <Button variant="primary" size="md" fullWidth={fullWidth} onClick={() => setOpen(true)} locale={locale}>
        {words.apply}
      </Button>
      <form ref={form} action={applyForCertification} style={{ display: "none" }}>
        <input type="hidden" name="applicant_name" value={applicant} />
        <input type="hidden" name="assurance_policy_version_id" value={version} />
      </form>
      {open ? (
        <Dialog
          title={words.title}
          description={words.text}
          primaryAction={{
            label: words.submit,
            variant: "primary",
            loading: sending,
            onClick: () => {
              setSending(true);
              form.current?.requestSubmit();
            },
          }}
          secondaryAction={{ label: words.cancel, onClick: () => setOpen(false) }}
          onClose={() => setOpen(false)}
          open
          placement="viewport"
          align="start"
          autoFocus={false}
          density="portal"
          width="var(--container-xl)"
          locale={locale}
        >
          {refusal !== null ? (
            <Banner family="neutral" title={refusal.title} code={refusal.code} compact density="portal" locale={locale}>
              {refusal.text}
            </Banner>
          ) : null}
          <TextField
            label={words.applicant}
            helper={words.applicantHelp}
            value={applicant}
            onChange={setApplicant}
            required
            {...(nameError !== null ? { error: nameError } : {})}
            density="portal"
            locale={locale}
          />
          <Select
            label={words.version}
            options={[...versions]}
            {...(version !== "" ? { value: version } : {})}
            placeholder={words.chooseVersion}
            onChange={setVersion}
            required
            density="portal"
            locale={locale}
          />
        </Dialog>
      ) : null}
    </>
  );
}
