import { ApprovalPair, Banner, Button, ButtonRow, FactList, Panel, Skeleton, Table, TextField, Toast } from "@/components/r1";
import { Text } from "@/components/Text";
import { ConfirmAct } from "@/features/notices/ConfirmAct";
import { decidePolicyAct } from "@/features/notices/console-actions";
import { className, day, moment, periodWords, policyStateValue, tabRoles } from "@/features/notices/console";
import { comTranslator } from "@/features/notices/copy";
import { NoticeFailure, NoticeFrame } from "@/features/notices/NoticeFrame";
import { readForPage } from "@/lib/api/flash";
import { loadPolicyApproval, type ConsoleAttempt, type PolicyApproval } from "@/lib/api/notices";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/notices";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const FORM = "com03-decide";

/**
 * SCR-COM-03 Approve a policy version, the Approvals surface: the version, its classes and its period, the preparer
 * beside the approver, and Approve and Withdraw for the business approver. Approve is refused rather than hidden for
 * the person who prepared it - the page names the rule and that a different approver completes it (SEG_SAME_ACTOR) -
 * and for a reader with no approving role the controls give way to ROLE_NOT_ASSIGNED. The backend checks both again.
 */
export default async function PolicyApprovalPage({ params, searchParams }: { params: Promise<{ version: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff(...tabRoles("policy"));
  const [{ version: raw }, query] = await Promise.all([params, searchParams]);
  const versionNo = Number(raw);
  const locale = await getLocale();
  const t = comTranslator(locale);
  const view = reviewView(query, CONSOLE_VIEWS);
  const kept = readForPage<ConsoleAttempt>(query);
  const attempt = kept !== null && "version" in kept && kept.version === versionNo ? kept : null;
  const outcome = view === "loading" || !Number.isInteger(versionNo) ? null : await loadPolicyApproval(staff, versionNo, view);
  const failure = !Number.isInteger(versionNo) ? { code: "POLICY_VERSION_NOT_FOUND", traceId: null, retryable: false } : (outcome?.failure ?? null);
  const data = outcome?.data ?? null;

  return (
    <NoticeFrame
      staff={staff}
      tab="policy"
      keys={false}
      header={{
        crumbs: [
          { label: t("com02.crumb"), href: routes.opsNoticePolicies() },
          ...(Number.isInteger(versionNo) ? [{ label: t("comOps.version", { n: raw }), href: routes.opsNoticePolicy(versionNo) }] : []),
        ],
        title: t("com03.title", { n: raw }),
        ...(data !== null ? { status: policyStateValue(data.version.state, t) } : {}),
      }}
      t={t}
      locale={locale}
    >
      {view === "loading" ? (
        <Panel density="console" locale={locale}>
          <Skeleton variant="facts" rows={5} density="console" locale={locale} />
        </Panel>
      ) : null}
      {failure !== null ? <NoticeFailure failure={failure} errTitle={t("com03.errTitle")} t={t} locale={locale} /> : null}
      {data !== null ? <Approval data={data} attempt={attempt} t={t} locale={locale} /> : null}
    </NoticeFrame>
  );
}

function Approval({ data, attempt, t, locale }: { data: PolicyApproval; attempt: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  const { version } = data;
  const done = attempt?.page === "approved" ? attempt : null;
  const refused = attempt?.page === "approval" ? attempt : null;
  const refusal = refused?.refusal ?? null;
  const required = data.classes.filter((entry) => entry.isRequired).length;
  const proof = data.classes.filter((entry) => entry.requiresProof).length;
  const open = version.state === "PREPARED" || version.state === "APPROVED";
  // The segregation line stands for the preparer, and for the server's refusal of their own approval.
  const own = data.reader === "preparer" || refusal?.code === "SEG_SAME_ACTOR";
  const decides = data.reader === "approver" && open;
  const toast =
    done === null
      ? null
      : done.act === "send"
        ? { family: "info" as const, title: t("com03.sentTitle", { n: version.versionNo }), text: t("com03.sentText") }
        : done.act === "approve"
          ? { family: "positive" as const, title: t("com03.approvedTitle", { n: version.versionNo }), text: t("com03.approvedText", { d: day(version.effectiveFrom, locale) }) }
          : { family: "neutral" as const, title: t("com03.withdrawnTitle", { n: version.versionNo }), text: t("com03.withdrawnText", { r: version.withdrawnReason ?? "" }) };
  const refusalWords = (code: string, values: Readonly<Record<string, string | number>>) =>
    t(`com.refusal.${code}.text`, {
      ...values,
      class_name: className(String(values.class_name ?? ""), t),
      state: t(`com.pstateIn.${String(values.state ?? version.state)}`),
    });

  return (
    <>
      {toast !== null ? (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family={toast.family} title={toast.title} locale={locale}>
            {toast.text}
          </Toast>
        </div>
      ) : null}
      {refusal !== null && refusal.code !== "SEG_SAME_ACTOR" && refusal.field !== "reason" ? (
        <Banner family="attention" title={t(`com.refusal.${refusal.code}.title`, refusal.values)} code={refusal.code} live density="console" locale={locale}>
          {refusalWords(refusal.code, refusal.values)}
        </Banner>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--container-xs), 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
        <Panel title={t("com03.summaryTitle")} level={2} gap="lg" density="console" locale={locale}>
          <FactList
            density="console"
            locale={locale}
            items={[
              { label: t("com03.fPrepared"), value: t("com03.preparedValue", { name: version.preparedBy, ts: moment(version.preparedAt, locale) }) },
              { label: t("com03.fSent"), value: version.sentAt, kind: "datetime", missing: t("com03.notSent") },
              { label: t("com03.fPeriod"), value: periodWords(version.effectiveFrom, version.effectiveTo, t, locale) },
              { label: t("com03.fClasses"), value: t("com03.classesValue", { n: data.classes.length, r: required, p: proof }) },
              ...(data.ends !== null ? [{ label: t("com03.fEnds"), value: t("com03.endsValue", { v: data.ends.versionNo, d: day(data.ends.lastDay, locale) }) }] : []),
            ]}
          />
          <Table
            columns={[
              { key: "cls", label: t("com02.cClass") },
              { key: "who", label: t("com02.cRecipient") },
              { key: "required", label: t("com02.cRequired") },
              { key: "proof", label: t("com02.cProof") },
            ]}
            rows={data.classes.map((entry) => ({
              _key: entry.classCode,
              cls: className(entry.classCode, t),
              who: t(`com.role.${entry.recipientRole}`),
              required: entry.isRequired ? t("com.yes") : t("com.no"),
              proof: entry.requiresProof ? t("com.yes") : t("com.no"),
            }))}
            density="console"
            caption={t("com03.classesTitle")}
            empty={{ variant: "governed", title: t("com02.emptyTitle"), text: t("com02.emptyText"), action: false }}
            locale={locale}
          />
        </Panel>
        <Panel title={t("com03.decisionTitle")} level={2} gap="lg" density="console" locale={locale}>
          <ApprovalPair
            preparer={{ name: version.preparedBy, role: t("comOps.officer"), at: version.preparedAt }}
            approver={version.approvedBy !== null ? { name: version.approvedBy, role: t("comOps.approverRole"), at: version.approvedAt ?? "" } : null}
            {...(version.approvedBy === null ? { awaiting: t("com03.awaiting") } : { decision: "approved" as const })}
            {...(own
              ? {
                  sameActor:
                    refusal?.code === "SEG_SAME_ACTOR"
                      ? { code: "SEG_SAME_ACTOR", title: t("com.refusal.SEG_SAME_ACTOR.title"), text: t("com.refusal.SEG_SAME_ACTOR.text"), family: "attention" as const }
                      : { code: "SEG_SAME_ACTOR", title: t("com03.ownTitle"), text: t("com03.ownText"), family: "attention" as const },
                }
              : {})}
            preparerLabel={t("comOps.preparer")}
            approverLabel={t("comOps.approver")}
            locale={locale}
          />
          <Text size="sm" tone="secondary">
            {t("com03.rule")}
          </Text>
          {data.reader === "no-role" && open ? (
            <Banner family="neutral" title={t("com.refusal.ROLE_NOT_ASSIGNED.title")} code="ROLE_NOT_ASSIGNED" density="console" locale={locale}>
              {t("com.refusal.ROLE_NOT_ASSIGNED.text")}
            </Banner>
          ) : null}
          {decides || (own && version.state === "PREPARED") ? (
            <Decide
              data={data}
              own={own}
              note={refused?.note ?? ""}
              reason={refused?.reason ?? ""}
              reasonError={refusal?.field === "reason" ? t("com03.reasonMissing") : null}
              t={t}
              locale={locale}
            />
          ) : (
            <ButtonRow>
              <Button variant="secondary" size="sm" icon="arrow-left" href={routes.opsNoticePolicy(version.versionNo)} locale={locale}>
                {t("com03.back")}
              </Button>
            </ButtonRow>
          )}
        </Panel>
      </div>
    </>
  );
}

/**
 * The note, the reason, Approve and Withdraw. For the preparer Approve stays on the page, refused with the rule, and
 * Withdraw is not theirs; for the approver each act is confirmed, naming the date the version takes effect and the
 * version it ends.
 */
function Decide({
  data,
  own,
  note,
  reason,
  reasonError,
  t,
  locale,
}: {
  data: PolicyApproval;
  own: boolean;
  note: string;
  reason: string;
  reasonError: string | null;
  t: Translate;
  locale: Locale;
}) {
  const { version } = data;
  const prepared = version.state === "PREPARED";
  return (
    <>
      <form id={FORM} action={decidePolicyAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <input type="hidden" name="version" value={version.versionNo} />
        <input type="hidden" name="intent" defaultValue="approve" />
        {!own && prepared ? (
          <TextField label={t("com03.fNote")} helper={t("com03.noteHelp")} name="note" value={note} multiline rows={3} maxLength={500} density="console" locale={locale} />
        ) : null}
        {!own ? (
          <TextField
            label={t("com03.fReason")}
            helper={t("com03.reasonHelp")}
            name="reason"
            value={reason}
            multiline
            rows={2}
            maxLength={500}
            {...(reasonError !== null ? { error: reasonError } : {})}
            density="console"
            locale={locale}
          />
        ) : null}
      </form>
      <ButtonRow align="between">
        <Button variant="secondary" size="sm" icon="arrow-left" href={routes.opsNoticePolicy(version.versionNo)} locale={locale}>
          {t("com03.back")}
        </Button>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {!own ? (
            <ConfirmAct
              formId={FORM}
              intent="withdraw"
              variant="danger"
              label={t("com03.withdraw")}
              dialog={{ title: t("com03.wdTitle", { n: version.versionNo }), description: t("com03.wdText"), confirm: t("com03.wdYes"), back: t("comOps.back") }}
              locale={locale}
            />
          ) : null}
          {prepared ? (
            <ConfirmAct
              formId={FORM}
              intent="approve"
              label={t("com03.approve")}
              disabledReason={own ? t("com03.ownTitle") : null}
              dialog={{
                title: t("com03.dlgTitle", { n: version.versionNo }),
                description:
                  data.ends !== null
                    ? t("com03.dlgEnds", { d: day(version.effectiveFrom, locale), v: data.ends.versionNo, e: day(data.ends.lastDay, locale) })
                    : t("com03.dlgText", { d: day(version.effectiveFrom, locale) }),
                confirm: t("com03.dlgYes"),
                back: t("comOps.back"),
              }}
              locale={locale}
            />
          ) : null}
        </div>
      </ButtonRow>
    </>
  );
}
