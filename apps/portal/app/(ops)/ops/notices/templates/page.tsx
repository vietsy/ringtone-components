import { ApprovalPair, Banner, Button, ButtonRow, DateField, FactList, FilterBar, Panel, Select, Table, TextField, Toast, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { ActButton } from "@/features/notices/ActButton";
import { ConfirmAct } from "@/features/notices/ConfirmAct";
import { approveTemplateAct, prepareTemplateAct } from "@/features/notices/console-actions";
import { askedDay, className, day, moment, periodWords, tabRoles, templateStateValue } from "@/features/notices/console";
import { comTranslator, previewOf } from "@/features/notices/copy";
import { NoticeFailure, NoticeFrame } from "@/features/notices/NoticeFrame";
import { readForPage } from "@/lib/api/flash";
import { loadTemplates, TEMPLATE_SKELETON, type ConsoleAttempt, type NoticeContent, type TemplatesView, type TemplateVersionRow } from "@/lib/api/notices";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS, type NoticeElement } from "@/lib/mock/notices";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/**
 * SCR-COM-04 Notice templates, filtered to one class of the policy in force: every version of its wording in each
 * language with its period, the one composing today marked (or on the day `as_of` asks for), and a preview of the six
 * elements as the version's own words read, filled with the values of the latest notice of the class, naming any
 * placeholder a body does not carry. The version approved here is what a recipient reads: a notice is composed from
 * the version in force at composition. An operations officer prepares a version; a business approver who did not
 * prepare it approves it (SEG_SAME_ACTOR otherwise). Where no wording is in force, notices of the class wait rather
 * than go out, and the page counts them.
 */
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff(...tabRoles("templates"));
  const params = await searchParams;
  const locale = await getLocale();
  const t = comTranslator(locale);
  const view = reviewView(params, CONSOLE_VIEWS);
  const asked = text(params.class);
  // `as_of`: the versions that composed the class on another day than today.
  const asOf = askedDay(params["as-of"]);
  const kept = readForPage<ConsoleAttempt>(params);
  const outcome = view === "loading" ? null : await loadTemplates(staff, asked, view, asOf);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const attempt = kept !== null && "classCode" in kept && kept.classCode === data?.classCode ? kept : null;

  return (
    <NoticeFrame
      staff={staff}
      tab="templates"
      keys={false}
      header={{ title: data !== null ? t("com04.title", { c: className(data.classCode, t) }) : t("comOps.tab.templates"), meta: t("com04.meta") }}
      t={t}
      locale={locale}
    >
      {failure !== null ? (
        <NoticeFailure failure={failure} errTitle={t("com04.errTitle")} values={{ class_name: asked ?? "" }} t={t} locale={locale} />
      ) : (
        <Templates data={data} attempt={attempt} t={t} locale={locale} />
      )}
    </NoticeFrame>
  );
}

