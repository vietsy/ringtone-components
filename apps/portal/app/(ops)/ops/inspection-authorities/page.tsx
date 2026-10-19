import { R1_FORMAT } from "@rightone/formatting";
import { redirect } from "next/navigation";
import { Banner, PageHeader, Panel, Tabs, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { RowDialogTable, type DialogRow, type RowAct } from "@/features/inspection/RowDialogTable";
import { endDesignationAct, recordDesignationAct } from "@/features/inspection/standing-actions";
import { endOfMonth, recordedBy, refusalNaming, sentenceNaming, standingStatus, standingTabs } from "@/features/inspection/standing";
import { DesignationForm, type DesignationFields } from "@/features/inspection/StandingForms";
import { date, joined, refusalOf, refusalSentence, timestamp } from "@/features/inspection/words";
import { readForPage } from "@/lib/api/flash";
import {
  AUTHORITY_LEVELS,
  loadInspectionAuthorities,
  type DesignationForm as SentForm,
  type DesignationRow,
  type FormAttempt,
  type InspectionAuthorities,
  type RowAttempt,
} from "@/lib/api/inspection";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/** The skeleton's rows while the designations are read. */
const LOADING_ROWS = 4;

/**
 * SCR-VER-09 Inspection authorities. The operations officer reads the designations, records a new one for a second
 * person to approve, and records the end date of one in force or withdraws one still waiting. An approver who
 * records nothing decides on the approver's own screen (SCR-VER-10), so the workspace opens that for them.
 */
export default async function InspectionAuthoritiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Operations officers record here; an approver is sent to the designations waiting for a decision.
  const staff = await requireStaff("ACT-OPS", "ACT-BIZ-APR");
  if (!holds(staff, "ACT-OPS")) redirect(routes.opsDesignationDecisions());
  const params = await searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, ["loading"] as const);
  const attempt = readForPage<FormAttempt<SentForm> | RowAttempt>(params);
  const outcome = view === "loading" ? null : await loadInspectionAuthorities(staff, locale);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const form = attempt !== null && "form" in attempt ? attempt : null;
  const row = attempt !== null && "act" in attempt ? attempt : null;

  return (
    <OpsFrame
      console="operations"
      current="inspection"
      staff={staff}
      searchLabel={t("ver09.search")}
      keyMap={[{ keys: ["J", "K"], label: t("ver.kRows") }]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          crumbs={[{ label: t("console.crumb") }]}
          title={t("ver09.title")}
          {...(data !== null ? { meta: t("ver09.meta", { n: data.designations.length, t: timestamp(data.asOf, locale) }) } : {})}
          locale={locale}
        />
        <Tabs tabs={standingTabs(t)} value="authorities" label={t("ver09.tabsLabel")} density="console" locale={locale} />
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
          <Authorities data={data} form={form} row={row} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Authorities({
  data,
  form,
  row,
  t,
  locale,
}: {
  data: InspectionAuthorities | null;
  form: FormAttempt<SentForm> | null;
  row: RowAttempt | null;
  t: Translate;
  locale: Locale;
}) {
  // GEOGRAPHY_READ_UNAVAILABLE and a refusal of the reader's right are said in the header, with Retry for the read.
  const header = form?.refusal === "GEOGRAPHY_READ_UNAVAILABLE" || form?.refusal === "NOT_AUTHORISED" ? form.refusal : null;
  const barred = data !== null && !data.mayAct ? refusalOf(t, "NOT_AUTHORISED").title : null;

  return (
    <>
      {header !== null && (
        <Banner
          family="attention"
          title={refusalOf(t, header).title}
          code={header}
          {...(header === "GEOGRAPHY_READ_UNAVAILABLE"
            ? { actions: { label: t("ver.retry"), icon: "refresh-cw", variant: "secondary", href: routes.opsInspectionAuthorities() } }
            : {})}
          density="console"
          locale={locale}
        >
          {refusalOf(t, header).text}
        </Banner>
      )}
      <Panel title={t("ver09.listTitle")} level={2} density="console" locale={locale}>
        <RowDialogTable
          columns={[
            { key: "code", label: t("ver09.cCode"), kind: "mono" },
            { key: "name", label: t("ver09.cName"), kind: "strong" },
            { key: "level", label: t("ver09.cLevel") },
            { key: "areas", label: t("ver09.cAreas"), kind: "stack" },
            { key: "period", label: t("ver09.cPeriod") },
            { key: "st", label: t("ver09.cState"), kind: "status", minWidth: "var(--space-40)" },
            { key: "act", kind: "actions" },
          ]}
          rows={(data?.designations ?? []).map((designation) => designationRow(designation, data?.asOf ?? "", barred, row, t, locale))}
          action={endDesignationAct}
          cancelLabel={t("ver.cancel")}
          open={row !== null ? { row: row.id, act: "end" } : null}
          caption={t("ver09.listTitle")}
          {...(data !== null && data.designations.length > 0 ? { sortNote: t("ver09.sortNote") } : {})}
          empty={{ variant: "not-started", title: t("ver09.emptyTitle"), action: false }}
          loading={data === null ? LOADING_ROWS : false}
          rowFocus
          density="console"
          locale={locale}
        />
      </Panel>
      {data !== null && (
        <Panel title={t("ver09.formTitle")} description={t("ver09.formNote")} level={2} gap="xl" density="console" locale={locale}>
          <DesignationForm
            action={recordDesignationAct}
            initial={initialForm(form)}
            options={{
              levels: AUTHORITY_LEVELS.map((level) => ({ value: level, label: t(`console.level.${level}`) })),
              geographies: data.geographies.map((geography) => ({ value: geography.id, label: geography.label })),
              predecessors: data.designations.map((designation) => ({ value: designation.id, label: `${designation.code} – ${designation.name}` })),
            }}
            errors={{
              ...(form?.refusal === "AUTHORITY_CODE_EXISTS" ? { code: refusalSentence(t, form.refusal) } : {}),
              ...(form?.refusal === "AREA_NOT_IN_GEOGRAPHY" ? { areas: t("ver09.areaError", { text: refusalSentence(t, form.refusal), area: form.detail ?? "" }) } : {}),
              ...(form?.refusal === "AUTHORITY_NOT_FOUND" ? { predecessor: refusalSentence(t, form.refusal) } : {}),
            }}
            words={{
              code: t("ver09.code"),
              name: t("ver09.name"),
              level: t("ver09.level"),
              basis: t("ver09.basis"),
              document: t("ver09.document"),
              geography: t("ver09.geography"),
              areas: t("ver09.areas"),
              areasHelp: t("ver09.areasHelp"),
              period: t("ver09.period"),
              from: t("ver09.from"),
              to: t("ver09.to"),
              noEnd: t("ver09.noEnd"),
              succeeds: t("ver09.succeeds"),
              none: t("ver09.none"),
              record: t("ver09.record"),
              close: t("ver.close"),
            }}
            closeHref={routes.ops()}
            barred={barred}
            locale={locale}
          />
        </Panel>
      )}
    </>
  );
}

function initialForm(form: FormAttempt<SentForm> | null): DesignationFields {
  const sent = form?.form;
  return {
    code: sent?.code ?? "",
    name: sent?.name ?? "",
    level: sent?.level ?? "PROVINCIAL",
    legalBasis: sent?.legalBasis ?? "",
    document: sent?.document ?? null,
    geography: sent?.geography ?? "g2025",
    areas: sent?.areas ?? "",
    from: sent?.from ?? "",
    to: sent?.to ?? "",
    predecessor: sent?.predecessor ?? "",
  };
}

/**
 * One designation: its row opens what is done with it next - its inspectors' appointments while it is in force,
 * the decision while it waits - and carries End, or Withdraw for one still waiting, confirmed in a dialog.
 */
function designationRow(
  designation: DesignationRow,
  asOf: string,
  barred: string | null,
  attempt: RowAttempt | null,
  t: Translate,
  locale: Locale,
): DialogRow {
  const pending = designation.state === "PENDING_APPROVAL";
  const detail = pending
    ? designation.recordedBy !== null
      ? recordedBy(t, designation.recordedBy, locale)
      : null
    : designation.endsAfter !== null
      ? t("ver09.endsAfter", { d: date(designation.endsAfter, locale) })
      : null;
  const mine = attempt?.id === designation.id ? attempt : null;
  const dateError = mine !== null && (mine.refusal === "END_DATE_IN_PAST" || mine.refusal === "END_DATE_EXTENDS_PERIOD") ? sentenceNaming(t, mine.refusal, mine.detail, locale) : null;
  const reasonError = mine?.refusal === "REASON_REQUIRED" ? refusalSentence(t, mine.refusal) : null;
  const inDialog = mine !== null && dateError === null && reasonError === null ? refusalNaming(t, mine.refusal, mine.detail, locale) : null;
  const name = `${designation.code} – ${designation.name}`;
  const ends: RowAct | null =
    designation.state === "ACTIVE" || pending
      ? {
          id: "end",
          label: pending ? t("ver09.withdraw") : t("ver09.end"),
          ariaLabel: `${pending ? t("ver09.withdraw") : t("ver09.end")} ${designation.code}`,
          variant: "quiet",
          ...(barred !== null
            ? { disabledReason: barred }
            : {
                dialog: {
                  title: pending ? t("ver09.withdrawTitle") : t("ver09.endTitle", { a: designation.code, d: "{d}" }),
                  description: pending ? name : t("ver09.endText"),
                  primary: { label: pending ? t("ver09.withdraw") : t("ver09.end"), variant: "danger" },
                  ...(pending
                    ? {}
                    : {
                        date: {
                          name: "effective_to",
                          label: t("ver09.endDate"),
                          value: mine?.effectiveTo ?? endOfMonth(asOf),
                          ...(dateError !== null ? { error: dateError } : {}),
                        },
                      }),
                  reason: { name: "reason", label: t("ver09.endReason"), value: mine?.reason ?? "", ...(reasonError !== null ? { error: reasonError } : {}) },
                  ...(inDialog !== null ? { refusal: inDialog } : {}),
                  hidden: { id: designation.id },
                },
              }),
        }
      : null;
  return {
    key: designation.id,
    cells: {
      // A row opens what is done with it next: the appointments under it, or its decision while it waits.
      ...(designation.state === "ACTIVE"
        ? { _href: routes.opsInspectorAppointments(designation.id) }
        : pending
          ? { _href: routes.opsDesignationDecisions({ designation: designation.id }) }
          : {}),
      code: designation.code,
      name: designation.name,
      level: t(`console.level.${designation.level}`),
      areas: { text: joined(t, designation.areas), detail: designation.geography },
      // The period is written out: an open-ended one is said in words, which a period cell (two dates) cannot hold.
      period: designation.to !== null ? (R1_FORMAT.formatPeriod(designation.from, designation.to, locale, true) ?? "") : t("ver09.openPeriod", { d: date(designation.from, locale) }),
      st: standingStatus(t, designation.state, detail),
    },
    acts: ends === null ? [] : [ends],
  };
}
