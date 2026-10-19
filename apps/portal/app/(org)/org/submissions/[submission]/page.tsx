import { R1_FORMAT } from "@rightone/formatting";
import { notFound } from "next/navigation";
import {
  Banner,
  Button,
  Columns,
  FactList,
  Meter,
  PageHeader,
  Panel,
  StatStrip,
  StatusLine,
  ViewState,
} from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { orgContext, orgNav } from "@/components/shells/org-nav";
import { Text } from "@/components/Text";
import { AcknowledgeControl } from "@/features/submissions/AcknowledgeControl";
import { OutcomeTable, type OutcomeRow } from "@/features/submissions/OutcomeTable";
import { acknowledgeSubmission } from "@/features/submissions/actions";
import {
  channelAndFormat,
  fileSize,
  OUTCOME_FAMILY,
  participationLine,
  reasonText,
  routeText,
  subTranslator,
  submissionMeta,
  submissionStatus,
} from "@/features/submissions/copy";
import { readForPage } from "@/lib/api/flash";
import { loadParticipationStanding } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import {
  loadSubmission,
  OUTCOME_CLASSES,
  reviewFor,
  type OrgReader,
  type OutcomesAttempt,
  type Submission,
  type SubmissionOutcome,
} from "@/lib/api/submissions";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CAT05_VIEWS } from "@/lib/mock/submissions";
import { routes } from "@/lib/routes";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/** The record number as the board writes it, five digits. */
const recordNumber = (index: number) => String(index).padStart(5, "0");

/**
 * SCR-CAT-05 Submission outcomes. The organisation reads one of its submissions: while it is received or being
 * processed, that it is stored and how far processing has got, and Cancel while nothing is classified (SCR-CAT-24);
 * once completed, the count of each of the five classes, zeroes included, and every record that was not accepted
 * with its reason and its correction route; then it acknowledges every outcome, once. A cancelled submission reads
 * back cancelled under the reference it kept.
 */
export default async function SubmissionOutcomesPage({
  params,
  searchParams,
}: {
  params: Promise<{ submission: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const cmo = await requireCmo();
  const [{ submission: reference }, query] = await Promise.all([params, searchParams]);
  const [locale, frame, standing] = await Promise.all([getLocale(), getFrame(query), loadParticipationStanding(cmo)]);
  const t = subTranslator(locale);
  const view = reviewFor(cmo, query, CAT05_VIEWS);
  const kept = view === null ? readForPage<OutcomesAttempt>(query) : null;
  const outcome = view === "loading" ? null : await loadSubmission(cmo, reference, view, kept?.page === "outcomes" ? kept : null);
  // An unknown reference is the contract's 404, not a refusal: it names nothing.
  if (outcome?.failure?.code === "SUBMISSION_NOT_FOUND") notFound();
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const submission = data?.submission ?? null;
  const phone = frame === "phone";
  const reader: OrgReader = data?.reader ?? {
    organisationName: cmo.organisationName,
    account: cmo.account,
    participation: { reference: standing.reference, state: standing.state },
  };
  const viewState = view === "loading" ? "loading" : failure === null ? "populated" : failure.code === "NOT_YOUR_SUBMISSION" ? "refused" : "error";
  const inFlight = submission?.state === "RECEIVED" || submission?.state === "PROCESSING";
  const total = submission?.counts !== null && submission?.counts !== undefined ? Object.values(submission.counts).reduce((sum, n) => sum + n, 0) : 0;
  const count = (value: number) => R1_FORMAT.formatCount(value, locale) ?? "";

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={orgNav("submissions", standing.open, locale)}
      account={reader.account}
      context={orgContext(reader.organisationName, participationLine(t, reader.participation), locale)}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("cat05.crumb") }]}
          title={t("cat05.title", { reference: submission?.reference ?? reference })}
          {...(submission !== null ? { status: submissionStatus(t, submission.state), meta: submissionMeta(t, submission, locale) } : {})}
          locale={locale}
        >
          {inFlight ? (
            <Button variant="secondary" size="md" icon="download" disabled disabledReason={t("cat05.exportReason")} locale={locale}>
              {t("cat05.export")}
            </Button>
          ) : null}
          {submission?.state === "COMPLETED" ? (
            <AcknowledgeControl
              copy={{
                acknowledge: t("cat05.ack"),
                title: t("cat05.dlgTitle", { count: count(total), reference: submission.reference }),
                text: t("cat05.dlgText", { action: count(submission.outcomes.length) }),
                confirm: t("cat05.dlgYes", { count: count(total) }),
                back: t("cat05.dlgNo"),
              }}
              action={acknowledgeSubmission.bind(null, submission.reference)}
              initiallyOpen={view === "confirm"}
              phone={phone}
              locale={locale}
            />
          ) : null}
        </PageHeader>
        {data !== null && data.refusal !== null ? (
          <Banner family="attention" title={t(`sub.refusal.${data.refusal}`)} code={data.refusal} density="portal" locale={locale} />
        ) : null}
        <ViewState
          view={viewState}
          refusal={{ code: "NOT_YOUR_SUBMISSION", title: t("cat05.refusedTitle"), text: t("sub.refusal.NOT_YOUR_SUBMISSION"), family: "neutral" }}
          {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
          {...(failure !== null ? { retryable: failure.retryable } : {})}
          errorText={t("cat05.errorText")}
          density="portal"
          rows={8}
          locale={locale}
        >
          {submission !== null ? <Body submission={submission} phone={phone} t={t} locale={locale} /> : null}
        </ViewState>
      </div>
    </PortalShell>
  );
}

