"use client";

import { useState } from "react";
import { Banner, ButtonRow, ChoiceList, FieldRow, FieldRows, Select } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { SubmitButton } from "./SubmitButton";

interface Row {
  key: number;
  group: string;
  kind: string;
  /** Yes or no; null until answered, because there is no default. */
  account: "yes" | "no" | null;
}

/**
 * SCR-CAS-16's route table while the version is prepared. Add a route adds a row here, not yet on the server; the
 * rows go with the form as hidden fields in order. The account-free check runs as the table is edited, so the
 * group that fails it is named while the person still looks at its row (BR-CAS-01), and Save waits for every row
 * to say whether it needs an account.
 */
export function IntakeRoutesEditor({
  initial,
  groups,
  kinds,
  words,
  locale,
}: {
  initial: readonly { group: string; kind: string; requiresAccount: boolean }[];
  groups: readonly { value: string; label: string }[];
  kinds: readonly { value: string; label: string }[];
  words: {
    legend: string;
    helper: string;
    add: string;
    row: string;
    group: string;
    kind: string;
    account: string;
    yes: string;
    no: string;
    choose: string;
    blockedTitle: string;
    /** The NO_ACCOUNT_FREE_ROUTE sentence with `{group}` in it. */
    blockedText: string;
    save: string;
    unanswered: string;
  };
  locale: Locale;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((route, index) => ({ key: index, group: route.group, kind: route.kind, account: route.requiresAccount ? "yes" : "no" })),
  );
  const update = (key: number, change: Partial<Row>) => setRows((before) => before.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const add = () => setRows((before) => [...before, { key: Math.max(-1, ...before.map((row) => row.key)) + 1, group: "", kind: "", account: null }]);
  const remove = (key: number) => setRows((before) => before.filter((row) => row.key !== key));

  const listed = [...new Set(rows.map((row) => row.group).filter((group) => group !== ""))];
  const without = listed.find((group) => !rows.some((row) => row.group === group && row.account === "no")) ?? null;
  const unanswered = rows.some((row) => row.group === "" || row.kind === "" || row.account === null);
  const groupLabel = (value: string) => groups.find((group) => group.value === value)?.label ?? value;

  return (
    <>
      <FieldRows legend={words.legend} helper={words.helper} count={rows.length} addLabel={words.add} onAdd={add} density="console" locale={locale}>
        {rows.map((row, index) => (
          <FieldRow key={row.key} title={words.row.replace("{n}", String(index + 1))} columns={3} removable={rows.length > 1} onRemove={() => remove(row.key)} density="console" locale={locale}>
            <input type="hidden" name="route_group" value={row.group} />
            <input type="hidden" name="route_kind" value={row.kind} />
            <input type="hidden" name="route_requires_account" value={row.account ?? ""} />
            <Select label={words.group} options={[...groups]} value={row.group} placeholder={words.choose} onChange={(group) => update(row.key, { group })} required density="console" locale={locale} />
            <Select label={words.kind} options={[...kinds]} value={row.kind} placeholder={words.choose} onChange={(kind) => update(row.key, { kind })} required density="console" locale={locale} />
            <ChoiceList
              legend={words.account}
              options={[
                { value: "yes", label: words.yes },
                { value: "no", label: words.no },
              ]}
              {...(row.account !== null ? { value: row.account } : {})}
              layout="inline"
              required
              onChange={(event) => {
                const value = (event as { target?: { value?: string } }).target?.value;
                if (value === "yes" || value === "no") update(row.key, { account: value });
              }}
              density="console"
              locale={locale}
            />
          </FieldRow>
        ))}
      </FieldRows>
      {without !== null ? (
        <Banner family="attention" title={words.blockedTitle} code="NO_ACCOUNT_FREE_ROUTE" live density="console" locale={locale}>
          {words.blockedText.replace("{group}", groupLabel(without))}
        </Banner>
      ) : null}
      <ButtonRow align="end">
        <SubmitButton variant="secondary" size="sm" disabled={unanswered} {...(unanswered ? { disabledReason: words.unanswered } : {})} locale={locale}>
          {words.save}
        </SubmitButton>
      </ButtonRow>
    </>
  );
}
