import {
  Banner,
  Button,
  ButtonRow,
  ChoiceList,
  Columns,
  DateField,
  EmptyState,
  FactList,
  NavList,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  Table,
  TextField,
} from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { addRegisterEntry, approvePolicyItem, prepareCategoryPolicy, preparePeriod, refusePolicyItem } from "@/features/cases/console-actions";
import { ConfirmSubmit } from "@/features/cases/ConfirmSubmit";
import { ConsoleFailure } from "@/features/cases/ConsoleFailure";
import { casOpsTranslator, day, fieldRefusal, one, refusalWords } from "@/features/cases/copy";
import { RequiredForm, RequiredSubmit } from "@/features/cases/RequiredForm";
import { isoDate } from "@/features/cases/dates";
import {
  POLICY_REGISTERS,
  PROTECTED_CATEGORIES,
  loadPolicyRegister,
  type CategoryPolicyView,
  type ConsoleAttempt,
  type PeriodView,
  type PolicyEntryView,
  type PolicyRegisterCode,
  type PolicyRegisterPage,
} from "@/lib/api/cases";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** The registers whose entries are a code and a label; the period kinds are versioned per case type. */
const ENTRY_REGISTERS: readonly PolicyRegisterCode[] = ["pause_ground", "reopen_ground"];
const PERIOD_REGISTERS: readonly PolicyRegisterCode[] = ["appeal_decision", "evidence_response", "reopen_window"];

/**
 * SCR-CAS-18 Case policy register: the registers this module defines, the configuration point each serves and whose
 * approval it carries, their entries or period versions with the one in force, and what is being prepared. A case
 * officer adds an entry or prepares a period version, the security owner a protected category's policy; someone who
 * did not prepare it approves and publishes it - a business approver, or for a category policy the data protection
 * officer - and it governs from its effective date, or refuses it with a reason its preparer reads. Nothing defaults:
 * an empty register refuses the case that reads it.
 */