function Templates({ data, attempt, t, locale }: { data: TemplatesView | null; attempt: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const classCode = data?.classCode ?? "";
  const done = attempt?.page === "template-done" ? attempt : null;
  const approvalRefusal = attempt?.page === "template-approval" ? attempt.refusal : null;
  const waiting = data !== null && data.versions.length > 0 && data.inForce.vi === null;
  return (
    <>
      <form action={routes.opsNoticeTemplates()}>
        <FilterBar label={t("com04.filters")} locale={locale}>
          <Select
            label={t("com04.fClass")}
            name="class"
            options={(data?.classes ?? []).map((code) => ({ value: code, label: className(code, t) }))}
            {...(data !== null ? { value: data.classCode } : {})}
            loading={data === null}
            density="console"
            width="var(--space-64)"
            locale={locale}
          />
          <DateField label={t("com04.fAsOf")} name="as-of" {...(data !== null && data.asOf !== null ? { value: data.asOf } : {})} helper={false} density="console" locale={locale} />
          <Button variant="primary" size="sm" type="submit" loading={data === null} locale={locale}>
            {t("comOps.show")}
          </Button>
        </FilterBar>
      </form>
      {data !== null && data.asOf !== null ? (
        <Banner family="info" title={t("com04.asOfTitle", { d: day(data.asOf, locale) })} density="console" locale={locale}>
          {t("com04.asOfText")}
        </Banner>
      ) : null}
      {done !== null ? (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family="positive" title={t(done.act === "prepare" ? "com04.preparedTitle" : "com04.approvedTitle", { n: done.versionNo, lang: t(`com.lang.${done.language}`) })} locale={locale}>
            {t(done.act === "prepare" ? "com04.preparedText" : "com04.approvedText")}
          </Toast>
        </div>
      ) : null}
      {approvalRefusal !== null ? (
        <Banner family="attention" title={t(`com.refusal.${approvalRefusal.code}.title`)} code={approvalRefusal.code} live density="console" locale={locale}>
          {t(`com.refusal.${approvalRefusal.code}.text`, { ...approvalRefusal.values, class_name: className(classCode, t) })}
        </Banner>
      ) : null}
      {waiting ? (
        <Banner family="danger" title={data.asOf !== null ? t("com04.noneOnTitle", { d: day(data.asOf, locale) }) : t("com04.noneTitle")} code="TEMPLATE_VERSION_NOT_EFFECTIVE" density="console" locale={locale}>
          {data.waiting > 0 ? `${t("com04.noneText")} ${t("com04.waitingCount", { n: data.waiting })}` : t("com04.noneText")}
        </Banner>
      ) : null}
      {data !== null && data.versions.length === 0 ? (
        <ViewState view="empty" empty={{ variant: "governed", title: t("com04.emptyTitle"), text: t("com04.emptyText"), action: false }} level={2} density="console" locale={locale} />
      ) : (
        <Panel title={t("com04.listTitle")} level={2} compact gap="md" density="console" locale={locale}>
          <Table
            columns={[
              { key: "no", label: t("com04.cVersion"), kind: "strong" },
              { key: "lang", label: t("com04.cLanguage") },
              { key: "period", label: t("com04.cPeriod") },
              { key: "st", label: t("com04.cState"), kind: "status" },
              { key: "prepared", label: t("com04.cPrepared"), kind: "stack" },
              { key: "approved", label: t("com04.cApproved"), kind: "stack" },
            ]}
            rows={(data?.versions ?? []).map((version) => ({
              _key: version.id,
              no: t("comOps.version", { n: version.versionNo }),
              lang: t(`com.lang.${version.language}`),
              period: periodWords(version.effectiveFrom, version.effectiveTo, t, locale),
              st: templateStateValue(version.state, version.inForce, t),
              prepared: { text: version.preparedBy, detail: moment(version.preparedAt, locale) },
              approved: version.approvedBy !== null ? { text: version.approvedBy, detail: moment(version.approvedAt ?? "", locale) } : { text: t("com01.notApproved"), muted: true },
            }))}
            loading={data === null ? 4 : false}
            density="console"
            caption={t("com04.listTitle")}
            locale={locale}
          />
          <Text size="sm" tone="secondary">
            {t("com04.placeholders")}
          </Text>
        </Panel>
      )}
      {(data?.versions ?? [])
        .filter((version) => version.state === "PREPARED")
        .map((version) => (
          <Awaiting key={version.id} version={version} sample={data?.sample ?? null} t={t} locale={locale} />
        ))}
      {data !== null && data.versions.length > 0 ? <Preview data={data} t={t} locale={locale} /> : null}
      {data?.canPrepare === true && data.asOf === null ? <Prepare data={data} attempt={attempt?.page === "template" ? attempt : null} t={t} locale={locale} /> : null}
      <ButtonRow>
        <Button variant="secondary" size="sm" icon="arrow-left" href={routes.opsNoticePolicies()} locale={locale}>
          {t("com04.back")}
        </Button>
      </ButtonRow>
    </>
  );
}

/** A version waiting for approval: its body, the placeholders it lacks, the preparer beside the approver, and Approve. */
function Awaiting({ version, sample, t, locale }: { version: TemplateVersionRow; sample: TemplatesView["sample"]; t: Translate; locale: Locale }) {
  const formId = `com04-approve-${version.id}`;
  const lang = t(`com.lang.${version.language}`);
  const refused = version.reader === "preparer" ? t("com04.ownWhy") : version.reader === "no-role" ? t("com04.roleWhy") : null;
  return (
    <Panel title={t("com04.approvalTitle", { n: version.versionNo, lang })} level={2} gap="lg" density="console" locale={locale}>
      <Rendered version={version} sample={sample} t={t} locale={locale} />
      {version.missing.length > 0 ? (
        <Banner family="attention" title={t("com04.missingTitle", { elements: version.missing.map((element) => `{${element}}`).join(", ") })} code="NOTICE_ELEMENT_MISSING" compact density="console" locale={locale} />
      ) : null}
      <ApprovalPair
        preparer={{ name: version.preparedBy, role: t("comOps.officer"), at: version.preparedAt }}
        approver={null}
        awaiting={t("com03.awaiting")}
        {...(version.reader === "preparer" ? { sameActor: { code: "SEG_SAME_ACTOR", title: t("com04.ownWhy"), text: t("com03.ownText"), family: "attention" as const } } : {})}
        preparerLabel={t("comOps.preparer")}
        approverLabel={t("comOps.approver")}
        locale={locale}
      />
      <form id={formId} action={approveTemplateAct} style={{ display: "contents" }}>
        <input type="hidden" name="template" value={version.id} />
        <input type="hidden" name="class" value={version.classCode} />
      </form>
      <ButtonRow align="end">
        <ConfirmAct
          formId={formId}
          label={t("com04.approve")}
          disabledReason={refused}
          dialog={{
            title: t("com04.dlgTitle", { n: version.versionNo, lang }),
            description: t("com04.dlgText", { d: day(version.effectiveFrom, locale), c: className(version.classCode, t) }),
            confirm: t("com04.dlgYes"),
            back: t("comOps.back"),
          }}
          locale={locale}
        />
      </ButtonRow>
    </Panel>
  );
}

/** A template's body as it is written, line by line: the placeholders stay as the composer reads them. */
function Body({ body, t, locale }: { body: string; t: Translate; locale: Locale }) {
  return (
    <Panel variant="sunken" title={t("com04.fBody")} level={3} compact gap="sm" density="console" locale={locale}>
      {body
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line, index) => (
          <Text key={index} size="sm">
            {line}
          </Text>
        ))}
    </Panel>
  );
}

