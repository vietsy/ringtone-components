import { redirect } from "next/navigation";
import {
  Banner,
  Button,
  ButtonRow,
  Columns,
  DateField,
  Divider,
  FactList,
  FilterBar,
  Panel,
  Select,
  SidePanel,
  Table,
  TextField,
  Timeline,
  Toast,
} from "@/components/r1";
import { Text } from "@/components/Text";
import { ConfirmAct } from "@/features/notices/ConfirmAct";
import { reissueNoticeAct } from "@/features/notices/console-actions";
import { askedDay, className, elementWords, firstTab, lateWords, moment, NOTICE_STATES, noticeStateValue, periodWords, shortDay } from "@/features/notices/console";
import { comTranslator, elementsOf } from "@/features/notices/copy";
import { NoticeFailure, NoticeFrame } from "@/features/notices/NoticeFrame";
import { readForPage } from "@/lib/api/flash";
import { loadNoticeQueue, type ConsoleAttempt, type NoticeDetail, type NoticeQueue, type QueueFilter } from "@/lib/api/notices";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/notices";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;
type ReissueAttempt = Extract<ConsoleAttempt, { page: "reissue" }>;

const REISSUE_FORM = "com07-reissue";

const text = (value: string | string[] | undefined) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/**
 * SCR-COM-06 Notice queue, the landing of the notice workspace: every notice in the state it is in, UNMET and
 * UNDELIVERED among them rather than filtered out of the default view, and a notice opened beside the queue with what
 * it said, where it went and everything reported about its delivery, with Reissue for a notice issued or delivered
 * (SCR-COM-07). A member whose roles do not open the queue (the business approver) lands on the first page of the
 * workspace they do.
 */
export default async function NoticeQueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-SUP", "ACT-AUD", "ACT-BIZ-APR");
  if (!holds(staff, "ACT-OPS", "ACT-AUD")) redirect(firstTab(staff));
  const params = await searchParams;
  const locale = await getLocale();
  const t = comTranslator(locale);
  const view = reviewView(params, CONSOLE_VIEWS);
  const askedState = text(params.state);
  const chosen: QueueFilter = {
    classCode: text(params.class),
    state: NOTICE_STATES.find((state) => state === askedState) ?? null,
    dueFrom: askedDay(params["due-from"] ?? params.from),
    dueTo: askedDay(params["due-to"] ?? params.to),
  };
  const kept = readForPage<ConsoleAttempt>(params);
  const reissue = kept?.page === "reissue" ? kept : null;
  const outcome = view === "loading" ? null : await loadNoticeQueue(staff, chosen, text(params.notice), view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <NoticeFrame
      staff={staff}
      tab="queue"
      keys={failure === null}
      header={{
        title: t("com06.title"),
        ...(data !== null ? { meta: t("com06.meta", { n: data.total, ts: moment(data.asOf, locale) }) } : {}),
        children: (
          <Button variant="secondary" size="sm" icon="chart-column" href={routes.opsNoticeTimeliness()} locale={locale}>
            {t("com06.position")}
          </Button>
        ),
      }}
      t={t}
      locale={locale}
    >
      {failure !== null ? (
        <NoticeFailure failure={failure} errTitle={t("com06.errTitle")} t={t} locale={locale} />
      ) : (
        <Queue data={data} chosen={chosen} staff={holds(staff, "ACT-OPS")} reissue={reissue} t={t} locale={locale} />
      )}
    </NoticeFrame>
  );
}

