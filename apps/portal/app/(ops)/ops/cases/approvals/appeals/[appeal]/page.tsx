import { Banner, Button, ButtonRow, ChoiceList, DateField, FactList, PageHeader, Panel, Select, Skeleton, TextField } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { recordOutcome } from "@/features/cases/console-actions";
import { ConfirmSubmit } from "@/features/cases/ConfirmSubmit";
import { ConsoleFailure } from "@/features/cases/ConsoleFailure";
import { casOpsTranslator, day, moment, refusalWords } from "@/features/cases/copy";
import { RequiredForm } from "@/features/cases/RequiredForm";
import { isoDate } from "@/features/cases/dates";
import { APPEAL_OUTCOMES, loadAppealPage, type AppealPage, type ConsoleAttempt } from "@/lib/api/cases";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;
type Eligible = Extract<AppealPage, { eligibility: { eligible: true } }>;

const FORM_ID = "outcome-form";
/** The outcome and the elements the decision stated, each separately (FR-CAS-015). */
const REQUIRED = ["outcome", "outcome_facts", "outcome_authority_ref", "outcome_reasoning", "outcome_further_route", "outcome_governing_ground"] as const;

/**
 * SCR-CAS-09 Decide an appeal. ALG-23's answer comes first, from the people recorded on the decision under appeal:
 * the person who made or approved it is told why they cannot decide it and shown nothing of the file, and no form is
 * drawn for them, disabled or otherwise. An eligible dispute authority reads the appeal and the decision and records
 * the outcome with the elements the decision stated.
 */
