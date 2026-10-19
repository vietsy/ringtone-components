"use client";

import { useState } from "react";
import { Banner, ButtonRow, ChoiceList, Divider, FactList, Panel, Select, StatusLine } from "@/components/r1";
import type { CandidateRecord, PartyAttempt } from "@/lib/api/parties";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ConfirmSubmit } from "./ConfirmSubmit";
import { classHelp, count, originWords, partyTranslator, refusal } from "./copy";

/** The survivor option's helper: where the record came from, and what it carries. */
function survivorHelp(record: CandidateRecord, t: Translate, locale: Locale): string {
  const origin = record.origin.kind === "IMPORTED" ? t("pty05.originShortImported") : record.origin.kind === "SOURCE" ? t("pty05.originShortSource") : originWords(record.origin, t, locale);
  return record.authorities === 0
    ? t("pty05.survHelpNone", { origin })
    : t("pty05.survHelp", { origin, p: count(record.premises.current, locale), a: count(record.authorities, locale) });
}

/**
 * SCR-PTY-05's decision on a duplicate candidacy: the surviving record, then for each kind of reference pointing at
 * the record that would be superseded, with its count, where it goes. Link stays unavailable while a kind is
 * undecided, with the reason; both decisions ask first, saying what changes and that neither record is deleted.
 */
export function DuplicateDecision({
  candidates,
  action,
  attempt,
  locale,
}: {
  candidates: readonly [CandidateRecord, CandidateRecord];
  action: (formData: FormData) => Promise<void>;
  attempt: PartyAttempt | null;
  locale: Locale;
}) {
  const t = partyTranslator(locale);
  const [a, b] = candidates;
  const kept = attempt?.values.surviving_party_id;
  const [survivorRecord, setSurvivor] = useState(typeof kept === "string" && kept === b.record ? b.record : a.record);
  const survivor = survivorRecord === a.record ? a : b;
  const superseded = survivorRecord === a.record ? b : a;
  const initial: Record<string, string> = {};
  for (const entry of superseded.references) {
    const value = attempt?.values[`dispositions.${entry.key}`];
    if (typeof value === "string" && value !== "") initial[entry.key] = value;
  }
  const [chosen, setChosen] = useState<Record<string, string>>(initial);
  const failed = attempt?.refusal ?? null;
  const undecided = superseded.references.find((entry) => chosen[entry.key] !== "MOVE" && chosen[entry.key] !== "STAY") ?? null;
  const optionWords = (to: string) => (to === "MOVE" ? t("pty05.move", { s: survivor.record }) : t("pty05.stay", { o: superseded.record }));

  return (
    <form id="decision" action={action} noValidate>
      <input type="hidden" name="intent" value="" />
      <Panel gap="xl" locale={locale}>
        <Panel variant="plain" level={2} title={t("pty05.decision")} compact locale={locale}>
          <ChoiceList
            legend={t("pty05.survivor")}
            name="surviving_party_id"
            options={candidates.map((record) => ({ value: record.record, label: t("pty05.survOption", { name: record.legalName, rec: record.record }), helper: survivorHelp(record, t, locale) }))}
            value={survivorRecord}
            onChange={(event) => {
              const target = (event as { target?: { value?: string } }).target;
              if (target?.value !== undefined) {
                setSurvivor(target.value);
                setChosen({});
              }
            }}
            required
            density="console"
            locale={locale}
          />
        </Panel>
        <Divider />
        <Panel variant="plain" level={2} title={t("pty05.refsTitle", { rec: superseded.record })} description={t("pty05.refsDesc")} compact locale={locale}>
          {superseded.references.map((entry) => (
            <Select
              key={`${superseded.record}-${entry.key}`}
              label={t("party.class.label", { name: t(`party.class.${entry.key}.name`), n: count(entry.count, locale) })}
              helper={classHelp(entry, superseded.record, t, locale)}
              name={`dispositions.${entry.key}`}
              options={["MOVE", "STAY"].map((to) => ({ value: to, label: optionWords(to) }))}
              value={chosen[entry.key] ?? ""}
              onChange={(value) => setChosen((before) => ({ ...before, [entry.key]: value }))}
              placeholder={t("pty05.notDecided")}
              {...(failed?.code === "DISPOSITION_MISSING" && failed.field === entry.key && chosen[entry.key] === undefined ? { error: t("party.refusal.DISPOSITION_MISSING.text") } : {})}
              required
              density="console"
              width="var(--space-96)"
              locale={locale}
            />
          ))}
        </Panel>
        <Divider />
        <StatusLine family="info" text={t("pty05.neither")} cutout="surface" locale={locale} />
        {failed?.code === "DECISION_REQUIRED" ? (
          <Banner family="attention" title={refusal(t, "DECISION_REQUIRED", "pty05").title} code="DECISION_REQUIRED" density="console" locale={locale}>
            {refusal(t, "DECISION_REQUIRED").text}
          </Banner>
        ) : null}
        <ButtonRow>
          <ConfirmSubmit
            formId="decision"
            label={t("pty05.link")}
            icon="link"
            intent="LINKED"
            disabledReason={undecided !== null ? t("pty05.linkWhy", { kind: t(`party.class.${undecided.key}.short`) }) : null}
            dialog={{
              title: t("pty05.dlgLinkTitle", { rec: superseded.record, name: survivor.legalName }),
              description: t("pty05.dlgLinkText", { name: superseded.legalName, rec: superseded.record, survivor: survivor.record }),
              confirm: t("pty05.dlgLink"),
              back: t("party.goBack"),
            }}
            density="console"
            locale={locale}
          >
            <FactList
              items={superseded.references.map((entry) => ({ label: t("party.class.label", { name: t(`party.class.${entry.key}.name`), n: count(entry.count, locale) }), value: optionWords(chosen[entry.key] ?? "STAY") }))}
              density="console"
              locale={locale}
            />
          </ConfirmSubmit>
          <ConfirmSubmit
            formId="decision"
            label={t("pty05.notSame")}
            variant="secondary"
            intent="NOT_LINKED"
            dialog={{ title: t("pty05.dlgNotTitle", { b: b.record, a: a.record }), description: t("pty05.dlgNotText"), confirm: t("pty05.dlgNot"), back: t("party.goBack") }}
            density="console"
            locale={locale}
          />
        </ButtonRow>
      </Panel>
    </form>
  );
}