function Queue({ data, chosen, staff, reissue, t, locale }: { data: NoticeQueue | null; chosen: QueueFilter; staff: boolean; reissue: ReissueAttempt | null; t: Translate; locale: Locale }) {
  const rows = data?.rows ?? [];
  const opened = data?.opened ?? null;
  const link = (notice: string | null) => routes.opsNotices({ classCode: chosen.classCode, state: chosen.state, from: chosen.dueFrom, to: chosen.dueTo, notice });
  const chips = [
    ...(chosen.classCode !== null ? [{ label: t("com06.chipClass", { c: className(chosen.classCode, t) }) }] : []),
    ...(chosen.state !== null ? [{ label: t("com06.chipState", { s: t(`com.state.${chosen.state}`) }) }] : []),
    ...(chosen.dueFrom !== null || chosen.dueTo !== null
      ? [{ label: t("com06.chipDue", { p: chosen.dueFrom !== null ? periodWords(chosen.dueFrom, chosen.dueTo, t, locale) : shortDay(chosen.dueTo ?? "", locale) }) }]
      : []),
  ];
  return (
    <>
      <form action={routes.opsNotices()}>
        <FilterBar
          chips={chips}
          {...(data !== null ? { summary: rows.length === 1 ? t("com06.countOne") : t("com06.count", { n: rows.length }) } : {})}
          active={chips.length > 0}
          label={t("com06.filters")}
          shortcut="/"
          locale={locale}
        >
          <Select
            label={t("com06.fClass")}
            name="class"
            options={[{ value: "", label: t("com06.anyClass") }, ...(data?.classes ?? []).map((code) => ({ value: code, label: className(code, t) }))]}
            value={chosen.classCode ?? ""}
            density="console"
            width="var(--space-64)"
            locale={locale}
          />
          <Select
            label={t("com06.fState")}
            name="state"
            options={[{ value: "", label: t("com06.anyState") }, ...NOTICE_STATES.map((state) => ({ value: state, label: t(`com.state.${state}`) }))]}
            value={chosen.state ?? ""}
            density="console"
            width="var(--space-48)"
            locale={locale}
          />
          <DateField
            label={t("com06.fDue")}
            name="due"
            range
            fromLabel={t("comOps.from")}
            toLabel={t("comOps.to")}
            {...(chosen.dueFrom !== null ? { value: chosen.dueFrom } : {})}
            {...(chosen.dueTo !== null ? { to: chosen.dueTo } : {})}
            helper={false}
            density="console"
            locale={locale}
          />
          <Button variant="primary" size="sm" type="submit" loading={data === null} locale={locale}>
            {t("comOps.show")}
          </Button>
        </FilterBar>
      </form>
      <Columns side="md" single={!(opened !== null)}>
        <Panel title={t("com06.panel")} level={2} compact gap="md" density="console" locale={locale}>
          <Table
            columns={[
              { key: "ref", label: t("com06.cRef"), kind: "id" },
              { key: "cls", label: t("com06.cClass"), minWidth: "var(--space-40)" },
              { key: "st", label: t("com06.cState"), kind: "status" },
              { key: "due", label: t("com06.cDue"), kind: "datetime", nowrap: true, hidden: opened !== null },
              { key: "issued", label: t("com06.cIssued"), kind: "datetime", nowrap: true, missing: t("com06.notIssued"), hidden: opened !== null },
            ]}
            rows={rows.map((row) => ({
              _key: row.reference,
              _href: link(row.reference),
              ...(row.reference === opened?.reference ? { _selected: true } : {}),
              ...(row.replay !== null ? { _message: { severity: "neutral", text: t("com06.replay", { d: shortDay(row.replay.lastAt, locale) }), code: "NOTICE_ALREADY_ISSUED" } } : {}),
              ref: row.reference,
              cls: className(row.classCode, t),
              st: noticeStateValue(row.state, t),
              due: row.dueAt,
              issued: row.issuedAt,
            }))}
            loading={data === null ? 4 : false}
            density="console"
            rowFocus
            empty={{
              variant: "filtered",
              title: t("com06.emptyTitle"),
              text: t("com06.emptyText"),
              action: (
                <Button variant="secondary" size="sm" href={routes.opsNotices()} locale={locale}>
                  {t("com06.clear")}
                </Button>
              ),
            }}
            caption={t("com06.title")}
            locale={locale}
          />
          <Text size="sm" tone="secondary">
            {t("com06.legend")}
          </Text>
        </Panel>
        {opened !== null ? (
          <Opened
            notice={opened}
            close={link(null)}
            operator={staff}
            attempt={reissue !== null && (reissue.reissued === opened.reference || reissue.reference === opened.reference) ? reissue : null}
            t={t}
            locale={locale}
          />
        ) : null}
      </Columns>
    </>
  );
}

const OUTCOME_FAMILY = { attempted: "info", pending: "info", delivered: "positive", failed: "danger" } as const;

const OPEN_STATES: readonly NoticeDetail["state"][] = ["DUE", "COMPOSED", "UNMET", "UNDELIVERED"];

/** Why a notice due now is still DUE, in words. */
function waitingWords(waiting: NonNullable<NoticeDetail["waiting"]>, t: Translate): string {
  if (waiting.reason === "TEMPLATE_VERSION_NOT_EFFECTIVE") return t("com06.waitingTemplate");
  if (waiting.reason === "CONTACT_REGISTER_ENTRY_MISSING") return t("com06.waitingRegister");
  return t("com06.waitingElement", { element: elementWords(waiting.element ?? "", t) });
}

/**
 * The notice opened beside the queue: whom and where it went to, what it said, and every outcome with who reported
 * it, in words. There is no control that changes what was sent, and the page says why; a correction is a reissue,
 * which keeps this notice as it is and names it.
 */
