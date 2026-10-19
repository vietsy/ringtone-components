import {
  Banner,
  Columns,
  Divider,
  EmptyState,
  FactList,
  PageHeader,
  Panel,
  Skeleton,
  Table,
  TextField,
  Toast,
  ViewState,
} from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ConfirmSubmit } from "@/features/parties/ConfirmSubmit";
import { acknowledgeAction, resolveAction } from "@/features/parties/premises-actions";
import { clock, count, exceptionStatus, moment, premisesRefusal, premisesTranslator, stamp } from "@/features/parties/premises-copy";
import { SubmitButton } from "@/features/parties/SubmitButton";
import { readForPage } from "@/lib/api/flash";
import { loadExceptions, type ExceptionQueue, type ExceptionRow, type PremisesAttempt } from "@/lib/api/premises";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PREMISES_VIEWS } from "@/lib/mock/premises";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const RESOLVE = "pty15-resolve";

/**
 * SCR-PTY-15 Exception queue, on the register data console: each exception this family raises with its kind, its
 * subject, when it was raised, its state and who handles it; the one opened shows under the table with its condition.
 * Acknowledge puts the reader's name on it; Resolve needs what was done and asks first, and while the condition holds
 * it is refused naming the figure that has not changed (FR-PTY-041). The security admin works here too (finding F-11).
 * An area withdrawn with no successor (FR-PTY-040) names the premises still in it; it closes once none is.
 */
export default async function ExceptionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-DAT", "ACT-SEC", "ACT-AUD");
  const query = await searchParams;
  const locale = await getLocale();
  const t = premisesTranslator(locale);
  const asked = reviewView(query, PREMISES_VIEWS);
  const outcome = asked === "loading" ? null : await loadExceptions(staff, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const attempt = readForPage<PremisesAttempt>(query);
  const requested = typeof query.exception === "string" ? query.exception : null;
  const selected = data !== null ? (data.rows.find((row) => row.id === requested) ?? data.rows.find((row) => row.state !== "RESOLVED") ?? data.rows[0] ?? null) : null;
  const kept = attempt !== null && selected !== null && attempt.subject === selected.id && (attempt.form === "acknowledge" || attempt.form === "resolve") ? attempt : null;

  return (
    <OpsFrame
      console="registerData"
      current="exceptions"
      staff={staff}
      searchLabel={t("prm.searchData")}
      keyMap={[
        ...(data !== null && data.rows.length > 0 ? [{ keys: ["J", "K"], label: t("pty15.kMove") }, { keys: ["Enter"], label: t("pty15.kOpen") }] : []),
        { keys: ["Esc"], label: t("pty15.kEsc") },
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("prm.crumbData") }]} title={t("pty15.title")} {...(data !== null ? { meta: meta(data, t, locale) } : {})} locale={locale} />
        {typeof kept?.done === "string" ? (
          <div style={{ maxWidth: "var(--container-lg)" }}>
            <Toast family="positive" title={t(kept.form === "acknowledge" ? "pty15.ackedTitle" : "pty15.resolvedTitle")} locale={locale}>
              {kept.form === "acknowledge" ? t("pty15.ackedText") : t("pty15.resolvedText", { t: `${clock(kept.done)} (GMT+7)` })}
            </Toast>
          </div>
        ) : null}
        {asked === "loading" ? (
          <>
            <Table columns={[{ key: "kind", label: t("pty15.cKind") }]} rows={[]} loading={4} density="console" caption={t("pty15.title")} locale={locale} />
            <Panel compact locale={locale}>
              <Skeleton variant="facts" rows={4} density="console" locale={locale} />
            </Panel>
          </>
        ) : failure !== null || data === null ? (
          <ViewState view="error" errorTitle={t("pty15.errTitle")} errorText={t("prm.errText")} {...(failure?.traceId ? { traceId: failure.traceId } : {})} retryable density="console" locale={locale} />
        ) : (
          <>
            {data.rows.every((row) => row.state === "RESOLVED") ? (
              <EmptyState variant="governed" title={t("pty15.emptyTitle")} action={false} density="console" locale={locale}>
                {t("pty15.emptyText")}
              </EmptyState>
            ) : null}
            {data.rows.length > 0 ? (
              <Table
                columns={[
                  { key: "kind", label: t("pty15.cKind") },
                  { key: "subject", label: t("pty15.cSubject"), kind: "stack" },
                  { key: "raised", label: t("pty15.cRaised"), kind: "stamp", nowrap: true },
                  { key: "st", label: t("pty15.cState"), kind: "status" },
                  { key: "handled", label: t("pty15.cHandled"), kind: "stack", minWidth: "var(--space-52)" },
                ]}
                rows={data.rows.map((row) => exceptionRow(row, selected?.id === row.id, t, locale))}
                density="console"
                rowFocus
                sortNote={t("pty15.sortNote")}
                caption={t("pty15.title")}
                locale={locale}
              />
            ) : null}
            {selected !== null ? <Selected row={selected} data={data} attempt={kept} security={holds(staff, "ACT-SEC", "ACT-AUD")} t={t} locale={locale} /> : null}
          </>
        )}
      </div>
    </OpsFrame>
  );
}

