import { Banner, Button, ButtonRow, DateField, FactList, PageHeader, Panel, Select, Skeleton, TextField } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { decide } from "@/features/cases/console-actions";
import { ConfirmSubmit } from "@/features/cases/ConfirmSubmit";
import { ConsoleFailure } from "@/features/cases/ConsoleFailure";
import { casOpsTranslator, day, fieldRefusal, moment, opsStatus, refusalWords } from "@/features/cases/copy";
import { RequiredForm } from "@/features/cases/RequiredForm";
import { SubmitButton } from "@/features/cases/SubmitButton";
import { isoDate } from "@/features/cases/dates";
import { loadDecisionPage, type ConsoleAttempt, type DecisionPage } from "@/lib/api/cases";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const FORM_ID = "decision-form";
/** The seven elements and the governing ground, each a field of its own (FR-CAS-007, DEC-32). */
const REQUIRED = ["facts", "authority_ref", "reasoning", "remedy_kind", "effective_date", "appeal_route", "governing_ground"] as const;

/**
 * SCR-CAS-07 Record a decision: the seven elements as seven fields, never one narrative box, with the decision
 * maker's own name filled in and read-only, the governing ground as a value, and the date the party will be given
 * to appeal shown before anything is committed. Once issued, the same address shows the decision read-only - which
 * is what the dispute authority opens from an appeal - and links on to the remedy.
 */
