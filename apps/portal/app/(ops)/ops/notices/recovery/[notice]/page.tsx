import { Banner, Button, ButtonRow, DateField, Panel, Skeleton, TextField, Timeline, Toast, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { ConfirmAct } from "@/features/notices/ConfirmAct";
import { recordServiceAct, withdrawNoticeAct } from "@/features/notices/console-actions";
import { askedDay, className, day, hoursBetween, moment, noticeStateValue, tabRoles } from "@/features/notices/console";
import { comTranslator } from "@/features/notices/copy";
import { NoticeFailure, NoticeFrame } from "@/features/notices/NoticeFrame";
import { readForPage } from "@/lib/api/flash";
import { loadServiceForm, type ConsoleAttempt, type ServiceView } from "@/lib/api/notices";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/notices";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;
type ServiceAttempt = Extract<ConsoleAttempt, { page: "service" }>;
type WithdrawAttempt = Extract<ConsoleAttempt, { page: "withdraw" }>;

const FORM = "com09-service";
const WITHDRAW_FORM = "com09-withdraw";
const OUTCOME_FAMILY = { attempted: "info", pending: "info", delivered: "positive", failed: "danger" } as const;

/**
 * SCR-COM-09 Record an alternative service: the notice and every attempt above the form; the route and the date of
 * service, the reader as the one who served it, and evidence held elsewhere. The confirmation names the reader,
 * because this is the one act in the family where a person's own account replaces a provider's receipt. A notice
 * already delivered or served shows when, with nothing to record.
 *
 * The page also carries Withdraw (POST /notices/{id}/withdraw), as its states place it: the business approver closes
 * an obligation still owed without serving it, once its class is no longer required. A notice already sent is not
 * withdrawn (NOTICE_ALREADY_SENT: a reissue replaces it); one whose class is still required stays owed, and the
 * control says why; a reader without the approver's role sees it refused rather than hidden.
 */
export default async function AlternativeServicePage({ params, searchParams }: { params: Promise<{ notice: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff(...tabRoles("recovery"));
  const [{ notice: raw }, query] = await Promise.all([params, searchParams]);
  const reference = decodeURIComponent(raw);
  const locale = await getLocale();
  const t = comTranslator(locale);
  const view = reviewView(query, CONSOLE_VIEWS);
  const kept = readForPage<ConsoleAttempt>(query);
  const attempt = kept?.page === "service" && kept.reference === reference ? kept : null;
  const withdrawal = kept?.page === "withdraw" && kept.reference === reference ? kept : null;
  const outcome = view === "loading" ? null : await loadServiceForm(staff, reference, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <NoticeFrame
      staff={staff}
      tab="recovery"
      keys={false}
      header={{
        crumbs: [{ label: t("com09.crumb"), href: routes.opsNoticeRecovery() }, { label: reference }],
        title: data === null ? t("com09.titlePlain") : data.canServe && data.issuedAt !== null ? t("com09.title", { ref: data.reference }) : t("com09.titleNotice", { ref: data.reference }),
        ...(data !== null ? { status: noticeStateValue(data.state, t), meta: meta(data, t) } : {}),
      }}
      t={t}
      locale={locale}
    >
      {view === "loading" ? (
        <Panel density="console" locale={locale}>
          <Skeleton variant="facts" rows={6} density="console" locale={locale} />
        </Panel>
      ) : null}
      {failure !== null ? <NoticeFailure failure={failure} errTitle={t("com09.errTitle")} t={t} locale={locale} /> : null}
      {data !== null ? <Service data={data} attempt={attempt} withdrawal={withdrawal} t={t} locale={locale} /> : null}
    </NoticeFrame>
  );
}

/** "Five attempts over 24 h, none delivered", or how far the treatment has got. */
function meta(data: ServiceView, t: Translate): string {
  const failed = data.attempts.filter((attempt) => attempt.outcome === "failed");
  const first = failed[0]?.reportedAt;
  const last = data.attempts.at(-1);
  const n = last?.attemptNo ?? 0;
  if (data.exhausted && first !== undefined && last !== undefined) return t("com09.meta", { n, h: hoursBetween(first, last.reportedAt) });
  return t("com09.metaRunning", { n });
}

function Service({ data, attempt, withdrawal, t, locale }: { data: ServiceView; attempt: ServiceAttempt | null; withdrawal: WithdrawAttempt | null; t: Translate; locale: Locale }) {
  const back = (
    <Button variant="secondary" size="sm" icon="arrow-left" href={routes.opsNoticeRecovery()} locale={locale}>
      {t("com09.back")}
    </Button>
  );
  const refusal = attempt?.refusal ?? null;
  const discharged = data.discharged ?? (refusal?.code === "NOTICE_ALREADY_DISCHARGED" ? { on: String(refusal.values.date ?? ""), by: "served" as const } : null);
  if (discharged !== null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
        <ViewState
          view="refused"
          refusal={{ code: "NOTICE_ALREADY_DISCHARGED", title: t("com09.dischargedTitle"), text: t("com09.dischargedText", { d: day(discharged.on, locale) }), family: "neutral" }}
          level={2}
          density="console"
          locale={locale}
        />
        {back}
      </div>
    );
  }
  if (data.withdrawal.kind === "withdrawn") {
    const { by, reason, at } = data.withdrawal;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-4)", maxWidth: "var(--container-3xl)" }}>
        {withdrawal !== null && withdrawal.refusal === null ? (
          <Toast family="positive" title={t("com09.withdrawnDone", { ref: data.reference })} locale={locale}>
            {t("com09.withdrawnDoneText")}
          </Toast>
        ) : null}
        <ViewState
          view="empty"
          empty={{ variant: "governed", title: t("com09.withdrawnTitle"), text: t("com09.withdrawnText", { by, ts: moment(at, locale), reason: withdrawnReason(reason, t) }), action: false }}
          level={2}
          density="console"
          locale={locale}
        />
        {back}
      </div>
    );
  }
  const missing = refusal?.code === "ALTERNATIVE_SERVICE_INCOMPLETE" ? t("com.refusal.ALTERNATIVE_SERVICE_INCOMPLETE.text", { element: t(`com.missing.${String(refusal.values.element ?? "route")}`) }) : null;
  const serviceable = data.canServe && (data.state === "ISSUED" || data.state === "UNDELIVERED");
  return (
    <>
      {data.issuedAt === null ? (
        <Banner family="neutral" title={t("com09.notIssuedTitle")} density="console" locale={locale}>
          {t("com09.notIssuedText", { state: t(`com.state.${data.state}`) })}
        </Banner>
      ) : null}
      {data.state === "ISSUED" && data.issuedAt !== null ? (
        <Banner family="neutral" title={t("com09.sentTitle", { recipient: data.destination ?? data.recipient ?? "", d: day(data.issuedAt, locale) })} code="NOTICE_ALREADY_SENT" density="console" locale={locale}>
          {t("com09.sentText")}
        </Banner>
      ) : null}
      {refusal !== null && refusal.code !== "ALTERNATIVE_SERVICE_INCOMPLETE" ? (
        <Banner family="attention" title={t(`com.refusal.${refusal.code}.title`)} code={refusal.code} live density="console" locale={locale}>
          {t(`com.refusal.${refusal.code}.text`)}
        </Banner>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--container-xs), 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
        <Panel title={t("com09.attemptsTitle")} description={className(data.classCode, t)} level={2} compact density="console" locale={locale}>
          <Timeline
            entries={data.attempts.map((outcome, index) => ({
              id: `${index}`,
              at: outcome.reportedAt,
              actor: t(`com.source.${outcome.reportedSourceRef}`),
              title: `${t("com06.cAttempt")} ${outcome.attemptNo}: ${t(`com.outcome.${outcome.outcome}`)}`,
              detail: `${t(`com.route.${outcome.route}`)}, ${outcome.providerResponse}${outcome.exhausted ? `. ${t("com06.exhausted")}` : ""}`,
              status: { family: OUTCOME_FAMILY[outcome.outcome], label: t(`com.outcome.${outcome.outcome}`) },
            }))}
            locale={locale}
          />
        </Panel>
        {serviceable ? (
        <Panel title={t("com09.formTitle")} level={2} gap="lg" density="console" locale={locale}>
          <form id={FORM} action={recordServiceAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            <input type="hidden" name="notice" value={data.reference} />
            <TextField
              label={t("com09.fRoute")}
              helper={t("com09.routeHelp")}
              name="route"
              value={attempt?.typed.route ?? ""}
              maxLength={200}
              required
              {...(missing !== null && refusal?.field === "route" ? { error: missing } : {})}
              density="console"
              locale={locale}
            />
            <DateField
              label={t("com09.fDate")}
              helper={t("com09.dateHelp")}
              name="servedOn"
              value={(attempt !== null ? askedDay(attempt.typed.servedOn) : null) ?? data.today}
              max={data.today}
              today={data.today}
              required
              {...(missing !== null && refusal?.field === "servedOn" ? { error: missing } : {})}
              density="console"
              locale={locale}
            />
            <TextField label={t("com09.fBy")} value={t("com09.byValue", { name: data.servedBy })} readOnly density="console" locale={locale} />
            <TextField label={t("com09.fEvidence")} helper={t("com09.evidenceHelp")} name="evidence" value={attempt?.typed.evidence ?? ""} maxLength={200} density="console" locale={locale} />
            <Text size="sm" tone="secondary">
              {t("com09.kept")}
            </Text>
          </form>
          <ButtonRow align="between">
            {back}
            <ConfirmAct
              formId={FORM}
              label={t("com09.record")}
              dialog={{
                title: t("com09.dlgTitle", { ref: data.reference }),
                description: t("com09.dlgText", { name: data.servedBy, date: "{date}" }),
                confirm: t("com09.dlgYes"),
                back: t("comOps.back"),
              }}
              fill={{ field: "servedOn", token: "{date}" }}
              locale={locale}
            />
          </ButtonRow>
        </Panel>
        ) : (
          <Panel title={t("com09.formTitle")} level={2} gap="md" density="console" locale={locale}>
            <Text size="sm" tone="secondary">
              {data.canServe ? t("com09.notIssuedText", { state: t(`com.state.${data.state}`) }) : t("com09.serveRole")}
            </Text>
            <ButtonRow>{back}</ButtonRow>
          </Panel>
        )}
      </div>
      {data.withdrawal.kind !== "sent" && data.withdrawal.kind !== "discharged" ? <Withdraw data={data} attempt={withdrawal} t={t} locale={locale} /> : null}
    </>
  );
}

/** Why a notice was withdrawn, in words: the policy version that stopped requiring its class, or the approver's reason. */
function withdrawnReason(reason: string, t: Translate): string {
  const version = /^POLICY_VERSION_(\d+)$/.exec(reason);
  return version !== null ? t("com06.withdrawnByPolicy", { n: version[1] ?? "" }) : reason;
}

/**
 * Withdraw, for a notice still owed: its reason and the confirmation naming the reader. Refused here - with the rule -
 * where the reader is not the business approver, or where the class is still required and the obligation stays open.
 */
function Withdraw({ data, attempt, t, locale }: { data: ServiceView; attempt: WithdrawAttempt | null; t: Translate; locale: Locale }) {
  const refusal = attempt?.refusal ?? null;
  const values = { class_name: className(data.classCode, t), recipient: data.recipient ?? data.destination ?? "", state: t(`com.state.${data.state}`) };
  const open = data.withdrawal.kind === "open" ? data.withdrawal.reason : null;
  const refused = !data.canWithdraw ? t("com09.withdrawRole") : open !== null ? t(`com.refusal.${open}.text`, values) : null;
  return (
    <Panel title={t("com09.withdrawTitle")} description={t("com09.withdrawText")} level={2} gap="lg" density="console" locale={locale}>
      {refusal !== null && refusal.field !== "reason" ? (
        <Banner family="attention" title={t(`com.refusal.${refusal.code}.title`)} code={refusal.code} live density="console" locale={locale}>
          {t(`com.refusal.${refusal.code}.text`, { authority: t("com.serviceOwner"), ...values })}
        </Banner>
      ) : null}
      <form id={WITHDRAW_FORM} action={withdrawNoticeAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", maxWidth: "var(--container-2xl)" }}>
        <input type="hidden" name="notice" value={data.reference} />
        <TextField
          label={t("com09.fReason")}
          helper={t("com09.reasonHelp")}
          name="reason"
          value={attempt?.reason ?? ""}
          multiline
          rows={3}
          maxLength={500}
          required
          {...(refusal?.field === "reason" ? { error: t("com09.reasonMissing") } : {})}
          density="console"
          locale={locale}
        />
      </form>
      <ButtonRow align="end">
        <ConfirmAct
          formId={WITHDRAW_FORM}
          label={t("com09.withdraw")}
          variant="danger"
          disabledReason={refused}
          dialog={{ title: t("com09.withdrawDlgTitle", { ref: data.reference }), description: t("com09.withdrawDlgText"), confirm: t("com09.withdrawYes"), back: t("comOps.back") }}
          locale={locale}
        />
      </ButtonRow>
    </Panel>
  );
}
