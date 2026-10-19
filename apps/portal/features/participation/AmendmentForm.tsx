"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Button,
  ButtonRow,
  ChoiceList,
  Columns,
  Comparison,
  DateField,
  Divider,
  FieldRow,
  FieldRows,
  Panel,
  Select,
} from "@/components/r1";
import type { Repertoire, Right, ScopeKey, Territory } from "@/lib/api/participation";
import type { Locale } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { scopeComparison, type Registers } from "./comparison";
import { day, fieldMissing, partTranslator, rowLabel } from "./copy";
import { every, oneOf, readDate, text } from "./fields";
import { sameReading, useFormReading } from "./useFormReading";

/** One addition row as chosen so far; a choice not made yet is null. */
export interface AdditionRow {
  right: Right | null;
  repertoire: Repertoire | null;
  territory: Territory | null;
}

/** What the form says now: the complete additions, the first row left half chosen, the closings, the date. */
interface Reading {
  additions: ScopeKey[];
  incomplete: string | null;
  removals: string[];
  /** The date as an ISO date; null when empty or unreadable. */
  effectiveFrom: string | null;
}

const keyOf = (key: ScopeKey) => `${key.right}-${key.repertoire}-${key.territory}`;

function readRows(rows: readonly AdditionRow[]): Pick<Reading, "additions" | "incomplete"> {
  const additions: ScopeKey[] = [];
  const unfinished: string[] = [];
  for (const [index, { right, repertoire, territory }] of rows.entries()) {
    if (right !== null && repertoire !== null && territory !== null) additions.push({ right, repertoire, territory });
    else if (right !== null || repertoire !== null || territory !== null) {
      unfinished.push(`${right === null ? "add_right" : repertoire === null ? "add_repertoire" : "add_territory"}.${String(index)}`);
    }
  }
  return { additions, incomplete: unfinished[0] ?? null };
}

/**
 * SCR-CAT-03's form while the organisation prepares an amendment: rows to add, rows to close, the effective
 * date, and the scope now and after, which follows what is chosen. Submit for approval waits for a date after
 * today and for at least one change, saying why beside it; a past date is refused at the date itself, with the
 * full two-sentence message, before the service refuses it again (SCR-CAT-03, "refuses past dates at the client
 * and again at the service").
 */