function Opened({ notice, close, operator, attempt, t, locale }: { notice: NoticeDetail; close: string; operator: boolean; attempt: ReissueAttempt | null; t: Translate; locale: Locale }) {
  const elements = notice.content !== null ? elementsOf(notice.content, t, locale) : null;
  // SCR-COM-07's exits: the recovery queue and the unmet list always, the run where a track change raised the notice.
  const ways = operator
    ? [
        { label: t("com06.openRecovery"), href: routes.opsNoticeRecovery(), variant: "secondary" as const },
        ...(notice.run !== null ? [{ label: t("com06.openRun"), href: routes.opsTrackChange(notice.run), variant: "secondary" as const }] : []),
        { label: t("com06.openUnmet"), href: routes.opsUnmetNotices(), variant: "secondary" as const },
        ...(OPEN_STATES.includes(notice.state) ? [{ label: t("com06.openService"), href: routes.opsNoticeService(notice.reference), variant: "secondary" as const }] : []),
      ]
    : [];
  return (
    <SidePanel
      title={notice.reference}
      eyebrow={className(notice.classCode, t)}
      status={noticeStateValue(notice.state, t)}
      actions={[...ways, { label: t("com06.close"), href: close, variant: "quiet" }]}
      onClose={false}
      density="console"
      locale={locale}
    >
      <FactList
        density="console"
        locale={locale}
        items={[
          { label: t("com06.fRecipient"), value: notice.recipient ?? t("comOps.raiser") },
          {
            label: t("com06.fRoute"),
            value: notice.channel !== null && notice.destination !== null ? t("com06.routeValue", { channel: t(`com.channel.${notice.channel}`), destination: notice.destination }) : null,
            ...(notice.unmetReason !== null
              ? { note: t(`com.refusal.${notice.unmetReason}.text`, { recipient: notice.recipient ?? t("comOps.raiserIn") }) }
              : {}),
          },
          { label: t("com06.cDue"), value: notice.dueAt, kind: "datetime" },
          { label: t("com06.fIssued"), value: notice.issuedAt, kind: "datetime", missing: t("com06.notIssued") },
          ...(notice.deliveredAt !== null ? [{ label: t("com06.fDelivered"), value: notice.deliveredAt, kind: "datetime" as const }] : []),
          ...(notice.waiting !== null ? [{ label: t("com06.fWaiting"), value: waitingWords(notice.waiting, t) }] : []),
          ...(notice.lateMinutes !== null ? [{ label: t("com06.fLate"), value: lateWords(notice.lateMinutes, t) }] : []),
          {
            label: t("com06.fOccurrence"),
            value: notice.occurrence.ref,
            ...(notice.occurrence.module !== null && notice.occurrence.eventKind !== null
              ? { note: t("com06.occurrenceNote", { module: notice.occurrence.module, kind: notice.occurrence.eventKind }) }
              : {}),
          },
          { label: t("com06.fPolicy"), value: t("comOps.version", { n: notice.policyVersion }) },
          ...(notice.content !== null ? [{ label: t("com06.fTemplate"), value: t("com06.templateValue", { n: notice.content.templateVersion }) }] : []),
          ...(notice.device !== null
            ? [
                {
                  label: t("com06.fDevice"),
                  value: notice.device.asAt !== null ? t("com.deviceAt", { condition: t(`com.device.${notice.device.condition}`), ts: moment(notice.device.asAt, locale) }) : t(`com.device.${notice.device.condition}`),
                  note: t("com06.deviceNote"),
                },
              ]
            : []),
          ...(notice.supersedes !== null ? [{ label: t("com06.fSupersedes"), value: notice.supersedes, ...(notice.reissueReason !== null ? { note: notice.reissueReason } : {}) }] : []),
          ...(notice.supersededBy !== null ? [{ label: t("com06.fSupersededBy"), value: notice.supersededBy }] : []),
          ...(notice.withdrawn !== null
            ? [
                {
                  label: t("com06.fWithdrawn"),
                  value: t("com06.withdrawnValue", { by: notice.withdrawn.by, ts: moment(notice.withdrawn.at, locale) }),
                  note: /^POLICY_VERSION_\d+$/.test(notice.withdrawn.reason) ? t("com06.withdrawnByPolicy", { n: notice.withdrawn.reason.replace("POLICY_VERSION_", "") }) : notice.withdrawn.reason,
                },
              ]
            : []),
        ]}
      />
      <Divider />
      <Panel variant="plain" level={3} title={t("com06.contentTitle")} compact gap="md" density="console" locale={locale}>
        {elements !== null && notice.content !== null ? (
          <>
            <FactList
              density="console"
              locale={locale}
              items={[
                { label: t("com10.about"), value: elements.subject },
                { label: t("com10.todo"), value: elements.action },
                { label: t("com10.by"), value: notice.content.deadline, kind: "date" },
                { label: t("com10.ifNot"), value: elements.consequence },
                { label: t("com10.contact"), value: elements.contact },
              ]}
            />
            <Text size="sm" tone="secondary">
              {t("com06.immutable")}
            </Text>
          </>
        ) : (
          <Text size="sm" tone="secondary">
            {t("com06.notComposed")}
          </Text>
        )}
      </Panel>
      <Divider />
      <Panel variant="plain" level={3} title={t("com06.outcomesTitle")} compact gap="md" density="console" locale={locale}>
        {notice.outcomes.length > 0 ? (
          <Timeline
            entries={notice.outcomes.map((outcome, index) => ({
              id: `${index}`,
              at: outcome.reportedAt,
              actor: t(`com.source.${outcome.reportedSourceRef}`),
              title: `${t("com06.cAttempt")} ${outcome.attemptNo}: ${t(`com.outcome.${outcome.outcome}`)}`,
              detail: `${t(`com.route.${outcome.route}`)}, ${outcome.providerResponse}${outcome.exhausted ? `. ${t("com06.exhausted")}` : ""}`,
              status: { family: OUTCOME_FAMILY[outcome.outcome], label: t(`com.outcome.${outcome.outcome}`) },
            }))}
            locale={locale}
          />
        ) : (
          <Text size="sm" tone="secondary">
            {t("com06.noOutcomes")}
          </Text>
        )}
      </Panel>
      {operator ? (
        <>
          <Divider />
          <Reissue notice={notice} attempt={attempt} t={t} locale={locale} />
        </>
      ) : null}
      {notice.service !== null ? (
        <>
          <Divider />
          <Panel variant="plain" level={3} title={t("com06.serviceTitle")} compact density="console" locale={locale}>
            <FactList
              density="console"
              locale={locale}
              items={[
                { label: t("com06.fServiceRoute"), value: notice.service.route },
                { label: t("com06.fServedOn"), value: notice.service.servedOn, kind: "date" },
                { label: t("com06.fServedBy"), value: notice.service.servedBy, note: moment(notice.service.recordedAt, locale) },
                { label: t("com06.fEvidence"), value: notice.service.evidence },
              ]}
            />
          </Panel>
        </>
      ) : null}
    </SidePanel>
  );
}