export default async function CasePolicyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-CAS", "ACT-BIZ-APR", "ACT-SEC", "ACT-DPO");
  const params = await searchParams;
  const locale = await getLocale();
  const t = casOpsTranslator(locale);
  const view = reviewView(params, CONSOLE_VIEWS);
  const register = one(params.register) ?? "pause_ground";
  const attempt = readForPage<ConsoleAttempt>(params);
  const kept = attempt !== null && attempt.subject === register ? attempt : null;
  const outcome = view === "loading" ? null : await loadPolicyRegister(staff, register, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  // An approval's refusal is said on the item it fell on; any other that names no field, in the page header.
  const header = kept !== null && !kept.form.startsWith("approve:") && Object.keys(kept.refusal.fields).length === 0 ? refusalWords(t, kept.refusal, locale) : null;

  return (
    <OpsFrame console="operations" current="cases" staff={staff} searchLabel={t("casops.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("casops.crumb") }]} title={t("cas18.title")} locale={locale}>
          {/* The case queue is the case officer's; the security owner and the data protection officer work here alone. */}
          {holds(staff, "ACT-CAS") ? (
            <Button variant="quiet" size="sm" icon="arrow-left" href={routes.opsCases()} locale={locale}>
              {t("cas04.back")}
            </Button>
          ) : null}
        </PageHeader>
        {header !== null ? (
          <Banner family="danger" title={header.title} code={header.code} live density="console" locale={locale}>
            {header.text}
          </Banner>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(var(--space-60), 1fr) minmax(0, 3fr)", gap: "var(--space-6)", alignItems: "start" }}>
          <NavList
            title={t("cas18.registers")}
            items={POLICY_REGISTERS.map((code) => ({
              label: t(`casops.register.${code}`),
              href: routes.opsCasePolicy(code),
              detail: t(`casops.registerPoint.${code}`),
              ...(code === register ? { current: true } : {}),
            }))}
            locale={locale}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
            {failure !== null ? (
              <ConsoleFailure failure={failure} errorTitle={t("cas18.errTitle")} errorText={t("casops.errText")} t={t} locale={locale} />
            ) : data === null ? (
              <Panel density="console" locale={locale}>
                <Skeleton variant="table" rows={4} columns={4} density="console" locale={locale} />
              </Panel>
            ) : (
              <Register data={data} staff={staff} kept={kept} t={t} locale={locale} />
            )}
          </div>
        </div>
      </div>
    </OpsFrame>
  );
}

function Register({ data, staff, kept, t, locale }: { data: PolicyRegisterPage; staff: Staff; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const code = data.register;
  const periods = PERIOD_REGISTERS.includes(code);
  const categories = code === "protected_category";
  const items: readonly (PolicyEntryView | PeriodView | CategoryPolicyView)[] = periods ? data.periods : categories ? data.categoryPolicies : data.entries;
  const prepared = items.filter((item) => item.state === "PREPARED");
  return (
    <>
      <Panel title={t(`casops.register.${code}`)} level={2} density="console" gap="md" locale={locale}>
        <FactList
          columns={2}
          items={[
            { label: t("cas18.point"), value: t(`casops.registerPoint.${code}`) },
            { label: t("cas18.owner"), value: t(`casops.registerOwner.${code}`) },
          ]}
          density="console"
          locale={locale}
        />
        <Text size="sm" tone="secondary">
          {t(`casops.registerAbout.${code}`)}
        </Text>
      </Panel>
      {items.length === 0 ? (
        <EmptyState variant="governed" title={t("cas18.emptyTitle")} level={2} density="console" locale={locale}>
          {t("cas18.emptyText")}
        </EmptyState>
      ) : periods ? (
        <PeriodTable periods={data.periods} t={t} locale={locale} />
      ) : categories ? (
        <CategoryTable policies={data.categoryPolicies} t={t} locale={locale} />
      ) : (
        <EntryTable entries={data.entries} register={code} t={t} locale={locale} />
      )}
      {data.unmeasured.length > 0 ? <Unmeasured data={data} t={t} locale={locale} /> : null}
      {prepared.map((item) => (
        <Approval key={item.id} item={item} register={code} staff={staff} kept={kept?.form === `approve:${item.id}` ? kept : null} t={t} locale={locale} />
      ))}
      {holds(staff, "ACT-CAS") && ENTRY_REGISTERS.includes(code) ? <AddEntry data={data} kept={kept?.form === "entry" ? kept : null} t={t} locale={locale} /> : null}
      {holds(staff, "ACT-CAS") && periods ? <PreparePeriod data={data} kept={kept?.form === "period" ? kept : null} t={t} locale={locale} /> : null}
      {holds(staff, "ACT-SEC") && categories ? <PrepareCategory data={data} kept={kept?.form === "category" ? kept : null} t={t} locale={locale} /> : null}
      {!ENTRY_REGISTERS.includes(code) && !periods ? (
        <Text size="sm" tone="secondary">
          {t(`casops.registerHow.${code}`)}
        </Text>
      ) : null}
    </>
  );
}

const stateOf = (item: { state: "PREPARED" | "APPROVED" }) => ({ family: item.state === "APPROVED" ? ("positive" as const) : ("attention" as const), label: item.state, quiet: true });

function EntryTable({ entries, register, t, locale }: { entries: readonly PolicyEntryView[]; register: PolicyRegisterCode; t: Translate; locale: Locale }) {
  const what = (entry: PolicyEntryView) => {
    if (entry.requiredAuthority !== null) return t(`casops.authority.${entry.requiredAuthority}`);
    if (entry.limit !== null) return t("cas18.limitValue", { type: t(`casops.caseType.${entry.limit.caseType}`), days: entry.limit.days, instrument: entry.limit.instrument });
    if (entry.requires !== null) return entry.requires.artefactKinds.length > 0 ? entry.requires.artefactKinds.map((kind) => t(`casops.artefact.${kind}`)).join(", ") : t("cas18.nothingRequired");
    return null;
  };
  return (
    <Table
      columns={[
        { key: "code", label: t("cas18.cCode"), kind: "mono" },
        { key: "label", label: t("cas18.cLabel") },
        { key: "what", label: t(`casops.registerColumn.${register}`), missing: "–" },
        { key: "from", label: t("cas18.cFrom"), kind: "date" },
        { key: "approved", label: t("cas18.cApproved"), kind: "stack" },
        { key: "state", label: t("cas03.cState"), kind: "status" },
      ]}
      rows={entries.map((entry) => ({
        _key: entry.id,
        code: entry.code,
        label: entry.label ?? t(`casops.code.${register}.${entry.code}`),
        what: what(entry),
        from: entry.effectiveFrom,
        approved: entry.approvedBy !== null ? { text: entry.approvedBy.name, detail: entry.approvedAt !== null ? day(entry.approvedAt, locale) : "" } : { text: t("cas16.nobody"), muted: true },
        state: stateOf(entry),
      }))}
      density="console"
      caption={t(`casops.register.${register}`)}
      locale={locale}
    />
  );
}

function PeriodTable({ periods, t, locale }: { periods: readonly PeriodView[]; t: Translate; locale: Locale }) {
  return (
    <Table
      columns={[
        { key: "type", label: t("cas04.type") },
        { key: "version", label: t("cas18.cVersion"), kind: "count" },
        { key: "amount", label: t("cas18.cPeriod") },
        { key: "from", label: t("cas18.cFrom"), kind: "date" },
        { key: "to", label: t("cas18.cTo"), kind: "date", missing: t("cas18.open") },
        { key: "approved", label: t("cas18.cApproved"), kind: "stack" },
        { key: "state", label: t("cas03.cState"), kind: "status" },
      ]}
      rows={periods.map((period) => ({
        _key: period.id,
        type: t(`casops.caseType.${period.caseType}`),
        version: period.versionNo,
        amount: t(period.unit === "months" ? "casops.months" : "casops.workingDays", { n: period.amount }),
        from: period.effectiveFrom,
        to: period.effectiveTo,
        approved: period.approvedBy !== null ? { text: period.approvedBy.name, detail: period.approvedAt !== null ? day(period.approvedAt, locale) : "" } : { text: t("cas16.nobody"), muted: true },
        state: stateOf(period),
      }))}
      density="console"
      caption={t("cas18.periods")}
      locale={locale}
    />
  );
}

/** The name a prepared item is approved under: an entry's label, a period's case type and length, a category's version. */
function itemName(item: PolicyEntryView | PeriodView | CategoryPolicyView, register: PolicyRegisterCode, t: Translate): string {
  if ("category" in item) return t("cas18.categoryName", { category: t(`casops.category.${item.category}`), n: item.versionNo });
  if ("code" in item) return item.label ?? t(`casops.code.${register}.${item.code}`);
  return `${t(`casops.caseType.${item.caseType}`)}, ${t(item.unit === "months" ? "casops.months" : "casops.workingDays", { n: item.amount })}`;
}

/**
 * Approve and publish one prepared item, or refuse it with a reason: both disabled for its preparer and for anyone
 * who may not approve it, each saying why. A business approver approves an entry or a period version; a category
 * policy, the data protection officer or a business approver. The last refusal stays on the item for its preparer.
 */
function Approval({
  item,
  register,
  staff,
  kept,
  t,
  locale,
}: {
  item: PolicyEntryView | PeriodView | CategoryPolicyView;
  register: PolicyRegisterCode;
  staff: Staff;
  kept: ConsoleAttempt | null;
  t: Translate;
  locale: Locale;
}) {
  const formId = `approve-${item.id}`;
  const refuseId = `refuse-${item.id}`;
  const category = "category" in item;
  const approver = category ? holds(staff, "ACT-DPO", "ACT-BIZ-APR") : holds(staff, "ACT-BIZ-APR");
  const why = item.preparedBy.email === staff.email ? t("cas18.whySame") : !approver ? t(category ? "cas18.whyRoleCategory" : "cas18.whyRole") : null;
  const name = itemName(item, register, t);
  const reached = kept?.refusal.code === "PERIOD_VERSION_NOT_APPROVED" ? kept.refusal.detail : null;
  return (
    <Panel title={t("cas18.preparedTitle", { name })} level={3} density="console" gap="sm" status={{ family: "attention", label: item.state, quiet: true }} locale={locale}>
      <FactList
        columns={2}
        items={[
          { label: t("cas16.preparedBy"), value: item.preparedBy.name },
          { label: t("cas16.effective"), value: item.effectiveFrom, kind: "date" },
          { label: t("cas16.approvedBy"), value: null, missing: t("cas16.nobody") },
        ]}
        density="console"
        locale={locale}
      />
      {item.preparedBy.email === staff.email ? (
        <Banner family="neutral" title={t("cas18.cannotTitle")} density="console" locale={locale}>
          {t("cas18.cannotText")}
        </Banner>
      ) : null}
      {item.refused !== null ? (
        <Banner family="attention" title={t("cas18.refusedTitle", { by: item.refused.by.name })} density="console" locale={locale}>
          {item.refused.reason}
        </Banner>
      ) : null}
      {kept !== null ? (
        <Banner family="danger" title={refusalWords(t, kept.refusal, locale).title} code={kept.refusal.code} density="console" locale={locale}>
          {reached !== null
            ? `${refusalWords(t, kept.refusal, locale).text} ${t("cas18.reachesBack", { reference: reached.reference ?? "", d: day(reached.date ?? item.effectiveFrom, locale), from: day(item.effectiveFrom, locale) })}`
            : refusalWords(t, kept.refusal, locale).text}
        </Banner>
      ) : null}
      <form id={refuseId} action={refusePolicyItem.bind(null, register, item.id)}>
        <input type="hidden" name="reason" value="" />
      </form>
      <form id={formId} action={approvePolicyItem.bind(null, register, item.id)}>
        <ButtonRow align="end">
          <ConfirmSubmit
            formId={refuseId}
            label={t("cas18.refuse")}
            variant="secondary"
            disabledReason={why}
            field={{ name: "reason", label: t("cas18.refuseReason"), missing: t("cas18.refuseMissing") }}
            dialog={{
              title: t("cas18.refuseTitle", { name }),
              description: t("cas18.refuseText"),
              confirm: t("cas18.refuseConfirm"),
              confirmVariant: "danger",
              back: t("cas07.issueBack"),
            }}
            locale={locale}
          />
          <ConfirmSubmit
            formId={formId}
            label={t("cas18.approve")}
            disabledReason={why}
            dialog={{
              title: t("cas18.approveTitle", { name }),
              description: t("cas18.approveText", { d: day(item.effectiveFrom, locale), reader: t(`casops.registerReader.${register}`) }),
              confirm: t("cas18.approveConfirm"),
              back: t("cas07.issueBack"),
            }}
            locale={locale}
          />
        </ButtonRow>
      </form>
    </Panel>
  );
}

const typedOf = (kept: ConsoleAttempt | null, name: string) => {
  const value = kept?.values[name];
  return typeof value === "string" ? value : "";
};

/** Add an entry: code, label, the authority a pause ground requires, and the day it starts to govern. */
function AddEntry({ data, kept, t, locale }: { data: PolicyRegisterPage; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const pause = data.register === "pause_ground";
  const required = pause ? (["code", "label", "required_authority", "effective_from"] as const) : (["code", "label", "effective_from"] as const);
  const refusal = kept?.refusal ?? null;
  const field = (name: string, label: string) => fieldRefusal(t, refusal, name, label, locale);
  return (
    <Panel title={t("cas18.addTitle")} level={2} density="console" gap="md" locale={locale}>
      <RequiredForm action={addRegisterEntry.bind(null, data.register)} required={required} initiallyMissing={required.filter((name) => typedOf(kept, name) === "")}>
        <Columns layout="thirds" gap={4}>
          <TextField label={t("cas18.code")} name="code" value={typedOf(kept, "code")} mono helper={t("cas18.codeHelp")} required {...field("code", t("cas18.code"))} density="console" locale={locale} />
          <TextField label={t("cas18.label")} name="label" value={typedOf(kept, "label")} helper={t("cas18.labelHelp")} required {...field("label", t("cas18.label"))} density="console" locale={locale} />
          {pause ? (
            <Select
              label={t("cas18.authority")}
              name="required_authority"
              options={data.authorities.map((role) => ({ value: role, label: t(`casops.authority.${role}`) }))}
              value={typedOf(kept, "required_authority")}
              placeholder={t("casops.choose")}
              required
              {...field("authority", t("cas18.authority"))}
              density="console"
              locale={locale}
            />
          ) : null}
          <DateField label={t("cas16.effective")} name="effective_from" value={isoDate(typedOf(kept, "effective_from"))} min={data.today} today={data.today} required {...field("effectiveFrom", t("cas16.effective"))} density="console" locale={locale} />
        </Columns>
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "var(--space-4)" }}>
          <RequiredSubmit
            variant="secondary"
            size="sm"
            reasons={[
              { field: "code", text: t("cas18.needCode") },
              { field: "label", text: t("cas18.needLabel") },
              { field: "required_authority", text: t("cas18.needAuthority") },
              { field: "effective_from", text: t("cas18.needFrom") },
            ]}
            locale={locale}
          >
            {t("cas18.add")}
          </RequiredSubmit>
        </div>
      </RequiredForm>
    </Panel>
  );
}

/** Prepare a period version: a case type, the period in its unit, and the day it starts to govern. */
function PreparePeriod({ data, kept, t, locale }: { data: PolicyRegisterPage; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const required = ["case_type", "amount", "effective_from"] as const;
  const refusal = kept?.refusal ?? null;
  const field = (name: string, label: string) => fieldRefusal(t, refusal, name, label, locale);
  const months = data.register === "reopen_window";
  return (
    <Panel title={t("cas18.periodTitle")} level={2} density="console" gap="md" locale={locale}>
      <RequiredForm action={preparePeriod.bind(null, data.register)} required={required} initiallyMissing={required.filter((name) => typedOf(kept, name) === "")}>
        <Columns layout="thirds" gap={4}>
          <Select
            label={t("cas04.type")}
            name="case_type"
            options={data.caseTypes.map((type) => ({ value: type, label: t(`casops.caseType.${type}`) }))}
            value={typedOf(kept, "case_type")}
            placeholder={t("casops.choose")}
            required
            {...field("caseType", t("cas04.type"))}
            density="console"
            locale={locale}
          />
          <TextField
            label={t(months ? "cas18.amountMonths" : "cas18.amountDays")}
            name="amount"
            value={typedOf(kept, "amount")}
            inputMode="numeric"
            required
            {...field("amount", t(months ? "cas18.amountMonths" : "cas18.amountDays"))}
            density="console"
            locale={locale}
          />
          <DateField label={t("cas16.effective")} name="effective_from" value={isoDate(typedOf(kept, "effective_from"))} min={data.today} today={data.today} required {...field("effectiveFrom", t("cas16.effective"))} density="console" locale={locale} />
        </Columns>
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "var(--space-4)" }}>
          <RequiredSubmit
            variant="secondary"
            size="sm"
            reasons={[
              { field: "case_type", text: t("cas18.needType") },
              { field: "amount", text: t("cas18.needAmount") },
              { field: "effective_from", text: t("cas18.needFrom") },
            ]}
            locale={locale}
          >
            {t("cas18.prepare")}
          </RequiredSubmit>
        </div>
      </RequiredForm>
    </Panel>
  );
}

/** The protected categories' policy versions: the process each routes to, who may read a matter, where an escalation goes. */
function CategoryTable({ policies, t, locale }: { policies: readonly CategoryPolicyView[]; t: Translate; locale: Locale }) {
  return (
    <Table
      columns={[
        { key: "category", label: t("cas18.cCategory") },
        { key: "version", label: t("cas18.cVersion"), kind: "count" },
        { key: "process", label: t("cas18.cProcess") },
        { key: "access", label: t("cas18.cAccess") },
        { key: "addressees", label: t("cas18.cAddressees") },
        { key: "from", label: t("cas18.cFrom"), kind: "date" },
        { key: "to", label: t("cas18.cTo"), kind: "date", missing: t("cas18.open") },
        { key: "approved", label: t("cas18.cApproved"), kind: "stack" },
        { key: "state", label: t("cas03.cState"), kind: "status" },
      ]}
      rows={policies.map((policy) => ({
        _key: policy.id,
        category: t(`casops.category.${policy.category}`),
        version: policy.versionNo,
        process: policy.specialistProcess,
        access: policy.access.map((person) => person.name).join(", "),
        addressees: t("cas18.addresseesValue", { primary: policy.primary.name, alternate: policy.alternate.name }),
        from: policy.effectiveFrom,
        to: policy.effectiveTo,
        approved: policy.approvedBy !== null ? { text: policy.approvedBy.name, detail: policy.approvedAt !== null ? day(policy.approvedAt, locale) : "" } : { text: t("cas16.nobody"), muted: true },
        state: stateOf(policy),
      }))}
      density="console"
      caption={t("cas18.categories")}
      locale={locale}
    />
  );
}

/**
 * The appeals lodged while no appeal period was approved for their case type (AC-FR-CAS-021-03): nothing set their
 * outcome date, and an approval now does not reach back to them. Shown on the appeal-period register beside Approve.
 */
function Unmeasured({ data, t, locale }: { data: PolicyRegisterPage; t: Translate; locale: Locale }) {
  return (
    <Panel title={t("cas18.unmeasuredTitle")} level={2} density="console" gap="md" status={{ family: "attention", label: "PERIOD_VERSION_NOT_APPROVED", quiet: true }} locale={locale}>
      <Text size="sm" tone="secondary">
        {t("cas18.unmeasuredText")}
      </Text>
      <Table
        columns={[
          { key: "appeal", label: t("cas18.cAppeal"), kind: "id" },
          { key: "case", label: t("cas18.cCase"), kind: "mono" },
          { key: "type", label: t("cas04.type"), missing: "–" },
          { key: "received", label: t("cas18.cReceived"), kind: "datetime" },
        ]}
        rows={data.unmeasured.map((entry) => ({
          _key: entry.appeal,
          appeal: entry.appeal,
          case: entry.caseReference,
          type: entry.caseType !== null ? t(`casops.caseType.${entry.caseType}`) : null,
          received: entry.receivedAt,
        }))}
        density="console"
        caption={t("cas18.unmeasuredTitle")}
        locale={locale}
      />
    </Panel>
  );
}

/**
 * Prepare a category policy (CFG-50, by the security owner): the category, the specialist process, who may read a
 * matter in it - named people - and the two escalation addressees, who must be two different people.
 */
function PrepareCategory({ data, kept, t, locale }: { data: PolicyRegisterPage; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const required = ["category", "specialist_process", "access_actor_ids", "primary_addressee_actor_id", "alternate_addressee_actor_id", "effective_from"] as const;
  const refusal = kept?.refusal ?? null;
  const field = (name: string, label: string) => fieldRefusal(t, refusal, name, label, locale);
  const people = data.staff.map((person) => ({ value: person.email, label: person.name }));
  const access = (() => {
    const value = kept?.values.access_actor_ids;
    return value === undefined ? [] : typeof value === "string" ? [value] : [...value];
  })();
  return (
    <Panel title={t("cas18.categoryTitle")} level={2} density="console" gap="md" locale={locale}>
      <Text size="sm" tone="secondary">
        {t("cas18.categoryAbout")}
      </Text>
      <RequiredForm action={prepareCategoryPolicy} required={required} initiallyMissing={required.filter((name) => (name === "access_actor_ids" ? access.length === 0 : typedOf(kept, name) === ""))}>
        <Columns layout="thirds" gap={4}>
          <Select
            label={t("cas18.cCategory")}
            name="category"
            options={PROTECTED_CATEGORIES.map((category) => ({ value: category, label: t(`casops.category.${category}`) }))}
            value={typedOf(kept, "category")}
            placeholder={t("casops.choose")}
            required
            density="console"
            locale={locale}
          />
          <TextField
            label={t("cas18.process")}
            name="specialist_process"
            value={typedOf(kept, "specialist_process")}
            helper={t("cas18.processHelp")}
            maxLength={500}
            required
            {...field("specialistProcess", t("cas18.process"))}
            density="console"
            locale={locale}
          />
          <Select
            label={t("cas18.primary")}
            name="primary_addressee_actor_id"
            options={people}
            value={typedOf(kept, "primary_addressee_actor_id")}
            placeholder={t("casops.choose")}
            required
            {...field("primary", t("cas18.primary"))}
            density="console"
            locale={locale}
          />
          <Select
            label={t("cas18.alternate")}
            name="alternate_addressee_actor_id"
            options={people}
            value={typedOf(kept, "alternate_addressee_actor_id")}
            placeholder={t("casops.choose")}
            helper={t("cas18.alternateHelp")}
            required
            {...field("alternate", t("cas18.alternate"))}
            density="console"
            locale={locale}
          />
          <DateField label={t("cas16.effective")} name="effective_from" value={isoDate(typedOf(kept, "effective_from"))} min={data.today} today={data.today} required {...field("effectiveFrom", t("cas16.effective"))} density="console" locale={locale} />
          <ChoiceList
            legend={t("cas18.access")}
            helper={t("cas18.accessHelp")}
            name="access_actor_ids"
            multiple
            options={people}
            value={access}
            required
            {...field("access", t("cas18.access"))}
            density="console"
            locale={locale}
          />
        </Columns>
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "var(--space-4)" }}>
          <RequiredSubmit
            variant="secondary"
            size="sm"
            reasons={[
              { field: "category", text: t("cas18.needCategory") },
              { field: "specialist_process", text: t("cas18.needProcess") },
              { field: "access_actor_ids", text: t("cas18.needAccess") },
              { field: "primary_addressee_actor_id", text: t("cas18.needPrimary") },
              { field: "alternate_addressee_actor_id", text: t("cas18.needAlternate") },
              { field: "effective_from", text: t("cas18.needFrom") },
            ]}
            locale={locale}
          >
            {t("cas18.prepareCategory")}
          </RequiredSubmit>
        </div>
      </RequiredForm>
    </Panel>
  );
}