export function AmendmentForm({
  action,
  today,
  current,
  registers,
  initial,
  serverError,
  phone,
  locale,
}: {
  action: (formData: FormData) => Promise<void>;
  today: string;
  /** The scope rows in force today. */
  current: readonly ScopeKey[];
  registers: Registers;
  initial: { additions: readonly AdditionRow[]; removals: readonly string[]; effectiveFrom: string | null };
  /** A refusal the service gave, under the field it names (`effective_from`, `add_right.0`, `changes`). */
  serverError: { field: string; text: string } | null;
  phone: boolean;
  locale: Locale;
}) {
  const t = partTranslator(locale);
  const read = (data: FormData): Reading => {
    const repertoires = every(data, "add_repertoire");
    const territories = every(data, "add_territory");
    const rows = every(data, "add_right").map((right, index) => ({
      right: oneOf(right, registers.rights),
      repertoire: oneOf(repertoires[index] ?? "", registers.repertoires),
      territory: oneOf(territories[index] ?? "", registers.territories),
    }));
    return { ...readRows(rows), removals: every(data, "removals"), effectiveFrom: readDate(text(data, "effective_from")) };
  };
  const [form, reading] = useFormReading<Reading>(
    read,
    { ...readRows(initial.additions), removals: [...initial.removals], effectiveFrom: initial.effectiveFrom },
    sameReading,
  );
  const nextKey = useRef(initial.additions.length);
  const [rows, setRows] = useState<readonly (AdditionRow & { key: number })[]>(
    (initial.additions.length > 0 ? initial.additions : [{ right: null, repertoire: null, territory: null }]).map((row, key) => ({ ...row, key })),
  );

  const past = reading.effectiveFrom !== null && reading.effectiveFrom <= today;
  const labels: Readonly<Record<string, string>> = {
    add_right: t("part03.right"),
    add_repertoire: t("part03.repertoire"),
    add_territory: t("part03.territory"),
    effective_from: t("part03.effLabel"),
  };
  const missingLabel = (field: string) => labels[field.split(".")[0] ?? field] ?? field;
  const reason =
    reading.effectiveFrom === null || past
      ? t("part03.submitOff")
      : reading.incomplete !== null
        ? fieldMissing(missingLabel(reading.incomplete), t)
        : reading.additions.length === 0 && reading.removals.length === 0
          ? t("part03.noChangeOff")
          : null;
  // A refusal from the service stands under its field only while the field still holds what was refused.
  const stillRefused = (field: string): boolean => {
    if (serverError?.field !== field) return false;
    if (field === "effective_from") return reading.effectiveFrom === initial.effectiveFrom;
    if (field === "changes") return reading.additions.length === 0 && reading.removals.length === 0;
    return reading.incomplete === field;
  };
  const errorAt = (field: string) => (serverError !== null && stillRefused(field) ? { error: serverError.text } : {});

  const removed = current.filter((key) => reading.removals.includes(keyOf(key)));
  const { rows: compared, summary } = scopeComparison(registers, current, reading.additions, removed, t, locale);
  const choices = (values: readonly string[], prefix: string) => values.map((value) => ({ value, label: t(`${prefix}.${value}`) }));

  return (
    <form ref={form} action={action} noValidate>
      <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        <Panel variant="plain" level={2} title={t("part03.changesTitle")} density="portal" locale={locale}>
          <FieldRows
            legend={t("part03.additions")}
            helper={t("part03.additionsHelp")}
            addLabel={t("part03.addRow")}
            count={rows.length}
            onAdd={() => setRows((before) => [...before, { right: null, repertoire: null, territory: null, key: nextKey.current++ }])}
            {...errorAt("changes")}
            locale={locale}
          >
            {rows.map((row, index) => (
              <FieldRow
                key={row.key}
                title={t("part03.additionN", { n: index + 1 })}
                {...(phone ? {} : { columns: 3 as const })}
                // Every row can go, the last one too: an amendment may only close rows.
                onRemove={() => setRows((before) => before.filter((other) => other.key !== row.key))}
                locale={locale}
              >
                <Select
                  label={t("part03.right")}
                  options={choices(registers.rights, "part.right")}
                  {...(row.right !== null ? { value: row.right } : { placeholder: t("part03.choose") })}
                  required
                  name="add_right"
                  {...errorAt(`add_right.${String(index)}`)}
                  locale={locale}
                />
                <Select
                  label={t("part03.repertoire")}
                  options={choices(registers.repertoires, "part.rep")}
                  {...(row.repertoire !== null ? { value: row.repertoire } : { placeholder: t("part03.choose") })}
                  required
                  name="add_repertoire"
                  {...errorAt(`add_repertoire.${String(index)}`)}
                  locale={locale}
                />
                <Select
                  label={t("part03.territory")}
                  options={choices(registers.territories, "part.terr")}
                  {...(row.territory !== null ? { value: row.territory } : { placeholder: t("part03.choose") })}
                  required
                  name="add_territory"
                  {...errorAt(`add_territory.${String(index)}`)}
                  locale={locale}
                />
              </FieldRow>
            ))}
          </FieldRows>
          <ChoiceList
            legend={t("part03.removals")}
            helper={reading.removals.length === 0 ? `${t("part03.removalsNone")} ${t("part03.removalsHelp")}` : t("part03.removalsHelp")}
            options={current.map((key) => ({ value: keyOf(key), label: rowLabel(key, t) }))}
            value={[...initial.removals]}
            multiple
            name="removals"
            layout="chips"
            density="portal"
            locale={locale}
          />
        </Panel>
        <Divider />
        <Panel variant="plain" level={2} title={t("part03.effTitle")} density="portal" locale={locale}>
          <Columns layout="halves" single={phone}>
            <DateField
              label={t("part03.effLabel")}
              helper={t("part03.effHelp")}
              {...(initial.effectiveFrom !== null ? { value: initial.effectiveFrom } : {})}
              min={nextDay(today)}
              today={today}
              required
              name="effective_from"
              {...(past ? { error: t("part.refusal.EFFECTIVE_FROM_IN_PAST") } : errorAt("effective_from"))}
              locale={locale}
            />
          </Columns>
        </Panel>
        <Divider />
        <Panel variant="plain" level={2} title={t("part03.cmpCaption")} density="portal" locale={locale}>
          <Comparison
            caption={t("part03.cmpCaption")}
            rowLabel={t("part03.cmpRowLabel")}
            {...(summary !== null ? { summary } : {})}
            columns={[
              { key: "now", label: t("part03.cmpNow"), meta: day(today, locale) },
              {
                key: "after",
                label: t("part03.cmpAfter"),
                ...(reading.effectiveFrom !== null && !past ? { meta: t("part03.cmpAfterMeta", { date: day(reading.effectiveFrom, locale) }) } : {}),
              },
            ]}
            rows={compared}
            density="portal"
            locale={locale}
          />
        </Panel>
        <Actions reason={reason} phone={phone} locale={locale} submit={t("part03.submit")} cancel={t("part03.cancel")} />
      </Panel>
    </form>
  );
}

/** The first day an amendment may take effect: the day after today. */
function nextDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function Actions({ reason, submit, cancel, phone, locale }: { reason: string | null; submit: string; cancel: string; phone: boolean; locale: Locale }) {
  const { pending } = useFormStatus();
  return (
    <ButtonRow>
      <Button
        type="submit"
        variant="primary"
        size="md"
        fullWidth={phone}
        disabled={reason !== null}
        {...(reason !== null ? { disabledReason: reason } : {})}
        loading={pending}
        locale={locale}
      >
        {submit}
      </Button>
      <Button variant="quiet" size="md" fullWidth={phone} href={routes.orgParticipation()} locale={locale}>
        {cancel}
      </Button>
    </ButtonRow>
  );
}