/** A version's body beside the six elements as a notice composed from it would read them. */
function Rendered({ version, sample, t, locale }: { version: TemplateVersionRow; sample: { reference: string; content: NoticeContent } | null; t: Translate; locale: Locale }) {
  const elements = previewOf(version.body, version.versionNo, sample?.content ?? null, t, locale);
  const shown = (element: NoticeElement, value: string) => (version.missing.includes(element) ? null : value);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--container-xs), 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
      <Body body={version.body} t={t} locale={locale} />
      <FactList
        density="console"
        locale={locale}
        items={[
          { label: t("com10.about"), value: shown("subject", elements.subject) },
          { label: t("com10.todo"), value: shown("action", elements.action) },
          { label: t("com10.by"), value: shown("deadline", elements.deadline) },
          { label: t("com10.ifNot"), value: shown("consequence", elements.consequence) },
          { label: t("com06.cRef"), value: shown("reference", sample?.reference ?? "{reference}") },
          { label: t("com10.contact"), value: shown("contact", elements.contact) },
        ]}
      />
    </div>
  );
}

/**
 * The version composing Vietnamese notices today, its six elements as its own words read with the values of the
 * latest notice of the class; with no notice yet, each value shows its placeholder.
 */
function Preview({ data, t, locale }: { data: TemplatesView; t: Translate; locale: Locale }) {
  const version = data.versions.find((entry) => entry.inForce && entry.language === "vi") ?? data.versions.find((entry) => entry.language === "vi") ?? data.versions[0];
  if (version === undefined) return null;
  return (
    <Panel
      title={t("com04.previewOf", { n: version.versionNo, lang: t(`com.lang.${version.language}`) })}
      description={data.sample !== null ? t("com04.previewNote", { ref: data.sample.reference }) : t("com04.previewNoSample")}
      level={2}
      gap="lg"
      density="console"
      locale={locale}
    >
      <Rendered version={version} sample={data.sample} t={t} locale={locale} />
      {version.missing.length > 0 ? (
        <Banner family="attention" title={t("com04.missingTitle", { elements: version.missing.map((element) => `{${element}}`).join(", ") })} code="NOTICE_ELEMENT_MISSING" density="console" locale={locale}>
          {t("com.refusal.NOTICE_ELEMENT_MISSING.text", { element: version.missing.map((element) => t(`com.element.${element}`)).join(", ") })}
        </Banner>
      ) : null}
    </Panel>
  );
}

