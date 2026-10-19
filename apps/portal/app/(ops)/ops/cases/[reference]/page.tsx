import { Banner, Button, ButtonRow, ChoiceList, DateField, Disclosure, FactList, PageHeader, Panel, Select, Skeleton, Table, TextField, Timeline } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { addParty, classify, classifyProtected, closeCase, linkCase, progress, referCase } from "@/features/cases/console-actions";
import { ConfirmSubmit } from "@/features/cases/ConfirmSubmit";
import { ConsoleFailure } from "@/features/cases/ConsoleFailure";
import { casOpsTranslator, day, fieldRefusal, moment, opsStatus, refusalWords } from "@/features/cases/copy";
import { RequiredForm, RequiredSubmit } from "@/features/cases/RequiredForm";
import { SubmitButton } from "@/features/cases/SubmitButton";
import { isoDate } from "@/features/cases/dates";
import { LINK_KINDS, PARTY_ROLES, VULNERABILITIES, loadConsoleCase, type CaseState, type ConsoleAttempt, type ConsoleCaseView, type Refusal } from "@/lib/api/cases";
import { readForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS, IMPACTS, SEVERITIES } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;
type Values = Readonly<Record<string, string | readonly string[]>>;

/** The fields Classify and derive waits for (its Enabled when). */
const CLASSIFY_REQUIRED = ["case_type", "subject_kind", "requested_remedy_kind", "owner_actor_id", "severity", "business_impact", "raiser_vulnerability"] as const;

/** The states the classification is still open in: until the case is decided or has ended. */
const CLASSIFIABLE = ["RECEIVED", "TRIAGED", "ASSIGNED", "INVESTIGATING", "AWAITING_EVIDENCE", "DECISION_PENDING"];

/** The closure each state admits (SM-05 transitions 4 and 9): inadmissible at triage, incomplete while evidence is awaited. */
const CLOSABLE: Partial<Record<CaseState, "inadmissible" | "incomplete">> = { TRIAGED: "inadmissible", AWAITING_EVIDENCE: "incomplete" };

/**
 * SCR-CAS-04 Case detail and triage, the hub a case officer works a case from. Classification and the derivation of
 * its target are one act (Classify and derive), shown before with its inputs and after with its result and the
 * inputs that produced it; links and parties are added here; the case moves on from here to its evidence, its
 * decision, its remedy and its reopening, each control saying why it waits when it does. A triaged case may instead be
 * referred to another process or closed as inadmissible, one awaiting evidence closed as incomplete, and any case still
 * being worked classified as a protected matter, which restricts it from that instant.
 */