function meta(data: ExceptionQueue, t: Translate, locale: Locale): string {
  const n = (state: ExceptionRow["state"]) => count(data.rows.filter((row) => row.state === state).length, locale);
  return t("pty15.meta", { open: n("OPEN"), ack: n("ACKNOWLEDGED"), res: n("RESOLVED"), ts: moment(data.asOf, locale) });
}

function subjectOf(row: ExceptionRow, t: Translate): { text: string; detail?: string } {
  switch (row.subject.kind) {
    case "REGISTER":
      return { text: t("pty15.register") };
    case "AUTHORITY":
      return { text: t("pty15.authority", { r: row.subject.reference }), detail: t("pty15.authorityDetail", { person: row.subject.person, party: row.subject.party }) };
    case "PREMISES":
      return { text: row.subject.name };
    case "AREA":
      return { text: row.subject.area, detail: t("pty15.areaDetail", { v: row.subject.version }) };
  }
}

function exceptionRow(row: ExceptionRow, selected: boolean, t: Translate, locale: Locale): Record<string, unknown> {
  const condition = row.condition;
  const message =
    row.state === "RESOLVED"
      ? null
      : condition.kind === "OVERDUE"
        ? condition.holds
          ? { severity: "warning", text: t("pty15.msgOverdue", { ts: condition.lastCompleted !== null ? moment(condition.lastCompleted, locale) : t("pty14.never") }) }
          : { severity: "info", text: t("pty15.msgOverdueGone", { ts: `${clock(condition.completedSince ?? "")} (GMT+7)` }) }
        : condition.kind === "REVOCATION"
          ? { severity: "info", text: condition.holds ? t("pty15.msgRevocation") : t("pty15.msgRevocationGone") }
          : condition.kind === "AREA"
            ? { severity: condition.holds ? "warning" : "info", text: condition.holds ? t("pty15.msgArea", { n: count(condition.premises, locale) }) : t("pty15.msgAreaGone") }
            : null;
  return {
    _key: row.id,
    _href: routes.opsRegisterExceptions(row.id),
    ...(selected ? { _selected: true } : {}),
    ...(message !== null ? { _message: message } : {}),
    kind: t(`prm.excKind.${row.kind}`),
    subject: subjectOf(row, t),
    raised: row.raisedAt,
    st: exceptionStatus(row.state, t),
    handled:
      row.resolved !== null
        ? { text: row.resolved.by, detail: t("pty15.resolved", { ts: stamp(row.resolved.at, locale) }) }
        : row.acknowledged !== null
          ? { text: row.acknowledged.by, detail: t("pty15.acked", { ts: stamp(row.acknowledged.at, locale) }) }
          : { text: t("pty15.nobody"), muted: true },
  };
}