export default async function DecideAppealPage({ params, searchParams }: { params: Promise<{ appeal: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-DSP", "ACT-CAS");
  const [{ appeal: raw }, query] = await Promise.all([params, searchParams]);
  const appealRef = decodeURIComponent(raw);
  const locale = await getLocale();
  const t = casOpsTranslator(locale);
  const view = reviewView(query, CONSOLE_VIEWS);
  const attempt = readForPage<ConsoleAttempt>(query);
  const kept = attempt !== null && attempt.subject === appealRef ? attempt : null;
  const outcome = view === "loading" ? null : await loadAppealPage(staff, appealRef, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const header = kept !== null && Object.keys(kept.refusal.fields).length === 0 ? refusalWords(t, kept.refusal, locale) : null;

  return (
    <OpsFrame console="operations" current="cases" staff={staff} searchLabel={t("casops.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={holds(staff, "ACT-DSP") ? [{ label: t("casAp.title"), href: routes.opsCaseApprovals() }, { label: appealRef }] : [{ label: t("casops.crumb") }, { label: appealRef }]}
          title={data !== null ? t("cas09.title", { ref: data.caseReference }) : t("cas09.titleShort")}
          {...(data !== null
            ? {
                meta: `${t("cas09.received", { t: moment(data.receivedAt, locale) })} ${data.dueAt !== null ? t("cas09.due", { d: day(data.dueAt, locale) }) : t("cas09.unmeasured")}${
                  data.period !== null ? ` ${t("cas09.period", { n: data.period.amount, v: data.period.versionNo, from: day(data.period.effectiveFrom, locale) })}` : ""
                }`,
              }
            : {})}
          locale={locale}
        />
        {header !== null ? (
          <Banner family="danger" title={header.title} code={header.code} live density="console" locale={locale}>
            {header.text}
          </Banner>
        ) : null}
        {failure !== null ? (
          <ConsoleFailure failure={failure} errorTitle={t("cas09.errTitle")} errorText={t("casops.errText")} t={t} locale={locale} />
        ) : data === null ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="text" rows={4} density="console" locale={locale} />
          </Panel>
        ) : data.eligibility.eligible ? (
          <File data={data as Eligible} kept={kept} t={t} locale={locale} />
        ) : (
          <Ineligible data={data} act={data.eligibility.act} on={data.eligibility.on} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

/** APPEAL_DECIDER_CONFLICT in place of the form, naming the act and its date and nobody else, and what happens now. */
function Ineligible({ data, act, on, t, locale }: { data: AppealPage; act: "made" | "approved"; on: string; t: Translate; locale: Locale }) {
  const words = refusalWords(t, { code: "APPEAL_DECIDER_CONFLICT", fields: {}, detail: { act, date: on } }, locale);
  return (
    <>
      <Banner family="danger" title={words.title} code={words.code} density="console" locale={locale}>
        {words.text}
      </Banner>
      <Panel title={t("cas09.nowTitle")} level={2} density="console" locale={locale}>
        <Text size="base" measure="2xl">
          {t("cas09.nowText")}
        </Text>
      </Panel>
      <ButtonRow align="between">
        <Button variant="secondary" size="sm" href={routes.opsCaseDecision(data.caseReference)} locale={locale}>
          {t("cas09.openDecision")}
        </Button>
        <Button variant="primary" size="sm" disabled disabledReason={t("cas09.whyConflict")} locale={locale}>
          {t("cas09.record")}
        </Button>
      </ButtonRow>
    </>
  );
}

/** The appeal and the decision under it, then the outcome: recorded, or the form for a dispute authority. */
function File({ data, kept, t, locale }: { data: Eligible; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const decision = data.decision;
  return (
    <>
      {data.lapsed ? (
        <Banner family="attention" title={t("cas.refusal.APPEAL_LAPSED.title")} code="APPEAL_LAPSED" density="console" locale={locale}>
          {t("cas.refusal.APPEAL_LAPSED.text")}
        </Banner>
      ) : data.late ? (
        <Banner family="info" title={t("cas.refusal.APPEAL_LATE_RECORDED.title")} code="APPEAL_LATE_RECORDED" density="console" locale={locale}>
          {t("cas09.lateText")}
        </Banner>
      ) : null}
      {data.measurement !== null ? (
        <Banner family="attention" title={t("cas.refusal.PERIOD_VERSION_NOT_APPROVED.title")} code={data.measurement} density="console" locale={locale}>
          {t("cas09.unmeasuredText")}
        </Banner>
      ) : null}
      <Panel title={t("cas09.grounds")} level={2} density="console" locale={locale}>
        <Text size="base" measure="2xl">
          {data.grounds}
        </Text>
      </Panel>
      <Panel
        title={t("cas09.decision")}
        level={2}
        density="console"
        gap="md"
        action={{ label: t("cas09.openDecision"), href: routes.opsCaseDecision(data.caseReference), variant: "quiet", kind: "link" }}
        locale={locale}
      >
        <FactList
          items={[
            { label: t("cas07.facts"), value: decision.facts },
            { label: t("cas07.authority"), value: decision.authority },
            { label: t("cas07.reasoning"), value: decision.reasoning },
            { label: t("cas07.remedy"), value: t(`cas.remedy.${decision.remedy}`) },
            { label: t("cas07.effective"), value: decision.effectiveDate, kind: "date" },
            { label: t("cas07.maker"), value: decision.decisionMaker },
            { label: t("cas07.route"), value: decision.appealRoute },
            { label: t("cas07.ground"), value: t(`casops.ground.${decision.governingGround}`) },
            { label: t("cas07.issuedAt"), value: decision.issuedAt, kind: "datetime" },
          ]}
          density="console"
          locale={locale}
        />
      </Panel>
      {data.outcome !== null ? (
        <Panel title={t("cas09.outcomeTitle")} level={2} density="console" gap="md" locale={locale}>
          <FactList
            items={[
              { label: t("cas09.outcome"), value: t(`casops.outcome.${data.outcome.outcome}`) },
              { label: t("cas07.facts"), value: data.outcome.facts },
              { label: t("cas07.authority"), value: data.outcome.authority },
              { label: t("cas07.reasoning"), value: data.outcome.reasoning },
              { label: t("cas07.remedy"), value: data.outcome.remedy !== null ? t(`cas.remedy.${data.outcome.remedy}`) : null, missing: t("cas09.remedyUnchanged") },
              { label: t("cas07.effective"), value: data.outcome.effectiveDate, kind: "date", missing: t("cas09.remedyUnchanged") },
              { label: t("cas09.further"), value: data.outcome.furtherRoute },
              { label: t("cas09.decidedBy"), value: data.decidedBy },
              { label: t("cas09.decidedAt"), value: data.outcome.decidedAt, kind: "datetime" },
            ]}
            density="console"
            locale={locale}
          />
        </Panel>
      ) : data.state === "UNDER_APPEAL" && data.mayDecide ? (
        <OutcomeForm data={data} kept={kept} t={t} locale={locale} />
      ) : data.state === "UNDER_APPEAL" ? (
        <Text size="sm" tone="secondary">
          {t("cas09.onlyAuthority")}
        </Text>
      ) : null}
    </>
  );
}

function OutcomeForm({ data, kept, t, locale }: { data: Eligible; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const typed = (name: string) => {
    const value = kept?.values[name];
    return typeof value === "string" ? value : "";
  };
  const refusal = kept?.refusal ?? null;
  const element = (name: string) =>
    refusal?.fields[name] !== undefined ? { error: refusalWords(t, { ...refusal, detail: { ...refusal.detail, element: name } }, locale).text } : {};
  return (
    <RequiredForm id={FORM_ID} action={recordOutcome.bind(null, data.reference)} required={REQUIRED} initiallyMissing={REQUIRED.filter((name) => typed(name) === "")}>
      <Panel title={t("cas09.outcomeTitle")} level={2} density="console" gap="md" locale={locale}>
        <ChoiceList
          legend={t("cas09.outcome")}
          name="outcome"
          options={APPEAL_OUTCOMES.map((value) => ({ value, label: t(`casops.outcome.${value}`), helper: t(`casops.outcomeHelp.${value}`) }))}
          {...(typed("outcome") !== "" ? { value: typed("outcome") } : {})}
          layout="inline"
          required
          {...element("outcome")}
          density="console"
          locale={locale}
        />
        <TextField label={t("cas07.facts")} name="outcome_facts" value={typed("outcome_facts")} multiline rows={3} required {...element("facts")} density="console" locale={locale} />
        <TextField label={t("cas07.authority")} name="outcome_authority_ref" value={typed("outcome_authority_ref")} required {...element("authority")} density="console" locale={locale} />
        <TextField label={t("cas07.reasoning")} name="outcome_reasoning" value={typed("outcome_reasoning")} multiline rows={3} required {...element("reasoning")} density="console" locale={locale} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--space-64), 1fr))", gap: "var(--space-4)", alignItems: "start" }}>
          <Select
            label={t("cas09.remedy")}
            name="outcome_remedy_kind"
            options={[{ value: "", label: t("cas09.remedyKeep") }, ...data.remedies.map((kind) => ({ value: kind, label: t(`cas.remedy.${kind}`) }))]}
            value={typed("outcome_remedy_kind")}
            helper={t("cas09.remedyHelp")}
            {...element("remedy")}
            density="console"
            locale={locale}
          />
          <DateField label={t("cas07.effective")} name="outcome_effective_date" value={isoDate(typed("outcome_effective_date"))} min={data.today} today={data.today} helper={t("cas09.effectiveHelp")} {...element("effective")} density="console" locale={locale} />
        </div>
        <TextField label={t("cas09.further")} name="outcome_further_route" value={typed("outcome_further_route")} helper={t("cas09.furtherHelp")} required {...element("furtherRoute")} density="console" locale={locale} />
        <Select
          label={t("cas07.ground")}
          name="outcome_governing_ground"
          options={data.governingGrounds.map((ground) => ({ value: ground, label: t(`casops.ground.${ground}`) }))}
          value={typed("outcome_governing_ground")}
          placeholder={t("casops.choose")}
          required
          {...element("ground")}
          density="console"
          locale={locale}
        />
        <ButtonRow align="end">
          <ConfirmSubmit
            formId={FORM_ID}
            label={t("cas09.record")}
            reasons={[
              { field: "outcome", text: t("cas09.needOutcome") },
              { field: "outcome_facts", text: t("cas07.needFacts") },
              { field: "outcome_authority_ref", text: t("cas07.needAuthority") },
              { field: "outcome_reasoning", text: t("cas07.needReasoning") },
              { field: "outcome_further_route", text: t("cas09.needFurther") },
              { field: "outcome_governing_ground", text: t("cas07.needGround") },
            ]}
            dialog={{
              title: t("cas09.confirmTitle", { ref: data.caseReference }),
              description: t("cas09.confirmText"),
              confirm: t("cas09.confirm"),
              back: t("cas07.issueBack"),
            }}
            locale={locale}
          />
        </ButtonRow>
      </Panel>
    </RequiredForm>
  );
}
