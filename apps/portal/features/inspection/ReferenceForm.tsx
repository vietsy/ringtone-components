"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Banner, Button, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import type { ActState } from "./actions";

interface Props {
  action: (previous: ActState, form: FormData) => Promise<ActState>;
  id?: string;
  field: {
    label: string;
    name: string;
    defaultValue: string;
    placeholder?: string;
    helper?: string;
    info?: string;
    maxLength?: number;
    /** The field cannot be used at all, for this reason. */
    disabledReason?: string;
  };
  button: { label: string; variant: "primary" | "secondary"; size: "md" | "lg"; icon: string };
  /** Why the button waits while nothing is typed. */
  emptyReason: string;
  /** The act cannot be made at all, for this reason, whatever is typed. */
  blockedReason: string | null;
  /** The words for a failure to act; the code and trace come from the action. */
  failure: { title: string; text: string };
  /** Drawn between the field and the button. */
  children?: ReactNode;
  locale: Locale;
}

/**
 * A reference typed and sent: SCR-VER-17's record reference and SCR-VER-01's reference. The button waits, with its
 * reason said, until something is typed, as the boards draw it; a failure to act is said above the field with its
 * code, never as an empty answer.
 */
export function ReferenceForm({ action, id, field, button, emptyReason, blockedReason, failure, children, locale }: Props) {
  const [state, formAction, pending] = useActionState(action, { failure: null });
  const [typed, setTyped] = useState(field.defaultValue);
  const waiting = typed.trim() === "";
  const reason = blockedReason ?? (waiting ? emptyReason : null);

  return (
    <form action={formAction} {...(id !== undefined ? { id } : {})} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {state.failure !== null && (
        <Banner family="attention" title={failure.title} code={state.failure.code} density="portal" locale={locale}>
          {failure.text}
        </Banner>
      )}
      <TextField
        label={field.label}
        name={field.name}
        mono
        value={typed}
        onChange={(value) => setTyped(value)}
        {...(field.placeholder !== undefined ? { placeholder: field.placeholder } : {})}
        {...(field.helper !== undefined ? { helper: field.helper } : {})}
        {...(field.info !== undefined ? { info: field.info } : {})}
        {...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {})}
        {...(field.disabledReason !== undefined ? { disabled: true, disabledReason: field.disabledReason } : {})}
        density="portal"
        locale={locale}
      />
      {children}
      <Button
        type="submit"
        variant={button.variant}
        size={button.size}
        icon={button.icon}
        fullWidth
        loading={pending}
        {...(reason !== null ? { disabled: true, disabledReason: reason } : {})}
        locale={locale}
      >
        {button.label}
      </Button>
    </form>
  );
}
