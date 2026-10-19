"use client";

import { useState } from "react";
import { Button, ButtonRow, DateField, Panel, Select, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { ConfirmSubmit } from "./ConfirmSubmit";

/** A fact an officer may correct: its code, its name, its value now in words, and how a new value is entered. */
export interface CorrectableFact {
  code: string;
  label: string;
  current: string;
  /** A whole number with its unit ({n} in the unit's words), a choice, or a date. */
  entry: { kind: "number"; unit: string; suffix: string; helper: string } | { kind: "choice"; options: { value: string; label: string }[] } | { kind: "date" };
}

export interface CorrectionWords {
  open: string;
  fact: string;
  /** Carries {fact}. */
  title: string;
  /** Carries {value}. */
  description: string;
  value: string;
  document: string;
  documentHelp: string;
  documentNone: string;
  submit: string;
  cancel: string;
  /** Carries {fact}, {old} and {new}. */
  confirmTitle: string;
  confirmText: string;
  /** Carries {new}. */
  confirmPrimary: string;
  valueWhy: string;
}

/**
 * SCR-REG-10's Correct a fact, opened in place under the facts: the fact, its new value and the document it rests
 * on, if any. The correction asks first, naming the fact, the value as declared and the new one; the declared
 * value stays as the earlier version.
 */
export function CorrectionPanel({
  formId,
  facts,
  documents,
  words,
  heldBy,
  initial,
  error,
  locale,
}: {
  formId: string;
  facts: readonly CorrectableFact[];
  documents: readonly { value: string; label: string }[];
  words: CorrectionWords;
  /** Why no fact can be corrected now (convention 14); null when one can. */
  heldBy: string | null;
  /** The last refused attempt, opened again with its values. */
  initial: { code: string; value: string; document: string } | null;
  error: string | null;
  locale: Locale;
}) {
  const [open, setOpen] = useState(initial !== null);
  const [code, setCode] = useState(initial?.code ?? facts[0]?.code ?? "");
  const [value, setValue] = useState(initial?.value ?? "");
  const fact = facts.find((entry) => entry.code === code) ?? null;
  if (!open || fact === null) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "var(--space-2)", maxWidth: "var(--container-md)" }}>
        <Button variant="secondary" size="sm" {...(heldBy !== null || fact === null ? { disabled: true, disabledReason: heldBy ?? "" } : {})} onClick={() => setOpen(true)} locale={locale}>
          {words.open}
        </Button>
      </div>
    );
  }
  const entry = fact.entry;
  const newWords =
    entry.kind === "number" ? entry.unit.replace("{n}", value.trim()) : entry.kind === "choice" ? (entry.options.find((option) => option.value === value)?.label ?? value) : value.trim();
  return (
    <Panel variant="sunken" title={words.title.replace("{fact}", fact.label)} description={words.description.replace("{value}", fact.current)} level={3} compact locale={locale}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "var(--space-4)" }}>
        {facts.length > 1 ? (
          <Select
            label={words.fact}
            name="fact_code"
            options={facts.map((option) => ({ value: option.code, label: option.label }))}
            value={code}
            onChange={(next) => {
              setCode(next);
              setValue("");
            }}
            density="console"
            width="var(--space-72)"
            locale={locale}
          />
        ) : (
          <input type="hidden" name="fact_code" value={code} />
        )}
        {entry.kind === "number" ? (
          <TextField
            label={words.value}
            name="value"
            value={value}
            onChange={setValue}
            suffix={entry.suffix}
            helper={entry.helper}
            inputMode="numeric"
            required
            {...(error !== null ? { error } : {})}
            density="console"
            width="var(--space-56)"
            locale={locale}
          />
        ) : entry.kind === "choice" ? (
          <Select
            label={words.value}
            name="value"
            options={entry.options}
            value={value}
            onChange={setValue}
            required
            {...(error !== null ? { error } : {})}
            density="console"
            width="var(--space-72)"
            locale={locale}
          />
        ) : (
          <DateField
            label={words.value}
            name="value"
            value={value}
            onChange={(next) => setValue(typeof next === "string" ? next : "")}
            required
            {...(error !== null ? { error } : {})}
            density="console"
            width="var(--space-56)"
            locale={locale}
          />
        )}
        <Select
          label={words.document}
          name="evidence_item_id"
          helper={words.documentHelp}
          options={[{ value: "none", label: words.documentNone }, ...documents]}
          value={initial?.document !== undefined && initial.document !== "" ? initial.document : "none"}
          density="console"
          width="var(--space-80)"
          locale={locale}
        />
      </div>
      <ButtonRow>
        <ConfirmSubmit
          formId={formId}
          label={words.submit}
          disabledReason={value.trim() === "" ? words.valueWhy : null}
          dialog={{
            title: words.confirmTitle.replace("{fact}", fact.label).replace("{old}", fact.current).replace("{new}", newWords),
            description: words.confirmText,
            confirm: words.confirmPrimary.replace("{new}", newWords),
            back: words.cancel,
          }}
          locale={locale}
        />
        <Button variant="quiet" size="sm" onClick={() => setOpen(false)} locale={locale}>
          {words.cancel}
        </Button>
      </ButtonRow>
    </Panel>
  );
}
