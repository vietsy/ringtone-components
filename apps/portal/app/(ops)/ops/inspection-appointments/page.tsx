import { R1_FORMAT } from "@rightone/formatting";
import { Banner, PageHeader, Panel, Tabs, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { RowDialogTable, type DialogRow, type RowAct } from "@/features/inspection/RowDialogTable";
import { changeAppointmentAct, recordAppointmentAct } from "@/features/inspection/standing-actions";
import { endOfMonth, refusalNaming, sentenceNaming, standingStatus, standingTabs } from "@/features/inspection/standing";
import { AppointmentForm, type AppointmentFields } from "@/features/inspection/StandingForms";
import { date, refusalOf, refusalSentence, timestamp } from "@/features/inspection/words";
import { readForPage } from "@/lib/api/flash";
import {
  loadInspectorAppointments,
  type AppointmentForm as SentForm,
  type AppointmentRow,
  type FormAttempt,
  type InspectorAppointments,
  type RefusalCode,
  type RowAttempt,
} from "@/lib/api/inspection";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/** Refusals of the form said in the header (design/03 SCR-VER-11, Refused); the others beside their field. */
const HEADER: readonly RefusalCode[] = ["DESIGNATION_NOT_ACTIVE", "PREMISES_READ_UNAVAILABLE", "NOT_AUTHORISED"];

/**
 * SCR-VER-11 Inspector appointments, of one authority. The operations officer reads its inspectors, records an
 * appointment for a second person to approve, suspends an inspector in force, and records the end date of an
 * appointment or withdraws one still waiting. A row waiting for approval opens its decision (SCR-VER-12).
 */
export default async function InspectorAppointmentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-BIZ-APR");
  const params = await searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, ["loading"] as const);
  const attempt = readForPage<FormAttempt<SentForm> | RowAttempt>(params);
  const outcome = view === "loading" ? null : await loadInspectorAppointments(staff, text(params.authority));
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const form = attempt !== null && "form" in attempt ? attempt : null;
  const row = attempt !== null && "act" in attempt ? attempt : null;

  return (
    <OpsFrame console="operations" current="inspection" staff={staff} searchLabel={t("ver09.search")} keyMap={[{ keys: ["J", "K"], label: t("ver.kRows") }]} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          crumbs={[{ label: t("console.crumb") }]}
          title={data !== null ? t("ver11.title", { a: data.authority.code }) : t("ver09.tabAppt")}
          {...(data !== null
            ? { meta: t("ver11.meta", { n: data.appointments.length, a: data.authority.name, t: timestamp(data.asOf, locale) }) }
            : {})}
          locale={locale}
        />
        <Tabs tabs={standingTabs(t)} value="appointments" label={t("ver09.tabsLabel")} density="console" locale={locale} />
        {failure !== null ? (
          failure.code === "AUTHORITY_NOT_FOUND" ? (
            <ViewState view="refused" refusal={{ ...refusalOf(t, "AUTHORITY_NOT_FOUND"), family: "attention" }} density="console" level={2} locale={locale} />
          ) : (
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
          )
        ) : (
          <Appointments data={data} form={form} row={row} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Appointments({
  data,
  form,
  row,
  t,
  locale,
}: {
  data: InspectorAppointments | null;
  form: FormAttempt<SentForm> | null;
  row: RowAttempt | null;
  t: Translate;
  locale: Locale;
}) {
  const header = form?.refusal !== undefined && form.refusal !== null && HEADER.includes(form.refusal) ? form.refusal : null;
  const barred = data !== null && !data.mayAct ? refusalOf(t, "NOT_AUTHORISED").title : null;
  const notFound = row?.refusal === "APPOINTMENT_NOT_FOUND" ? row : null;

  return (
    <>
      {header !== null && (
        <Banner
          family="attention"
          title={refusalOf(t, header).title}
          code={header}
          {...(header === "PREMISES_READ_UNAVAILABLE"
            ? { actions: { label: t("ver.retry"), icon: "refresh-cw", variant: "secondary", href: routes.opsInspectorAppointments(data?.authority.id) } }
            : {})}
          density="console"
          locale={locale}
        >
          {refusalOf(t, header).text}
        </Banner>
      )}
      <Panel title={t("ver11.listTitle")} level={2} density="console" locale={locale}>
        <RowDialogTable
          columns={[
            { key: "person", label: t("ver11.cPerson"), kind: "stack", minWidth: "var(--space-48)" },
            { key: "ref", label: t("ver11.cRef"), kind: "mono" },
            { key: "instr", label: t("ver11.cInstrument") },
            { key: "period", label: t("ver09.cPeriod") },
            { key: "st", label: t("ver09.cState"), kind: "status", minWidth: "var(--space-40)" },
            { key: "act", kind: "actions", minWidth: "var(--space-48)" },
          ]}
          rows={(data?.appointments ?? []).map((appointment) =>
            appointmentRow(appointment, data?.authority.id ?? "", data?.asOf ?? "", barred, row?.id === appointment.id && notFound === null ? row : null, notFound?.id === appointment.id, t, locale),
          )}
          action={changeAppointmentAct}
          cancelLabel={t("ver.cancel")}
          open={row !== null && notFound === null ? { row: row.id, act: row.act } : null}
          caption={t("ver11.listTitle")}
          {...(data !== null && data.appointments.length > 0 ? { sortNote: t("ver11.sortNote") } : {})}
          empty={{ variant: "not-started", title: t("ver11.emptyTitle"), action: false }}
          loading={data === null ? 5 : false}
          rowFocus
          density="console"
          locale={locale}
        />
      </Panel>
      {data !== null && (
        <Panel title={t("ver11.formTitle")} description={t("ver09.formNote")} level={2} gap="xl" density="console" locale={locale}>
          <AppointmentForm
            action={recordAppointmentAct}
            initial={initialForm(form, data.authority.id)}
            authorities={data.authorities.map((authority) => ({ value: authority.id, label: `${authority.code} – ${authority.name}` }))}
            errors={{
              ...(form?.refusal === "AUTHORITY_NOT_FOUND" ? { authority: refusalSentence(t, form.refusal) } : {}),
              ...(form?.refusal === "PERSON_NOT_FOUND" || form?.refusal === "APPOINTMENT_EXISTS" ? { person: refusalSentence(t, form.refusal) } : {}),
            }}
            words={{
              authority: t("ver11.authority"),
              person: t("ver11.personRef"),
              personHelp: t("ver11.personHelp"),
              name: t("ver11.name"),
              card: t("ver11.card"),
              instrument: t("ver11.instrument"),
              document: t("ver11.document"),
              period: t("ver09.period"),
              from: t("ver09.from"),
              to: t("ver09.to"),
              noEnd: t("ver09.noEnd"),
              record: t("ver09.record"),
              close: t("ver.close"),
            }}
            closeHref={routes.ops()}
            barred={barred ?? (header !== null ? refusalOf(t, header).title : null)}
            locale={locale}
          />
        </Panel>
      )}
    </>
  );
}

function initialForm(form: FormAttempt<SentForm> | null, authority: string): AppointmentFields {
  const sent = form?.form;
  return {
    authority: sent?.authority ?? authority,
    person: sent?.person ?? "",
    name: sent?.name ?? "",
    card: sent?.card ?? "",
    instrument: sent?.instrument ?? "",
    document: sent?.document ?? null,
    from: sent?.from ?? "",
    to: sent?.to ?? "",
  };
}

/** One appointment: Suspend while in force; End while in force, suspended or waiting; a waiting one opens its decision. */
function appointmentRow(
  appointment: AppointmentRow,
  authority: string,
  asOf: string,
  barred: string | null,
  attempt: RowAttempt | null,
  notFound: boolean,
  t: Translate,
  locale: Locale,
): DialogRow {
  const pending = appointment.state === "PENDING_APPROVAL";
  const detail =
    appointment.state === "SUSPENDED" && appointment.suspendedAt !== null
      ? t("ver11.since", { t: timestamp(appointment.suspendedAt, locale) })
      : appointment.state === "ENDED" && appointment.to !== null
        ? t("ver11.endedOn", { d: date(appointment.to, locale) })
        : appointment.endsAfter !== null
          ? t("ver09.endsAfter", { d: date(appointment.endsAfter, locale) })
          : null;
  const reasonError = attempt?.refusal === "REASON_REQUIRED" ? refusalSentence(t, attempt.refusal) : null;
  const dateError = attempt !== null && (attempt.refusal === "END_DATE_IN_PAST" || attempt.refusal === "END_DATE_EXTENDS_PERIOD") ? sentenceNaming(t, attempt.refusal, attempt.detail, locale) : null;
  const inDialog = attempt !== null && reasonError === null && dateError === null ? refusalNaming(t, attempt.refusal, attempt.detail, locale) : null;
  const of = (act: string) => (attempt?.act === act ? attempt : null);
  const disabled = barred !== null ? { disabledReason: barred } : null;
  const suspend: RowAct = {
    id: "suspend",
    label: t("ver11.suspend"),
    ariaLabel: `${t("ver11.suspend")} ${appointment.name}`,
    variant: "quiet",
    ...(disabled ?? {
      dialog: {
        title: t("ver11.suspendTitle", { p: appointment.name }),
        description: t("ver11.suspendText"),
        primary: { label: t("ver11.suspend"), variant: "danger" as const },
        reason: { name: "reason", label: t("ver11.suspendReason"), value: of("suspend")?.reason ?? "", ...(of("suspend") !== null && reasonError !== null ? { error: reasonError } : {}) },
        ...(of("suspend") !== null && inDialog !== null ? { refusal: inDialog } : {}),
        hidden: { id: appointment.id, authority, act: "suspend" },
      },
    }),
  };
  const end: RowAct = {
    id: "end",
    label: t("ver11.end"),
    ariaLabel: `${t("ver11.end")} ${appointment.name}`,
    variant: "quiet",
    ...(disabled ?? {
      dialog: {
        title: pending ? t("ver11.withdrawTitle", { p: appointment.name }) : t("ver11.endTitle", { p: appointment.name, d: "{d}" }),
        description: pending ? t("ver11.withdrawText") : t("ver11.endText"),
        primary: { label: t("ver11.end"), variant: "danger" as const },
        ...(pending
          ? {}
          : {
              date: {
                name: "effective_to",
                label: t("ver09.endDate"),
                value: of("end")?.effectiveTo ?? endOfMonth(asOf),
                ...(of("end") !== null && dateError !== null ? { error: dateError } : {}),
              },
            }),
        reason: { name: "reason", label: t("ver11.endReason"), value: of("end")?.reason ?? "", ...(of("end") !== null && reasonError !== null ? { error: reasonError } : {}) },
        ...(of("end") !== null && inDialog !== null ? { refusal: inDialog } : {}),
        hidden: { id: appointment.id, authority, act: "end" },
      },
    }),
  };
  const acts =
    appointment.state === "ACTIVE" ? [suspend, end] : appointment.state === "SUSPENDED" || pending ? [end] : [];
  return {
    key: appointment.id,
    cells: {
      ...(pending ? { _href: routes.opsAppointmentDecisions({ appointment: appointment.id }) } : {}),
      // APPOINTMENT_NOT_FOUND is said on the row it was asked of (design/03 SCR-VER-11, Refused).
      ...(notFound ? { _message: { severity: "warning", text: refusalSentence(t, "APPOINTMENT_NOT_FOUND"), code: "APPOINTMENT_NOT_FOUND" } } : {}),
      person: appointment.card !== null ? { text: appointment.name, detail: t("ver11.cardOf", { c: appointment.card }) } : appointment.name,
      ref: appointment.person,
      instr: appointment.instrument,
      // The period is written out: an open-ended one is said in words, which a period cell (two dates) cannot hold.
      period: appointment.to !== null ? (R1_FORMAT.formatPeriod(appointment.from, appointment.to, locale, true) ?? "") : t("ver09.openPeriod", { d: date(appointment.from, locale) }),
      st: standingStatus(t, appointment.state, detail),
    },
    acts,
  };
}