function Body({ submission, phone, t, locale }: { submission: Submission; phone: boolean; t: Translate; locale: Locale }) {
  const { state, counts } = submission;
  const done = counts !== null && (state === "COMPLETED" || state === "ACKNOWLEDGED");
  const inFlight = state === "RECEIVED" || state === "PROCESSING";
  const count = (value: number) => R1_FORMAT.formatCount(value, locale) ?? "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
      <Columns single={phone}>
        {done ? (
          <Panel title={t("cat05.countsTitle")} density="portal" locale={locale}>
            <StatStrip items={OUTCOME_CLASSES.map((outcome) => ({ label: t(`cat05.outcome.${outcome}`), value: counts[outcome] }))} locale={locale} />
          </Panel>
        ) : null}
        {inFlight ? <InFlight submission={submission} t={t} locale={locale} /> : null}
        {state === "CANCELLED" ? (
          <Panel title={t("cat24.keepsTitle")} density="portal" locale={locale}>
            <Text size="base">{t("cat24.keepsText", { reference: submission.reference })}</Text>
          </Panel>
        ) : null}
        <Panel title={t("cat05.subTitle")} density="portal" locale={locale}>
          <FactList items={facts(submission, t, locale)} locale={locale} />
          {state === "RECEIVED" ? (
            <Button variant="secondary" size="md" fullWidth href={routes.orgCancelSubmission(submission.reference)} locale={locale}>
              {t("cat05.cancel")}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="md"
              fullWidth
              disabled
              disabledReason={t(state === "CANCELLED" ? "cat05.cancelOffCancelled" : "sub.refusal.SUBMISSION_NOT_RECEIVED")}
              locale={locale}
            >
              {t("cat05.cancel")}
            </Button>
          )}
        </Panel>
      </Columns>
      {done ? (
        <Panel title={t("cat05.needTitle")} density="portal" locale={locale}>
          <OutcomeTable
            rows={submission.outcomes.map((row) => outcomeRow(row, t))}
            columns={columns(t, phone)}
            filters={OUTCOME_CLASSES.map((outcome) => ({
              value: outcome,
              label: t("cat05.filterOption", { label: t(`cat05.outcome.${outcome}`), count: count(counts[outcome]) }),
            }))}
            initial={["WARNING", "REJECTED", "DUPLICATE", "CONFLICT"]}
            allAccepted={submission.outcomes.length === 0 ? t("cat05.allAccepted", { count: count(counts.ACCEPTED) }) : null}
            copy={{
              legend: t("cat05.filter"),
              caption: t("cat05.needTitle"),
              sortNote: t("cat05.sortNote"),
              pager: t("cat05.pager"),
              endNote: t("cat05.endNote"),
              pages: t("cat05.pages"),
              filteredEmpty: t("cat05.filteredEmpty"),
            }}
            layout={phone ? "cards" : "table"}
            locale={locale}
          />
        </Panel>
      ) : null}
    </div>
  );
}

