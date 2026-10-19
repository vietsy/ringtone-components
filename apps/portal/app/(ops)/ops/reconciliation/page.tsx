import { Banner, EmptyState, FactList, PageHeader, Panel, Skeleton, Table, Toast, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ConfirmSubmit } from "@/features/parties/ConfirmSubmit";
import { repointAction, startRunAction } from "@/features/parties/premises-actions";
import { clock, count, moment, premisesRefusal, premisesTranslator, runStatus, stamp } from "@/features/parties/premises-copy";
import { readForPage } from "@/lib/api/flash";
import { loadReconciliation, type PremisesAttempt, type ReconciliationView, type RepointAnswer, type RunRow } from "@/lib/api/premises";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PREMISES_VIEWS } from "@/lib/mock/premises";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const FORM = "pty14-start";

/**
 * SCR-PTY-14 Reconciliation runs and differences, on the register data console. It leads with the last completed
 * run and its age, the interval measured from it (the default in force), the next run due and the population route;
 * then the runs, newest first, with the row of the run not started yet; then the differences awaiting a decision.
 * When the interval has passed with no completed run, a banner says so and that the overdue exception is open
 * (FR-PTY-041). Start a run asks first; while one runs it is unavailable with RUN_ALREADY_RUNNING's sentence.
 * Under the runs, the data owner re-points the register to a new geography version where a published successor table
 * leads to it (FR-PTY-040); an area withdrawn with no successor keeps its premises and opens NO_SUCCESSOR_AREA.
 */
