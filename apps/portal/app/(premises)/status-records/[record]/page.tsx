import { R1_FORMAT } from "@rightone/formatting";
import {
  Banner,
  Button,
  ButtonRow,
  Columns,
  Divider,
  FactList,
  ItemList,
  Link,
  PageHeader,
  Panel,
  Skeleton,
  Table,
  ViewState,
} from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { printStatusRecord } from "@/features/status-records/actions";
import { readForPage } from "@/lib/api/flash";
import { requirePrincipal } from "@/lib/api/session";
import { holderStatus } from "@/features/status-records/holder";
import { recordStatus, written } from "@/features/status-records/words";
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
 * SCR-CER-12 Status record. The holder reads what the record is - its name, nature, effect and issuer as copied from
 * the definition it was issued under (FR-CER-019) - and until when, why it is suspended and how to appeal when it is,
 * renews it from its decision while it is expiring or expired, and prints it. Print opens the new printout; the page,
 * read again, lists it. A record still waiting to issue, addressed by its decision, says what it waits on (FR-CER-001).
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
  const outcome = view === "loading" ? null : await loadStatusRecord(principal, record, view);
  const data = answered(outcome?.data ?? null, view === null ? readForPage<PrintAttempt>(query) : null);
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  const current = data?.record ?? null;

  // The reference is known once the record has loaded; a reader refused stays in her party.
  const context =
    current !== null
      ? { premises: current.premises, ...(current.reference !== null ? { period: current.reference } : {}), label: t("cer12.premisesLabel") }
      : { premises: principal.party, label: t("cer12.partyLabel") };
  const list = routes.statusRecords(current?.premisesId ?? undefined);
  const status = current === null ? null : recordStatus(t, holderStatus(current.state));

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
          crumbs={[{ label: t("cer12.crumb"), href: list }]}
          title={current === null ? t("cer12.titleGeneric") : current.reference !== null ? t("cer12.title", { reference: current.reference }) : t("cer12.titlePending")}
          {...(status !== null ? { status } : {})}
          {...(current !== null ? { meta: t("cer12.since", { time: R1_FORMAT.formatTimestamp(current.since, locale) ?? "" }) } : {})}
          locale={locale}
        />
        {view === "loading" ? (
          <Loading frame={frame} t={t} locale={locale} />
        ) : failure !== null || data === null ? (
          <Failed failure={failure} record={record} phone={phone} t={t} locale={locale} />
        ) : (
          <RecordView page={data} list={list} printing={view === "printing"} review={view !== null} frame={frame} t={t} locale={locale} />
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

function Loading({ frame, t, locale }: { frame: Frame; t: Translate; locale: Locale }) {
  const narrow = frame !== "desktop";
  const inset = frame === "phone" ? "sm" : "md";
  return (
    <Columns single={narrow} gap={frame === "phone" ? 4 : 6}>
      <div style={narrow ? { display: "contents" } : { display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
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
        <div style={{ order: narrow ? 2 : 0, minWidth: 0 }}>
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
      <div style={{ order: narrow ? 1 : 0, minWidth: 0 }}>
        <Panel as="aside" title={t("cer12.appealActive")} level={2} inset={inset} density="portal" locale={locale}>
          <Skeleton variant="facts" rows={2} density="portal" locale={locale} />
        </Panel>
      </div>
    </Columns>
  );
}

function RecordView({
  page,
  list,
  printing,
  review,
  frame,
  t,
  locale,
}: {
  page: StatusRecordPage;
  /** SCR-CER-11 for the record's premises, which Back opens. */
  list: string;
  printing: boolean;
  /** A review state draws the board's rows as drawn, each with Open. */
  review: boolean;
  frame: Frame;
  t: Translate;
  locale: Locale;
}) {
  const { record, printAnswer, printoutRefusal } = page;
  const phone = frame === "phone";
  const narrow = frame !== "desktop";
  const inset = phone ? "sm" : "md";
  const standing = record.standing;
  const pending = record.reference === null;
  const active = { family: "info", label: t("cer12.active"), variant: "seal" };
  const madeNow = printAnswer?.outcome === "made" ? printAnswer.printout.reference : null;
  const definition = record.definition;
  // The renewal starts from the decision the record carries, on SCR-REG-08, while it is expiring or expired.
  const renewFrom = (record.state === "expiring" || record.state === "expired") && record.period.decision !== null ? record.period.decision : null;

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
        href: review ? routes.statusRecordPrint(record.key) : routes.statusRecordPrint(record.key, printout.reference),
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
      {
        // Wide: what happened and the record, then the printouts, beside the appeal. Narrow (and while it waits to issue):
        // one column, the record first, then why, the appeal and the printouts.
      }
      <Columns single={narrow || pending} gap={phone ? 4 : 6} style={pending ? { maxWidth: "var(--container-3xl)" } : undefined}>
        <div style={narrow || pending ? { display: "contents" } : { display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
          {pending && (
            <div style={{ minWidth: 0 }}>
              {/* Every condition the latest assessment found unmet, in the rule's order; none says only that it waits. */}
              <Panel family="attention" title={t("cer12.waitTitle")} level={2} inset={inset} density="portal" locale={locale}>
                {record.waitingOn.length > 0 ? (
                  <ItemList
                    items={record.waitingOn.map((condition) => ({ key: condition, title: t(`cer.condition.${condition}`), family: "attention" as const }))}
                    readOnly
                    density="portal"
                    label={t("cer12.waitTitle")}
                    locale={locale}
                  />
                ) : (
                  <FactList items={[{ label: t("cer12.fWait"), value: t("cer12.waitNone") }]} density="portal" locale={locale} />
                )}
              </Panel>
            </div>
          )}
          {standing !== null && (
            <div style={{ order: narrow ? 1 : 0, minWidth: 0 }}>
              <Panel
                family={standing.kind === "cancelled" ? "neutral" : "danger"}
                title={t(standing.kind === "suspended" ? "cer12.whyTitle" : `cer12.whyTitle.${standing.kind}`)}
                level={2}
                inset={inset}
                density="portal"
                locale={locale}
              >
                <FactList
                  items={[
                    {
                      label: t("cer12.fGround"),
                      value: standing.ground !== null ? t(`cer.ground.${standing.ground}`) : null,
                      missing: t("cer12.noReason"),
                      ...(standing.reason !== null ? { note: written(standing.reason, locale) ?? "" } : {}),
                    },
                    ...(standing.condition !== null ? [{ label: t("cer12.fRestore"), value: t(`cer.reinstate.${standing.condition}`) }] : []),
                  ]}
                  density="portal"
                  locale={locale}
                />
              </Panel>
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <Panel gap="xl" inset={inset} density="portal" locale={locale}>
              <Panel variant="plain" title={t("cer12.scopeTitle")} level={2} density="portal" locale={locale}>
                <FactList
                  items={[
                    // The name, nature, effect and issuer are the definition's, as the record copied them when it issued.
                    ...(!pending
                      ? [
                          { label: t("cer12.fName"), value: definition !== null ? written(definition.legalName, locale) : t("cer12.nameVal") },
                          ...(definition !== null
                            ? [
                                { label: t("cer12.fNature"), value: written(definition.legalNature, locale) },
                                { label: t("cer12.fEffect"), value: written(definition.legalEffect, locale) },
                              ]
                            : []),
                          { label: t("cer12.fIssuer"), value: definition !== null ? written(definition.issuer, locale) : t("cer12.issuer") },
                        ]
                      : []),
                    { label: t("cer12.fHolder"), value: record.holder },
                    ...(record.premisesClass !== null ? [{ label: t("cer12.fClass"), value: t(`cer.class.${record.premisesClass}`) }] : []),
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
                      label: t(pending ? "cer12.fPendingPeriod" : "cer12.fCurrent"),
                      value: { from: record.period.from, to: record.period.to },
                      kind: "period",
                      ...(record.period.decision !== null ? { note: t("cer12.currentNote", { decision: record.period.decision }) } : {}),
                    },
                    ...(pending
                      ? []
                      : record.earlierPeriods.length === 0
                        ? [{ label: t("cer12.fEarlier"), value: null, missing: t("cer12.noEarlier") }]
                        : record.earlierPeriods.map((period) => ({
                            label: t("cer12.fEarlier"),
                            value: { from: period.from, to: period.to },
                            kind: "period" as const,
                            ...(period.decision !== null ? { note: t("cer12.currentNote", { decision: period.decision }) } : {}),
                          }))),
                  ]}
                  density="portal"
                  locale={locale}
                />
                {record.period.decision !== null && (
                  <div>
                    <Link href={routes.decision(record.period.decision)} variant="standalone" size="touch" locale={locale}>
                      {t("cer12.openDecision", { decision: record.period.decision })}
                    </Link>
                  </div>
                )}
              </Panel>
            </Panel>
          </div>
          {!pending && (
            <div style={{ order: narrow ? 3 : 0, minWidth: 0 }}>
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
          )}
        </div>
        {!pending && (
          <div style={{ order: narrow ? 2 : 0, minWidth: 0, display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)" }}>
            <Panel
              as="aside"
              title={t(standing === null ? "cer12.appealActive" : standing.kind === "suspended" ? "cer12.appealSusp" : `cer12.appeal.${standing.kind}`)}
              level={2}
              inset={inset}
              density="portal"
              locale={locale}
            >
              <FactList
                items={[
                  { label: t("cer12.fRoute"), value: t("cer12.routeVal") },
                  (standing?.appealBy !== undefined && standing?.appealBy !== null)
                    ? { label: t("cer12.fLast"), value: standing.appealBy, kind: "date", note: t(standing.kind === "suspended" ? "cer12.lastNote" : "cer12.lastNoteChange") }
                    : { label: t("cer12.fLast"), value: null, missing: t("cer12.noLast") },
                ]}
                density="portal"
                locale={locale}
              />
            </Panel>
            {renewFrom !== null && (
              // Gia hạn: the renewal is applied for on REG's decision, and adds a period to this record (FR-CER-010).
              <Panel title={t("cer12.renewTitle")} level={2} inset={inset} density="portal" locale={locale}>
                <FactList items={[{ label: t("cer12.fRenew"), value: t(record.state === "expired" ? "cer12.renewExpired" : "cer12.renewExpiring") }]} density="portal" locale={locale} />
                <div>
                  <Link href={routes.decision(renewFrom)} variant="standalone" size="touch" locale={locale}>
                    {t("cer12.renew", { decision: renewFrom })}
                  </Link>
                </div>
              </Panel>
            )}
          </div>
        )}
      </Columns>
      {!pending && (
        <PrintAnswerBanner
          page={page}
          printHref={madeNow !== null && !review ? routes.statusRecordPrint(record.key, madeNow) : routes.statusRecordPrint(record.key)}
          t={t}
          locale={locale}
        />
      )}
      {record.reference !== null ? (
        // Print makes a printout on the server and opens it; Back is a link and does not submit.
        <form action={printStatusRecord.bind(null, record.reference)}>
          <ButtonRow>
            <Button
              variant="primary"
              size="md"
              icon="printer"
              type="submit"
              disabled={!record.current}
              {...(!record.current ? { disabledReason: t("cer12.notCurrent") } : {})}
              loading={printing}
              loadingLabel={t("cer12.printing")}
              fullWidth={phone}
              locale={locale}
            >
              {t("cer12.print")}
            </Button>
            <Button variant="secondary" size="md" icon="arrow-left" href={list} fullWidth={phone} locale={locale}>
              {t("cer12.back")}
            </Button>
          </ButtonRow>
        </form>
      ) : (
        <ButtonRow>
          <Button variant="secondary" size="md" icon="arrow-left" href={list} fullWidth={phone} locale={locale}>
            {t("cer12.back")}
          </Button>
        </ButtonRow>
      )}
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
        action={{ label: t("cer12.reload"), href: routes.statusRecord(page.record.key), icon: "refresh-cw", variant: "secondary" }}
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