export default async function CaseDetailPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-CAS");
  const [{ reference: raw }, query] = await Promise.all([params, searchParams]);
  const reference = decodeURIComponent(raw);
  const locale = await getLocale();
  const t = casOpsTranslator(locale);
  const view = reviewView(query, CONSOLE_VIEWS);
  const attempt = readForPage<ConsoleAttempt>(query);
  const kept = attempt !== null && attempt.subject === reference ? attempt : null;
  const outcome = view === "loading" ? null : await loadConsoleCase(staff, reference, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame console="operations" current="cases" staff={staff} searchLabel={t("casops.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("cas03.title"), href: routes.opsCases() }, { label: reference }]}
          title={t("cas04.title", { ref: reference })}
          {...(data !== null ? { status: opsStatus(data.state), meta: raisedLine(data, t, locale) } : {})}
          locale={locale}
        >
          <Button variant="quiet" size="sm" icon="arrow-left" href={routes.opsCases()} locale={locale}>
            {t("cas04.back")}
          </Button>
        </PageHeader>
        {kept !== null && headerRefusal(kept.refusal) ? (
          <Banner family="danger" title={refusalWords(t, kept.refusal, locale).title} code={kept.refusal.code} live density="console" locale={locale}>
            {refusalWords(t, kept.refusal, locale).text}
          </Banner>
        ) : null}
        {failure !== null ? (
          <ConsoleFailure
            failure={failure}
            errorTitle={t("cas04.errTitle")}
            errorText={t("casops.errText")}
            action={{ label: t("cas04.back"), href: routes.opsCases() }}
            t={t}
            locale={locale}
          />
        ) : (
          <CaseFile data={data} kept={kept} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

/** Raised when, through which group, from an account or without one. */
function raisedLine(data: ConsoleCaseView, t: Translate, locale: Locale): string {
  const by = data.raiser.name !== null ? t("cas04.byParty", { group: t(`cas.group.${data.group}`), party: data.raiser.name }) : t("cas04.byNoAccount", { group: t(`cas.group.${data.group}`) });
  return t("cas04.raised", { t: moment(data.submittedAt, locale), by });
}

/** A refusal said in the page header: one that falls on no single field. */
const headerRefusal = (refusal: Refusal) => Object.keys(refusal.fields).length === 0;

function CaseFile({ data, kept, t, locale }: { data: ConsoleCaseView | null; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  if (data === null) {
    return (
      <Panel density="console" locale={locale}>
        <Skeleton variant="facts" rows={6} density="console" locale={locale} />
      </Panel>
    );
  }
  const classified = data.caseType !== null;
  const open = CLASSIFIABLE.includes(data.state);
  return (
    <>
      <Panel title={t("cas04.matter")} level={2} density="console" gap="md" locale={locale}>
        <FactList
          columns={2}
          items={[
            { label: t("cas04.contact"), value: data.contact },
            {
              label: t("cas04.route"),
              value: data.route !== null ? t("cas04.routeValue", { kind: t(`casops.route.${data.route.kind}`), n: data.route.versionNo }) : null,
              missing: t("cas04.routeModule"),
            },
            ...(data.agent !== null ? [{ label: t("cas04.agent"), value: data.agent.name }] : []),
            { label: t("cas04.requested"), value: data.requestedRemedy !== null ? t(`cas.remedy.${data.requestedRemedy}`) : null, missing: t("cas04.notSaid") },
            { label: t("cas04.subjectRef"), value: data.subjectRef, kind: "mono", missing: t("cas04.notSaid") },
            {
              label: t("cas04.period"),
              value: data.period.from !== null || data.period.to !== null ? `${data.period.from !== null ? day(data.period.from, locale) : "…"} – ${data.period.to !== null ? day(data.period.to, locale) : "…"}` : null,
              missing: t("cas04.notSaid"),
            },
          ]}
          density="console"
          locale={locale}
        />
        <Text size="sm" tone="secondary">
          {t("cas04.matterLabel")}
        </Text>
        <Text size="base" measure="2xl">
          {data.matter}
        </Text>
      </Panel>

      {data.protection !== null ? <Protection data={data} t={t} locale={locale} /> : null}
      {data.referral !== null || data.closure !== null ? <Ended data={data} t={t} locale={locale} /> : null}
      {classified ? <Derived data={data} t={t} locale={locale} /> : null}
      {open ? (
        classified ? (
          <Disclosure title={t("cas04.reclassify")} level={2} density="console" locale={locale}>
            <ClassifyForm data={data} kept={kept} t={t} locale={locale} />
          </Disclosure>
        ) : (
          <ClassifyForm data={data} kept={kept} t={t} locale={locale} />
        )
      ) : null}

      <LinksAndParties data={data} kept={kept} open={open} t={t} locale={locale} />

      <Panel title={t("cas04.history")} level={2} density="console" locale={locale}>
        <Timeline
          entries={[
            ...data.history.map((entry, index) => ({
              id: `state-${String(index)}`,
              at: entry.at,
              title: entry.from !== null ? `${entry.from} → ${entry.to}` : entry.to,
              ...(entry.reason !== null ? { detail: entry.reason } : {}),
            })),
            ...data.notices.map((notice) => ({ id: notice.reference, at: notice.at, title: t("cas04.noticeSent", { ref: notice.reference }), detail: t(`casops.noticeKind.${notice.kind}`) })),
          ]
            // The latest first; two acts in one instant (triage and assignment) keep their own order, the later on top.
            .map((entry, index) => ({ entry, index }))
            .sort((a, b) => b.entry.at.localeCompare(a.entry.at) || b.index - a.index)
            .map(({ entry }) => entry)}
          locale={locale}
        />
      </Panel>

      <Acts data={data} t={t} locale={locale} />
      {open ? <ReferOrClose data={data} kept={kept} t={t} locale={locale} /> : null}
      {open ? <Protect data={data} kept={kept?.form === "protect" ? kept : null} t={t} locale={locale} /> : null}
    </>
  );
}

/** The derivation as it stands: the result and the inputs that produced it (the block shown after classification). */
function Derived({ data, t, locale }: { data: ConsoleCaseView; t: Translate; locale: Locale }) {
  const derivation = data.derivation;
  return (
    <Panel title={t("cas04.derived")} level={2} density="console" gap="md" locale={locale}>
      <FactList
        columns={2}
        items={[
          { label: t("cas04.type"), value: data.caseType !== null ? t(`casops.caseType.${data.caseType}`) : null },
          { label: t("cas04.subjectKind"), value: data.subjectKind !== null ? t(`casops.subject.${data.subjectKind}`) : null },
          { label: t("cas04.owner"), value: data.owner?.name ?? null, missing: t("cas03.unassigned") },
          ...(derivation !== null
            ? [
                { label: t("cas04.priority"), value: t("cas04.priorityValue", { n: derivation.priority }) },
                { label: t("cas04.target"), value: derivation.targetOn, kind: "date" as const, note: t(`casops.reason.${derivation.reason}`) },
                { label: t("cas04.objective"), value: derivation.objectiveVersion, kind: "mono" as const },
                {
                  label: t("cas04.limit"),
                  value: derivation.statutoryLimit !== null ? t("cas04.limitValue", { d: day(derivation.statutoryLimit.on, locale), instrument: derivation.statutoryLimit.instrument }) : null,
                  missing: t("cas04.noLimit"),
                },
                {
                  label: t("cas04.inputs"),
                  value: t("cas04.inputsValue", {
                    severity: t(`casops.severity.${derivation.severity}`),
                    impact: t(`casops.impact.${derivation.impact}`),
                    vulnerability: t(`casops.vulnerability.${derivation.vulnerability}`),
                  }),
                },
                { label: t("cas04.derivedAt"), value: derivation.derivedAt, kind: "datetime" as const },
              ]
            : []),
        ]}
        density="console"
        locale={locale}
      />
    </Panel>
  );
}

const valueOf = (values: Values | null, name: string, fallback: string) => {
  const value = values?.[name];
  return typeof value === "string" ? value : fallback;
};

/** Classify (type, subject, period, remedy, owner) and Derive the target (severity, impact, vulnerability), one act. */
function ClassifyForm({ data, kept, t, locale }: { data: ConsoleCaseView; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const mine = kept?.form === "classify" ? kept : null;
  const values = mine?.values ?? null;
  const refusal = mine?.refusal ?? null;
  const caseType = valueOf(values, "case_type", data.caseType ?? "");
  const remedies = [...new Set(Object.values(data.options.remediesByType).flat())];
  const current = {
    case_type: caseType,
    subject_kind: valueOf(values, "subject_kind", data.subjectKind ?? ""),
    requested_remedy_kind: valueOf(values, "requested_remedy_kind", data.requestedRemedy ?? ""),
    owner_actor_id: valueOf(values, "owner_actor_id", data.owner?.email ?? ""),
    severity: valueOf(values, "severity", data.severity ?? ""),
    business_impact: valueOf(values, "business_impact", data.impact ?? ""),
    raiser_vulnerability: valueOf(values, "raiser_vulnerability", data.vulnerability ?? ""),
  };
  const field = (name: string, label: string) => fieldRefusal(t, refusal, name, label, locale);
  const limits = Object.entries(data.statutoryLimits);
  return (
    <RequiredForm action={classify.bind(null, data.reference)} required={CLASSIFY_REQUIRED} initiallyMissing={CLASSIFY_REQUIRED.filter((name) => current[name] === "")}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--container-sm), 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
        <Panel title={t("cas04.classify")} level={2} density="console" gap="md" locale={locale}>
          <Select
            label={t("cas04.type")}
            name="case_type"
            options={data.options.caseTypes.map((type) => ({ value: type, label: t(`casops.caseType.${type}`) }))}
            value={current.case_type}
            placeholder={t("casops.choose")}
            required
            {...field("caseType", t("cas04.type"))}
            density="console"
            locale={locale}
          />
          <Select
            label={t("cas04.subjectKind")}
            name="subject_kind"
            options={data.options.subjectKinds.map((kind) => ({ value: kind, label: t(`casops.subject.${kind}`) }))}
            value={current.subject_kind}
            placeholder={t("casops.choose")}
            required
            {...field("subjectKind", t("cas04.subjectKind"))}
            density="console"
            locale={locale}
          />
          <TextField label={t("cas04.subjectRef")} name="subject_ref" value={valueOf(values, "subject_ref", data.subjectRef ?? "")} mono autoComplete="off" density="console" locale={locale} />
          <DateField
            label={t("cas04.period")}
            range
            fromLabel={t("cas04.from")}
            toLabel={t("cas04.to")}
            name="affected_period"
            value={isoDate(valueOf(values, "affected_period-from", data.period.from ?? ""))}
            to={isoDate(valueOf(values, "affected_period-to", data.period.to ?? ""))}
            max={data.today}
            today={data.today}
            {...field("period", t("cas04.period"))}
            density="console"
            locale={locale}
          />
          <Select
            label={t("cas04.remedy")}
            name="requested_remedy_kind"
            options={remedies.map((kind) => ({ value: kind, label: t(`cas.remedy.${kind}`) }))}
            value={current.requested_remedy_kind}
            placeholder={t("casops.choose")}
            helper={t("cas04.remedyHelp")}
            required
            {...field("remedy", t("cas04.remedy"))}
            density="console"
            locale={locale}
          />
          <Select
            label={t("cas04.owner")}
            name="owner_actor_id"
            options={data.options.owners.map((owner) => ({ value: owner.email, label: owner.name }))}
            value={current.owner_actor_id}
            placeholder={t("cas03.unassigned")}
            required
            {...field("owner", t("cas04.owner"))}
            density="console"
            locale={locale}
          />
        </Panel>
        <Panel title={t("cas04.derive")} level={2} density="console" gap="md" locale={locale}>
          <Select
            label={t("cas04.severity")}
            name="severity"
            options={SEVERITIES.map((severity) => ({ value: severity, label: t(`casops.severity.${severity}`) }))}
            value={current.severity}
            placeholder={t("casops.choose")}
            required
            {...field("severity", t("cas04.severity"))}
            density="console"
            locale={locale}
          />
          <Select
            label={t("cas04.impact")}
            name="business_impact"
            options={IMPACTS.map((impact) => ({ value: impact, label: t(`casops.impact.${impact}`) }))}
            value={current.business_impact}
            placeholder={t("casops.choose")}
            required
            {...field("impact", t("cas04.impact"))}
            density="console"
            locale={locale}
          />
          {/* Three recorded answers and no default: a blank would silently become a no (DR-47 row 2). */}
          <ChoiceList
            legend={t("cas04.vulnerability")}
            helper={t("cas04.vulnerabilityHelp")}
            name="raiser_vulnerability"
            options={VULNERABILITIES.map((answer) => ({ value: answer, label: t(`casops.vulnerability.${answer}`) }))}
            {...(current.raiser_vulnerability !== "" ? { value: current.raiser_vulnerability } : {})}
            layout="inline"
            required
            {...(refusal?.fields.vulnerability !== undefined ? { error: refusalWords(t, refusal, locale).text } : {})}
            density="console"
            locale={locale}
          />
          <FactList
            items={[
              {
                label: t("cas04.limit"),
                value: limits.length > 0 ? limits.map(([type, limit]) => t("cas04.limitRule", { type: t(`casops.caseType.${type}`), days: limit.days, instrument: limit.instrument })).join("; ") : null,
                missing: t("cas04.noLimit"),
              },
            ]}
            density="console"
            locale={locale}
          />
        </Panel>
      </div>
      <ButtonRow align="end">
        <RequiredSubmit
          variant="primary"
          size="sm"
          reasons={[
            { field: "case_type", text: t("cas04.needType") },
            { field: "subject_kind", text: t("cas04.needSubject") },
            { field: "requested_remedy_kind", text: t("cas04.needRemedy") },
            { field: "owner_actor_id", text: t("cas04.needOwner") },
            { field: "severity", text: t("cas04.needSeverity") },
            { field: "business_impact", text: t("cas04.needImpact") },
            { field: "raiser_vulnerability", text: t("cas04.needVulnerability") },
          ]}
          locale={locale}
        >
          {t("cas04.classifyAct")}
        </RequiredSubmit>
      </ButtonRow>
    </RequiredForm>
  );
}

/** Linked cases and parties: the rows, and the controls that add one. */
function LinksAndParties({ data, kept, open, t, locale }: { data: ConsoleCaseView; kept: ConsoleAttempt | null; open: boolean; t: Translate; locale: Locale }) {
  const link = kept?.form === "link" ? kept : null;
  const party = kept?.form === "party" ? kept : null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--container-sm), 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
      <Panel title={t("cas04.links")} level={2} density="console" gap="md" locale={locale}>
        <Table
          columns={[
            { key: "ref", label: t("cas03.cRef"), kind: "id" },
            { key: "kind", label: t("cas04.linkKind") },
            { key: "state", label: t("cas03.cState"), kind: "status" },
          ]}
          rows={data.links.map((entry) => ({
            _key: `${entry.reference}-${entry.kind}`,
            _href: routes.opsCase(entry.reference),
            ref: entry.reference,
            kind: t(`casops.link.${entry.kind}`),
            state: { ...opsStatus(entry.state), quiet: true },
          }))}
          empty={{ variant: "governed", title: t("cas04.noLinks"), action: false }}
          density="console"
          caption={t("cas04.links")}
          locale={locale}
        />
        {open ? (
          <form action={linkCase.bind(null, data.reference)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--space-48), 1fr))", gap: "var(--space-3)", alignItems: "end" }}>
            <TextField
              label={t("cas04.linkTo")}
              name="to_case"
              value={valueOf(link?.values ?? null, "to_case", "")}
              mono
              autoComplete="off"
              {...fieldRefusal(t, link?.refusal ?? null, "to", t("cas04.linkTo"), locale)}
              density="console"
              locale={locale}
            />
            <Select
              label={t("cas04.linkKind")}
              name="link_kind"
              options={LINK_KINDS.map((kind) => ({ value: kind, label: t(`casops.link.${kind}`) }))}
              value={valueOf(link?.values ?? null, "link_kind", "")}
              placeholder={t("casops.choose")}
              {...fieldRefusal(t, link?.refusal ?? null, "kind", t("cas04.linkKind"), locale)}
              density="console"
              locale={locale}
            />
            <div>
              <SubmitButton variant="secondary" size="sm" locale={locale}>
                {t("cas04.linkAct")}
              </SubmitButton>
            </div>
          </form>
        ) : null}
      </Panel>
      <Panel title={t("cas04.parties")} level={2} density="console" gap="md" locale={locale}>
        <Table
          columns={[
            { key: "name", label: t("cas04.party") },
            { key: "role", label: t("cas04.role") },
          ]}
          rows={data.parties.map((entry) => ({ _key: `${entry.party}-${entry.role}`, name: entry.name, role: t(`casops.role.${entry.role}`) }))}
          empty={{ variant: "governed", title: t("cas04.noParties"), text: t("cas04.noPartiesText"), action: false }}
          density="console"
          caption={t("cas04.parties")}
          locale={locale}
        />
        {open ? (
          <form action={addParty.bind(null, data.reference)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--space-48), 1fr))", gap: "var(--space-3)", alignItems: "end" }}>
            <Select
              label={t("cas04.party")}
              name="party_id"
              options={data.options.parties.map((entry) => ({ value: entry.id, label: entry.name }))}
              value={valueOf(party?.values ?? null, "party_id", "")}
              placeholder={t("casops.choose")}
              {...fieldRefusal(t, party?.refusal ?? null, "party", t("cas04.party"), locale)}
              density="console"
              locale={locale}
            />
            <Select
              label={t("cas04.role")}
              name="party_role"
              options={PARTY_ROLES.map((role) => ({ value: role, label: t(`casops.role.${role}`) }))}
              value={valueOf(party?.values ?? null, "party_role", "")}
              placeholder={t("casops.choose")}
              {...fieldRefusal(t, party?.refusal ?? null, "role", t("cas04.role"), locale)}
              density="console"
              locale={locale}
            />
            <div>
              <SubmitButton variant="secondary" size="sm" locale={locale}>
                {t("cas04.partyAct")}
              </SubmitButton>
            </div>
          </form>
        ) : null}
      </Panel>
    </div>
  );
}

