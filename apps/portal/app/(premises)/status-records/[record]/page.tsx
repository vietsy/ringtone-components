import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Button, ButtonRow, Divider, FactList, Link, PageHeader, Panel, Skeleton, Table, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { printStatusRecord } from "@/features/status-records/actions";
import { readForPage } from "@/lib/api/flash";
import { requirePrincipal } from "@/lib/api/session";
import { loadStatusRecord, type PrintAttempt, type StatusRecordPage } from "@/lib/api/status-records";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { CER12_VIEWS } from "@/lib/mock/status-records";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;
type Failure = { code: string; traceId: string | null; retryable: boolean };

/** Refusals that replace the page; any other failure is our outage and reads as the error state. */
const REFUSALS: Readonly<Record<string, { title: string; text: string }>> = {
  CERTIFICATE_NOT_FOUND: { title: "cer12.nfTitle", text: "cer12.nfText" },
  NOT_AUTHORISED_FOR_PREMISES: { title: "cer12.naTitle", text: "cer12.naText" },
  REFERENCE_DATA_UNAVAILABLE: { title: "cer12.unTitle", text: "cer12.unText" },
};

/**
 * SCR-CER-12 Status record. The holder reads what the record is and until when, why it is suspended and how
 * to appeal when it is, and prints it. Print opens the new printout; the page, read again, lists it.
 */
export default async function StatusRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ record: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const principal = await requirePrincipal();
  const [{ record }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, CER12_VIEWS);
  const outcome = view === "loading" ? null : await loadStatusRecord(principal.sessionId, record, view);
  const data = answered(outcome?.data ?? null, view === null ? readForPage<PrintAttempt>(query) : null);
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  const current = data?.record ?? null;

  // The reference is known once the record has loaded; a reader refused stays in her party.
  const context =
    current !== null
      ? { premises: current.premises, period: current.reference, label: t("cer12.premisesLabel") }
      : { premises: principal.party, label: t("cer12.partyLabel") };
  const status =
    current === null
      ? null
      : current.state === "suspended"
        ? { family: "danger" as const, label: t("cer12.suspended") }
        : { family: "info" as const, label: t("cer12.active"), variant: "seal" as const };

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("records", frame, locale)}
      account={principal.account}
      context={context}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("cer12.crumb"), href: routes.statusRecords() }]}
          title={current !== null ? t("cer12.title", { reference: current.reference }) : t("cer12.titleGeneric")}
          {...(status !== null ? { status } : {})}
          {...(current !== null ? { meta: t("cer12.since", { time: R1_FORMAT.formatTimestamp(current.since, locale) ?? "" }) } : {})}
          locale={locale}
        />
        {view === "loading" ? (
          <Loading frame={frame} t={t} locale={locale} />
        ) : failure !== null || data === null ? (
          <Failed failure={failure} record={record} phone={phone} t={t} locale={locale} />
        ) : (
          <RecordView page={data} printing={view === "printing"} review={view !== null} frame={frame} t={t} locale={locale} />
        )}
      </div>
    </PortalShell>
  );
}

/** The record as a refused Print left it: the refusal beside Print, with its code. */
function answered(page: StatusRecordPage | null, attempt: PrintAttempt | null): StatusRecordPage | null {
  if (page === null || attempt === null) return page;
  return { ...page, printAnswer: { outcome: "refused", code: attempt.refusal } };
}

