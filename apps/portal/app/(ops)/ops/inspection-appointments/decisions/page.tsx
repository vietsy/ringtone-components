import {
  ApprovalPair,
  Banner,
  Button,
  Columns,
  FactList,
  PageHeader,
  Panel,
  StatusLine,
  Table,
  Tabs,
  ViewState,
} from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { DecisionForm } from "@/features/inspection/DecisionForm";
import { RowDialogTable } from "@/features/inspection/RowDialogTable";
import { decideAppointmentAct, reinstateAppointmentAct } from "@/features/inspection/standing-actions";
import { decisionTabs } from "@/features/inspection/standing";
import { date, refusalOf, refusalSentence, timestamp } from "@/features/inspection/words";
import { readForPage } from "@/lib/api/flash";
import { loadAppointmentDecisions, type AppointmentDecisions, type RowAttempt } from "@/lib/api/inspection";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/** Refusals of a decision that take the form's place (design/03 SCR-VER-12, Refused). */
const IN_PLACE = new Set(["NOT_PENDING_APPROVAL", "APPOINTMENT_NOT_FOUND", "DESIGNATION_NOT_ACTIVE"]);

/**
 * SCR-VER-12 Decide an appointment. The approver approves or refuses the appointments waiting, oldest first, and
 * reinstates a suspended inspector, as a person who neither recorded nor suspended it (DR-746).
 */