/** The acts that move the case on, each enabled by the state the specification names, or saying why it waits. */
function Acts({ data, t, locale }: { data: ConsoleCaseView; t: Translate; locale: Locale }) {
  const classified = data.caseType !== null;
  const decided = data.decision !== null;
  const reason = (enabled: boolean, why: string) => (enabled ? {} : { disabled: true, disabledReason: why });
  const closed = data.state === "CLOSED" || data.state === "CLOSED_INADMISSIBLE" || data.state === "CLOSED_INCOMPLETE";
  return (
    <Panel title={t("cas04.next")} level={2} density="console" gap="md" locale={locale}>
      {data.appeal !== null ? (
        <FactList
          columns={2}
          items={[
            {
              label: t("cas04.appeal"),
              value: data.appeal.reference,
              kind: "mono",
              note: data.appeal.dueAt !== null ? t("cas04.appealNote", { d: day(data.appeal.dueAt, locale) }) : t("cas04.appealUnmeasured"),
            },
            { label: t("cas04.appealState"), value: { family: data.appeal.state === "UNDER_APPEAL" ? "attention" : "neutral", label: data.appeal.state }, kind: "status" },
          ]}
          density="console"
          locale={locale}
        />
      ) : null}
      <ButtonRow>
        <Button variant="secondary" size="sm" href={routes.opsCaseEvidence(data.reference)} {...reason(classified, t("cas04.whyClassify"))} locale={locale}>
          {t("cas04.evidence", { n: data.evidence.open })}
        </Button>
        <form action={progress.bind(null, data.reference, "investigating")}>
          <SubmitButton variant="secondary" size="sm" {...reason(data.state === "TRIAGED" || data.state === "ASSIGNED", t("cas04.whyInvestigate", { state: data.state }))} locale={locale}>
            {t("cas04.investigate")}
          </SubmitButton>
        </form>
        <form action={progress.bind(null, data.reference, "decision_pending")}>
          <SubmitButton variant="secondary" size="sm" {...reason(data.state === "INVESTIGATING", t("cas04.whyReady", { state: data.state }))} locale={locale}>
            {t("cas04.ready")}
          </SubmitButton>
        </form>
        <Button
          variant="primary"
          size="sm"
          href={routes.opsCaseDecision(data.reference)}
          {...reason(decided || data.state === "INVESTIGATING" || data.state === "DECISION_PENDING", t("cas04.whyDecide", { state: data.state }))}
          locale={locale}
        >
          {decided ? t("cas04.openDecision") : t("cas04.decide")}
        </Button>
        <Button variant="secondary" size="sm" href={routes.opsCaseRemedy(data.reference)} {...reason(decided, t("cas04.whyRemedy"))} locale={locale}>
          {t("cas04.remedyLink")}
        </Button>
        <Button variant="secondary" size="sm" href={routes.opsCaseReopening(data.reference)} {...reason(closed || data.reopening !== null, t("cas04.whyReopen", { state: data.state }))} locale={locale}>
          {t("cas04.reopen")}
        </Button>
      </ButtonRow>
    </Panel>
  );
}

