import { R1_FORMAT } from "@rightone/formatting";
import {
  Banner,
  Button,
  ButtonRow,
  Columns,
  DateField,
  Divider,
  FactList,
  FilterBar,
  Link,
  PageHeader,
  Panel,
  Table,
  ViewState,
} from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ListPager } from "@/features/venue/ListPager";
import { showPeriods } from "@/features/venue/console-actions";
import { actionStatus, causeWords, headMeta, recordedBy, refusal, sentence } from "@/features/venue/console-copy";
import { periodOutcome, serviceStatus, venTranslator } from "@/features/venue/copy";
import { readDate } from "@/features/venue/fields";
import { ShortcutButton } from "@/features/venue/ShortcutButton";
import { SubmitButton } from "@/features/venue/SubmitButton";
import { holds, requireStaff } from "@/lib/api/session";
import { loadCaseFile, type CaseAction, type CaseEnding, type CaseFile, type CaseReinstatement, type ScheduleStep, type WeekQuery } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN13_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const value = (param: string | string[] | undefined) => (typeof param === "string" ? param : null);

/** The week asked in the address; none until one is asked, so the periods panel opens on its governed empty. */
function weekOf(params: SearchParams): WeekQuery | null {
  const from = value(params.from);
  const to = value(params.to);
  const asOf = value(params.as_of);
  return from === null && to === null && asOf === null ? null : { from: readDate(from ?? "") ?? from ?? "", to: readDate(to ?? "") ?? to ?? "", asOf: asOf ?? "" };
}

/**
 * SCR-VEN-13 Entitlement case file: everything recorded about one service (enforcement, reinstatements, endings, the
 * terms accepted, its history), what played in a week as the rule then in force worked it out, and which periods
 * fell back. Operations act from here; evidence reads the record and is told the periods and fallbacks are
 * operations' to read.
 */
