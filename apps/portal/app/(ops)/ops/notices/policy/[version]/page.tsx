import { Banner, Button, ButtonRow, Panel, Skeleton, Table, Toast, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { ClassForm } from "@/features/notices/ClassForm";
import { ConfirmAct } from "@/features/notices/ConfirmAct";
import { addClassAct, sendForApprovalAct } from "@/features/notices/console-actions";
import { className, moment, periodWords, policyStateValue, tabRoles } from "@/features/notices/console";
import { comTranslator } from "@/features/notices/copy";
import { NoticeFailure, NoticeFrame } from "@/features/notices/NoticeFrame";
import { readForPage } from "@/lib/api/flash";
import { loadPolicyVersion, type ConsoleAttempt, type PolicyVersionView } from "@/lib/api/notices";
import { requireStaff, type Staff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CLASS_REGISTER, CONSOLE_VIEWS } from "@/lib/mock/notices";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const SEND_FORM = "com02-send";
const ROLES = ["raiser", "premises_party", "applicant", "artist", "payee", "purchaser", "affected_person", "figure_recipient", "operations_officer"] as const;
const CHANNELS = ["email", "sms", "post", "portal"] as const;
/** The subjects the register's classes are about, in the register's order: what a class may be stated against. */
const SUBJECTS = [...new Set(CLASS_REGISTER.flatMap((entry) => entry.subjectKinds))];

/**
 * SCR-COM-02 Policy version and its classes: the classes one version states with the two designations that decide
 * everything downstream - required, and proof of notice - neither with a default. While the version is prepared, an
 * operations officer adds classes and sends it for approval; once approved or in force nothing on it changes, and
 * the page says to prepare a new version. Each class in force opens its templates (SCR-COM-04).
 */
export default async function PolicyVersionPage({ params, searchParams }: { params: Promise<{ version: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff(...tabRoles("policy"));
  const [{ version: raw }, query] = await Promise.all([params, searchParams]);
  const versionNo = Number(raw);
  const locale = await getLocale();
  const t = comTranslator(locale);
  const view = reviewView(query, CONSOLE_VIEWS);
  const kept = readForPage<ConsoleAttempt>(query);
  const outcome = view === "loading" || !Number.isInteger(versionNo) ? null : await loadPolicyVersion(staff, versionNo, view);
  const failure = !Number.isInteger(versionNo) ? { code: "POLICY_VERSION_NOT_FOUND", traceId: null, retryable: false } : (outcome?.failure ?? null);
  const data = outcome?.data ?? null;
  const attempt = kept !== null && "version" in kept && kept.version === versionNo ? kept : null;

  return (
    <NoticeFrame
      staff={staff}
      tab="policy"
      keys={false}
      header={{
        crumbs: [{ label: t("com02.crumb"), href: routes.opsNoticePolicies() }, { label: t("comOps.version", { n: raw }) }],
        title: t("com02.title", { n: raw }),
        ...(data !== null
          ? {
              status: policyStateValue(data.version.state, t),
              meta: t("com02.meta", { p: periodWords(data.version.effectiveFrom, data.version.effectiveTo, t, locale), name: data.version.preparedBy, ts: moment(data.version.preparedAt, locale) }),
            }
          : {}),
      }}
      t={t}
      locale={locale}
    >
      {view === "loading" ? (
        <Panel density="console" locale={locale}>
          <Skeleton variant="table" rows={6} columns={6} density="console" locale={locale} />
        </Panel>
      ) : null}
      {failure !== null ? <NoticeFailure failure={failure} errTitle={t("com02.errTitle")} t={t} locale={locale} /> : null}
      {data !== null ? <Version data={data} staff={staff} attempt={attempt} t={t} locale={locale} /> : null}
    </NoticeFrame>
  );
}

function Version({
  data,
  staff,
  attempt,
  t,
  locale,
}: {
  data: PolicyVersionView;
  staff: Staff;
  attempt: ConsoleAttempt | null;
  t: Translate;
  locale: Locale;
}) {
  const { version } = data;
  const prepared = version.state === "PREPARED";
  const added = attempt?.page === "class-added" ? attempt : null;
  const classAttempt = attempt?.page === "class" ? attempt : null;
  const sendAttempt = attempt?.page === "send" ? attempt : null;
  const errors: Record<string, string> = {};
  if (classAttempt !== null) {
    const { code, field, values } = classAttempt.refusal;
    errors[field ?? "class"] = t(`com.refusal.${code}.text`, { ...values, class_name: className(String(values.class_name ?? classAttempt.typed.classCode), t), authority: t("com.serviceOwner") });
  }
  return (
    <>
      {added !== null ? (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family="positive" title={t("com02.addedTitle", { c: className(added.classCode, t) })} locale={locale}>
            {t("com02.addedText", { n: version.versionNo })}
          </Toast>
        </div>
      ) : null}
      {sendAttempt !== null ? (
        <Banner family="attention" title={t("com02.sendRefused")} code={sendAttempt.refusal.code} live density="console" locale={locale}>
          {t(`com.refusal.${sendAttempt.refusal.code}.text`, {
            ...sendAttempt.refusal.values,
            class_name: className(String(sendAttempt.refusal.values.class_name ?? ""), t),
            state: t(`com.pstateIn.${String(sendAttempt.refusal.values.state ?? version.state)}`),
          })}
        </Banner>
      ) : null}
      {!prepared ? (
        <Banner family="neutral" title={t("com02.notPreparedTitle")} code="POLICY_VERSION_NOT_PREPARED" density="console" locale={locale}>
          {t("com02.notPreparedText", { state: t(`com.pstateIn.${version.state}`) })}
        </Banner>
      ) : null}
      {data.classes.length === 0 ? (
        <ViewState view="empty" empty={{ variant: "governed", title: t("com02.emptyTitle"), text: t("com02.emptyText"), action: false }} level={2} density="console" locale={locale} />
      ) : (
        <Panel title={t("com02.classesTitle")} level={2} compact gap="md" density="console" locale={locale}>
          <Table
            columns={[
              { key: "cls", label: t("com02.cClass"), kind: "stack" },
              { key: "event", label: t("com02.cEvent"), kind: "stack" },
              { key: "who", label: t("com02.cRecipient") },
              { key: "channels", label: t("com02.cChannels") },
              { key: "required", label: t("com02.cRequired") },
              { key: "proof", label: t("com02.cProof") },
              { key: "lead", label: t("com02.cLead"), missing: "-" },
              { key: "act", label: t("com02.cActions"), kind: "actions" },
            ]}
            rows={data.classes.map((entry) => ({
              _key: entry.classCode,
              cls: { text: className(entry.classCode, t), detail: entry.classCode, detailSize: "sm" },
              event: { text: t(`com.event.${entry.eventKind}`), detail: t(`com02.action.${entry.requiredActionRule}`), detailSize: "sm" },
              who: t(`com.role.${entry.recipientRole}`),
              channels: entry.channels.map((channel) => t(`com.channel.${channel}`)).join(", "),
              required: entry.isRequired ? t("com.yes") : t("com.no"),
              proof: entry.requiresProof ? t("com.yes") : t("com.no"),
              lead: entry.leadTimeDays !== null ? t("com02.leadValue", { n: entry.leadTimeDays }) : null,
              act: [
                data.inForceClasses.includes(entry.classCode)
                  ? { label: t("com02.templates"), ariaLabel: t("com02.templatesLabel", { c: className(entry.classCode, t) }), href: routes.opsNoticeTemplates(entry.classCode), variant: "quiet" }
                  : { label: t("com02.templates"), ariaLabel: t("com02.templatesLabel", { c: className(entry.classCode, t) }), variant: "quiet", disabled: true, disabledReason: t("com02.templatesWhy") },
              ],
            }))}
            density="console"
            caption={t("com02.classesTitle")}
            locale={locale}
          />
          <Text size="sm" tone="secondary">
            {t("com02.designationNote")}
          </Text>
        </Panel>
      )}
      {prepared && data.preparer && data.addable.length > 0 ? (
        <Panel title={t("com02.addTitle")} level={2} gap="lg" density="console" locale={locale}>
          <ClassForm
            action={addClassAct}
            version={version.versionNo}
            register={data.addable}
            options={{
              classes: data.addable.map((entry) => ({ value: entry.classCode, label: className(entry.classCode, t) })),
              events: CLASS_REGISTER.map((entry) => ({ value: entry.eventKind, label: `${t(`com.event.${entry.eventKind}`)} (${entry.sourceModule})` })),
              roles: ROLES.map((role) => ({ value: role, label: t(`com.role.${role}`) })),
              channels: CHANNELS.map((channel) => ({ value: channel, label: t(`com.channel.${channel}`) })),
              subjects: SUBJECTS.map((kind) => ({ value: kind, label: t(`com.subject.${kind}`) })),
              actions: [
                { value: "states_action", label: t("com02.action.states_action") },
                { value: "states_no_action", label: t("com02.action.states_no_action") },
              ],
            }}
            typed={classAttempt?.typed ?? null}
            errors={errors}
            copy={{
              classLabel: t("com02.fClass"),
              classHelp: t("com02.classHelp"),
              choose: t("com02.chooseClass"),
              event: t("com02.fEvent"),
              recipient: t("com02.fRecipient"),
              channels: t("com02.fChannels"),
              subjects: t("com02.fSubjects"),
              required: t("com02.fRequired"),
              requiredHelp: t("com02.requiredHelp"),
              proof: t("com02.fProof"),
              proofHelp: t("com02.proofHelp"),
              action: t("com02.fAction"),
              lead: t("com02.fLead"),
              leadHelp: t("com02.leadHelp"),
              add: t("com02.add"),
              yes: t("com.yes"),
              no: t("com.no"),
            }}
            locale={locale}
          />
        </Panel>
      ) : null}
      <form id={SEND_FORM} action={sendForApprovalAct} style={{ display: "contents" }}>
        <input type="hidden" name="version" value={version.versionNo} />
      </form>
      <ButtonRow align="between">
        <Button variant="secondary" size="sm" icon="arrow-left" href={routes.opsNoticePolicies()} locale={locale}>
          {t("com02.back")}
        </Button>
        {prepared && data.preparer && version.preparedBy === staff.account ? (
          <ConfirmAct
            formId={SEND_FORM}
            label={t("com02.send")}
            dialog={{ title: t("com02.dlgTitle", { n: version.versionNo }), description: t("com02.dlgText"), confirm: t("com02.send"), back: t("comOps.back") }}
            locale={locale}
          />
        ) : prepared ? (
          <Button variant="primary" size="sm" href={routes.opsNoticePolicyApproval(version.versionNo)} locale={locale}>
            {t("com02.openApproval")}
          </Button>
        ) : null}
      </ButtonRow>
    </>
  );
}