/** Received or processing: the submission is stored, and how many of its records are classified so far. */
function InFlight({ submission, t, locale }: { submission: Submission; t: Translate; locale: Locale }) {
  const processing = submission.state === "PROCESSING";
  const classified = submission.processing?.classified ?? 0;
  const records = submission.records;
  const count = (value: number) => R1_FORMAT.formatCount(value, locale) ?? "";
  const text = processing && records !== null ? t("cat05.processingText", { classified: count(classified), total: count(records) }) : t("cat05.receivedText");
  return (
    <Panel title={t(processing ? "cat05.processingTitle" : "cat05.receivedTitle")} density="portal" locale={locale}>
      <StatusLine family="info" text={text} detail={t(processing ? "cat05.processingDetail" : "cat05.receivedDetail")} cutout="surface" locale={locale} />
      {records !== null && records > 0 ? (
        <Meter
          value={processing ? classified : 0}
          max={records}
          family="info"
          label={text}
          caption={t("cat05.progress", { classified: count(processing ? classified : 0), total: count(records) })}
          locale={locale}
        />
      ) : null}
    </Panel>
  );
}

function facts(submission: Submission, t: Translate, locale: Locale) {
  const { file, cancelled } = submission;
  return [
    { label: t("cat05.fReference"), value: submission.reference, kind: "id" as const },
    { label: t("cat05.fChannel"), value: channelAndFormat(t, submission) },
    { label: t("cat05.fRecords"), value: submission.records, kind: "count" as const },
    ...(file !== null ? [{ label: t("cat05.fFile"), value: t("sub.fileFact", { name: file.name, size: fileSize(t, file.sizeBytes, locale) }) }] : []),
    { label: t("cat05.fReceived"), value: submission.receivedAt, kind: "datetime" as const },
    { label: t("cat05.fSubmittedBy"), value: submission.submittedBy },
    ...(cancelled !== null
      ? [
          { label: t("cat05.fCancelled"), value: cancelled.at, kind: "datetime" as const },
          { label: t("cat05.fReason"), value: cancelled.reason },
        ]
      : []),
  ];
}

/** The list's columns; on a phone each record is a card, reason and route first, index last. */
function columns(t: Translate, phone: boolean) {
  const rec = { key: "rec", label: t("cat05.cRecord"), kind: "stack" as const, width: "var(--space-56)" };
  const outcome = { key: "outcome", label: t("cat05.cOutcome"), kind: "status" as const, sortable: true };
  const reason = { key: "reason", label: t("cat05.cReason") };
  const route = { key: "route", label: t("cat05.cRoute"), kind: "stack" as const, detailSize: "sm" as const, width: "var(--space-60)" };
  return phone ? [reason, outcome, route, rec] : [rec, outcome, reason, route];
}

/**
 * One record that was not accepted. The board links a subject to its catalogue record (SCR-CAT-09, operations)
 * and a claim's to SCR-CAT-07, and an out-of-scope row's route to SCR-CAT-03: the links whose screens exist in the
 * portal are kept (G-22), the catalogue record's is left out.
 */
function outcomeRow(row: SubmissionOutcome, t: Translate): OutcomeRow {
  const { subject } = row;
  const where = subject.right !== null ? [t(`sub.right.${subject.right}`), subject.territory ?? ""].filter((part) => part !== "") : [];
  const detail = [subject.title, ...where, ...(subject.claim !== null ? [subject.claim] : [])].join(", ");
  const route = routeText(t, row.route);
  return {
    index: row.index,
    outcome: row.outcome,
    cells: {
      _key: recordNumber(row.index),
      ...(subject.claim !== null ? { _href: routes.orgClaim(subject.claim) } : {}),
      rec: { text: recordNumber(row.index), mono: true, detail },
      outcome: { family: OUTCOME_FAMILY[row.outcome], label: t(`cat05.outcome.${row.outcome}`) },
      reason: reasonText(t, row.reason),
      route: { ...route, ...(row.route.kind === "scope-amendment" ? { href: routes.orgAmendScope() } : {}) },
    },
  };
}