export default async function EntitlementCaseFilePage({ params, searchParams }: { params: Promise<{ service: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-EVD");
  const [{ service }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = venTranslator(locale);
  const operations = holds(staff, "ACT-OPS");
  const week = weekOf(query);
  const view = reviewView(query, VEN13_VIEWS);
  const outcome = view === "loading" ? null : await loadCaseFile(staff, service, week, view, value(query.after));
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame
      console="operations"
      current="services"
      staff={staff}
      searchLabel={t("venops.search")}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={operations ? [{ label: t("venops.area") }, { label: t("venops.register"), href: routes.opsServices() }] : [{ label: t("venops.area") }]}
          title={data !== null ? data.head.premises.name : t("ven13.title")}
          {...(data !== null ? { status: serviceStatus(data.head.status, t), meta: headMeta(data.head, t, locale) } : {})}
          locale={locale}
        >
          {data !== null ? (
            <Button variant="quiet" size="sm" icon="refresh-cw" href={week === null ? routes.opsService(service) : routes.opsService(service, week)} locale={locale}>
              {t("ven13.reload")}
            </Button>
          ) : null}
        </PageHeader>
        {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={10} density="console" locale={locale} /> : null}
        {failure !== null && failure.code === "ENTITLEMENT_NOT_FOUND" ? (
          <ViewState
            view="refused"
            refusal={{ ...refusal(failure.code, t), family: "neutral", ...(operations ? { action: { label: t("ven13.back"), href: routes.opsServices() } } : {}) }}
            density="console"
            level={2}
            locale={locale}
          />
        ) : failure !== null ? (
          <ViewState
            view="error"
            errorTitle={t("ven.errTitle")}
            errorText={t("ven.errText")}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            density="console"
            level={2}
            locale={locale}
          />
        ) : null}
        {data !== null ? <Case data={data} asked={week} operations={operations} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Case({ data, asked, operations, t, locale }: { data: CaseFile; asked: WeekQuery | null; operations: boolean; t: Translate; locale: Locale }) {
  const code = data.head.code;
  const count = (n: number) => R1_FORMAT.formatCount(n, locale) ?? String(n);
  const actions = data.actions.length;
  return (
    <>
      <Text size="sm">{t("ven.line")}</Text>
      <Panel gap="xl" density="console" locale={locale}>
        <Panel
          variant="plain"
          level={2}
          title={t("ven13.enfTitle")}
          meta={actions === 0 ? t("ven13.enfCountNone") : actions === 1 ? t("ven13.enfCountOne") : t("ven13.enfCount", { n: count(actions) })}
          gap="lg"
          density="console"
          locale={locale}
        >
          {actions === 0 ? (
            <Text size="sm" tone="secondary">
              {t("ven13.enfNone")}
            </Text>
          ) : (
            data.actions.map((action) => <ActionRecord key={action.id} action={action} t={t} locale={locale} />)
          )}
        </Panel>
        <Divider />
        <Columns layout="halves">
          <Panel variant="plain" level={2} title={t("ven13.reinTitle")} gap="md" density="console" locale={locale}>
            {data.reinstatements.length === 0 ? (
              <Text size="sm" tone="secondary">
                {t("ven13.reinNone")}
              </Text>
            ) : (
              data.reinstatements.map((reinstatement) => <ReinstatementRecord key={reinstatement.id} reinstatement={reinstatement} t={t} locale={locale} />)
            )}
          </Panel>
          <Panel variant="plain" level={2} title={t("ven13.endTitle")} gap="md" density="console" locale={locale}>
            {data.endings.length === 0 ? (
              <Text size="sm" tone="secondary">
                {t("ven13.endNone")}
              </Text>
            ) : (
              data.endings.map((ending) => <EndingRecord key={ending.id} ending={ending} t={t} locale={locale} />)
            )}
          </Panel>
        </Columns>
        <Divider />
        <Panel variant="plain" level={2} title={t("ven13.termsTitle")} density="console" locale={locale}>
          {data.terms === null ? (
            <Text size="sm" tone="secondary">
              {t("ven13.termsNone")}
            </Text>
          ) : (
            <Table
              columns={[
                { key: "ver", label: t("ven13.cVersion") },
                { key: "by", label: t("ven13.cBy") },
                { key: "forP", label: t("ven13.cFor") },
                { key: "at", label: t("ven13.cAt"), kind: "stamp" },
                // The digest's first twelve characters, the whole value on hover and focus (design/03).
                { key: "digest", label: t("ven13.cDigest"), kind: "mono", truncate: true, maxWidth: "var(--space-28)" },
              ]}
              rows={[{ _key: "terms", ver: data.terms.version, by: data.terms.acceptedBy, forP: data.terms.actingFor, at: data.terms.acceptedAt, digest: data.terms.digest }]}
              density="console"
              caption={t("ven13.termsTitle")}
              locale={locale}
            />
          )}
        </Panel>
        <Divider />
        <Panel variant="plain" level={2} title={t("ven13.histTitle")} density="console" locale={locale}>
          <Table
            columns={[
              { key: "at", label: t("ven13.cAt"), kind: "stamp" },
              { key: "from", label: t("ven13.cFrom") },
              { key: "to", label: t("ven13.cTo"), kind: "strong" },
              { key: "cause", label: t("ven13.cCause") },
              { key: "rec", label: t("ven13.cRecorded") },
            ]}
            rows={data.history.map((row, index) => ({
              _key: `h${String(index)}`,
              at: row.at,
              from: row.from !== null ? t(`ven.status.${row.from}`) : t("venops.none"),
              to: t(`ven.status.${row.to}`),
              cause: t(`ven13.hCause.${row.cause}`),
              rec: recordedBy(row, t),
            }))}
            density="console"
            caption={t("ven13.histTitle")}
            locale={locale}
          />
        </Panel>
      </Panel>
      <Panel gap="xl" density="console" locale={locale}>
        <Panel variant="plain" level={2} title={t("ven13.playTitle")} gap="md" density="console" locale={locale}>
          {data.periods.withheld ? (
            <Text size="sm" tone="secondary">
              {t("ven13.withheld")}
            </Text>
          ) : (
            <Periods code={code} week={data.periods.week} resolution={data.periods.resolution} t={t} locale={locale} />
          )}
        </Panel>
        <Divider />
        <Panel variant="plain" level={2} title={t("ven13.fbTitle")} gap="md" density="console" locale={locale}>
          {data.fallbacks.withheld ? (
            <Text size="sm" tone="secondary">
              {t("ven13.withheld")}
            </Text>
          ) : (
            <>
              <Table
                columns={[
                  { key: "day", label: t("ven13.cDay"), kind: "date", short: true, nowrap: true },
                  { key: "time", label: t("ven13.cTime"), nowrap: true, num: true },
                  { key: "sched", label: t("ven13.cSchedule"), kind: "strong" },
                  { key: "cause", label: t("ven13.cFbCause") },
                  { key: "inst", label: t("ven13.cInstead") },
                  { key: "notice", label: t("ven13.cNotice"), kind: "status" },
                  { key: "seen", label: t("ven13.cSeen"), kind: "stamp" },
                ]}
                rows={data.fallbacks.items.map((row, index) => ({
                  _key: `f${String(index)}`,
                  day: row.date,
                  time: `${row.start}-${row.end}`,
                  sched: row.playlist.name,
                  cause: t(`ven13.fbCause.${row.cause}`),
                  inst: t(`ven13.instead.${row.resolvedTo}`),
                  // RPT-VEN-02 is where an unnotified fallback (EXC-VEN-06) is found: its reference is empty.
                  notice: row.notice !== null ? { family: "neutral", label: row.notice, plain: true } : { family: "attention", label: t("ven13.notSent") },
                  seen: row.detectedAt,
                }))}
                density="console"
                caption={t("ven13.fbTitle")}
                empty={{ variant: "governed", title: t("ven13.fbEmpty"), action: false }}
                locale={locale}
              />
              {/* RPT-VEN-02 one entitlement at a time: its fallbacks a page at a time, the week asked kept. */}
              <ListPager paging={data.fallbacks.paging} href={(cursor) => routes.opsService(code, asked ?? undefined, cursor)} density="console" always t={t} locale={locale} />
            </>
          )}
        </Panel>
      </Panel>
      {operations ? (
        <>
          <Panel title={t("ven13.actTitle")} level={2} density="console" locale={locale}>
            <ButtonRow>
              <ShortcutButton
                variant="secondary"
                size="sm"
                shortcut="Alt+O"
                {...(data.acts.enforce !== null ? { disabled: true, disabledReason: sentence(data.acts.enforce, t) } : { href: routes.opsServiceEnforcement(code) })}
                locale={locale}
              >
                {t("ven13.enforce")}
              </ShortcutButton>
              <ShortcutButton
                variant="primary"
                size="sm"
                shortcut="Alt+R"
                {...(data.acts.reinstate !== null ? { disabled: true, disabledReason: sentence(data.acts.reinstate, t) } : { href: routes.opsServiceReinstatement(code) })}
                locale={locale}
              >
                {t("ven13.reinstate")}
              </ShortcutButton>
              <ShortcutButton
                variant="secondary"
                size="sm"
                shortcut="Alt+X"
                {...(data.acts.exit !== null ? { disabled: true, disabledReason: sentence(data.acts.exit, t) } : { href: routes.opsServiceScopeExit(code) })}
                locale={locale}
              >
                {t("ven13.exit")}
              </ShortcutButton>
            </ButtonRow>
          </Panel>
          <div style={{ display: "flex" }}>
            <Link back href={routes.opsServices()} variant="standalone" size="sm" locale={locale}>
              {t("ven13.back")}
            </Link>
          </div>
        </>
      ) : null}
    </>
  );
}

function ActionRecord({ action, t, locale }: { action: CaseAction; t: Translate; locale: Locale }) {
  return (
    <>
      <FactList
        items={[
          { label: t("ven13.fAction"), value: actionStatus(action.action, t), kind: "status" },
          { label: t("ven13.fEffective"), value: action.effectiveAt, kind: "datetime", ...(action.applied ? {} : { note: t("ven13.pending") }) },
          { label: t("ven13.fGround"), value: action.ground[locale] },
          { label: t("ven13.fUnder"), value: action.policy[locale] },
          { label: t("ven13.fDecided"), value: t("ven13.decided", { name: action.decidedBy }) },
          action.notice !== null
            ? { label: t("ven13.fNotice"), value: action.notice, kind: "mono" as const }
            : { label: t("ven13.fNotice"), value: { family: "attention", label: t("ven13.notSent") }, kind: "status" as const },
          { label: t("ven13.fRemedy"), value: action.remedy[locale] },
        ]}
        columns={2}
        density="console"
        locale={locale}
      />
      {action.conditions.length > 0 ? (
        <Panel variant="plain" level={3} title={t("ven13.condTitle")} gap="sm" density="console" locale={locale}>
          <Table
            columns={[
              { key: "code", label: t("ven13.cCode"), kind: "mono" },
              { key: "text", label: t("ven13.cText") },
              { key: "ev", label: t("ven13.cEvidence"), kind: "status" },
            ]}
            rows={action.conditions.map((condition) => ({
              _key: condition.code,
              code: condition.code,
              text: condition.text[locale],
              ev: condition.evidence === null ? { family: "attention", label: t("ven13.noEvidence") } : { family: "neutral", label: condition.evidence, plain: true },
            }))}
            density="console"
            caption={t("ven13.condTitle")}
            locale={locale}
          />
        </Panel>
      ) : null}
    </>
  );
}

function ReinstatementRecord({ reinstatement, t, locale }: { reinstatement: CaseReinstatement; t: Translate; locale: Locale }) {
  return (
    <FactList
      items={[
        { label: t("ven13.fEffective"), value: reinstatement.effectiveAt, kind: "datetime" },
        {
          label: t("ven13.fLifted"),
          value: t("ven13.lifted", { action: t(`venops.action.${reinstatement.lifted.action}`), ts: R1_FORMAT.formatTimestamp(reinstatement.lifted.effectiveAt, locale) ?? "" }),
        },
        { label: t("ven13.fReinstatedBy"), value: t("ven13.decided", { name: reinstatement.by }) },
        { label: t("ven13.fConditionsMet"), value: reinstatement.conditionsMet.map((met) => `${met.code}: ${met.evidence}`).join("; ") },
      ]}
      density="console"
      locale={locale}
    />
  );
}

function EndingRecord({ ending, t, locale }: { ending: CaseEnding; t: Translate; locale: Locale }) {
  const exit = ending.scopeExit;
  return (
    <FactList
      items={[
        { label: t("ven13.fCause"), value: exit !== null ? causeWords(exit.family, exit.event, t) : t("ven13.request"), ...(ending.superseded ? { note: t("ven13.superseded") } : {}) },
        ...(exit !== null
          ? [
              { label: t("ven13.fEvent"), value: exit.reference, kind: "mono" as const },
              { label: t("ven13.fEvidence"), value: exit.evidence },
            ]
          : []),
        { label: t("ven13.fEffective"), value: ending.effectiveAt, kind: "datetime", ...(ending.applied || ending.superseded ? {} : { note: t("ven13.pending") }) },
        ...(ending.requestedBy !== null ? [{ label: t(exit !== null ? "ven13.fRecordedBy" : "ven13.fRequestedBy"), value: ending.requestedBy }] : []),
      ]}
      density="console"
      locale={locale}
    />
  );
}

/** What played: the week and the as-at instant, then each period with its outcome and the rule version it was worked out under. */
function Periods({
  code,
  week,
  resolution,
  t,
  locale,
}: {
  code: string;
  week: WeekQuery;
  resolution: ScheduleStep["resolution"] | null;
  t: Translate;
  locale: Locale;
}) {
  const count = (n: number) => R1_FORMAT.formatCount(n, locale) ?? String(n);
  const refused = resolution?.refusal ?? null;
  const periods = resolution?.periods ?? null;
  return (
    <>
      <form action={showPeriods.bind(null, code)} style={{ display: "contents" }}>
        <FilterBar label={t("ven13.weekBar")} locale={locale}>
          <DateField
            range
            label={t("ven13.week")}
            fromLabel={t("ven13.from")}
            toLabel={t("ven13.to")}
            name="week"
            value={week.from}
            to={week.to}
            required
            {...(refused === "WINDOW_TOO_LONG" ? { error: sentence(refused, t) } : {})}
            density="console"
            locale={locale}
          />
          <DateField
            withTime
            label={t("ven13.asOf")}
            name="as_of"
            value={week.asOf}
            required
            {...(refused === "AS_OF_REQUIRED" ? { error: sentence(refused, t) } : {})}
            density="console"
            locale={locale}
          />
          <SubmitButton variant="secondary" size="sm" locale={locale}>
            {t("ven13.show")}
          </SubmitButton>
        </FilterBar>
      </form>
      {refused === "RULES_NOT_APPROVED" ? (
        <Banner family="neutral" title={refusal(refused, t).title} code={refused} level={3} density="console" locale={locale}>
          {refusal(refused, t).text}
        </Banner>
      ) : null}
      {refused === null ? (
        <Table
          columns={[
            { key: "day", label: t("ven13.cDay"), kind: "date", short: true, nowrap: true },
            { key: "time", label: t("ven13.cTime"), nowrap: true, num: true },
            { key: "out", label: t("ven13.cOutcome"), kind: "status" },
            { key: "list", label: t("ven13.cPlaylist"), kind: "strong", missing: t("venops.none") },
            { key: "rev", label: t("ven13.cRev"), align: "end", num: true, nowrap: true, missing: t("venops.none") },
            { key: "rule", label: t("ven13.cRule"), nowrap: true },
          ]}
          rows={(periods ?? []).map((period, index) => ({
            _key: `p${String(index)}`,
            day: period.date,
            time: `${period.start}-${period.end}`,
            out: periodOutcome(period, t),
            list: period.playlist,
            rev: period.revision === null ? null : String(period.revision),
            rule: period.ruleVersion,
          }))}
          density="console"
          caption={t("ven13.playTitle")}
          {...(periods !== null && periods.length > 0 ? { footer: t("ven13.perFoot", { a: count(periods.length), b: count(periods.length) }) } : {})}
          empty={{ variant: "not-started", title: t("ven13.perEmpty"), action: false }}
          locale={locale}
        />
      ) : null}
    </>
  );
}
