"use client";

import { useState } from "react";
import { Banner, ChoiceList, Combobox, DateField, FactList, StatusLine, TextField } from "@/components/r1";
import type { PartyAttempt, PartyDetail } from "@/lib/api/parties";
import { ACTS } from "@/lib/api/parties-terms";
import type { Locale } from "@/lib/i18n/translate";
import { codeStatus, day, moment, partyTranslator, refusal } from "./copy";
import { readDate } from "./fields";

const one = (value: string | readonly string[] | undefined): string => (typeof value === "string" ? value : "");
const many = (value: string | readonly string[] | undefined): string[] => (typeof value === "string" ? [value] : value !== undefined ? [...value] : []);

/**
 * Record principal's fields on SCR-PTY-02: the party, the person from the register (each option says who created the
 * record, so the officer sees at once whether the separation applies), the basis and its evidence, what the principal
 * may do and the period. Leaving the end date empty says at once that, with no delegation standard approved, the
 * recording will be refused (finding F-5).
 */
export function PrincipalFields({ party, attempt, locale }: { party: PartyDetail; attempt: PartyAttempt | null; locale: Locale }) {
  const t = partyTranslator(locale);
  const values = attempt?.values ?? {};
  const failed = attempt?.refusal ?? null;
  const [to, setTo] = useState<string | null>(readDate(one(values["effective_period-to"])));
  const from = readDate(one(values["effective_period-from"])) ?? party.today;
  const fieldError = (field: string) => (failed !== null && failed.field === field ? { error: refusal(t, failed.code, "pty02", failed.values).text } : {});
  const banner = failed !== null && failed.field === null ? refusal(t, failed.code, "pty02", failed.values) : null;
  const personDetail = (person: PartyDetail["persons"][number]) => {
    const account = person.hasAccount ? t("pty02.personAccount") : t("pty02.personNoAccount");
    if (person.createdBy === null || person.createdAt === null) return `${person.reference}, ${account}`;
    const when = person.createdAt.length > 10 ? t("pty02.createdAt", { ts: moment(person.createdAt, locale) }) : t("pty02.createdOn", { d: day(person.createdAt, locale) });
    const who = person.createdBy === party.officer ? t("pty02.byYou") : t("pty02.byName", { name: person.createdBy });
    return `${person.reference}, ${account}, ${who} ${when}`;
  };
  const consequence =
    to === null
      ? { family: "attention" as const, text: t("pty02.consOpen"), detail: t("pty02.consOpenDetail") }
      : { family: "info" as const, text: t("pty02.consDated"), detail: t("pty02.consDatedDetail", { f: day(from, locale), d: day(to, locale) }) };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <FactList
        items={[
          { label: t("pty02.fParty"), value: party.legalName, note: party.record },
          { label: t("pty02.fState"), value: codeStatus(party.state, t), kind: "status" },
        ]}
        density="console"
        locale={locale}
      />
      {banner !== null ? (
        <Banner family={failed?.code === "NO_DELEGATION_STANDARD" ? "neutral" : "attention"} title={banner.title} code={banner.code} level={3} density="console" live locale={locale}>
          {banner.text}
        </Banner>
      ) : null}
      <Combobox
        label={t("pty02.fPerson")}
        helper={t("pty02.fPersonHelp")}
        name="party_person_id"
        options={party.persons.map((person) => ({ value: person.reference, label: person.name, detail: personDetail(person) }))}
        {...(one(values.party_person_id) !== "" ? { value: one(values.party_person_id) } : {})}
        allowCustom
        customLabel={t("pty02.useRef")}
        selectedDetail
        wrap
        {...fieldError("party_person_id")}
        required
        density="console"
        width="100%"
        locale={locale}
      />
      <TextField label={t("pty02.fBasis")} helper={t("pty02.fBasisHelp")} name="basis" value={one(values.basis)} {...fieldError("basis")} required wrap density="console" width="100%" locale={locale} />
      <TextField
        label={t("pty02.fEvidence")}
        helper={t("pty02.fEvidenceHelp")}
        name="evidence_ref"
        value={one(values.evidence_ref)}
        {...fieldError("evidence_ref")}
        mono
        required
        density="console"
        width="var(--container-3xs)"
        locale={locale}
      />
      <ChoiceList
        legend={t("pty02.fActs")}
        name="scope_keys"
        options={ACTS.map((act) => ({ value: act, label: t(`party.act.${act}`) }))}
        value={many(values.scope_keys).length > 0 ? many(values.scope_keys) : [...ACTS]}
        multiple
        {...fieldError("scope_keys")}
        required
        density="console"
        locale={locale}
      />
      <DateField
        label={t("pty02.fPeriod")}
        range
        fromLabel={t("party.from")}
        toLabel={t("party.to")}
        name="effective_period"
        value={from}
        {...(to !== null ? { to } : {})}
        toPlaceholder={t("party.noEnd")}
        onChange={(value) => {
          if (value !== null && typeof value === "object") setTo(value.to);
        }}
        {...fieldError("effective_period")}
        required
        today={party.today}
        density="console"
        locale={locale}
      />
      <StatusLine family={consequence.family} text={consequence.text} detail={consequence.detail} cutout="surface" locale={locale} />
      <FactList items={[{ label: t("pty02.fBy"), value: party.officer, note: t("pty02.byNote") }]} density="console" locale={locale} />
    </div>
  );
}
