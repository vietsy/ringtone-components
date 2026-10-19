import { Banner, Button, ButtonRow, EmptyState, FactList, PageHeader, Panel, Timeline, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { certificationCell, count, day, deviceStatus, moment, plropsTranslator, said } from "@/features/player-ops/copy";
import { Failure } from "@/features/player-ops/Failure";
import { RecordCondition } from "@/features/player-ops/RecordCondition";
import { readForPage } from "@/lib/api/flash";
import { DEVICE_STATUSES, loadDeviceRecord, type ConditionAttempt, type ConditionRow, type DeviceRecord, type Officer } from "@/lib/api/player";
import { requireStaff, type Staff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PLR02_VIEWS } from "@/lib/mock/player";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PLR-02 Device record: the condition in force with its cause and the time it took effect, every other condition
 * at its own dates (one recorded for a time still to come waits for it), and Record a condition. A loss or a
 * compromise quarantines the evidence from the reported time rather than deleting it, and the banner above says how
 * much is held and for which disposition. The auditor reads the record (PERM-472) with the action shown unavailable;
 * the security officer records a condition (PERM-473) but not a transfer, which is the operations officer's alone.
 */
export default async function DeviceRecordPage({ params, searchParams }: { params: Promise<{ device: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-AUD", "ACT-SEC");
  const [{ device }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = plropsTranslator(locale);
  const view = reviewView(query, PLR02_VIEWS);
  const attempt = readForPage<ConditionAttempt>(query);
  const mine = attempt?.page === "condition" && attempt.device === device ? attempt : null;
  const outcome = view === "loading" ? null : await loadDeviceRecord(staff, device, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  // The estate is the operations officer's (PERM-471): anyone else closes to the console's landing.
  const back = estateReader(staff) ? routes.opsDevices() : routes.ops();

  return (
    <OpsFrame console="operations" current="devices" staff={staff} searchLabel={t("plrops.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("plrops.area") }, { label: t("plr01.title"), ...(estateReader(staff) ? { href: routes.opsDevices() } : {}) }, { label: data?.id ?? device }]}
          title={data?.id ?? t("plr02.pageTitle")}
          {...(data !== null
            ? {
                status: deviceStatus(data.status, t),
                meta: t("plr02.meta", { p: data.premises.name, s: data.supplier, i: data.identity, d: day(data.enrolledAt, locale) }),
              }
            : {})}
          locale={locale}
        >
          <Button variant="quiet" size="sm" href={back} locale={locale}>
            {t("plrops.close")}
          </Button>
        </PageHeader>
        {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={6} density="console" locale={locale} /> : null}
        {failure !== null ? (
          <Failure failure={failure} errorText={t("plr02.errText")} prefix="plrops" action={{ label: t(estateReader(staff) ? "plr02.back" : "plr02.backConsole"), href: back }} t={t} locale={locale} />
        ) : null}
        {data !== null ? <Record data={data} attempt={mine} visit={typeof query.attempt === "string" ? query.attempt : ""} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

const estateReader = (staff: Staff) => staff.roles.includes("ACT-OPS");

const person = (who: Officer, t: Translate) => ({ name: who.name, detail: t(`plrops.role.${who.role}`) });

/** The condition in force: the newest whose effective time has come. */
const inForceRow = (data: DeviceRecord) => data.conditions.find((row) => !row.pending);

function Record({ data, attempt, visit, t, locale }: { data: DeviceRecord; attempt: ConditionAttempt | null; visit: string; t: Translate; locale: Locale }) {
  const current = inForceRow(data);
  const latest = data.conditions[0];
  const overlap = attempt?.code === "CONDITION_OVERLAPS";
  const tried = attempt?.values.condition ?? "";
  const triedLabel = DEVICE_STATUSES.some((status) => status === tried) ? t(`plr02.cond.${tried}`) : "";
  const refused = attempt !== null && attempt.done === null && !overlap && attempt.code !== null;
  const next = data.next.filter((status) => status !== "TRANSFERRED" || data.acts.transfer);
  const disabledReason = !data.acts.record
    ? t("plr02.readOnly")
    : next.length > 0
      ? null
      : data.status === "ENROLLED"
        ? t("plr02.recordEnrolled")
        : t("plr02.recordNone", { s: t(`plrops.status.${data.status}`) });
  return (
    <>
      {attempt !== null && attempt.done !== null ? (
        <Banner
          family="positive"
          title={
            attempt.doneInForce || attempt.doneFrom === null
              ? t("plr02.done", { id: data.id, s: t(`plrops.status.${attempt.done}`) })
              : t("plr02.doneLater", { id: data.id, s: t(`plrops.status.${attempt.done}`), ts: moment(attempt.doneFrom, locale) })
          }
          compact
          density="console"
          locale={locale}
        />
      ) : null}
      {data.scheduled !== null && current !== undefined ? (
        <Banner
          family="info"
          title={t("plr02.scheduledTitle", { s: t(`plrops.status.${data.scheduled.status}`), ts: moment(data.scheduled.effectiveFrom, locale) })}
          density="console"
          locale={locale}
        >
          {t("plr02.scheduledText", { s: t(`plrops.status.${current.status}`) })}
        </Banner>
      ) : null}
      {data.held > 0 && data.disposition !== null ? (
        <Banner family="attention" title={t("plr02.heldTitle", { n: count(data.held, locale) })} density="console" locale={locale}>
          {data.credentialRevokedAt !== null && current !== undefined
            ? t("plr02.heldTextLost", { r: moment(data.credentialRevokedAt, locale), e: moment(current.effectiveFrom, locale), dsp: data.disposition })
            : t("plr02.heldText", { dsp: data.disposition })}
        </Banner>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)", alignItems: "flex-start" }}>
        <div style={{ flex: "3 1 var(--container-md)", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {overlap ? (
            <Banner family="neutral" title={t("plr02.notRecorded", { s: triedLabel })} code="CONDITION_OVERLAPS" density="console" locale={locale}>
              {latest !== undefined
                ? `${t("plrops.refusal.CONDITION_OVERLAPS")} ${t("plr02.overlapLatest", { s: t(`plrops.status.${latest.status}`), ts: moment(latest.effectiveFrom, locale) })}`
                : t("plrops.refusal.CONDITION_OVERLAPS")}
            </Banner>
          ) : (
            <Panel title={t("plr02.inForce")} level={2} density="console" locale={locale}>
              <FactList items={facts(data, t, locale)} density="console" locale={locale} />
              <ButtonRow>
                <RecordCondition
                  // Each answer opens the record afresh: no dialogue of the act before stays open.
                  key={visit}
                  device={data.id}
                  premises={data.premises.name}
                  next={next.map((status) => ({ value: status, label: t(`plr02.cond.${status}`) }))}
                  causes={Object.fromEntries(Object.entries(data.causes).map(([status, list]) => [status, (list ?? []).map((cause) => ({ value: cause.id, label: said(cause.text, locale) }))]))}
                  transferTo={data.transferTo.map((premises) => ({ value: premises.id, label: premises.name, detail: premises.area }))}
                  waiting={data.waiting ?? 0}
                  disabledReason={disabledReason}
                  initial={attempt !== null && (refused || attempt.field !== null) ? attempt.values : null}
                  refusal={
                    refused && attempt !== null && attempt.code !== null
                      ? { code: attempt.code, title: tried === "TRANSFERRED" ? t("plr02.notRecordedTransfer") : t("plr02.notRecorded", { s: triedLabel }), text: t(`plrops.refusal.${attempt.code}`) }
                      : null
                  }
                  field={attempt?.field ?? null}
                  words={{
                    record: t("plr02.record"),
                    formTitle: t("plr02.formTitle"),
                    formDesc: t("plr02.formDesc"),
                    formDescTransfer: t("plr02.formDescTransfer"),
                    condition: t("plr02.fCondition"),
                    choose: t("plr02.choose"),
                    cause: t("plr02.fCause"),
                    effective: t("plr02.fFrom"),
                    effectiveHelp: t("plr02.effectiveHelp"),
                    effectiveLost: t("plr02.fHappened"),
                    effectiveHelpLost: t("plr02.effectiveHelpLost"),
                    reported: t("plr02.fReportedAt"),
                    reportedHelp: t("plr02.reportedHelp"),
                    reportedInvalid: t("plr02.reportedInvalid"),
                    newPremises: t("plr02.newPremises"),
                    cross: t("plrops.refusal.ENTITLEMENT_WOULD_CROSS"),
                    pending: t("plr02.pending"),
                    optSubmit: t("plr02.optSubmit"),
                    optDiscard: t("plr02.optDiscard"),
                    discardHint: t("plr02.discardHint"),
                    ground: t("plr02.ground"),
                    groundHelp: t("plr02.groundHelp"),
                    next: t("plr02.next"),
                    nextTransfer: t("plr02.recordTransfer"),
                    keep: t("plr02.keep"),
                    cfTitle: t("plr02.cfTitle"),
                    cfTitleTransfer: t("plr02.cfTitleTransfer"),
                    cfText: t("plr02.cfText"),
                    cfTextLost: t("plr02.cfTextLost"),
                    cfTextTransfer: t("plr02.cfTextTransfer"),
                    confirm: t("plr02.confirm"),
                    confirmTransfer: t("plr02.recordTransfer"),
                    fDevice: t("plr02.fDevice"),
                    fCondition: t("plr02.fCondition"),
                    fCause: t("plr02.fCause"),
                    fFrom: t("plr02.fLeaves"),
                    fTo: t("plr02.fMovesTo"),
                    fEffective: t("plr02.fFrom"),
                    fPending: t("plr02.pending"),
                    fPendingSubmit: t("plr02.fPendingSubmit"),
                    fPendingDiscard: t("plr02.fPendingDiscard"),
                    fGround: t("plr02.ground"),
                    fReported: t("plr02.fReportedAt"),
                    noTime: t("plr02.noTime"),
                    premisesMissing: t("plr02.premisesMissing"),
                    conditionMissing: t("plr02.conditionMissing"),
                  }}
                  locale={locale}
                />
              </ButtonRow>
            </Panel>
          )}
        </div>
        <div style={{ flex: "2 1 var(--container-xs)", minWidth: 0 }}>
          <Panel title={t("plr02.history")} level={2} density="console" locale={locale}>
            {data.conditions.length > 1 ? (
              <Timeline entries={data.conditions.map((row, index) => timelineEntry(row, index === 0, t, locale))} locale={locale} />
            ) : (
              <EmptyState variant="not-started" title={t("plr02.noHistory")} level={3} density="console" locale={locale}>
                {t("plr02.noHistoryText")}
              </EmptyState>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

/** The snapshot the device held, superseded once a transfer took it from its premises. */
function snapshotFact(data: DeviceRecord, t: Translate) {
  return data.snapshot === null
    ? []
    : [{ label: t("plr02.fSnapshot"), value: t(`plr02.snapshot.${data.snapshot.status}`, { v: data.snapshot.version }) }];
}

/** A transfer's decision on the evidence the device held: what, how many, and the ground of a discard. */
function evidenceFacts(row: ConditionRow, t: Translate, locale: Locale) {
  const evidence = row.evidence;
  if (evidence === null) return [];
  const what =
    evidence.count === null
      ? t(`plr02.decision.${evidence.decision}`, { from: evidence.former.name })
      : t(`plr02.decisionCount.${evidence.decision}`, { from: evidence.former.name, n: count(evidence.count, locale) });
  return [
    { label: t("plr02.fDecision"), value: what, note: t("plr02.fDecisionNote", { name: row.recordedBy?.name ?? "", ts: moment(row.recordedAt, locale) }) },
    ...(evidence.ground !== null ? [{ label: t("plr02.ground"), value: evidence.ground }] : []),
  ];
}

/** The facts the board draws for the condition in force: a loss names who reported it and what is held. */
function facts(data: DeviceRecord, t: Translate, locale: Locale) {
  const current = inForceRow(data);
  const identity = { label: t("plr02.fIdentity"), value: data.identity, kind: "mono" as const, provenance: "registry-sourced" as const, provenanceDetail: "IAM" };
  const held = { label: t("plr02.fHeld"), value: data.held, kind: "count" as const, ...(data.disposition !== null && data.held > 0 ? { note: t("plr02.fHeldNote", { dsp: data.disposition }) } : {}) };
  const status = { label: t("plr02.fStatus"), value: deviceStatus(data.status, t), kind: "status" as const };
  if (current === undefined) return [status, identity];
  const from = { label: t("plr02.fFrom"), value: current.effectiveFrom, kind: "datetime" as const };
  if (data.status === "LOST" || data.status === "COMPROMISED") {
    return [
      status,
      { ...from, note: t("plr02.fFromNoteLost") },
      ...(current.reportedAt !== null ? [{ label: t("plr02.fReportedAt"), value: current.reportedAt, kind: "datetime" as const }] : []),
      { label: t("plr02.fRecorded"), value: current.recordedAt, kind: "datetime" as const },
      { label: t("plr02.fCause"), value: current.cause === null ? null : said(current.cause, locale), missing: t("plr02.none") },
      ...(current.reportedBy !== null ? [{ label: t("plr02.fReportedBy"), value: person(current.reportedBy, t), kind: "person" as const }] : []),
      identity,
      held,
    ];
  }
  if (data.status === "TRANSFERRED") {
    return [
      status,
      from,
      { label: t("plr02.fRecorded"), value: current.recordedAt, kind: "datetime" as const },
      { label: t("plr02.fCause"), value: current.cause === null ? null : said(current.cause, locale), missing: t("plr02.none") },
      { label: t("plr02.fPremises"), value: data.premises.name },
      ...evidenceFacts(current, t, locale),
      ...snapshotFact(data, t),
      identity,
    ];
  }
  if (data.status === "ENROLLED") {
    return [
      status,
      { ...from, note: t("plr02.fFromNoteNew") },
      { label: t("plr02.fEnrolledBy"), value: person(data.enrolledBy, t), kind: "person" as const },
      identity,
      { label: t("plr02.fCert"), value: certificationCell(data.certification, t, locale), kind: "status" as const },
      { label: t("plr02.fPaired"), value: t(data.paired ? "plr02.paired" : "plr02.notPaired") },
      held,
    ];
  }
  return [
    status,
    from,
    ...(current.cause !== null
      ? [
          { label: t("plr02.fRecorded"), value: current.recordedAt, kind: "datetime" as const },
          { label: t("plr02.fCause"), value: said(current.cause, locale) },
        ]
      : []),
    { label: t("plr02.fPremises"), value: data.premises.name },
    {
      label: t("plr02.fWaiting"),
      value: data.waiting,
      kind: "count" as const,
      missing: t("plr02.none"),
      ...(data.offlineSince !== null ? { note: t("plr02.fWaitingNote", { ts: moment(data.offlineSince, locale) }) } : {}),
    },
    ...snapshotFact(data, t),
    identity,
    ...(data.held > 0 ? [held] : []),
  ];
}

/** One condition on the timeline: one still to come says from when, the one in force since when, an earlier one until when. */
function timelineEntry(row: ConditionRow, current: boolean, t: Translate, locale: Locale) {
  const title =
    row.status === "ENROLLED"
      ? t("plr02.tEnrolled")
      : row.status === "ACTIVE" && (row.from === "ENROLLED" || row.from === "TRANSFERRED")
        ? t("plr02.tActive")
        : t("plr02.tChange", { from: row.from === null ? "" : t(`plrops.status.${row.from}`), to: t(`plrops.status.${row.status}`) });
  return {
    title,
    status: deviceStatus(row.status, t),
    at: row.recordedAt,
    actor: row.recordedBy === null ? t("plr02.system") : t("plr02.actor", { name: row.recordedBy.name, role: t(`plrops.role.${row.recordedBy.role}`) }),
    detail: [
      row.pending
        ? t("plr02.tPending", { ts: moment(row.effectiveFrom, locale) })
        : row.effectiveTo === null
          ? t("plr02.tFrom", { ts: moment(row.effectiveFrom, locale) })
          : t("plr02.tUntil", { ts: moment(row.effectiveTo, locale) }),
      ...(row.premisesTo !== null ? [t("plr02.tTo", { p: row.premisesTo.name })] : []),
      ...(row.evidence !== null
        ? [
            row.evidence.count === null
              ? t(`plr02.decision.${row.evidence.decision}`, { from: row.evidence.former.name })
              : t(`plr02.decisionCount.${row.evidence.decision}`, { from: row.evidence.former.name, n: count(row.evidence.count, locale) }),
          ]
        : []),
    ].join(" "),
    ...(current ? { current: true } : {}),
  };
}