/** The protected matter the case is restricted under, as a reader on its category's access list reads it. */
function Protection({ data, t, locale }: { data: ConsoleCaseView; t: Translate; locale: Locale }) {
  const protection = data.protection;
  if (protection === null) return null;
  return (
    <Banner family="attention" title={t("cas04.protectedTitle", { category: t(`casops.category.${protection.category}`) })} density="console" locale={locale}>
      {t("cas04.protectedText", { t: moment(protection.since, locale), process: protection.process, state: protection.state })}
    </Banner>
  );
}

/** How a case ended without a decision: the process a referral named, or the closure, its reason and what it names. */
function Ended({ data, t, locale }: { data: ConsoleCaseView; t: Translate; locale: Locale }) {
  const { referral, closure } = data;
  return (
    <Panel title={t("cas04.endedTitle")} level={2} density="console" gap="md" locale={locale}>
      {referral !== null ? (
        <FactList
          columns={2}
          items={[
            { label: t("cas04.process"), value: referral.process },
            { label: t("cas04.referredAt"), value: referral.at, kind: "datetime" },
            { label: t("cas04.referReason"), value: referral.reason },
          ]}
          density="console"
          locale={locale}
        />
      ) : null}
      {closure !== null ? (
        <FactList
          columns={2}
          items={[
            { label: t("cas04.closedAs"), value: t(`cas.disposition.${closure.disposition}`) },
            { label: t("cas04.closedAt"), value: closure.at, kind: "datetime" },
            { label: t("cas04.closeReason"), value: closure.reason },
            ...(closure.route !== null ? [{ label: t("cas04.closeRoute"), value: closure.route }] : []),
            ...(closure.unestablished !== null ? [{ label: t("cas04.unestablished"), value: closure.unestablished }] : []),
            ...(closure.approver !== null ? [{ label: t("cas04.closeApprover"), value: closure.approver.name }] : []),
          ]}
          density="console"
          locale={locale}
        />
      ) : null}
    </Panel>
  );
}