/** The exception opened under the table: its facts and condition at left, Acknowledge and Resolve at right. */
function Selected({ row, data, attempt, security, t, locale }: { row: ExceptionRow; data: ExceptionQueue; attempt: PremisesAttempt | null; security: boolean; t: Translate; locale: Locale }) {
  const condition = row.condition;
  const failed = attempt?.refusal ?? null;
  const facts = factsOf(row, data, t, locale);
  const canAct = data.mayAct && row.state !== "RESOLVED";
  const still = failed?.code === "CONDITION_STILL_HOLDS";
  const stillTitle =
    condition.kind === "OVERDUE"
      ? condition.lastCompleted !== null
        ? t("pty15.shTitle", { ts: moment(condition.lastCompleted, locale) })
        : t("pty15.shTitleNever")
      : condition.kind === "REVOCATION"
        ? t("pty15.shTitleRevocation", { ts: moment(condition.revokedAt, locale) })
        : condition.kind === "AREA"
          ? t("pty15.shTitleArea", { n: count(condition.premises, locale) })
          : premisesRefusal(t, "CONDITION_STILL_HOLDS").title;
  const links = [
    ...(condition.kind === "OVERDUE" && !still ? [{ kind: "link" as const, label: t("pty15.openRuns"), href: routes.opsReconciliation() }] : []),
    ...(row.subject.kind === "AUTHORITY" && security ? [{ kind: "link" as const, label: t("pty15.openAuthority"), href: routes.securityPartyAuthority(row.subject.reference) }] : []),
    ...(row.subject.kind === "PREMISES" ? [{ kind: "link" as const, label: t("pty16.openPremises"), href: routes.opsPremises(row.subject.record) }] : []),
    ...(row.subject.kind === "AREA" ? [{ kind: "link" as const, label: t("pty15.openArea"), href: routes.opsPremisesRegister({ area: row.subject.area }) }] : []),
  ];
  return (
    <Panel title={t(`prm.excKind.${row.kind}`)} status={exceptionStatus(row.state, t)} {...(links.length > 0 ? { actions: links } : {})} compact locale={locale}>
      <Columns single={!canAct} gap={8}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
          {failed !== null && failed.code === "ALREADY_ACKNOWLEDGED" ? (
            <Banner family="attention" title={premisesRefusal(t, failed.code, failed.values).title} code={failed.code} compact density="console" live locale={locale}>
              {premisesRefusal(t, failed.code, failed.values).text}
            </Banner>
          ) : null}
          {failed !== null && failed.code === "EXCEPTION_RESOLVED" ? (
            <Banner family="attention" title={premisesRefusal(t, failed.code).title} code={failed.code} compact density="console" live locale={locale}>
              {premisesRefusal(t, failed.code).text}
            </Banner>
          ) : null}
          <FactList items={facts} density="console" locale={locale} />
          {still ? (
            <Banner
              family="attention"
              title={stillTitle}
              code="CONDITION_STILL_HOLDS"
              {...(condition.kind === "OVERDUE" ? { action: { label: t("pty15.openRuns"), href: routes.opsReconciliation(), variant: "secondary" as const } } : {})}
              compact
              density="console"
              live
              locale={locale}
            >
              {premisesRefusal(t, "CONDITION_STILL_HOLDS").text}
            </Banner>
          ) : null}
        </div>
        {canAct ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
            {row.acknowledged === null ? (
              <>
                <Text size="sm" tone="secondary">
                  {t("pty15.ackLine")}
                </Text>
                <form action={acknowledgeAction.bind(null, row.id)}>
                  <SubmitButton variant="secondary" size="sm" locale={locale}>
                    {t("pty15.ack")}
                  </SubmitButton>
                </form>
                <Divider />
              </>
            ) : null}
            <form id={RESOLVE} action={resolveAction.bind(null, row.id)} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <TextField
                label={t("pty15.resolution")}
                helper={t("pty15.resolutionHelp")}
                name="resolution"
                value={typeof attempt?.values.resolution === "string" ? attempt.values.resolution : ""}
                {...(failed?.code === "RESOLUTION_REQUIRED" ? { error: premisesRefusal(t, failed.code).text } : {})}
                multiline
                rows={3}
                required
                width="100%"
                density="console"
                locale={locale}
              />
              <div>
                <ConfirmSubmit
                  formId={RESOLVE}
                  label={t("pty15.resolve")}
                  shortcut="Alt+R"
                  dialog={{
                    title: t("pty15.dlgTitle", { kind: t(`prm.excKind.${row.kind}`) }),
                    description: row.kind === "RECONCILIATION_OVERDUE" ? t("pty15.dlgText") : t("pty15.dlgTextPlain"),
                    confirm: t("pty15.dlgYes"),
                    back: t("pty15.dlgNo"),
                  }}
                  typed={[{ name: "resolution", label: t("pty15.fResolution"), none: t("pty15.noResolution") }]}
                  density="console"
                  locale={locale}
                >
                  {condition.kind === "OVERDUE" ? <FactList items={[lastRunFact(row, data, t, locale)]} density="console" locale={locale} /> : null}
                </ConfirmSubmit>
              </div>
            </form>
          </div>
        ) : null}
      </Columns>
    </Panel>
  );
}

