"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Banner, ButtonRow, Button, ChoiceList, Combobox, DateField, Divider, FactList, ItemList, Panel, StatusLine } from "@/components/r1";
import type { ChangeForm as ChangeFormData, PremisesAttempt } from "@/lib/api/premises";
import { CHANGE_CAUSES } from "@/lib/api/premises-terms";
import type { Locale } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { ConfirmSubmit } from "./ConfirmSubmit";
import { count, day, factItem, moment, premisesRefusal, premisesTranslator, writtenWords } from "./premises-copy";

const FORM = "pty09-change";
const one = (value: string | readonly string[] | undefined): string => (typeof value === "string" ? value : "");

/**
 * SCR-PTY-09's form: the cause, each with a line saying what it means; the effective date, which says at once whether
 * it is earlier or later than today; the incoming party a change of operator needs. The date is checked on the server
 * against what was published since (DR-206 row 7): the page is read again for it while the person types, and the form
 * sends the date the check ran for, so a change recorded before its check finished is refused rather than recorded
 * without the published facts it contradicts. The sentence about what was already issued is on the page, never in a
 * help panel; Record change asks first and records.
 */
export function ChangeForm({
  data,
  draft,
  attempt,
  action,
  locale,
}: {
  data: ChangeFormData;
  draft: { cause: string | null; effective: string | null; incoming: string | null };
  attempt: PremisesAttempt | null;
  action: (formData: FormData) => Promise<void>;
  locale: Locale;
}) {
  const t = premisesTranslator(locale);
  const router = useRouter();
  const [checking, startCheck] = useTransition();
  const failed = attempt?.refusal ?? null;
  const [cause, setCause] = useState(draft.cause ?? (one(attempt?.values.cause) || "OPERATOR_CHANGE"));
  const [effective, setEffective] = useState<string | null>(draft.effective);
  const [incoming, setIncoming] = useState(draft.incoming ?? one(attempt?.values.incoming_party_id));
  const outgoing = data.party?.legalName ?? "";

  const reread = (next: { cause: string; effective: string | null; incoming: string }) =>
    startCheck(() => router.replace(routes.opsPremisesChange(data.record, { cause: next.cause, effective: next.effective, incoming: next.incoming === "" ? null : next.incoming }), { scroll: false }));

  const checked = data.check !== null && data.check.effectiveOn === effective && !checking ? data.check : null;
  const relation = effective === null ? null : effective < data.today ? "earlier" : effective > data.today ? "later" : "today";
  const operatorChange = cause === "OPERATOR_CHANGE";
  const incomingParty = data.parties.find((party) => party.record === incoming) ?? null;
  const facts = checked?.facts ?? [];

  const why =
    effective === null ? t("pty09.whyDate") : operatorChange && incoming === "" ? t("pty09.whyIncoming") : relation === "earlier" && checked === null ? t("pty09.whyChecking") : null;
  const dateInfo =
    relation === "earlier"
      ? t("pty09.earlier", { d: day(data.today, locale) })
      : relation === "later" && effective !== null
        ? t("pty09.later", { d: day(effective, locale), party: outgoing, s: t("prm.state.CHANGE_PENDING") })
        : relation === "today"
          ? t("pty09.today")
          : null;
  const factsDesc =
    relation === null
      ? t("pty09.factsNoDate")
      : relation === "later"
        ? t("pty09.factsLater")
        : relation === "today"
          ? t("pty09.factsToday")
          : checked === null
            ? null
            : facts.length > 0
              ? t("pty09.factsNamed")
              : t("pty09.factsNone");
  const stays = effective !== null ? t("pty09.stays", { p: outgoing, d: day(effective, locale) }) : t("pty09.staysNoDate", { p: outgoing });
  const banner =
    failed !== null && (failed.code === "CONTRADICTION_CHECK_INCOMPLETE" || failed.code === "TRANSFER_DECISION_REQUIRED" || failed.field === null) ? premisesRefusal(t, failed.code, failed.values) : null;
  const causeWord = t(`prm.causeLower.${cause}`);
  const factsPart = relation === "earlier" && facts.length > 0 ? t("pty09.dlgFacts", { n: count(facts.length, locale) }) : "";

  return (
    <form id={FORM} action={action} noValidate>
      <input type="hidden" name="checked_for" value={checked?.effectiveOn ?? ""} />
      <div style={{ maxWidth: "var(--container-3xl)" }}>
        <Panel gap="xl" locale={locale}>
          <Panel variant="plain" title={t("pty09.sChange")} {...(data.prompt !== null ? { description: writtenWords(data.prompt, t, locale) } : {})} level={2} compact locale={locale}>
            <ChoiceList
              legend={t("pty09.cause")}
              name="cause"
              options={CHANGE_CAUSES.map((code) => ({ value: code, label: t(`prm.cause.${code}`), helper: t(`prm.causeHelp.${code}`) }))}
              value={cause}
              onChange={(event) => {
                const value = (event as { target?: { value?: string } }).target?.value;
                if (value === undefined) return;
                setCause(value);
                reread({ cause: value, effective, incoming });
              }}
              required
              density="console"
              locale={locale}
            />
            <DateField
              label={t("pty09.effective")}
              name="effective_on"
              value={effective ?? ""}
              today={data.today}
              onChange={(value) => {
                const next = typeof value === "string" ? value : null;
                setEffective(next);
                reread({ cause, effective: next, incoming });
              }}
              {...(dateInfo !== null ? { info: dateInfo } : {})}
              {...(failed?.code === "EFFECTIVE_DATE_REQUIRED" && effective === null ? { error: premisesRefusal(t, failed.code).text } : {})}
              required
              density="console"
              width="var(--space-48)"
              locale={locale}
            />
            {operatorChange ? (
              <Combobox
                wrap
                label={t("pty09.incoming")}
                name="incoming_party_id"
                options={data.parties.map((party) => ({ value: party.record, label: party.legalName, detail: party.businessRegistration !== null ? `${party.record}, ${party.businessRegistration}` : party.record }))}
                value={incoming}
                onChange={(value) => {
                  const next = typeof value === "string" ? value : "";
                  setIncoming(next);
                  reread({ cause, effective, incoming: next });
                }}
                helper={t("pty09.incomingHelp")}
                placeholder={t("pty09.pickParty")}
                {...(failed?.code === "INCOMING_PARTY_REQUIRED" ? { error: premisesRefusal(t, failed.code).text } : {})}
                required
                density="console"
                width="var(--container-sm)"
                locale={locale}
              />
            ) : null}
          </Panel>
          <Divider />
          <Panel variant="plain" title={t("pty09.sFacts")} {...(factsDesc !== null ? { description: factsDesc } : {})} level={2} compact locale={locale}>
            {relation === "earlier" && checked === null ? (
              <StatusLine family="info" text={t("pty09.checking")} detail={t("pty09.checkingSince", { ts: moment(data.asOf, locale) })} cutout="surface" live locale={locale} />
            ) : null}
            {facts.length > 0 ? <ItemList items={facts.map((fact) => factItem(fact, t, locale))} readOnly density="console" label={t("pty09.sFacts")} locale={locale} /> : null}
          </Panel>
          <Divider />
          <Panel variant="plain" title={t("pty09.sIssued")} level={2} compact locale={locale}>
            <StatusLine family="info" text={stays} detail={t("pty09.staysDetail")} cutout="surface" locale={locale} />
          </Panel>
          {banner !== null && failed !== null ? (
            <Banner
              family="attention"
              title={banner.title}
              code={failed.code}
              {...(failed.code === "TRANSFER_DECISION_REQUIRED" && failed.values.change !== undefined
                ? { action: { label: t("pty09.tdAction", { r: failed.values.record ?? "" }), href: routes.opsChangeDispositions(failed.values.change, failed.values.disposition), variant: "secondary" as const } }
                : {})}
              level={3}
              density="console"
              live
              locale={locale}
            >
              {banner.text}
            </Banner>
          ) : null}
          <Divider />
          <ButtonRow>
            <ConfirmSubmit
              formId={FORM}
              label={t("pty09.record")}
              disabledReason={why}
              dialog={{
                title: t("pty09.dlgTitle", { cause: causeWord, p: data.name, d: effective !== null ? day(effective, locale) : "" }),
                description: operatorChange
                  ? t("pty09.dlgTextChange", { incoming: incomingParty?.legalName ?? "", facts: factsPart, outgoing })
                  : t("pty09.dlgTextEnd", { facts: factsPart, outgoing }),
                confirm: t("pty09.dlgPrimary", { cause: causeWord }),
                back: t("prm.back"),
              }}
              density="console"
              locale={locale}
            >
              <FactList
                items={[
                  { label: t("pty09.cause"), value: t(`prm.cause.${cause}`) },
                  { label: t("pty09.effective"), value: effective, kind: "date" },
                  ...(operatorChange && incomingParty !== null ? [{ label: t("pty09.incoming"), value: incomingParty.legalName, note: incomingParty.record }] : []),
                  ...(relation === "earlier" ? [{ label: t("pty09.dlgNamed"), value: facts.length, kind: "count" as const }] : []),
                ]}
                density="console"
                locale={locale}
              />
            </ConfirmSubmit>
            <Button variant="quiet" size="sm" href={routes.opsPremises(data.record)} locale={locale}>
              {t("pty09.cancel")}
            </Button>
          </ButtonRow>
        </Panel>
      </div>
    </form>
  );
}