/**
 * Refer this case (TRIAGED, to the process named) and Close this case (inadmissible from TRIAGED, incomplete from
 * AWAITING_EVIDENCE), each confirmed in a dialog naming the consequence, each saying why it waits in any other state.
 */
function ReferOrClose({ data, kept, t, locale }: { data: ConsoleCaseView; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const refer = kept?.form === "refer" ? kept : null;
  const close = kept?.form === "close" ? kept : null;
  const disposition = CLOSABLE[data.state] ?? null;
  const referable = data.state === "TRIAGED";
  const referRequired = ["receiving_process", "reason"] as const;
  const closeRequired = disposition === "incomplete" ? (["reason", "approver_actor_id"] as const) : (["reason", "route"] as const);
  const referId = `refer-${data.reference}`;
  const closeId = `close-${data.reference}`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--container-sm), 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
      <Panel title={t("cas04.referTitle")} level={2} density="console" gap="md" locale={locale}>
        <Text size="sm" tone="secondary">
          {t("cas04.referAbout")}
        </Text>
        <RequiredForm id={referId} action={referCase.bind(null, data.reference)} required={referRequired} initiallyMissing={referRequired.filter((name) => valueOf(refer?.values ?? null, name, "") === "")}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {referable ? (
              <>
                <TextField
                  label={t("cas04.process")}
                  name="receiving_process"
                  value={valueOf(refer?.values ?? null, "receiving_process", "")}
                  helper={t("cas04.processHelp")}
                  maxLength={500}
                  required
                  {...fieldRefusal(t, refer?.refusal ?? null, "process", t("cas04.process"), locale)}
                  density="console"
                  locale={locale}
                />
                <TextField
                  label={t("cas04.referReason")}
                  name="reason"
                  value={valueOf(refer?.values ?? null, "reason", "")}
                  multiline
                  rows={3}
                  maxLength={500}
                  required
                  {...fieldRefusal(t, refer?.refusal ?? null, "reason", t("cas04.referReason"), locale)}
                  density="console"
                  locale={locale}
                />
              </>
            ) : null}
            <ButtonRow align="end">
              <ConfirmSubmit
                formId={referId}
                label={t("cas04.refer")}
                variant="secondary"
                disabledReason={referable ? null : t("cas04.whyRefer", { state: data.state })}
                reasons={[
                  { field: "receiving_process", text: t("cas04.needProcess") },
                  { field: "reason", text: t("cas04.needReferReason") },
                ]}
                dialog={{
                  title: t("cas04.referDialogTitle", { ref: data.reference }),
                  description: t("cas04.referDialogText"),
                  confirm: t("cas04.referConfirm"),
                  back: t("cas04.referBack"),
                }}
                locale={locale}
              />
            </ButtonRow>
          </div>
        </RequiredForm>
      </Panel>
      <Panel title={t("cas04.closeTitle")} level={2} density="console" gap="md" locale={locale}>
        <Text size="sm" tone="secondary">
          {disposition === "incomplete" ? t("cas04.closeIncomplete") : t("cas04.closeInadmissible")}
        </Text>
        <RequiredForm id={closeId} action={closeCase.bind(null, data.reference)} required={closeRequired} initiallyMissing={closeRequired.filter((name) => valueOf(close?.values ?? null, name, "") === "")}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {disposition !== null ? (
              <>
                <input type="hidden" name="disposition" value={disposition} />
                <TextField
                  label={t("cas04.closeReason")}
                  name="reason"
                  value={valueOf(close?.values ?? null, "reason", "")}
                  multiline
                  rows={3}
                  maxLength={500}
                  required
                  {...fieldRefusal(t, close?.refusal ?? null, "reason", t("cas04.closeReason"), locale)}
                  density="console"
                  locale={locale}
                />
                {disposition === "inadmissible" ? (
                  <TextField
                    label={t("cas04.closeRoute")}
                    name="route"
                    value={valueOf(close?.values ?? null, "route", "")}
                    helper={t("cas04.closeRouteHelp")}
                    maxLength={500}
                    required
                    {...fieldRefusal(t, close?.refusal ?? null, "route", t("cas04.closeRoute"), locale)}
                    density="console"
                    locale={locale}
                  />
                ) : (
                  <>
                    <TextField
                      label={t("cas04.unestablished")}
                      name="unestablished"
                      value={valueOf(close?.values ?? null, "unestablished", "")}
                      helper={t("cas04.unestablishedHelp")}
                      maxLength={500}
                      density="console"
                      locale={locale}
                    />
                    <Select
                      label={t("cas04.closeApprover")}
                      name="approver_actor_id"
                      options={data.options.closeApprovers.map((officer) => ({ value: officer.email, label: officer.name }))}
                      value={valueOf(close?.values ?? null, "approver_actor_id", "")}
                      placeholder={t("casops.choose")}
                      helper={t("cas04.closeApproverHelp")}
                      required
                      {...(close?.refusal.fields.approver !== undefined
                        ? fieldRefusal(t, close.refusal, "approver", t("cas04.closeApprover"), locale)
                        : data.options.closeApprovers.length === 0
                          ? { error: t("cas04.noApprover") }
                          : {})}
                      density="console"
                      locale={locale}
                    />
                  </>
                )}
              </>
            ) : null}
            <ButtonRow align="end">
              <ConfirmSubmit
                formId={closeId}
                label={t("cas04.close")}
                variant="secondary"
                disabledReason={disposition !== null ? null : t("cas04.whyClose", { state: data.state })}
                reasons={[
                  { field: "reason", text: t("cas04.needCloseReason") },
                  { field: "route", text: t("cas04.needRoute") },
                  { field: "approver_actor_id", text: t("cas04.needApprover") },
                ]}
                dialog={{
                  title: t("cas04.closeDialogTitle", { ref: data.reference }),
                  description: t("cas04.closeDialogText", { state: disposition === "incomplete" ? "CLOSED_INCOMPLETE" : "CLOSED_INADMISSIBLE" }),
                  confirm: t("cas04.closeConfirm"),
                  confirmVariant: "danger",
                  back: t("cas04.closeBack"),
                }}
                locale={locale}
              />
            </ButtonRow>
          </div>
        </RequiredForm>
      </Panel>
    </div>
  );
}