export default async function ReconciliationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-DAT", "ACT-AUD");
  const query = await searchParams;
  const locale = await getLocale();
  const t = premisesTranslator(locale);
  const asked = reviewView(query, PREMISES_VIEWS);
  const outcome = asked === "loading" ? null : await loadReconciliation(staff, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const attempt = readForPage<PremisesAttempt>(query);
  const kept = attempt?.form === "run" ? attempt : null;
  const refused = kept?.refusal ?? null;
  const repoint = attempt?.form === "repoint" ? attempt : null;
  const repointed = typeof repoint?.done === "string" ? (JSON.parse(repoint.done) as RepointAnswer) : null;
  const running = data?.running ?? null;
  const startWhy = running !== null ? premisesRefusal(t, "RUN_ALREADY_RUNNING").text : null;

  return (
    <OpsFrame
      console="registerData"
      current="reconciliation"
      staff={staff}
      searchLabel={t("prm.searchData")}
      keyMap={[{ keys: ["Esc"], label: t("pty14.kEsc") }]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("prm.crumbData") }]}
          title={t("pty14.title")}
          {...(data !== null ? { status: runStatus(data.state, t), meta: t("pty14.meta", { ts: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        >
          {data !== null && data.mayStart ? (
            <form id={FORM} action={startRunAction}>
              <ConfirmSubmit
                formId={FORM}
                label={t("pty14.start")}
                disabledReason={startWhy}
                shortcut="Alt+T"
                dialog={{ title: t("pty14.dlgTitle"), description: t("pty14.dlgText"), confirm: t("pty14.dlgYes"), back: t("pty14.dlgNo") }}
                density="console"
                locale={locale}
              >
                <FactList items={[{ label: t("pty14.fRoute"), value: t("pty14.routeVal") }, lastFact(data, t, locale)]} density="console" locale={locale} />
              </ConfirmSubmit>
            </form>
          ) : null}
        </PageHeader>
        {typeof kept?.done === "string" ? (
          <div style={{ maxWidth: "var(--container-lg)" }}>
            <Toast family="positive" title={t("pty14.startedTitle")} locale={locale}>
              {t("pty14.startedText")}
            </Toast>
          </div>
        ) : null}
        {repointed !== null ? (
          <div style={{ maxWidth: "var(--container-lg)" }}>
            <Toast family="positive" title={t("pty14.geoDoneTitle")} locale={locale}>
              {t("pty14.geoDoneText", { n: count(repointed.repointed, locale) })}
            </Toast>
          </div>
        ) : null}
        {[...(repointed?.withdrawn ?? []), ...(repoint?.refusal?.code === "NO_SUCCESSOR_AREA" ? [{ area: repoint.refusal.values.area ?? "", premises: Number(repoint.refusal.values.premises ?? "0"), exception: repoint.refusal.values.exception ?? "" }] : [])].map((left) => (
          <Banner
            key={left.area}
            family="attention"
            title={premisesRefusal(t, "NO_SUCCESSOR_AREA", { area: left.area }).title}
            code="NO_SUCCESSOR_AREA"
            action={{ label: t("pty14.openException"), href: routes.opsRegisterExceptions(left.exception), variant: "secondary" as const }}
            density="console"
            live
            locale={locale}
          >
            {`${premisesRefusal(t, "NO_SUCCESSOR_AREA").text} ${t("pty14.geoLeft", { n: count(left.premises, locale) })}`}
          </Banner>
        ))}
        {repoint?.refusal !== null && repoint?.refusal !== undefined && repoint.refusal.code !== "NO_SUCCESSOR_AREA" ? (
          <Banner family="attention" title={premisesRefusal(t, repoint.refusal.code, repoint.refusal.values).title} code={repoint.refusal.code} density="console" live locale={locale}>
            {premisesRefusal(t, repoint.refusal.code, repoint.refusal.values).text}
          </Banner>
        ) : null}
        {refused !== null ? (
          <Banner
            family={refused.code === "NO_POPULATION_ROUTE" ? "neutral" : "attention"}
            title={premisesRefusal(t, refused.code).title}
            code={refused.code}
            density="console"
            live
            locale={locale}
          >
            {premisesRefusal(t, refused.code).text}
          </Banner>
        ) : null}
        {asked === "loading" ? (
          <>
            <Panel title={t("pty14.lastTitle")} compact locale={locale}>
              <Skeleton variant="facts" rows={4} density="console" locale={locale} />
            </Panel>
            <Panel title={t("pty14.runsTitle")} compact locale={locale}>
              <Skeleton variant="table" rows={3} density="console" locale={locale} />
            </Panel>
          </>
        ) : failure !== null || data === null ? (
          <ViewState view="error" errorTitle={t("pty14.errTitle")} errorText={t("prm.errText")} {...(failure?.traceId ? { traceId: failure.traceId } : {})} retryable density="console" locale={locale} />
        ) : (
          <>
            <Runs data={data} t={t} locale={locale} />
            <Geography data={data} t={t} locale={locale} />
          </>
        )}
      </div>
    </OpsFrame>
  );
}

/** The last completed run with its age in whole days, which the reader acts on (FR-PTY-041). */
function lastFact(data: ReconciliationView, t: Translate, locale: Locale) {
  const last = data.limitation.lastCompleted;
  if (last === null) return { label: t("pty14.fLast"), value: null, missing: t("pty14.never") };
  const days = data.limitation.daysSince ?? 0;
  return { label: t("pty14.fLast"), value: days === 0 ? t("pty14.agoToday", { ts: moment(last, locale) }) : t("pty14.ago", { ts: moment(last, locale), n: count(days, locale) }) };
}

function Runs({ data, t, locale }: { data: ReconciliationView; t: Translate; locale: Locale }) {
  const limitation = data.limitation;
  const late = data.state === "OVERDUE" || (data.state === "RUNNING" && data.nextDue !== null && Date.parse(data.nextDue) <= Date.parse(data.asOf)) || (data.state === "RUNNING" && limitation.lastCompleted === null);
  const due = data.nextDue !== null ? moment(data.nextDue, locale) : "";
  const kind = t("prm.excKind.RECONCILIATION_OVERDUE");
  const refusedLatest = data.runs.find((run) => run.startedAt !== null)?.state === "REFUSED";
  const differences = data.differences;
  const ran = data.runs.some((run) => run.startedAt !== null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
      {refusedLatest || data.connection === "UNAVAILABLE" ? (
        <Banner family="neutral" title={premisesRefusal(t, "NO_POPULATION_ROUTE").title} code="NO_POPULATION_ROUTE" density="console" locale={locale}>
          {premisesRefusal(t, "NO_POPULATION_ROUTE").text}
        </Banner>
      ) : null}
      {late ? (
        <Banner
          family="attention"
          title={limitation.lastCompleted === null ? t("pty14.neverBanner") : t("pty14.odTitle", { n: count(limitation.daysSince ?? 0, locale), i: String(limitation.intervalDays) })}
          {...(data.overdueException !== null ? { action: { label: t("pty14.openException"), href: routes.opsRegisterExceptions(data.overdueException), variant: "secondary" as const } } : {})}
          density="console"
          locale={locale}
        >
          {limitation.lastCompleted === null ? t("pty14.neverBannerText", { kind }) : t(data.state === "RUNNING" ? "pty14.odRunText" : "pty14.odText", { due, kind })}
        </Banner>
      ) : null}
      <Panel title={t("pty14.lastTitle")} compact locale={locale}>
        <FactList
          items={[
            lastFact(data, t, locale),
            { label: t("pty14.fInterval"), value: t("pty14.interval", { n: String(limitation.intervalDays) }), note: t("pty14.intervalNote") },
            data.nextDue === null
              ? { label: t("pty14.fDue"), value: null, missing: t("pty14.dueNever") }
              : {
                  label: t("pty14.fDue"),
                  value: due,
                  note: Date.parse(data.nextDue) <= Date.parse(data.asOf) ? t("pty14.dueOverdue") : t("pty14.dueIn", { n: count(Math.ceil((Date.parse(data.nextDue) - Date.parse(data.asOf)) / 86_400_000), locale) }),
                },
            { label: t("pty14.fRoute"), value: t("pty14.routeVal"), note: data.connection === "UNAVAILABLE" ? t("pty14.routeDown") : t("pty14.routeNote") },
          ]}
          density="console"
          locale={locale}
        />
      </Panel>
      <Panel title={t("pty14.runsTitle")} compact locale={locale}>
        {ran ? (
          <Table
            columns={[
              { key: "run", label: t("pty14.cRun"), kind: "stack", minWidth: "var(--space-48)" },
              { key: "route", label: t("pty14.cRoute") },
              { key: "st", label: t("pty14.cState"), kind: "status" },
              { key: "completed", label: t("pty14.cCompleted"), kind: "stamp", nowrap: true },
              { key: "compared", label: t("pty14.cCompared"), kind: "count" },
              { key: "diff", label: t("pty14.cDiff"), kind: "count" },
              { key: "awaiting", label: t("pty14.cAwaiting"), kind: "count" },
            ]}
            rows={data.runs.map((run) => runRow(run, data, t, locale))}
            density="console"
            sortNote={t("pty14.sortNote")}
            caption={t("pty14.runsTitle")}
            locale={locale}
          />
        ) : (
          <EmptyState variant="governed" title={t("pty14.neverTitle")} action={false} density="console" locale={locale}>
            {t("pty14.neverText", { n: String(limitation.intervalDays) })}
          </EmptyState>
        )}
      </Panel>
      {differences !== null ? (
        <Panel
          title={t("pty14.diffTitle")}
          description={
            differences.relationship + differences.overridden + differences.licensing > 0
              ? t("pty14.diffDesc", { ts: moment(differences.run.startedAt, locale) })
              : t("pty14.diffDescNone", { ts: moment(differences.run.startedAt, locale) })
          }
          compact
          locale={locale}
        >
          <FactList
            items={[
              { label: t("pty14.dLicensing"), value: differences.licensing, kind: "count" },
              {
                label: t("pty14.dRelationship"),
                value: differences.relationship,
                kind: "count",
                ...(differences.relationshipNames.length > 0 ? { note: t("pty14.dRelNote", { names: differences.relationshipNames.join(", ") }) } : {}),
              },
              { label: t("pty14.dOverridden"), value: differences.overridden, kind: "count" },
            ]}
            columns={2}
            density="console"
            locale={locale}
          />
        </Panel>
      ) : null}
    </div>
  );
}

/** One run: when it started and what it was due for, its route and state, and the counts once it has finished. */
function runRow(run: RunRow, data: ReconciliationView, t: Translate, locale: Locale): Record<string, unknown> {
  const due = t("pty14.due", { ts: stamp(run.dueAt, locale) });
  // The completion an incomplete run left as the last one: the latest before it started (SM-194 transition 7).
  const lastCompleted =
    data.runs
      .filter((entry) => entry.state === "COMPLETED" && entry.completedAt !== null && run.startedAt !== null && Date.parse(entry.completedAt) < Date.parse(run.startedAt))
      .map((entry) => entry.completedAt as string)
      .sort((a, b) => Date.parse(a) - Date.parse(b))
      .at(-1) ?? null;
  const counted = (value: number | null, missing: string) => (value !== null ? value : { missing });
  const base = { _key: run.id, st: runStatus(run.state, t) };
  if (run.startedAt === null) {
    return { ...base, run: { text: t("pty14.notStarted"), detail: due }, route: { missing: t("pty14.noRouteYet") }, completed: { missing: t("pty14.notDone") }, compared: null, diff: null, awaiting: null };
  }
  const detail = run.firstLoad ? t("pty14.firstRun") : run.startedBy !== null ? t("pty14.startedBy", { due, p: run.startedBy }) : due;
  const missing = run.state === "RUNNING" ? t("pty14.running") : run.state === "REFUSED" ? t("pty14.refused") : run.stoppedAt !== null ? t("pty14.stopped", { t: clock(run.stoppedAt) }) : t("pty14.notDone");
  const notRun = run.state === "REFUSED" ? t("pty14.notRun") : t("pty14.running");
  return {
    ...base,
    run: { text: stamp(run.startedAt, locale), detail },
    route: run.route !== null ? t("pty14.source") : { missing: t("pty14.noRoute") },
    completed: run.completedAt ?? { missing },
    compared: counted(run.compared, notRun),
    diff: counted(run.differences, notRun),
    awaiting: counted(run.awaiting, notRun),
    ...(run.state === "INCOMPLETE" && run.stoppedAt !== null
      ? { _message: { severity: "info", text: t("pty14.incompleteMsg", { t: clock(run.stoppedAt), ts: lastCompleted !== null ? moment(lastCompleted, locale) : t("pty14.never") }) } }
      : run.state === "RUNNING"
        ? { _message: { severity: "info", text: t("pty14.runningMsg", { t: clock(run.startedAt) }) } }
        : run.state === "REFUSED"
          ? { _message: { severity: "info", text: t("pty14.refusedMsg") } }
          : {}),
  };
}

/**
 * FR-PTY-040: the geography version the register's areas belong to, and each published successor table some premises
 * still carry the earlier version of - how many re-pointing moves now, and the areas it leaves where they are.
 */
function Geography({ data, t, locale }: { data: ReconciliationView; t: Translate; locale: Locale }) {
  const geography = data.geography;
  return (
    <Panel title={t("pty14.geoTitle")} description={t("pty14.geoDesc", { v: geography.current })} compact locale={locale}>
      {geography.pending.length === 0 ? (
        <Text size="sm" tone="secondary">
          {t("pty14.geoNone", { v: geography.current })}
        </Text>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
          {geography.pending.map((table) => {
            const form = `pty14-repoint-${table.from}`;
            const facts = [
              { label: t("pty14.geoStep"), value: t("pty14.geoStepVal", { from: table.from, to: table.to }) },
              { label: t("pty14.geoMoves"), value: table.premises, kind: "count" as const, note: t("pty14.geoMovesNote") },
              ...table.withdrawn.map((left) => ({
                label: t("pty14.geoWithdrawn"),
                value: left.area,
                note: t("pty14.geoWithdrawnNote", { n: count(left.premises, locale) }),
                ...(left.exception !== null ? { action: { label: t("pty14.openException"), href: routes.opsRegisterExceptions(left.exception) } } : {}),
              })),
            ];
            return (
              <div key={table.from} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
                <FactList items={facts} density="console" locale={locale} />
                {geography.mayRepoint ? (
                  <form id={form} action={repointAction.bind(null, table.from, table.to)}>
                    <ConfirmSubmit
                      formId={form}
                      label={t("pty14.geoRun", { to: table.to })}
                      variant="secondary"
                      disabledReason={table.premises === 0 && table.withdrawn.length === 0 ? t("pty14.geoNothing") : null}
                      dialog={{ title: t("pty14.geoDlgTitle", { to: table.to }), description: t("pty14.geoDlgText", { from: table.from }), confirm: t("pty14.geoDlgYes"), back: t("pty14.dlgNo") }}
                      density="console"
                      locale={locale}
                    >
                      <FactList items={facts.slice(0, 2)} density="console" locale={locale} />
                    </ConfirmSubmit>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