export default async function AppointmentDecisionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-BIZ-APR", "ACT-OPS");
  const params = await searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, ["loading"] as const);
  const attempt = readForPage<RowAttempt>(params);
  const outcome = view === "loading" ? null : await loadAppointmentDecisions(staff, text(params.appointment), text(params.decided), locale);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame console="operations" current="inspection" staff={staff} searchLabel={t("ver10.search")} keyMap={[{ keys: ["J", "K"], label: t("ver.kRows") }]} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          crumbs={[{ label: t("console.crumb") }]}
          title={t("ver12.title")}
          {...(data !== null ? { meta: t("ver12.meta", { n: data.waiting.length, s: data.suspended.length, t: timestamp(data.asOf, locale) }) } : {})}
          locale={locale}
        />
        <Tabs
          tabs={decisionTabs(t, data?.designationsWaiting ?? 0, data?.waiting.length ?? 0)}
          value="appointments"
          label={t("ver10.tabsLabel")}
          density="console"
          locale={locale}
        />
        {failure !== null ? (
          <ViewState
            view="error"
            errorTitle={t("ver.errTitle")}
            errorText={t("ver.errText")}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            density="console"
            level={2}
            locale={locale}
          />
        ) : (
          <Decisions data={data} attempt={attempt} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Decisions({ data, attempt, t, locale }: { data: AppointmentDecisions | null; attempt: RowAttempt | null; t: Translate; locale: Locale }) {
  const opened = data?.opened ?? null;
  const decided = data?.decided ?? null;
  const decision = attempt?.act === "decide" ? attempt : null;
  const reinstating = attempt?.act === "reinstate" ? attempt : null;
  const inPlace = data?.openedRefusal ?? (decision !== null && IN_PLACE.has(decision.refusal) ? decision.refusal : null);

  return (
    <>
      {decided !== null && (
        <StatusLine
          family="positive"
          text={t(decided.act === "REINSTATE" ? "ver12.reinstated" : "ver12.decided", { t: timestamp(decided.at, locale), p: decided.name })}
          locale={locale}
        />
      )}
      <Columns layout="halves">
        <Panel title={t("ver10.waiting")} level={2} density="console" locale={locale}>
          <Table
            columns={[
              { key: "person", label: t("ver11.cPerson"), kind: "stack" },
              { key: "auth", label: t("ver12.cAuth"), kind: "mono" },
              { key: "from", label: t("ver10.cFrom"), kind: "date", short: true },
              { key: "by", label: t("ver10.cBy") },
            ]}
            rows={(data?.waiting ?? []).map((row) => ({
              _key: row.id,
              _href: routes.opsAppointmentDecisions({ appointment: row.id }),
              ...(opened?.appointment.id === row.id ? { _selected: true } : {}),
              person: row.card !== null ? { text: row.name, detail: t("ver11.cardOf", { c: row.card }) } : row.name,
              auth: row.authorityCode,
              from: row.from,
              by: row.recordedBy?.name ?? null,
            }))}
            loading={data === null ? 1 : false}
            density="console"
            rowFocus
            caption={t("ver10.waiting")}
            {...(data !== null && data.waiting.length > 0 ? { sortNote: t("ver10.sortNote") } : {})}
            empty={{ variant: "governed", title: t("ver12.emptyTitle"), action: false }}
            locale={locale}
          />
        </Panel>
        {inPlace !== null ? (
          <Banner family={inPlace === "NOT_PENDING_APPROVAL" ? "neutral" : "attention"} title={refusalOf(t, inPlace).title} code={inPlace} density="console" locale={locale}>
            {refusalOf(t, inPlace).text}
          </Banner>
        ) : (
          opened !== null && <Opened opened={opened} attempt={decision} t={t} locale={locale} />
        )}
      </Columns>
      <Panel title={t("ver12.suspended")} level={2} density="console" locale={locale}>
        <RowDialogTable
          columns={[
            { key: "person", label: t("ver11.cPerson"), kind: "stack" },
            { key: "auth", label: t("ver12.cAuth"), kind: "mono" },
            { key: "since", label: t("ver12.cSince"), kind: "datetime" },
            { key: "by", label: t("ver12.cSusBy") },
            { key: "reason", label: t("ver12.cReason"), truncate: true },
            { key: "act", kind: "actions" },
          ]}
          rows={(data?.suspended ?? []).map((row) => ({
            key: row.id,
            cells: {
              ...(reinstating?.id === row.id && reinstating.refusal === "APPOINTMENT_NOT_SUSPENDED"
                ? { _message: { severity: "warning", text: refusalSentence(t, reinstating.refusal), code: reinstating.refusal } }
                : {}),
              person: row.card !== null ? { text: row.name, detail: t("ver11.cardOf", { c: row.card }) } : row.name,
              auth: row.authorityCode,
              since: row.suspendedAt,
              by: row.suspendedBy,
              reason: row.reason,
            },
            acts: [
              {
                id: "reinstate",
                label: t("ver12.reinstate"),
                ariaLabel: `${t("ver12.reinstate")} ${row.name}`,
                variant: "secondary",
                ...(row.bar !== null
                  ? { disabledReason: refusalOf(t, row.bar).title }
                  : {
                      dialog: {
                        title: t("ver12.reinstateTitle", { p: row.name }),
                        description: t("ver12.reinstateText"),
                        primary: { label: t("ver12.reinstate"), variant: "primary" as const },
                        ...(reinstating?.id === row.id ? { refusal: refusalOf(t, reinstating.refusal) } : {}),
                        hidden: { id: row.id },
                      },
                    }),
              },
            ],
          }))}
          action={reinstateAppointmentAct}
          cancelLabel={t("ver.cancel")}
          open={reinstating !== null && reinstating.refusal !== "APPOINTMENT_NOT_SUSPENDED" ? { row: reinstating.id, act: "reinstate" } : null}
          caption={t("ver12.suspended")}
          empty={{ variant: "governed", title: t("ver12.susEmptyTitle"), action: false }}
          loading={data === null ? 1 : false}
          density="console"
          locale={locale}
        />
      </Panel>
      <div style={{ display: "flex" }}>
        <Button variant="quiet" size="sm" href={routes.ops()} locale={locale}>
          {t("ver.close")}
        </Button>
      </div>
    </>
  );
}

function Opened({ opened, attempt, t, locale }: { opened: NonNullable<AppointmentDecisions["opened"]>; attempt: RowAttempt | null; t: Translate; locale: Locale }) {
  const { appointment, bar } = opened;
  const sent = attempt?.id === appointment.id ? attempt : null;
  const segregation = bar === "SEGREGATION_REQUIRED" ? refusalOf(t, bar) : null;

  return (
    <Panel title={t("ver12.opened", { p: appointment.name, a: appointment.authorityCode })} level={2} gap="xl" density="console" locale={locale}>
      <FactList
        items={[
          { label: t("ver12.cAuth"), value: appointment.authority },
          { label: t("ver11.cRef"), value: appointment.person, kind: "mono" },
          { label: t("ver11.cInstrument"), value: appointment.instrument },
          appointment.to !== null
            ? { label: t("ver09.cPeriod"), value: { from: appointment.from, to: appointment.to }, kind: "period" }
            : { label: t("ver09.cPeriod"), value: t("ver09.openPeriod", { d: date(appointment.from, locale) }) },
        ]}
        density="console"
        locale={locale}
      />
      {appointment.recordedBy !== null && (
        <ApprovalPair
          preparer={{ name: appointment.recordedBy.name, role: t("ver10.opsRole"), at: appointment.recordedBy.at }}
          approver={null}
          awaiting={t("ver10.awaiting")}
          preparerLabel={t("ver10.preparer")}
          approverLabel={t("ver10.approver")}
          {...(segregation !== null ? { sameActor: { ...segregation, family: "attention" as const } } : {})}
          locale={locale}
        />
      )}
      {bar === "NOT_AUTHORISED" && (
        <Banner family="attention" title={refusalOf(t, bar).title} code={bar} density="console" locale={locale}>
          {refusalOf(t, bar).text}
        </Banner>
      )}
      {sent !== null && sent.refusal !== "REASON_REQUIRED" && !IN_PLACE.has(sent.refusal) && (
        <Banner family="attention" title={refusalOf(t, sent.refusal).title} code={sent.refusal} density="console" locale={locale}>
          {refusalOf(t, sent.refusal).text}
        </Banner>
      )}
      <DecisionForm
        action={decideAppointmentAct}
        id={appointment.id}
        words={{
          decision: t("ver10.decision"),
          approve: t("ver10.approve"),
          refuse: t("ver10.refuse"),
          reason: t("ver10.reason"),
          reasonHelp: t("ver10.reasonHelp"),
          record: t("ver10.record"),
          cancel: t("ver.cancel"),
        }}
        initial={{ decision: sent?.decision ?? "APPROVE", reason: sent?.reason ?? "" }}
        reasonError={sent?.refusal === "REASON_REQUIRED" ? refusalSentence(t, sent.refusal) : null}
        barred={bar !== null ? refusalOf(t, bar).title : null}
        confirm={{
          title: t("ver12.approveTitle", { p: appointment.name, a: appointment.authority }),
          description: t("ver12.approveText", { d: date(appointment.from, locale) }),
        }}
        fullWidth
        locale={locale}
      />
    </Panel>
  );
}
