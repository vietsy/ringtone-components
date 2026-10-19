"use client";

import { useRef, useState } from "react";
import { ButtonRow, DateField, Dialog, FactList, TextField } from "@/components/r1";
import type { CredentialAct } from "@/lib/api/player";
import type { Locale } from "@/lib/i18n/translate";
import { actOnCredential } from "./actions";
import { ShortcutButton } from "./ShortcutButton";

type Fact = { label: string; value: unknown; kind?: "datetime" | "count" };

export interface ActWords {
  button: string;
  title: string;
  text: string;
  facts: readonly Fact[];
  field: string;
  confirm: string;
  keep: string;
}

/**
 * SCR-IAM-08's three acts. Each opens its own confirmation, which asks for the reason (a cause, for a revocation) that
 * stays on the device's record; Revoke also asks from when it takes effect, not before the pairing. The dialogue
 * says in words that revocation cannot be undone and that the evidence is kept. A reason left out is refused by the
 * API and the dialogue opens again with the refusal on the field.
 */
export function CredentialActions({
  credential,
  acts,
  disabledReason,
  reinstateReason,
  open,
  error,
  initial,
  revoke,
  words,
  locale,
}: {
  credential: string;
  /** The acts the state allows: suspend while active, reinstate while suspended, revoke until revoked. */
  acts: readonly CredentialAct[];
  /** Why the reader may not act at all (AUTHORITY_NOT_IN_FORCE). */
  disabledReason: string | null;
  /** Why Reinstate is unavailable (the premises relationship has ended). */
  reinstateReason: string | null;
  /** The act whose dialogue reopens with a refusal on its field. */
  open: CredentialAct | null;
  /** The refusal on a field of the reopened dialogue: the reason (or cause), or the effective time. */
  error: { text: string; on: "text" | "date" } | null;
  initial: { text: string; effectiveAt: string } | null;
  revoke: { min: string; helper: string; label: string };
  words: Readonly<Record<CredentialAct, ActWords>> & { reasonHelp: string };
  locale: Locale;
}) {
  const [act, setAct] = useState<CredentialAct | null>(open);
  const [text, setText] = useState(initial?.text ?? "");
  const [effectiveAt, setEffectiveAt] = useState(initial?.effectiveAt ?? "");
  const [sending, setSending] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const chosen = act === null ? null : words[act];
  const icons: Readonly<Record<CredentialAct, string>> = { suspend: "pause", reinstate: "refresh-cw", revoke: "ban" };
  const keys: Readonly<Record<CredentialAct, string>> = { suspend: "Alt+U", reinstate: "Alt+R", revoke: "Alt+V" };

  return (
    <>
      <ButtonRow>
        {acts.map((one) => {
          const why = disabledReason ?? (one === "reinstate" ? reinstateReason : null);
          return (
            <ShortcutButton
              key={one}
              variant="secondary"
              size="sm"
              icon={icons[one]}
              shortcut={keys[one]}
              {...(why !== null ? { disabled: true, disabledReason: why } : {})}
              onClick={() => {
                setText("");
                setEffectiveAt("");
                setAct(one);
              }}
              locale={locale}
            >
              {words[one].button}
            </ShortcutButton>
          );
        })}
      </ButtonRow>
      {act !== null ? (
        <form ref={form} action={actOnCredential.bind(null, credential, act)} style={{ display: "none" }}>
          <input type="hidden" name={act === "revoke" ? "revocation_cause" : "reason"} value={text} />
          <input type="hidden" name="revoked_at" value={act === "revoke" ? effectiveAt : ""} />
        </form>
      ) : null}
      {act !== null && chosen !== null ? (
        <Dialog
          title={chosen.title}
          description={chosen.text}
          primaryAction={{
            label: chosen.confirm,
            variant: act === "revoke" ? "danger" : "primary",
            loading: sending,
            onClick: () => {
              setSending(true);
              form.current?.requestSubmit();
            },
          }}
          secondaryAction={{ label: chosen.keep, onClick: () => setAct(null) }}
          onClose={() => setAct(null)}
          open
          placement="viewport"
          align="start"
          autoFocus={false}
          density="console"
          width="var(--container-xl)"
          locale={locale}
        >
          <FactList items={[...chosen.facts]} density="console" locale={locale} />
          <TextField
            label={chosen.field}
            helper={words.reasonHelp}
            value={text}
            onChange={setText}
            required
            multiline
            rows={3}
            {...(act === open && error?.on === "text" ? { error: error.text } : {})}
            density="console"
            locale={locale}
          />
          {act === "revoke" ? (
            <DateField
              withTime
              label={revoke.label}
              helper={revoke.helper}
              min={revoke.min}
              {...(effectiveAt !== "" ? { value: effectiveAt.slice(0, 10), time: effectiveAt.slice(11, 16) } : {})}
              onChange={(value) => setEffectiveAt(typeof value === "string" ? value : "")}
              {...(act === open && error?.on === "date" ? { error: error.text } : {})}
              density="console"
              locale={locale}
            />
          ) : null}
        </Dialog>
      ) : null}
    </>
  );
}
