"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ChoiceList, Dialog, FactList, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { revokePairing } from "./actions";

/**
 * SCR-IAM-06's premises choice: the premises a code is issued for, and whose codes the list below shows, so choosing
 * another reloads the list for it.
 */
export function PairingPremises({
  legend,
  options,
  chosen,
  hrefFor,
  locale,
}: {
  legend: string;
  options: { value: string; label: string }[];
  chosen: string;
  hrefFor: Readonly<Record<string, Route>>;
  locale: Locale;
}) {
  const router = useRouter();
  return (
    <ChoiceList
      legend={legend}
      options={options}
      value={chosen}
      layout="cards"
      required
      name="premises_id"
      onChange={(event) => {
        const href = hrefFor[(event as { target: { value: string } }).target.value];
        if (href !== undefined) router.replace(href, { scroll: false });
      }}
      density="premises"
      locale={locale}
    />
  );
}

/**
 * SCR-IAM-06's Revoke: once revoked no device can pair with the code. It asks first, naming the code by when it was
 * issued, and the reason is required: it stays with the code's record.
 */
export function RevokePairing({
  premises,
  authorisation,
  copy,
  facts,
  phone,
  locale,
}: {
  premises: string;
  authorisation: string;
  copy: { revoke: string; title: string; text: string; reason: string; reasonHelp: string; reasonMissing: string; confirm: string; keep: string };
  facts: { label: string; value: string; kind?: "datetime" }[];
  phone: boolean;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, startBusy] = useTransition();
  const missing = reason.trim() === "";
  return (
    <>
      <Button variant="secondary" size="md" icon="ban" fullWidth={phone} onClick={() => setOpen(true)} locale={locale}>
        {copy.revoke}
      </Button>
      {open ? (
        <Dialog
          title={copy.title}
          description={copy.text}
          primaryAction={{
            label: copy.confirm,
            variant: "danger",
            loading: busy,
            disabled: missing,
            ...(missing ? { disabledReason: copy.reasonMissing } : {}),
            onClick: () => {
              const form = new FormData();
              form.set("reason", reason);
              startBusy(() => revokePairing(premises, authorisation, form));
            },
          }}
          secondaryAction={{ label: copy.keep, onClick: () => setOpen(false) }}
          onClose={() => setOpen(false)}
          open
          placement="viewport"
          autoFocus={false}
          density="portal"
          width="var(--container-xl)"
          locale={locale}
        >
          <FactList items={facts} locale={locale} />
          <TextField label={copy.reason} helper={copy.reasonHelp} name="reason" value={reason} onChange={setReason} required multiline rows={2} density="portal" locale={locale} />
        </Dialog>
      ) : null}
    </>
  );
}
