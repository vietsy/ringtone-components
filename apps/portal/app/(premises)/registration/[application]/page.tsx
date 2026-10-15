import {
  Banner,
  Button,
  ButtonRow,
  Disclosure,
  FactList,
  ItemList,
  PageHeader,
  Panel,
  Skeleton,
  StatusLine,
  Table,
  ViewState,
} from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { Text } from "@/components/Text";
import { UploadList } from "@/features/registration/UploadList";
import { WithdrawControl } from "@/features/registration/WithdrawControl";
import { addRequestedDocument, withdrawApplication } from "@/features/registration/actions";
import { applicationStatus, day, moment, regTranslator } from "@/features/registration/copy";
import { readForPage } from "@/lib/api/flash";
import { loadApplicationRecord, type ApplicationRecord, type EvidenceItemRefusal, type HistoryEvent, type StatusAttempt } from "@/lib/api/registration";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG07_VIEWS } from "@/lib/mock/registration";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";
import type { LoadOutcome } from "@rightone/ui";
import type { ReactNode } from "react";

type SearchParams = Record<string, string | string[] | undefined>;
type Failure = NonNullable<LoadOutcome<unknown>["failure"]>;
type Request = NonNullable<ApplicationRecord["evidenceRequest"]>;

/** Refusals that take the place of the page body, each with its sentence; any other failure is our outage. */
const REFUSALS: Readonly<Record<string, { title: string; text: string }>> = {
  APPLICATION_NOT_FOUND: { title: "reg.notFound.title", text: "reg.notFound.text" },
  NOT_AUTHORISED_FOR_PREMISES: { title: "reg07.naTitle", text: "reg07.naText" },
};

/** What a refused document says beside its item: an error for a bad file, a warning when the request cannot take it. */
const ITEM_REFUSALS: Readonly<Record<EvidenceItemRefusal, { severity: "error" | "warning"; text: string }>> = {
  DOCUMENT_INVALID: { severity: "error", text: "reg07.diText" },
  EVIDENCE_REQUEST_CLOSED: { severity: "warning", text: "reg07.rcText" },
  TARIFF_NOT_APPROVED: { severity: "warning", text: "reg.refusal.TARIFF_NOT_APPROVED.text" },
  EVIDENCE_NOT_REQUESTED: { severity: "error", text: "reg.refusal.EVIDENCE_NOT_REQUESTED.text" },
};

/**
 * SCR-REG-07 Application status. Where one application stands: its state and what happens next, the
 * documents a reviewer asked for, the dates, the claims and the history; why it ended once it has; and
 * Withdraw while it can still be withdrawn. SCR-REG-06 opens it after sending.
 */
export default async function ApplicationStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ application: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const principal = await requirePrincipal();
  const [{ application }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = regTranslator(locale);
  const view = reviewView(query, REG07_VIEWS);
  const outcome = view === "loading" ? null : await loadApplicationRecord(principal.sessionId, application, view);
  const last = readForPage<StatusAttempt>(query);
  const attempt = last?.page === "status" && last.application === application ? last : null;
  const read = outcome?.data ?? null;
  const record = read !== null && attempt !== null ? withAttempt(read, attempt) : read;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";
  const gap = phone ? "var(--space-4)" : "var(--space-6)";

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("applications", frame, locale)}
      account={principal.account}
      {...(record !== null ? { context: { premises: record.premises, period: record.reference } } : {})}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("reg.crumb"), href: routes.applications() }]}
          title={record !== null ? record.premises : t("reg07.title")}
          {...(record !== null ? { status: applicationStatus(record.status, t) } : {})}
          {...(record !== null && record.ended !== null ? { meta: endedMeta(record.ended, t, locale) } : {})}
          locale={locale}
        />
        {view === "loading" ? <Loading frame={frame} t={t} locale={locale} /> : null}
        {failure !== null ? <Unavailable failure={failure} phone={phone} t={t} locale={locale} /> : null}
        {record !== null ? <Status record={record} confirmOpen={view === "withdraw-confirm"} frame={frame} t={t} locale={locale} /> : null}
      </div>
    </PortalShell>
  );
}

/**
 * The application as the last refused act left it: a withdrawal refused because the application has ended
 * (the control goes, never left disabled), or a document refused beside its item.
 */
