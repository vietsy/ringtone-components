"use client";

import { useState, type ReactNode } from "react";
import { Button, ButtonRow, ChoiceList, Columns, DateField, Select, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Act = "NO_CHANGE" | "SUSPEND" | "REVOKE" | "CANCEL" | "REINSTATE";

/** The acts that rest on a ground of the policy (`DR-40`). */
const ENFORCEMENT: readonly Act[] = ["SUSPEND", "REVOKE", "CANCEL"];

interface Props {
  acts: readonly { value: Act; label: string }[];
  /** The policy's grounds with the acts each permits and the condition that reinstates a suspension on it; null with no policy to read. */
  grounds: readonly { value: string; label: string; acts: readonly Act[]; condition: string | null }[] | null;
  /** Said in place of the ground list: no policy in force, or the policy unreadable. */
  groundNotice: ReactNode;
  /** The reinstatement conditions the suspension states, each addressed in its own field. */
  conditions: readonly { code: string; label: string }[];
  values: { act: Act; ground: string; reason: string; evidence: string; effective: string; conditions: Readonly<Record<string, string>> };
  errors: Partial<Record<"act" | "ground" | "reason" | "evidence" | "effective" | "conditions", string>>;
  /** Propose cannot be sent at all: the policy could not be read. */
  blocked: string | null;
  leaveHref: string;
  words: {
    act: string;
    ground: string;
    groundPh: string;
    reason: string;
    reasonHelp: string;
    evidence: string;
    evidenceHelp: string;
    evidenceOptional: string;
    effective: string;
    effectiveHelp: string;
    condHelp: string;
    propose: string;
    leave: string;
    whyGround: string;
    whyEvidence: string;
    whyReason: string;
    whyConditions: string;
    whyNoAct: string;
  };
  locale: Locale;
}

/**
 * SCR-CER-05's proposal. Choosing an act changes what it asks for at once, as on the board: a ground of the policy for
 * suspend, revoke and cancel, with the condition that would reinstate the record; how each condition is met for a
 * reinstatement; evidence for every act but no change. Propose stays unavailable, with its reason, until the
 * proposal is whole; the server checks the same again.
 */
export function ProposalFields({ acts, grounds, groundNotice, conditions, values, errors, blocked, leaveHref, words, locale }: Props) {
  const [act, setAct] = useState<Act>(values.act);
  const [ground, setGround] = useState(values.ground);
  const [reason, setReason] = useState(values.reason);
  const [evidence, setEvidence] = useState(values.evidence);
  const [addressed, setAddressed] = useState<Record<string, string>>({ ...values.conditions });

  const enforcement = ENFORCEMENT.includes(act);
  const offered = (grounds ?? []).filter((entry) => entry.acts.includes(act) || entry.value === ground);
  const chosen = offered.find((entry) => entry.value === ground) ?? null;
  const [date, time] = values.effective.length >= 16 ? [values.effective.slice(0, 10), values.effective.slice(11, 16)] : [undefined, undefined];

  const why =
    blocked ??
    (acts.length === 0
      ? words.whyNoAct
      : enforcement && (grounds === null || ground === "")
        ? words.whyGround
        : act !== "NO_CHANGE" && evidence.trim() === ""
          ? words.whyEvidence
          : reason.trim() === ""
            ? words.whyReason
            : act === "REINSTATE" && conditions.some((condition) => (addressed[condition.code] ?? "").trim() === "")
              ? words.whyConditions
              : null);

  return (
    <>
      {acts.length > 0 && (
        <ChoiceList
          legend={words.act}
          name="action"
          options={acts.map((entry) => ({ value: entry.value, label: entry.label }))}
          value={act}
          layout="inline"
          required
          {...(errors.act !== undefined ? { error: errors.act } : {})}
          onChange={(event) => {
            const target = (event as { target?: { value?: unknown } }).target;
            const next = acts.find((entry) => entry.value === target?.value)?.value;
            if (next === undefined) return;
            setAct(next);
            // A ground the policy does not give for the new act is not carried over to it.
            if (!(grounds ?? []).some((entry) => entry.value === ground && entry.acts.includes(next))) setGround("");
          }}
          density="console"
          locale={locale}
        />
      )}
      {enforcement && grounds !== null && (
        <Select
          label={words.ground}
          name="ground_code"
          options={offered.map((entry) => ({ value: entry.value, label: entry.label }))}
          value={ground}
          placeholder={words.groundPh}
          onChange={setGround}
          {...(errors.ground !== undefined ? { error: errors.ground } : {})}
          {...((chosen?.condition !== undefined && chosen?.condition !== null) && act === "SUSPEND" ? { info: chosen.condition } : {})}
          required
          density="console"
          width="100%"
          locale={locale}
        />
      )}
      {(grounds === null || !enforcement) && groundNotice}
      {act === "REINSTATE" &&
        conditions.map((condition) => (
          <TextField
            key={condition.code}
            label={condition.label}
            helper={words.condHelp}
            name={`condition:${condition.code}`}
            value={addressed[condition.code] ?? ""}
            onChange={(value) => setAddressed((current) => ({ ...current, [condition.code]: value }))}
            {...(errors.conditions !== undefined ? { error: errors.conditions } : {})}
            multiline
            rows={2}
            required
            width="100%"
            density="console"
            locale={locale}
          />
        ))}
      <TextField
        label={words.reason}
        helper={words.reasonHelp}
        name="reason"
        value={reason}
        onChange={setReason}
        {...(errors.reason !== undefined ? { error: errors.reason } : {})}
        wrap
        maxLength={2000}
        required
        width="100%"
        density="console"
        locale={locale}
      />
      <Columns layout="halves">
        <TextField
          label={words.evidence}
          helper={act === "NO_CHANGE" ? words.evidenceOptional : words.evidenceHelp}
          name="evidence_refs"
          value={evidence}
          onChange={setEvidence}
          {...(errors.evidence !== undefined ? { error: errors.evidence } : {})}
          mono
          required={act !== "NO_CHANGE"}
          density="console"
          locale={locale}
        />
        <DateField
          label={words.effective}
          helper={words.effectiveHelp}
          name="effective_at"
          withTime
          {...(date !== undefined ? { value: date } : {})}
          {...(time !== undefined ? { time } : {})}
          {...(errors.effective !== undefined ? { error: errors.effective } : {})}
          density="console"
          locale={locale}
        />
      </Columns>
      <ButtonRow>
        <Button variant="primary" size="sm" type="submit" {...(why !== null ? { disabled: true, disabledReason: why } : {})} locale={locale}>
          {words.propose}
        </Button>
        <Button variant="secondary" size="sm" href={leaveHref} locale={locale}>
          {words.leave}
        </Button>
      </ButtonRow>
    </>
  );
}