/**
 * Reissue (POST /notices/{id}/reissue), for a notice issued or delivered: its reason, then a confirmation naming what
 * follows. Refused here with the rule where the notice is in no state to be reissued or the reader lacks the role.
 */
function Reissue({ notice, attempt, t, locale }: { notice: NoticeDetail; attempt: ReissueAttempt | null; t: Translate; locale: Locale }) {
  const refusal = attempt !== null && attempt.reference === notice.reference ? attempt.refusal : null;
  const done = attempt !== null && attempt.refusal === null && attempt.reissued === notice.reference ? attempt : null;
  const reissuable = notice.state === "ISSUED" || notice.state === "DELIVERED";
  const refused = !notice.canReissue ? t("com06.reissueRole") : !reissuable ? t("com06.reissueWhy") : null;
  return (
    <Panel variant="plain" level={3} title={t("com06.reissueTitle")} compact gap="md" density="console" locale={locale}>
      {done !== null ? (
        <Toast family="positive" title={t("com06.reissuedTitle", { ref: notice.reference })} locale={locale}>
          {t("com06.reissuedText")}
        </Toast>
      ) : null}
      {refusal !== null && refusal.field !== "reason" ? (
        <Banner family="attention" title={t(`com.refusal.${refusal.code}.title`)} code={refusal.code} live density="console" locale={locale}>
          {[
            t(`com.refusal.${refusal.code}.text`, {
              class_name: className(notice.classCode, t),
              authority: t("comOps.officer"),
              state: t(`com.state.${String(refusal.values.state ?? notice.state)}`),
            }),
            ...(String(refusal.values.reference ?? "") !== "" ? [t("com06.replacedBy", { ref: String(refusal.values.reference) })] : []),
          ].join(" ")}
        </Banner>
      ) : null}
      {reissuable && done === null ? (
        <>
          <form id={REISSUE_FORM} action={reissueNoticeAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <input type="hidden" name="notice" value={notice.reference} />
            <TextField
              label={t("com06.fReason")}
              helper={t("com06.reasonHelp")}
              name="reason"
              value={attempt?.reason ?? ""}
              multiline
              rows={3}
              maxLength={500}
              required
              {...(refusal?.field === "reason" ? { error: t("com.refusal.REISSUE_REASON_MISSING.text") } : {})}
              density="console"
              locale={locale}
            />
          </form>
          <ButtonRow align="end">
            <ConfirmAct
              formId={REISSUE_FORM}
              label={t("com06.reissue")}
              variant="secondary"
              disabledReason={refused}
              dialog={{ title: t("com06.reissueDlgTitle", { ref: notice.reference }), description: t("com06.reissueDlgText", { ref: notice.reference }), confirm: t("com06.reissueYes"), back: t("comOps.back") }}
              locale={locale}
            />
          </ButtonRow>
        </>
      ) : (
        <Text size="sm" tone="secondary">
          {refused ?? t("com06.reissuedText")}
        </Text>
      )}
    </Panel>
  );
}