function Failed({ failure, record, phone, t, locale }: { failure: Failure | null; record: string; phone: boolean; t: Translate; locale: Locale }) {
  const refusal = failure !== null ? REFUSALS[failure.code] : undefined;
  if (failure !== null && refusal !== undefined) {
    // The 503 read offers Try again; the others lead back to the list.
    const unavailable = failure.code === "REFERENCE_DATA_UNAVAILABLE";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
        <ViewState
          view="refused"
          refusal={{
            code: failure.code,
            title: t(refusal.title),
            text: t(refusal.text),
            family: "attention",
            ...(unavailable ? { action: { label: t("cer12.tryAgain"), icon: "refresh-cw", href: routes.statusRecord(record) } } : {}),
          }}
          density="portal"
          locale={locale}
        />
        <div>
          <Button variant="secondary" size="md" icon="arrow-left" href={routes.statusRecords()} fullWidth={phone} locale={locale}>
            {t("cer12.back")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <ViewState
      view="error"
      errorTitle={t("cer12.errTitle")}
      errorText={t("cer12.errText")}
      {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure?.retryable ?? true}
      density="portal"
      locale={locale}
    />
  );
}

function printColumns(frame: Frame, t: Translate) {
  const low = frame === "tablet" ? { priority: "low" as const } : {};
  return [
    { key: "ref", label: t("cer12.cPrint"), kind: "id" as const },
    { key: "at", label: t("cer12.cAt"), kind: "datetime" as const, ...low },
    { key: "st", label: t("cer12.cAtStatus"), kind: "status" as const },
    { key: "key", label: t("cer12.cKey"), kind: "mono" as const, ...low },
    { key: "act", kind: "actions" as const, align: "end" as const },
  ];
}

/**
 * Each section has its own area. Wide: the record and its printouts on the left, the appeal beside them, the
 * ground first when suspended. Narrow: scope, period, ground, appeal, then the printouts.
 */
function grid(frame: Frame, suspended: boolean) {
  const narrow = frame !== "desktop";
  return {
    display: "grid",
    gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "minmax(0, 1fr) var(--container-sm)",
    gridTemplateAreas: narrow
      ? suspended
        ? "'record' 'why' 'appeal' 'prints'"
        : "'record' 'appeal' 'prints'"
      : suspended
        ? "'why appeal' 'record appeal' 'prints appeal'"
        : "'record appeal' 'prints appeal'",
    gap: frame === "phone" ? "var(--space-4)" : "var(--space-6)",
    alignItems: "start",
  } as const;
}

function Loading({ frame, t, locale }: { frame: Frame; t: Translate; locale: Locale }) {
  const inset = frame === "phone" ? "sm" : "md";
  return (
    <div style={grid(frame, false)}>
      <div style={{ gridArea: "record", minWidth: 0 }}>
        <Panel gap="xl" inset={inset} density="portal" locale={locale}>
          <Panel variant="plain" title={t("cer12.scopeTitle")} level={2} density="portal" locale={locale}>
            <Skeleton variant="facts" rows={5} density="portal" locale={locale} />
          </Panel>
          <Divider />
          <Panel variant="plain" title={t("cer12.periodTitle")} level={2} density="portal" locale={locale}>
            <Skeleton variant="facts" rows={2} density="portal" locale={locale} />
          </Panel>
        </Panel>
      </div>
      <div style={{ gridArea: "appeal", minWidth: 0 }}>
        <Panel as="aside" title={t("cer12.appealActive")} level={2} inset={inset} density="portal" locale={locale}>
          <Skeleton variant="facts" rows={2} density="portal" locale={locale} />
        </Panel>
      </div>
      <div style={{ gridArea: "prints", minWidth: 0 }}>
        <Panel title={t("cer12.printsTitle")} level={2} inset={inset} density="portal" locale={locale}>
          <Table
            columns={printColumns(frame, t)}
            rows={[]}
            loading={1}
            density="portal"
            layout={frame === "phone" ? "cards" : "table"}
            caption={t("cer12.printsTitle")}
            locale={locale}
          />
        </Panel>
      </div>
    </div>
  );
}

function RecordView({
  page,
  printing,
  review,
  frame,
  t,
  locale,
}: {
  page: StatusRecordPage;
  printing: boolean;
  /** A review state draws the board's rows as drawn, each with Open. */
  review: boolean;
  frame: Frame;
  t: Translate;
  locale: Locale;
}) {
  const { record, printAnswer, printoutRefusal } = page;
  const phone = frame === "phone";
  const inset = phone ? "sm" : "md";
  const suspension = record.suspension;
  const suspended = record.state === "suspended";
  const active = { family: "info", label: t("cer12.active"), variant: "seal" };
  const madeNow = printAnswer?.outcome === "made" ? printAnswer.printout.reference : null;

  // Each row opens its own printout, and its Open is named for it. A review state draws the board's rows, whose
  // printouts the session may not hold; they open the canvas's sheet, as the board links them.
  const printRows = record.printouts.map((printout) => ({
    _key: printout.reference,
    ...(printout.reference === madeNow ? { _changed: true } : {}),
    ref: printout.reference,
    at: printout.printedAt,
    st: active,
    key: printout.signingKey,
    act: [
      {
        label: t("cer12.open"),
        ariaLabel: `${t("cer12.open")} ${printout.reference}`,
        href: review ? routes.statusRecordPrint(record.reference) : routes.statusRecordPrint(record.reference, printout.reference),
        variant: "quiet",
      },
    ],
  }));

  return (
    <>
      {printoutRefusal !== null && (
        <div style={{ maxWidth: "var(--container-3xl)" }}>
          <Banner family="attention" title={t("cer12.npTitle")} code={printoutRefusal} density="portal" locale={locale}>
            {t(printoutRefusal === "NOT_A_PRINTABLE_REPRESENTATION" ? "cer12.npText" : "cer12.pnfText")}
          </Banner>
        </div>
      )}
      <div style={grid(frame, suspended)}>
        {suspension !== null && (
          <div style={{ gridArea: "why", minWidth: 0 }}>
            <Panel family="danger" title={t("cer12.whyTitle")} level={2} inset={inset} density="portal" locale={locale}>
              <FactList
                items={[
                  {
                    label: t("cer12.fGround"),
                    value: t("cer12.groundVal"),
                    note: t("cer12.reasonVal", { amount: R1_FORMAT.formatMoney(suspension.amountMinor, "VND", locale) ?? "" }),
                  },
                  { label: t("cer12.fRestore"), value: t("cer12.restoreVal") },
                ]}
                density="portal"
                locale={locale}
              />
            </Panel>
          </div>
        )}
        <div style={{ gridArea: "record", minWidth: 0 }}>
          <Panel gap="xl" inset={inset} density="portal" locale={locale}>
            <Panel variant="plain" title={t("cer12.scopeTitle")} level={2} density="portal" locale={locale}>
              <FactList
                items={[
                  { label: t("cer12.fName"), value: t("cer12.nameVal") },
                  { label: t("cer12.fIssuer"), value: t("cer12.issuer") },
                  { label: t("cer12.fHolder"), value: record.holder },
                  { label: t("cer12.fClass"), value: t("cer12.classVal") },
                  { label: t("cer12.fRights"), value: t("cer12.rightsVal") },
                ]}
                density="portal"
                locale={locale}
              />
            </Panel>
            <Divider />
            <Panel variant="plain" title={t("cer12.periodTitle")} level={2} density="portal" locale={locale}>
              <FactList
                items={[
                  {
                    label: t("cer12.fCurrent"),
                    value: { from: record.period.from, to: record.period.to },
                    kind: "period",
                    note: t("cer12.currentNote", { decision: record.period.decision }),
                  },
                  ...(record.earlierPeriods.length === 0
                    ? [{ label: t("cer12.fEarlier"), value: null, missing: t("cer12.noEarlier") }]
                    : record.earlierPeriods.map((period) => ({
                        label: t("cer12.fEarlier"),
                        value: { from: period.from, to: period.to },
                        kind: "period" as const,
                        note: t("cer12.currentNote", { decision: period.decision }),
                      }))),
                ]}
                density="portal"
                locale={locale}
              />
              <div>
                <Link href={routes.decision(record.period.decision)} variant="standalone" size="touch" locale={locale}>
                  {t("cer12.openDecision", { decision: record.period.decision })}
                </Link>
              </div>
            </Panel>
          </Panel>
        </div>
        <div style={{ gridArea: "appeal", minWidth: 0 }}>
          <Panel as="aside" title={t(suspended ? "cer12.appealSusp" : "cer12.appealActive")} level={2} inset={inset} density="portal" locale={locale}>
            <FactList
              items={[
                { label: t("cer12.fRoute"), value: t("cer12.routeVal") },
                suspension !== null
                  ? { label: t("cer12.fLast"), value: suspension.appealBy, kind: "date", note: t("cer12.lastNote") }
                  : { label: t("cer12.fLast"), value: null, missing: t("cer12.noLast") },
              ]}
              density="portal"
              locale={locale}
            />
          </Panel>
        </div>
        <div style={{ gridArea: "prints", minWidth: 0 }}>
          <Panel title={t("cer12.printsTitle")} description={t("cer12.printsDesc")} level={2} inset={inset} density="portal" locale={locale}>
            <Table
              columns={printColumns(frame, t)}
              rows={printRows}
              empty={{ variant: "not-started", title: t("cer12.noPrintsTitle"), text: t("cer12.noPrintsText"), action: false }}
              density="portal"
              layout={phone ? "cards" : "table"}
              expandable={frame === "tablet"}
              caption={t("cer12.printsTitle")}
              locale={locale}
            />
          </Panel>
        </div>
      </div>
      <PrintAnswerBanner
        page={page}
        printHref={madeNow !== null && !review ? routes.statusRecordPrint(record.reference, madeNow) : routes.statusRecordPrint(record.reference)}
        t={t}
        locale={locale}
      />
      {/* Print makes a printout on the server and opens it; Back is a link and does not submit. */}
      <form action={printStatusRecord.bind(null, record.reference)}>
        <ButtonRow>
          <Button
            variant="primary"
            size="md"
            icon="printer"
            type="submit"
            disabled={suspended}
            {...(suspended ? { disabledReason: t("cer12.notCurrent") } : {})}
            loading={printing}
            loadingLabel={t("cer12.printing")}
            fullWidth={phone}
            locale={locale}
          >
            {t("cer12.print")}
          </Button>
          <Button variant="secondary" size="md" icon="arrow-left" href={routes.statusRecords()} fullWidth={phone} locale={locale}>
            {t("cer12.back")}
          </Button>
        </ButtonRow>
      </form>
    </>
  );
}

/** Beside Print: what pressing it answered. */
function PrintAnswerBanner({ page, printHref, t, locale }: { page: StatusRecordPage; printHref: string; t: Translate; locale: Locale }) {
  const answer = page.printAnswer;
  if (answer === null) return null;
  let banner: React.ReactNode;
  if (answer.outcome === "made") {
    banner = (
      <Banner
        family="positive"
        title={t("cer12.doneTitle", { reference: answer.printout.reference })}
        action={{ label: t("cer12.openPrint"), href: printHref, icon: "file-text", variant: "secondary" }}
        density="portal"
        live
        locale={locale}
      >
        {t("cer12.doneText", { time: R1_FORMAT.formatTimestamp(answer.printout.printedAt, locale) ?? "", status: t("cer12.active") })}
      </Banner>
    );
  } else if (answer.code === "SIGNING_UNAVAILABLE") {
    banner = (
      <Banner family="attention" title={t("cer12.suTitle")} code={answer.code} density="portal" live locale={locale}>
        {t("cer12.suText")}
      </Banner>
    );
  } else {
    banner = (
      <Banner
        family="attention"
        title={t("cer12.ncTitle")}
        code={answer.code}
        action={{ label: t("cer12.reload"), href: routes.statusRecord(page.record.reference), icon: "refresh-cw", variant: "secondary" }}
        density="portal"
        live
        locale={locale}
      >
        {t("cer12.notCurrent")}
      </Banner>
    );
  }
  return <div style={{ maxWidth: "var(--container-3xl)" }}>{banner}</div>;
}