/** Prepare a template version for the class: its language, its body with the six placeholders, its period. */
function Prepare({ data, attempt, t, locale }: { data: TemplatesView; attempt: Extract<ConsoleAttempt, { page: "template" }> | null; t: Translate; locale: Locale }) {
  const refusal = attempt?.refusal ?? null;
  const language = attempt?.typed.language === "en" ? "en" : "vi";
  const latest = data.versions.find((entry) => entry.language === language);
  const bodyError =
    refusal?.code === "NOTICE_ELEMENT_MISSING"
      ? t("com.refusal.NOTICE_ELEMENT_MISSING.text", {
          element: String(refusal.values.element ?? "")
            .split(", ")
            .filter((element) => element !== "")
            .map((element) => t(`com.element.${element}`))
            .join(", "),
        })
      : null;
  const periodError =
    refusal === null || refusal.code === "NOTICE_ELEMENT_MISSING"
      ? null
      : refusal.code === "TEMPLATE_PERIOD_OVERLAP"
        ? `${t("com.refusal.TEMPLATE_PERIOD_OVERLAP.text", { class_name: className(data.classCode, t) })} ${t("com04.collides", { other: refusal.values.other ?? "" })}`
        : refusal.code === "PERIOD_INVALID" && refusal.field === "from"
          ? t("com01.fromMissing")
          : t(`com.refusal.${refusal.code}.text`, { ...refusal.values, class_name: className(data.classCode, t), authority: t("com.serviceOwner") });
  const from = attempt !== null ? askedDay(attempt.typed.from) : null;
  const to = attempt !== null ? askedDay(attempt.typed.to) : null;
  return (
    <Panel title={t("com04.prepareTitle")} level={2} gap="lg" density="console" locale={locale}>
      <form action={prepareTemplateAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: "var(--container-2xl)" }}>
        <input type="hidden" name="class" value={data.classCode} />
        <Select
          label={t("com04.fLanguage")}
          name="language"
          options={[
            { value: "vi", label: t("com.lang.vi") },
            { value: "en", label: t("com.lang.en") },
          ]}
          value={language}
          density="console"
          width="var(--space-48)"
          locale={locale}
        />
        <TextField
          label={t("com04.fBody")}
          helper={t("com04.bodyHelp")}
          name="body"
          value={attempt?.typed.body ?? latest?.body ?? TEMPLATE_SKELETON}
          multiline
          rows={9}
          required
          {...(bodyError !== null ? { error: bodyError } : {})}
          density="console"
          locale={locale}
        />
        <DateField
          label={t("com04.fPeriod")}
          name="period"
          range
          fromLabel={t("comOps.from")}
          toLabel={t("comOps.to")}
          toPlaceholder={t("comOps.toOpen")}
          {...(from !== null ? { value: from } : {})}
          {...(to !== null ? { to } : {})}
          required
          {...(periodError !== null ? { error: periodError } : {})}
          density="console"
          locale={locale}
        />
        <ButtonRow>
          <ActButton variant="primary" size="sm" icon="file-plus" locale={locale}>
            {t("com04.prepare")}
          </ActButton>
        </ButtonRow>
      </form>
    </Panel>
  );
}