/**
 * Classify as protected (FR-CAS-010): a category whose policy is approved and in force, the reason, and the people the
 * matter names, confirmed in a dialog that says the restriction attaches now and may take the reader's own access.
 */
function Protect({ data, kept, t, locale }: { data: ConsoleCaseView; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const required = ["category", "reason"] as const;
  const formId = `protect-${data.reference}`;
  const chosen = (() => {
    const value = kept?.values.subject_actor_id;
    return value === undefined ? [] : typeof value === "string" ? [value] : [...value];
  })();
  const why = data.protection !== null ? t("cas04.alreadyProtected") : data.options.categories.length === 0 ? t("cas04.noCategory") : null;
  return (
    <Disclosure title={t("cas04.protectTitle")} level={2} density="console" {...(kept !== null ? { open: true } : {})} locale={locale}>
      <RequiredForm id={formId} action={classifyProtected.bind(null, data.reference)} required={required} initiallyMissing={required.filter((name) => valueOf(kept?.values ?? null, name, "") === "")}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Text size="sm" tone="secondary">
            {t("cas04.protectAbout")}
          </Text>
          {why === null ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--container-sm), 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <Select
                  label={t("cas04.category")}
                  name="category"
                  options={data.options.categories.map((category) => ({ value: category, label: t(`casops.category.${category}`) }))}
                  value={valueOf(kept?.values ?? null, "category", "")}
                  placeholder={t("casops.choose")}
                  required
                  {...fieldRefusal(t, kept?.refusal ?? null, "category", t("cas04.category"), locale)}
                  density="console"
                  locale={locale}
                />
                <TextField
                  label={t("cas04.protectReason")}
                  name="reason"
                  value={valueOf(kept?.values ?? null, "reason", "")}
                  multiline
                  rows={3}
                  maxLength={500}
                  required
                  {...fieldRefusal(t, kept?.refusal ?? null, "reason", t("cas04.protectReason"), locale)}
                  density="console"
                  locale={locale}
                />
              </div>
              <ChoiceList
                legend={t("cas04.subjects")}
                helper={t("cas04.subjectsHelp")}
                name="subject_actor_id"
                multiple
                options={data.options.staff.map((person) => ({ value: person.email, label: person.name }))}
                value={chosen}
                density="console"
                locale={locale}
              />
            </div>
          ) : null}
          <ButtonRow align="end">
            <ConfirmSubmit
              formId={formId}
              label={t("cas04.protect")}
              variant="secondary"
              disabledReason={why}
              reasons={[
                { field: "category", text: t("cas04.needCategory") },
                { field: "reason", text: t("cas04.needProtectReason") },
              ]}
              dialog={{
                title: t("cas04.protectDialogTitle", { ref: data.reference }),
                description: t("cas04.protectDialogText"),
                confirm: t("cas04.protectConfirm"),
                confirmVariant: "danger",
                back: t("cas04.protectBack"),
              }}
              locale={locale}
            />
          </ButtonRow>
        </div>
      </RequiredForm>
    </Disclosure>
  );
}