export default async function RecordDecisionPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-CAS", "ACT-BIZ-APR", "ACT-DSP");
  const [{ reference: raw }, query] = await Promise.all([params, searchParams]);
  const reference = decodeURIComponent(raw);
  const locale = await getLocale();
  const t = casOpsTranslator(locale);
  const view = reviewView(query, CONSOLE_VIEWS);
  const attempt = readForPage<ConsoleAttempt>(query);
  const kept = attempt !== null && attempt.subject === reference && attempt.form === "decision" ? attempt : null;
  const outcome = view === "loading" ? null : await loadDecisionPage(staff, reference, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const officer = holds(staff, "ACT-CAS");
  const header = kept !== null && Object.keys(kept.refusal.fields).length === 0 ? refusalWords(t, kept.refusal, locale) : null;

  return (
    <OpsFrame console="operations" current="cases" staff={staff} searchLabel={t("casops.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={officer ? [{ label: t("cas03.title"), href: routes.opsCases() }, { label: reference, href: routes.opsCase(reference) }] : [{ label: t("casops.crumb") }, { label: reference }]}
          title={t(data !== null && data.issued !== null ? "cas07.titleIssued" : "cas07.title", { ref: reference })}
          {...(data !== null ? { status: opsStatus(data.state) } : {})}
          locale={locale}
        >
          {officer ? (
            <Button variant="quiet" size="sm" icon="arrow-left" href={routes.opsCase(reference)} locale={locale}>
              {t("cas06.back")}
            </Button>
          ) : null}
        </PageHeader>
        {header !== null ? (
          <Banner family="danger" title={header.title} code={header.code} live density="console" locale={locale}>
            {header.text}
          </Banner>
        ) : null}
        {failure !== null ? (
          <ConsoleFailure failure={failure} errorTitle={t("cas07.errTitle")} errorText={t("casops.errText")} t={t} locale={locale} />
        ) : data === null ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="facts" rows={7} density="console" locale={locale} />
          </Panel>
        ) : data.issued !== null ? (
          <Issued data={data} t={t} locale={locale} />
        ) : (
          <Compose data={data} staff={staff} kept={kept} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

/** The decision as issued: every element on its own line, the ground, the deadline, and the remedy's next step. */
function Issued({ data, t, locale }: { data: DecisionPage; t: Translate; locale: Locale }) {
  const issued = data.issued;
  if (issued === null) return null;
  return (
    <>
      <Panel title={t("cas07.seven")} level={2} density="console" gap="md" locale={locale}>
        <FactList
          items={[
            { label: t("cas07.facts"), value: issued.facts },
            { label: t("cas07.authority"), value: issued.authority },
            { label: t("cas07.reasoning"), value: issued.reasoning },
            { label: t("cas07.remedy"), value: t(`cas.remedy.${issued.remedy}`) },
            { label: t("cas07.effective"), value: issued.effectiveDate, kind: "date" },
            { label: t("cas07.maker"), value: issued.maker.name },
            { label: t("cas07.route"), value: issued.appealRoute },
            { label: t("cas07.ground"), value: t(`casops.ground.${issued.governingGround}`) },
            { label: t("cas07.deadline"), value: issued.appealDeadline, kind: "date", missing: t("cas07.noDeadline") },
            { label: t("cas07.issuedAt"), value: issued.issuedAt, kind: "datetime" },
          ]}
          density="console"
          locale={locale}
        />
      </Panel>
      <ButtonRow>
        <Button
          variant="primary"
          size="sm"
          href={routes.opsCaseRemedy(data.reference)}
          {...(data.financial ? {} : { disabled: true, disabledReason: t("cas07.noFinancial") })}
          locale={locale}
        >
          {t("cas07.link")}
        </Button>
      </ButtonRow>
    </>
  );
}

/** The decision being written: the seven elements, the ground, what the party will be told, Save draft and Record and issue. */
function Compose({ data, staff, kept, t, locale }: { data: DecisionPage; staff: Staff; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const typed = kept?.values ?? null;
  const draft = data.draft?.values ?? null;
  const value = (name: (typeof REQUIRED)[number], key: keyof NonNullable<typeof draft>) => {
    const fromAttempt = typed?.[name];
    return typeof fromAttempt === "string" ? fromAttempt : (draft?.[key] ?? "");
  };
  const values = {
    facts: value("facts", "facts"),
    authority_ref: value("authority_ref", "authority"),
    reasoning: value("reasoning", "reasoning"),
    remedy_kind: value("remedy_kind", "remedy"),
    effective_date: value("effective_date", "effective"),
    appeal_route: value("appeal_route", "appealRoute"),
    governing_ground: value("governing_ground", "ground"),
  };
  const refusal = kept?.refusal ?? null;
  const field = (name: string, label: string) => fieldRefusal(t, refusal, name, label, locale);
  const element = (name: string) =>
    refusal?.fields[name] !== undefined ? { error: refusalWords(t, { ...refusal, detail: { ...refusal.detail, element: name } }, locale).text } : {};
  const owner = data.owner?.email === staff.email;
  const blocked = owner ? t("cas07.whyOwner") : data.state !== "DECISION_PENDING" ? t("cas07.whyState", { state: data.state }) : null;
  return (
    <RequiredForm id={FORM_ID} action={decide.bind(null, data.reference)} required={REQUIRED} initiallyMissing={REQUIRED.filter((name) => values[name] === "")}>
      <input type="hidden" name="intent" value="issue" />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <Panel title={t("cas07.case")} level={2} density="console" gap="sm" locale={locale}>
          <FactList
            columns={2}
            items={[
              { label: t("cas07.party"), value: data.raiserLabel },
              { label: t("cas04.requested"), value: data.requestedRemedy !== null ? t(`cas.remedy.${data.requestedRemedy}`) : null, missing: t("cas04.notSaid") },
              { label: t("cas04.owner"), value: data.owner?.name ?? null, missing: t("cas03.unassigned") },
              {
                label: t("cas07.evidence"),
                value: data.evidence.length > 0 ? data.evidence.map((entry) => `${entry.item}: ${entry.receiptOutcome !== null ? t(`cas.receipt.${entry.receiptOutcome}`) : entry.state}`).join("; ") : null,
                missing: t("cas07.noEvidence"),
              },
            ]}
            density="console"
            locale={locale}
          />
          <Text size="sm">{data.matter}</Text>
        </Panel>
        <Panel title={t("cas07.seven")} level={2} density="console" gap="md" locale={locale}>
          <TextField label={t("cas07.facts")} name="facts" value={values.facts} multiline rows={4} helper={t("cas07.factsHelp")} required {...element("facts")} density="console" locale={locale} />
          <TextField label={t("cas07.authority")} name="authority_ref" value={values.authority_ref} helper={t("cas07.authorityHelp")} required {...element("authority")} density="console" locale={locale} />
          <TextField label={t("cas07.reasoning")} name="reasoning" value={values.reasoning} multiline rows={4} helper={t("cas07.reasoningHelp")} required {...element("reasoning")} density="console" locale={locale} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--space-64), 1fr))", gap: "var(--space-4)", alignItems: "start" }}>
            <Select
              label={t("cas07.remedy")}
              name="remedy_kind"
              options={data.remedies.map((kind) => ({ value: kind, label: t(`cas.remedy.${kind}`) }))}
              value={values.remedy_kind}
              placeholder={t("casops.choose")}
              required
              {...(refusal?.fields.remedy === "REMEDY_KIND_UNKNOWN" ? field("remedy", t("cas07.remedy")) : element("remedy"))}
              density="console"
              locale={locale}
            />
            <DateField label={t("cas07.effective")} name="effective_date" value={isoDate(values.effective_date)} min={data.today} today={data.today} required {...element("effective")} density="console" locale={locale} />
            <TextField label={t("cas07.maker")} value={t("cas07.you", { name: staff.account })} readOnly helper={t("cas07.makerHelp")} density="console" locale={locale} />
          </div>
          <TextField label={t("cas07.route")} name="appeal_route" value={values.appeal_route} helper={t("cas07.routeHelp")} required {...element("appealRoute")} density="console" locale={locale} />
        </Panel>
        <Panel title={t("cas07.groundTitle")} level={2} density="console" gap="sm" locale={locale}>
          <Select
            label={t("cas07.ground")}
            name="governing_ground"
            options={data.grounds.map((ground) => ({ value: ground, label: t(`casops.ground.${ground}`) }))}
            value={values.governing_ground}
            placeholder={t("casops.choose")}
            required
            {...element("ground")}
            density="console"
            locale={locale}
          />
          <Text size="sm" tone="secondary">
            {t("cas07.groundWhy")}
          </Text>
        </Panel>
        <Panel title={t("cas07.told")} level={2} density="console" gap="sm" locale={locale}>
          <Text size="base">{data.appealDeadline !== null ? t("cas07.toldText", { d: day(data.appealDeadline, locale) }) : t("cas07.noDeadline")}</Text>
        </Panel>
        <ButtonRow align="between">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
            <SubmitButton variant="secondary" size="sm" intent="draft" locale={locale}>
              {t("cas07.save")}
            </SubmitButton>
            {data.draft !== null ? (
              <Text size="sm" tone="secondary">
                {t("cas07.saved", { t: moment(data.draft.savedAt, locale), by: data.draft.by })}
              </Text>
            ) : null}
          </div>
          <ConfirmSubmit
            formId={FORM_ID}
            label={t("cas07.issue")}
            intent="issue"
            disabledReason={blocked}
            reasons={[
              { field: "facts", text: t("cas07.needFacts") },
              { field: "authority_ref", text: t("cas07.needAuthority") },
              { field: "reasoning", text: t("cas07.needReasoning") },
              { field: "remedy_kind", text: t("cas07.needRemedy") },
              { field: "effective_date", text: t("cas07.needEffective") },
              { field: "appeal_route", text: t("cas07.needRoute") },
              { field: "governing_ground", text: t("cas07.needGround") },
            ]}
            dialog={{
              title: t("cas07.issueTitle", { ref: data.reference }),
              description:
                data.appealDeadline !== null
                  ? t("cas07.issueText", { party: data.raiserLabel, d: day(data.appealDeadline, locale) })
                  : t("cas07.issueTextNoDeadline", { party: data.raiserLabel }),
              confirm: t("cas07.issueConfirm"),
              back: t("cas07.issueBack"),
            }}
            locale={locale}
          />
        </ButtonRow>
      </div>
    </RequiredForm>
  );
}
