"use client";

import { useState } from "react";
import { Button, Columns, DateField, Divider, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Field = "kid" | "key_handle" | "public_key_jwk" | "valid_from";

interface Props {
  values: Readonly<Partial<Record<Field, string>>>;
  errors: Partial<Record<Field, string>>;
  /** The first day the date field offers: a key starts signing ahead, never before today. */
  today: string;
  words: {
    kid: string;
    kidHelp: string;
    handle: string;
    handleHelp: string;
    jwk: string;
    jwkHelp: string;
    from: string;
    fromHelp: string;
    register: string;
    registerWhy: string;
  };
  locale: Locale;
}

/**
 * SCR-CER-10's Register a key: the key id, the key service's handle, the public key and when it starts signing.
 * Register the key stays unavailable, with its reason, until every field is filled; the server checks the id is
 * new, the start is ahead and the public key is P-256.
 */
export function KeyRegistration({ values, errors, today, words, locale }: Props) {
  const [kid, setKid] = useState(values.kid ?? "");
  const [handle, setHandle] = useState(values.key_handle ?? "");
  const [jwk, setJwk] = useState(values.public_key_jwk ?? "");
  const [from, setFrom] = useState(values.valid_from ?? "");
  // The field keeps what the person picks; it is given only the value the form came back with.
  const sent = values.valid_from ?? "";
  const [date, time] = sent.length >= 16 ? [sent.slice(0, 10), sent.slice(11, 16)] : [undefined, undefined];
  const complete = kid.trim() !== "" && handle.trim() !== "" && jwk.trim() !== "" && from !== "";

  return (
    <>
      <Columns layout="halves" gap={4}>
        <TextField
          label={words.kid}
          helper={words.kidHelp}
          name="kid"
          value={kid}
          onChange={setKid}
          {...(errors.kid !== undefined ? { error: errors.kid } : {})}
          mono
          required
          width="100%"
          density="console"
          locale={locale}
        />
        <TextField
          label={words.handle}
          helper={words.handleHelp}
          name="key_handle"
          value={handle}
          onChange={setHandle}
          {...(errors.key_handle !== undefined ? { error: errors.key_handle } : {})}
          mono
          required
          width="100%"
          density="console"
          locale={locale}
        />
        <div style={{ gridColumn: "span 2", minWidth: 0 }}>
          <TextField
            label={words.jwk}
            helper={words.jwkHelp}
            name="public_key_jwk"
            value={jwk}
            onChange={setJwk}
            {...(errors.public_key_jwk !== undefined ? { error: errors.public_key_jwk } : {})}
            mono
            multiline
            rows={4}
            required
            width="100%"
            density="console"
            locale={locale}
          />
        </div>
        <DateField
          label={words.from}
          helper={words.fromHelp}
          name="valid_from"
          withTime
          today={today}
          {...(date !== undefined ? { value: date } : {})}
          {...(time !== undefined ? { time } : {})}
          onChange={(value) => setFrom(typeof value === "string" ? value : "")}
          {...(errors.valid_from !== undefined ? { error: errors.valid_from } : {})}
          required
          density="console"
          locale={locale}
        />
      </Columns>
      <Divider />
      <div>
        <Button variant="primary" size="sm" type="submit" {...(!complete ? { disabled: true, disabledReason: words.registerWhy } : {})} locale={locale}>
          {words.register}
        </Button>
      </div>
    </>
  );
}