function withAttempt(record: ApplicationRecord, attempt: StatusAttempt): ApplicationRecord {
  const request = record.evidenceRequest;
  const refused = attempt.document;
  return {
    ...record,
    ...(attempt.withdrawRefusal !== null ? { withdrawRefusal: attempt.withdrawRefusal, canWithdraw: false } : {}),
    evidenceRequest:
      request === null || refused === null
        ? request
        : {
            ...request,
            closed: request.closed || refused.code === "EVIDENCE_REQUEST_CLOSED",
            items: request.items.map((entry) => (entry.item === refused.item ? { ...entry, refusal: refused.code } : entry)),
          },
  };
}

/** The two columns of the page: the application's facts beside the panels, one column at 768 px and below. */
function Columns({ frame, side, children }: { frame: Frame; side: ReactNode; children: ReactNode }) {
  const narrow = frame !== "desktop";
  const gap = frame === "phone" ? "var(--space-4)" : "var(--space-6)";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "minmax(0, 1fr) var(--container-sm)",
        gridTemplateAreas: narrow ? "'side' 'main'" : "'main side'",
        gap,
        alignItems: "start",
      }}
    >
      <div style={{ gridArea: "side", minWidth: 0 }}>{side}</div>
      <div style={{ gridArea: "main", display: "flex", flexDirection: "column", gap, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function Loading({ frame, t, locale }: { frame: Frame; t: Translate; locale: Locale }) {
  const inset = frame === "phone" ? "sm" : "md";
  return (
    <Columns
      frame={frame}
      side={
        <Panel inset={inset} density="portal" locale={locale}>
          <Skeleton variant="facts" rows={4} density="portal" locale={locale} />
        </Panel>
      }
    >
      <Panel title={t("reg07.datesTitle")} level={2} inset={inset} density="portal" locale={locale}>
        <Skeleton variant="facts" rows={3} density="portal" locale={locale} />
      </Panel>
      <Panel title={t("reg07.historyTitle")} level={2} inset={inset} density="portal" locale={locale}>
        <Table columns={historyColumns(frame, t)} rows={[]} loading={5} density="portal" layout={frame === "phone" ? "cards" : "table"} caption={t("reg07.historyTitle")} locale={locale} />
      </Panel>
    </Columns>
  );
}

/** Not found and not the person's to see are refusals with their sentence; anything else is our failure, never an empty page. */
function Unavailable({ failure, phone, t, locale }: { failure: Failure; phone: boolean; t: Translate; locale: Locale }) {
  const refusal = REFUSALS[failure.code];
  if (refusal === undefined) {
    return (
      <ViewState
        view="error"
        errorTitle={t("reg.errTitle")}
        errorText={t("reg.errText")}
        {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
        retryable={failure.retryable}
        density="portal"
        locale={locale}
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
      <ViewState
        view="refused"
        refusal={{ code: failure.code, title: t(refusal.title), text: t(refusal.text), family: "attention" }}
        density="portal"
        locale={locale}
      />
      <div>
        <Button variant="secondary" size="md" href={routes.applications()} fullWidth={phone} locale={locale}>
          {t("reg.notFound.back")}
        </Button>
      </div>
    </div>
  );
}

function Status({
  record,
  confirmOpen,
  frame,
  t,
  locale,
}: {
  record: ApplicationRecord;
  confirmOpen: boolean;
  frame: Frame;
  t: Translate;
  locale: Locale;
}) {
  const phone = frame === "phone";
  const inset = phone ? "sm" : "md";
  const ended = record.ended;
  const request = record.evidenceRequest;
  return (
    <>
      {record.withdrawRefusal !== null ? (
        <Banner family="attention" title={t("reg07.afTitle")} code={record.withdrawRefusal} density="portal" live locale={locale}>
          {t("reg07.afText")}
        </Banner>
      ) : null}
      <Columns
        frame={frame}
        side={
          <Panel as="aside" title={t("reg07.thisApp")} level={2} inset={inset} density="portal" locale={locale}>
            <FactList items={applicationFacts(record, t, locale)} density="portal" locale={locale} />
          </Panel>
        }
      >
        {/* The documents asked for, while the application is open; once it has ended its own panel says what was missing. */}
        {request !== null && ended === null ? <Documents reference={record.reference} request={request} phone={phone} t={t} locale={locale} /> : null}

        {record.status === "DRAFT" ? (
          <Panel
            title={t("reg07.draftTitle")}
            {...(record.savedAt !== null ? { description: t("reg07.draftText", { ts: moment(record.savedAt, locale) }) } : {})}
            level={2}
            inset={inset}
            density="portal"
            locale={locale}
          >
            <div>
              <Button variant="primary" size="md" href={routes.applicationFacts(record.reference)} fullWidth={phone} locale={locale}>
                {t("reg07.continueApp")}
              </Button>
            </div>
          </Panel>
        ) : null}

        {record.decision !== null ? (
          <Panel title={t("reg07.decisionTitle")} level={2} inset={inset} density="portal" locale={locale}>
            <FactList
              items={[
                { label: t("reg07.fDecision"), value: record.decision.reference, kind: "id" },
                { label: t("reg07.fIssued"), value: record.decision.issuedAt, kind: "datetime" },
              ]}
              density="portal"
              locale={locale}
            />
            <div>
              <Button variant="primary" size="md" href={routes.decision(record.decision.reference)} fullWidth={phone} locale={locale}>
                {t("reg07.openDecision")}
              </Button>
            </div>
          </Panel>
        ) : null}

        {ended !== null ? <Ended ended={ended} request={request} inset={inset} t={t} locale={locale} /> : null}

        {/* An application that has ended expects no decision, so its dates are not stated again. */}
        {record.dates !== null && ended === null ? <Dates dates={record.dates} inset={inset} t={t} locale={locale} /> : null}

        {record.claims.length > 0 ? (
          <Panel title={t("reg07.claimsTitle")} level={2} inset={inset} density="portal" locale={locale}>
            <Table
              columns={[
                { key: "claim", label: t("reg07.cClaim"), kind: "strong" },
                { key: "layer", label: t("reg07.cLayer"), kind: "text" },
                { key: "period", label: t("reg07.cPeriod"), kind: "period", ...(frame === "tablet" ? { priority: "low" as const } : {}) },
                { key: "state", label: t("reg07.cState"), kind: "status" },
              ]}
              rows={record.claims.map((claim) => ({
                _key: `${claim.kind}-${claim.layer}`,
                claim: t(`reg07.claim.${claim.kind}`),
                layer: t(`reg.layer.${claim.layer}`),
                period: claim.period,
                state: { family: "neutral", label: t(`reg07.claimState.${claim.state}`) },
              }))}
              density="portal"
              layout={phone ? "cards" : "table"}
              expandable={frame === "tablet"}
              caption={t("reg07.claimsTitle")}
              locale={locale}
            />
          </Panel>
        ) : null}

        <Panel title={t("reg07.historyTitle")} level={2} inset={inset} density="portal" locale={locale}>
          <Table
            columns={historyColumns(frame, t)}
            rows={record.history.map((entry, index) => ({ _key: `h${index}`, when: entry.at, what: historyText(entry, t) }))}
            density="portal"
            layout={phone ? "cards" : "table"}
            caption={t("reg07.historyTitle")}
            locale={locale}
          />
        </Panel>

        <ButtonRow>
          {record.canWithdraw ? (
            <WithdrawControl
              copy={{
                withdraw: t("reg07.withdraw"),
                title: t("reg07.dlgTitle", { ref: record.reference }),
                text: t("reg07.dlgText"),
                confirm: t("reg07.dlgPrimary", { ref: record.reference }),
                keep: t("reg07.dlgKeep"),
              }}
              action={withdrawApplication.bind(null, record.reference)}
              initiallyOpen={confirmOpen}
              phone={phone}
              locale={locale}
            />
          ) : null}
          <Button variant="quiet" size="md" href={routes.applications()} fullWidth={phone} locale={locale}>
            {t("reg.notFound.back")}
          </Button>
        </ButtonRow>
      </Columns>
    </>
  );
}

function applicationFacts(record: ApplicationRecord, t: Translate, locale: Locale) {
  const next = nextAction(record, t, locale);
  return [
    { label: t("reg07.fRef"), value: record.reference, kind: "id" as const },
    { label: t("reg07.fKind"), value: t(`reg.kind.${record.kind}`) },
    ...(record.savedAt !== null ? [{ label: t("reg07.fSaved"), value: record.savedAt, kind: "datetime" as const }] : []),
    // Not sent yet is said of a draft; a record that does not give the moment it was sent leaves the line out.
    ...(record.sentAt !== null || record.status === "DRAFT"
      ? [{ label: t("reg07.fSent"), value: record.sentAt, kind: "datetime" as const, missing: t("reg07.notSent") }]
      : []),
    ...(record.review !== null ? [{ label: t("reg07.fReview"), value: t(`reg07.review.${record.review}`) }] : []),
    ...(next !== null ? [{ label: t("reg07.fNext"), value: next }] : []),
  ];
}

/** The next action as SCR-REG-01 words it; an application that has ended has none. */
function nextAction(record: ApplicationRecord, t: Translate, locale: Locale): string | null {
  switch (record.status) {
    case "DRAFT":
      return t("reg.next.continue");
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return t("reg.next.deciding");
    case "EVIDENCE_REQUIRED": {
      const due = record.evidenceRequest?.dueOn ?? null;
      return due !== null ? t("reg.next.sendBy", { d: day(due, locale) }) : null;
    }
    case "DECIDED":
      return t("reg.next.read");
    default:
      return null;
  }
}

/**
 * The documents asked for, with Add a document beside each one still awaited (the first is the primary
 * action). Adding records the file's name, type and size against the item. A refused document says why
 * under its item; once the request has ended, the control stays with the reason it cannot be used.
 */
function Documents({ reference, request, phone, t, locale }: { reference: string; request: Request; phone: boolean; t: Translate; locale: Locale }) {
  const title = request.dueOn !== null ? t("reg07.docsTitleBy", { d: day(request.dueOn, locale) }) : t("reg07.docsTitle");
  const asked = request.askedBy === "RIGHTONE" ? t("reg07.askedAuto") : t("reg07.askedReviewer", { d: day(request.askedOn, locale) });
  const firstAwaited = request.items.findIndex((entry) => entry.receivedOn === null);
  const entries = request.items.map((entry, index) => {
    const refusal = entry.refusal !== null ? ITEM_REFUSALS[entry.refusal] : null;
    const detail = entry.receivedOn !== null ? t("reg07.receivedOn", { d: day(entry.receivedOn, locale) }) : t("reg07.notYet");
    return {
      key: entry.item,
      title: t(`reg.doc.${entry.item}`),
      family: entry.receivedOn !== null ? ("positive" as const) : ("attention" as const),
      detail,
      message: refusal !== null ? { severity: refusal.severity, text: t(refusal.text) } : null,
      add:
        entry.receivedOn !== null
          ? null
          : {
              target: entry.item,
              label: t("reg07.addDoc"),
              variant: !request.closed && index === firstAwaited ? ("primary" as const) : ("secondary" as const),
              disabledReason: request.closed ? t("reg07.requestEnded") : null,
            },
      more: [],
      card: { label: detail, detail: null },
      busy: false,
    };
  });
  return (
    <Panel title={title} description={asked} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
      <UploadList
        entries={entries}
        upload={addRequestedDocument.bind(null, reference)}
        layout={phone ? "cards" : "list"}
        numbered
        label={title}
        columns={{ doc: t("reg07.docCol"), state: t("reg07.cState") }}
        locale={locale}
      />
      {/* On the automated route the last document triggers the decision; there is no review to wait for. */}
      {request.askedBy === "RIGHTONE" ? (
        <Text size="base" measure="2xl">
          {t("reg07.autoLine")}
        </Text>
      ) : null}
      {request.dueOn !== null ? (
        <Text size="base" tone="secondary" measure="2xl">
          {t("reg07.closeLine", { d: day(request.dueOn, locale) })}
        </Text>
      ) : null}
    </Panel>
  );
}

function Dates({ dates, inset, t, locale }: { dates: NonNullable<ApplicationRecord["dates"]>; inset: "sm" | "md"; t: Translate; locale: Locale }) {
  // Completeness and the expected decision are stated only where a review takes place.
  const reviewed = dates.completeOn !== null && dates.decisionExpectedBy !== null;
  return (
    <Panel title={t("reg07.datesTitle")} level={2} inset={inset} density="portal" locale={locale}>
      <FactList
        items={[
          ...(reviewed
            ? [
                { label: t("reg07.fComplete"), value: dates.completeOn, kind: "date" as const },
                {
                  label: t("reg07.fExpected"),
                  value: dates.decisionExpectedBy,
                  kind: "date" as const,
                  ...(dates.reset ? { note: t("reg07.resetNote") } : {}),
                },
              ]
            : []),
          {
            label: t("reg07.fDeadline"),
            value: dates.paymentDeadline,
            kind: "date" as const,
            note: t("reg07.deadlineNote", { d: day(dates.useBeganOn, locale) }),
          },
        ]}
        density="portal"
        locale={locale}
      />
      {dates.toldOn !== null ? (
        <StatusLine
          family="attention"
          text={t("reg07.afterLine", { d: day(dates.paymentDeadline, locale), d2: day(dates.toldOn, locale) })}
          cutout="surface"
          locale={locale}
        />
      ) : null}
      {/* DR-41 row 3: the deadline was already behind when the application became complete. */}
      {dates.passedWhenComplete ? (
        <StatusLine family="attention" text={t("reg07.passedLine", { d: day(dates.paymentDeadline, locale) })} cutout="surface" locale={locale} />
      ) : null}
    </Panel>
  );
}

/**
 * Why the application ended. A refusal carries its statement and the appeal route, and never a withdraw
 * control or the word withdrawn (FR-REG-032); a withdrawal says when and by whom; a closure names the
 * documents that never arrived.
 */
function Ended({
  ended,
  request,
  inset,
  t,
  locale,
}: {
  ended: NonNullable<ApplicationRecord["ended"]>;
  request: Request | null;
  inset: "sm" | "md";
  t: Translate;
  locale: Locale;
}) {
  switch (ended.kind) {
    case "REFUSED":
      return (
        <Panel family="danger" title={t("reg07.endedTitle")} level={2} inset={inset} density="portal" locale={locale}>
          <FactList
            items={[
              { label: t("reg07.fOutcome"), value: ended.statement.outcome[locale] },
              { label: t("reg07.fReason"), value: ended.statement.reason[locale] },
              { label: t("reg07.fNotMet"), value: ended.statement.notMet[locale] },
              { label: t("reg07.fYouCan"), value: ended.statement.youCan[locale] },
            ]}
            density="portal"
            locale={locale}
          />
          <Disclosure title={t("reg07.howAppeal")} open level={3} density="portal" locale={locale}>
            <Text size="base" measure="2xl">
              {t("reg07.appealRoute")}
            </Text>
          </Disclosure>
        </Panel>
      );
    case "WITHDRAWN":
      return (
        <Panel family="info" title={t("reg07.endedTitle")} level={2} inset={inset} density="portal" locale={locale}>
          <FactList
            items={[
              { label: t("reg07.fEnded"), value: ended.at, kind: "datetime" },
              { label: t("reg07.fWithdrawnBy"), value: t("reg07.byYou") },
            ]}
            density="portal"
            locale={locale}
          />
          <Text size="base" measure="2xl">
            {t("reg07.keptText")}
          </Text>
        </Panel>
      );
    case "CLOSED_INCOMPLETE": {
      const missing = (request?.items ?? []).filter((entry) => entry.receivedOn === null);
      const due = request?.dueOn ?? null;
      return (
        <Panel family="attention" title={t("reg07.endedTitle")} level={2} inset={inset} density="portal" locale={locale}>
          {due !== null ? (
            <Text size="base" measure="2xl">
              {t("reg07.closedText", { d: day(due, locale), d2: day(ended.on, locale) })}
            </Text>
          ) : null}
          <ItemList
            items={missing.map((entry) => ({ key: entry.item, title: t(`reg.doc.${entry.item}`), family: "attention" as const, detail: t("reg07.notReceived") }))}
            numbered
            readOnly
            label={t("reg07.notReceivedLabel")}
            density="portal"
            locale={locale}
          />
          <Text size="base" tone="secondary" measure="2xl">
            {t("reg07.closedNext")}
          </Text>
        </Panel>
      );
    }
  }
}

function endedMeta(ended: NonNullable<ApplicationRecord["ended"]>, t: Translate, locale: Locale): string {
  const on = day(ended.on, locale);
  switch (ended.kind) {
    case "REFUSED":
      return t("reg07.refusedMeta", { d: on });
    case "WITHDRAWN":
      return t("reg07.withdrawnMeta", { d: on });
    case "CLOSED_INCOMPLETE":
      return t("reg07.closedMeta", { d: on });
  }
}

/** When, then what happened; a phone card leads with what happened. */
function historyColumns(frame: Frame, t: Translate) {
  const when = { key: "when", label: t("reg07.cWhen"), kind: "datetime" as const };
  const what = { key: "what", label: t("reg07.cWhat"), kind: "text" as const };
  return frame === "phone" ? [what, when] : [when, what];
}

function historyText(entry: HistoryEvent, t: Translate): string {
  switch (entry.event) {
    case "SENT":
      return t(entry.route === "CLAIM_REVIEW" && entry.claim === "DIRECT_LICENCE" ? "reg07.event.SENT.CLAIM_REVIEW_DIRECT_LICENCE" : `reg07.event.SENT.${entry.route}`);
    case "EVIDENCE_ASKED":
      return t(`reg07.event.EVIDENCE_ASKED.${entry.by}`);
    case "DECIDED":
      return t(entry.afterDocument ? "reg07.event.DECIDED" : "reg07.event.DECIDED_PLAIN", { ref: entry.decision });
    default:
      return t(`reg07.event.${entry.event}`);
  }
}