function lastRunFact(row: ExceptionRow, data: ExceptionQueue, t: Translate, locale: Locale) {
  if (row.condition.kind !== "OVERDUE" || row.condition.lastCompleted === null) return { label: t("pty15.fLast"), value: null, missing: t("pty14.never") };
  const last = row.condition.lastCompleted;
  const days = row.condition.daysSince ?? 0;
  return row.condition.holds
    ? { label: t("pty15.fLast"), value: t("pty15.ago", { ts: moment(last, locale), n: count(days, locale) }), note: t("pty15.intervalNote", { n: String(data.intervalDays) }) }
    : { label: t("pty15.fLast"), value: days === 0 ? t("pty15.today", { ts: moment(last, locale) }) : t("pty15.ago", { ts: moment(last, locale), n: count(days, locale) }), note: t("pty15.restarts", { n: String(data.intervalDays) }) };
}

function factsOf(row: ExceptionRow, data: ExceptionQueue, t: Translate, locale: Locale) {
  const taken = row.acknowledged !== null ? { label: t("pty15.fTaken"), value: `${row.acknowledged.by}, ${moment(row.acknowledged.at, locale)}` } : { label: t("pty15.fTaken"), value: null, missing: t("pty15.nobodyFact") };
  const resolved =
    row.resolved !== null
      ? [
          { label: t("pty15.fResolvedBy"), value: `${row.resolved.by}, ${moment(row.resolved.at, locale)}` },
          { label: t("pty15.fResolution"), value: row.resolved.resolution, missing: t("pty15.noResolution") },
        ]
      : [];
  const condition = row.condition;
  switch (condition.kind) {
    case "OVERDUE":
      return [
        { label: t("pty15.fSubject"), value: subjectOf(row, t).text },
        { label: t("pty15.fRaised"), value: moment(row.raisedAt, locale), note: t("pty15.raisedByCheck") },
        lastRunFact(row, data, t, locale),
        ...(row.resolved === null ? [taken] : resolved),
      ];
    case "REVOCATION": {
      const subject = row.subject.kind === "AUTHORITY" ? row.subject : null;
      const points = condition.stopped.map((point) => t(`pty15.point.${point.point}`, { t: clock(point.at) })).join(", ");
      return [
        taken,
        { label: t("pty15.fSubject"), value: subject?.reference ?? "", kind: "id" as const, ...(subject !== null ? { note: `${t("pty15.authorityDetail", { person: subject.person, party: subject.party })}.` } : {}) },
        { label: t("pty15.fRaised"), value: moment(row.raisedAt, locale), note: t("pty15.raisedByProp") },
        { label: t("pty15.fCondition"), value: condition.holds ? t("pty15.condRevocation") : t("pty15.condRevocationGone"), ...(points !== "" ? { note: t("pty15.condRevNote", { points }) } : {}) },
        ...resolved,
      ];
    }
    case "AREA":
      return [
        { label: t("pty15.fSubject"), value: subjectOf(row, t).text, note: subjectOf(row, t).detail ?? "" },
        { label: t("pty15.fRaised"), value: moment(row.raisedAt, locale), note: t("pty15.raisedByRepoint") },
        ...(row.resolved === null
          ? [taken, { label: t("pty15.fCondition"), value: condition.holds ? t("pty15.condArea", { n: count(condition.premises, locale) }) : t("pty15.condAreaGone"), note: t("pty15.condAreaNote") }]
          : resolved),
      ];
    case "DERIVATION":
      return [
        { label: t("pty15.fSubject"), value: subjectOf(row, t).text },
        { label: t("pty15.fRaised"), value: moment(row.raisedAt, locale), note: t("pty15.raisedByDerivation") },
        ...(row.resolved === null ? [taken, { label: t("pty15.fCondition"), value: t("pty15.condDerivation") }] : resolved),
      ];
  }
}
