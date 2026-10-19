import { Banner, Button, ButtonRow, Combobox, Divider, FactList, MoneyField, PageHeader, Panel, Skeleton, Table, Tabs, TextField, ViewState } from "@/components/r1";
import type { StatusValue } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { closeCorrectionAct, decideRefundAct, recordChargebackAct, recordCorrectionAct, recordRefundAct, sendRefundAct } from "@/features/finance/actions";
import { ApproverDecision } from "@/features/finance/ApproverDecision";
import { ConfirmSend } from "@/features/finance/ConfirmSend";
import { day, financeTabs, finTranslator, moment, money, premisesLine } from "@/features/finance/console";
import { loadCorrections, type CorrectionAttempt, type CorrectionDetail, type CorrectionRow, type Corrections } from "@/lib/api/finance";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { FIN10_VIEWS } from "@/lib/mock/finance";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** SM-331's states in their families: a correction just raised or waiting on a review asks for attention. */
const STATE_FAMILY = { RAISED: "attention", CONSEQUENCES_DETERMINED: "info", OWNING_REVIEW_OPEN: "attention", AGREED: "positive", CLOSED: "neutral" } as const;

const text = (value: string | string[] | undefined) => (typeof value === "string" ? value : null);

/** The forms the page opens: a chargeback, a refund under a case, or the confirmation that sends a refund. */
type OpenForm = "chargeback" | "refund" | "send" | null;

/**
 * SCR-FIN-10 Corrections, refunds and chargebacks. The finance officer works the corrections: the list, open first,
 * and the selected one under it with the original event, the chargeback or the refund, the consequences, the
 * settlement by component and the review it waits for. He records a chargeback, records a correction (its
 * consequences, or a refund under the case that decided it), sends an approved refund and closes a correction once
 * its consequences agree. The finance approver decides the refund he did not prepare.
 */
export default async function CorrectionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The finance officer, the finance approver who decides a refund, or the auditor who reads; anyone else is sent to their landing.
  const staff = await requireStaff("ACT-FIN-OP", "ACT-FIN-APR", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = finTranslator(locale);
  const view = reviewView(params, FIN10_VIEWS);
  const attempt = readForPage<CorrectionAttempt>(params);
  const selected = text(params.correction);
  const outcome = view === "loading" ? null : await loadCorrections(staff, selected, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const asked = text(params.form);
  const officer = holds(staff, "ACT-FIN-OP");
  const form: OpenForm = !officer
    ? null
    : asked === "chargeback" || attempt?.act === "chargeback"
      ? "chargeback"
      : asked === "refund" || attempt?.act === "refund"
        ? "refund"
        : asked === "send"
          ? "send"
          : null;

  return (
    <OpsFrame
      console="operations"
      current="finance"
      staff={staff}
      searchLabel={t("fin10.search")}
      // The rows' keys are listed only while the table that binds them is on the page.
      keyMap={[
        ...((data?.rows.length ?? 0) > 0
          ? [
              { keys: ["↑", "↓"], label: t("fin.kMove") },
              { keys: ["Enter"], label: t("fin10.kOpen") },
            ]
          : []),
        // While the confirmation that sends a refund is open, Esc leaves it.
        ...(form === "send" ? [{ keys: ["Esc"], label: t("fin10.kEsc") }] : []),
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader title={t("fin10.title")} {...(data !== null ? { meta: meta(data, t, locale) } : {})} locale={locale}>
          {officer && failure === null ? <HeaderActs data={data} t={t} locale={locale} /> : null}
        </PageHeader>
        <Tabs tabs={financeTabs(staff, data?.counts ?? null, t)} value="corrections" label={t("fin.tabs")} density="console" locale={locale} />
        {failure !== null ? (
          <Failure failure={failure} t={t} locale={locale} />
        ) : (
          <Page data={data} staff={staff} form={form} caseRef={text(params.case)} attempt={attempt} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

/** A refund approved and not sent yet: a return to send, which the list offers to Send. */
const toSend = (row: CorrectionRow) => row.refund !== null && row.refund.approval?.decision === "approved" && row.refund.sent === null;

/** "1 correction open. As of …", the count of what is not closed, and the returns waiting to be sent. */
function meta(data: Corrections, t: Translate, locale: Locale): string {
  const open = data.rows.filter((row) => row.state !== "CLOSED").length;
  const returns = data.rows.filter(toSend).length;
  const ts = moment(data.asOf, locale);
  if (open === 0) return t("fin10.metaNone", { ts });
  if (returns > 0) return t("fin10.metaRefund", { n: open, m: returns, ts });
  return t(open === 1 ? "fin10.meta" : "fin10.metaMany", { n: open, ts });
}

/**
 * Record a chargeback opens its form on the page. Record a correction decides the consequences of a chargeback just
 * raised; with any other correction opened it opens the form that records a refund under the case that decided it.
 */
function HeaderActs({ data, t, locale }: { data: Corrections | null; t: Translate; locale: Locale }) {
  const subject = data?.selected ?? null;
  const settable = subject !== null && subject.state === "RAISED" && subject.kind === "chargeback";
  return (
    <ButtonRow>
      <Button variant="secondary" size="sm" href={routes.opsCorrections(subject?.reference ?? null, "chargeback")} locale={locale}>
        {t("fin10.recordChargeback")}
      </Button>
      {settable ? (
        <form action={recordCorrectionAct}>
          <input type="hidden" name="correction" value={subject.reference} />
          <Button variant="secondary" size="sm" type="submit" locale={locale}>
            {t("fin10.recordCorrection")}
          </Button>
        </form>
      ) : (
        <Button variant="secondary" size="sm" href={routes.opsCorrections(subject?.reference ?? null, "refund")} locale={locale}>
          {t("fin10.recordCorrection")}
        </Button>
      )}
    </ButtonRow>
  );
}

function Failure({ failure, t, locale }: { failure: { code: string; traceId: string | null; retryable: boolean }; t: Translate; locale: Locale }) {
  if (failure.code === "SRS_SERVICE_UNAVAILABLE") {
    return (
      <ViewState
        view="refused"
        refusal={{
          code: failure.code,
          title: t("fin10.unTitle"),
          text: t("fin10.unText"),
          family: "attention",
          action: { label: t("fin.tryAgain"), icon: "refresh-cw", href: routes.opsCorrections() },
        }}
        level={2}
        density="console"
        locale={locale}
      />
    );
  }
  return (
    <ViewState
      view="error"
      errorTitle={t("fin.errTitle")}
      errorText={t("fin.errText")}
      {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure.retryable}
      level={2}
      density="console"
      locale={locale}
    />
  );
}

/** The words of a refused act on this page, its first sentence the banner's title. */
function refusalWords(code: string, t: Translate): { title: string; text: string } {
  switch (code) {
    case "SOD_PREPARER_IS_APPROVER":
      return { title: t("fin15.sodTitle"), text: t("fin15.sodText") };
    case "FIN_OWNING_REVIEW_OPEN":
      return { title: t("fin10.closeWhyOpen"), text: "" };
    case "FIN_OWNING_REVIEW_OVERDUE":
      return { title: t("fin10.ovTitle"), text: t("fin10.closeWhyOver") };
    case "FIN_IDEMPOTENCY_CONFLICT":
      return { title: t("fin.conflictTitle"), text: t("fin.conflictText") };
    case "FIN_GROUNDS_RESERVED":
      return { title: t("fin10.grTitle"), text: t("fin10.grText") };
    case "FIN_GROUND_NOT_LISTED":
      return { title: t("fin10.gnlTitle"), text: t("fin10.gnlText") };
    default:
      return { title: t("fin.notAccessibleTitle"), text: t("fin.notAccessibleText") };
  }
}

function ActRefusal({ code, t, locale }: { code: string; t: Translate; locale: Locale }) {
  const words = refusalWords(code, t);
  // A decision the business has reserved is neutral, never a warning (04-refusal-codes.md rule 7).
  return (
    <Banner family={code === "FIN_GROUNDS_RESERVED" ? "neutral" : "attention"} title={words.title} code={code} live density="console" locale={locale}>
      {words.text !== "" ? words.text : null}
    </Banner>
  );
}

/** CER-06, where the owning service's review of a status record is decided, opens for these readers. */
const readsReviews = (staff: Staff) => holds(staff, "ACT-BIZ-APR", "ACT-OPS", "ACT-AUD");

/** Open the review: SCR-CER-06 for a review the owning service has opened, for a reader who may open it. */
function openReview(review: string | null, staff: Staff, t: Translate) {
  return review !== null && readsReviews(staff) ? { label: t("fin10.openReview"), href: routes.opsStatusReview(review), kind: "link" as const } : null;
}

function Page({
  data,
  staff,
  form,
  caseRef,
  attempt,
  t,
  locale,
}: {
  data: Corrections | null;
  staff: Staff;
  form: OpenForm;
  /** The case a link from the case's remedy linkage names, filled in on the refund form. */
  caseRef: string | null;
  attempt: CorrectionAttempt | null;
  t: Translate;
  locale: Locale;
}) {
  const selected = data?.selected ?? null;
  const officer = holds(staff, "ACT-FIN-OP");
  // The exception stands above the list for every review past its period, whichever correction is opened.
  const overdue = (data?.rows ?? []).filter((row) => (row.review?.overdueSince ?? null) !== null);
  // Send is the row's own act while an approved refund waits for it, as the board draws the return to send.
  const sending = officer && (data?.rows ?? []).some(toSend);
  return (
    <>
      {attempt !== null && attempt.act === "correction" ? <ActRefusal code={attempt.code} t={t} locale={locale} /> : null}
      {overdue.map((row) => {
        const action = row.review !== null ? openReview(row.review.reference, staff, t) : null;
        return row.review !== null ? (
          <Banner key={row.reference} family="attention" title={t("fin10.ovTitle")} {...(action !== null ? { action } : {})} density="console" locale={locale}>
            {t("fin10.ovText", { approver: row.review.approver, review: row.review.reference ?? row.reference })}
          </Banner>
        ) : null;
      })}
      <Panel compact density="console" locale={locale}>
        <Table
          columns={[
            { key: "id", label: t("fin10.cRef"), kind: "id" },
            { key: "ev", label: t("fin10.cEvent"), kind: "stack", minWidth: "var(--space-80)" },
            { key: "amt", label: t("fin10.cAmount"), kind: "money", align: "end", unit: "VND" },
            { key: "st", label: t("fin10.cState"), kind: "status", minWidth: "var(--space-48)" },
            ...(sending ? [{ key: "act", kind: "actions" as const }] : []),
          ]}
          rows={(data?.rows ?? []).map((row) => correctionRow(row, row.reference === selected?.reference, sending, t, locale))}
          density="console"
          rowFocus
          loading={data === null ? 2 : false}
          {...(data !== null ? { sortNote: t("fin10.sortNote") } : {})}
          empty={{ variant: "not-started", title: t("fin10.emptyTitle") }}
          caption={t("fin10.caption")}
          locale={locale}
        />
        <ButtonRow align="end">
          <Button variant="secondary" size="sm" icon="refresh-cw" href={routes.opsCorrections(selected?.reference ?? null)} locale={locale}>
            {t("fin.reload")}
          </Button>
        </ButtonRow>
      </Panel>
      {form === "chargeback" && data !== null ? <ChargebackForm data={data} attempt={attempt} t={t} locale={locale} /> : null}
      {form === "refund" && data !== null ? <RefundForm data={data} caseRef={caseRef} attempt={attempt} t={t} locale={locale} /> : null}
      {data === null ? (
        <Panel title={t("fin10.loadingTitle")} level={2} density="console" locale={locale}>
          <Skeleton variant="facts" rows={8} density="console" locale={locale} />
        </Panel>
      ) : selected !== null ? (
        <Detail correction={selected} staff={staff} confirmSend={form === "send"} attempt={attempt} t={t} locale={locale} />
      ) : null}
    </>
  );
}

/** A refund's own step while the correction is raised: waiting for the approver, declined, or approved and waiting to be sent. */
function refundState(row: CorrectionRow, t: Translate, locale: Locale): StatusValue | null {
  const refund = row.refund;
  if (refund === null || row.state !== "RAISED") return null;
  if (refund.approval === null) return { family: "attention", label: t("fin10.state.RAISED"), detail: t("fin10.dWaitApprover") };
  if (refund.approval.decision === "declined") return { family: "neutral", label: t("fin10.sDeclined"), detail: t("fin10.dDeclined", { name: refund.approval.by, at: moment(refund.approval.at, locale) }) };
  return { family: "neutral", label: t("fin10.sDisposed"), detail: t("fin10.dRefund") };
}

function stateOf(row: CorrectionRow, t: Translate, locale: Locale): StatusValue {
  const step = refundState(row, t, locale);
  if (step !== null) return step;
  const review = row.review;
  const detail =
    row.state === "CLOSED" && row.closedOn !== null
      ? t("fin10.dClosed", { d: day(row.closedOn, locale) })
      : review === null
        ? undefined
        : review.reference !== null
          ? review.overdueSince !== null
            ? t("fin10.dReviewOver", { ref: review.reference, d: day(review.overdueSince, locale) })
            : t("fin10.dReview", { ref: review.reference, d: day(review.dueBy, locale) })
          : review.overdueSince !== null
            ? t("fin10.dDueOver", { d: day(review.overdueSince, locale) })
            : t("fin10.dDue", { d: day(review.dueBy, locale) });
  return { family: STATE_FAMILY[row.state], label: t(`fin10.state.${row.state}`), ...(detail !== undefined ? { detail } : {}) };
}

function correctionRow(row: CorrectionRow, selected: boolean, sending: boolean, t: Translate, locale: Locale): Record<string, unknown> {
  return {
    _key: row.reference,
    _href: routes.opsCorrections(row.reference),
    ...(selected ? { _selected: true } : {}),
    id: row.reference,
    ev: {
      text: t(`fin10.event.${row.kind}`, { payment: row.payment, case: row.case ?? "" }),
      detail: row.raised !== null ? t("fin10.raisedLine", { premises: premisesLine(row.premises), name: row.raised.by, at: moment(row.raised.at, locale) }) : premisesLine(row.premises),
    },
    amt: { amountMinor: row.amountMinor, currency: "VND" },
    st: stateOf(row, t, locale),
    ...(sending
      ? {
          act: toSend(row)
            ? [{ label: t("fin10.send"), ariaLabel: t("fin10.sendAria", { ref: row.reference }), variant: "quiet", href: routes.opsCorrections(row.reference, "send") }]
            : [],
        }
      : {}),
  };
}

/** The chargeback form, as the board draws it under the list: the payment named, the acquirer's notice, the amount. */
function ChargebackForm({ data, attempt, t, locale }: { data: Corrections; attempt: CorrectionAttempt | null; t: Translate; locale: Locale }) {
  const refused = attempt?.act === "chargeback" ? attempt : null;
  const sent = refused?.form ?? null;
  const fieldError = (name: "payment" | "evidence" | "amount"): string | null => {
    if (refused === null || refused.field !== name) return null;
    if (refused.code === "FIN_EVIDENCE_OUT_OF_SCOPE") return t("fin10.fcErr");
    if (name === "evidence") return t("fin10.fcEvidenceMissing");
    if (name === "amount") return t("fin10.fcAmountInvalid");
    return t("fin10.fcPaymentMissing");
  };
  const options = data.payments.map((payment) => ({
    value: payment.reference,
    label: t("fin10.payOption", { payment: payment.reference, premises: premisesLine(payment.premises) }),
    detail: t(payment.method === "card" ? "fin10.payCard" : "fin10.payTransfer", { m: money(payment.amountMinor, locale), d: day(payment.paidOn, locale) }),
  }));
  const chosen = data.payments.find((payment) => payment.reference === sent?.payment) ?? null;
  const errors = { payment: fieldError("payment"), evidence: fieldError("evidence"), amount: fieldError("amount") };
  return (
    <form action={recordChargebackAct}>
      <Panel gap="xl" density="console" locale={locale}>
        <Panel variant="plain" level={2} title={t("fin10.fcTitle")} compact density="console" locale={locale}>
          {refused !== null && refused.field === null ? <ActRefusal code={refused.code} t={t} locale={locale} /> : null}
          <Combobox
            wrap
            label={t("fin10.fcPayment")}
            helper={t("fin10.fcPaymentHelp")}
            name="payment_id"
            options={options}
            {...(chosen !== null ? { value: chosen.reference } : {})}
            selectedDetail
            required
            {...(errors.payment !== null ? { error: errors.payment } : {})}
            density="console"
            width="var(--container-md)"
            locale={locale}
          />
          <TextField
            label={t("fin10.fcEvidence")}
            helper={t("fin10.fcEvidenceHelp")}
            name="evidence_ref"
            {...(sent !== null ? { value: sent.evidence } : {})}
            {...(errors.evidence !== null ? { error: errors.evidence } : {})}
            mono
            required
            width="var(--container-md)"
            density="console"
            locale={locale}
          />
          <MoneyField
            label={t("fin10.fcAmount")}
            name="amount"
            amountMinor={sent?.amountMinor ?? chosen?.amountMinor ?? null}
            required
            {...(errors.amount !== null ? { error: errors.amount } : {})}
            density="console"
            width="var(--space-64)"
            locale={locale}
          />
        </Panel>
        <Divider />
        <ButtonRow>
          <Button variant="primary" size="sm" type="submit" locale={locale}>
            {t("fin10.fcSubmit")}
          </Button>
          <Button variant="secondary" size="sm" href={routes.opsCorrections(data.selected?.reference ?? null)} locale={locale}>
            {t("fin10.fcCancel")}
          </Button>
        </ButtonRow>
      </Panel>
    </form>
  );
}

const datetimeOrDate = (value: string) => (value.length > 10 ? ("datetime" as const) : ("date" as const));

/** A moment the canvas gives with its time, or a day it gives without one, in a sentence. */
const momentOrDay = (value: string, locale: Locale) => (value.length > 10 ? moment(value, locale) : day(value, locale));

/** The words beside a field of the refund form for the refusal it fell on. */
function refundFieldError(refused: CorrectionAttempt, name: "payment" | "case" | "amount", caseRef: string, t: Translate): string | null {
  if (refused.field !== name) return null;
  if (name === "payment") return t(refused.code === "SRS_PAYLOAD_INVALID" ? "fin10.frPaymentMissing" : "fin10.frPaymentNotRefundable");
  if (name === "amount") return t("fin10.frAmountInvalid");
  if (refused.code === "SRS_PAYLOAD_INVALID") return t("fin10.frCaseMissing");
  return t(`fin10.refusal.${refused.code}`, { case: caseRef.trim().toUpperCase(), ref: refused.subject ?? "" });
}

/**
 * Record a correction that refunds a payment under the case that decided it: the payment, the case, the amount. A
 * link from the case's remedy linkage fills the case in. A refusal is said under the field it belongs to, the form as
 * it was sent.
 */
function RefundForm({ data, caseRef, attempt, t, locale }: { data: Corrections; caseRef: string | null; attempt: CorrectionAttempt | null; t: Translate; locale: Locale }) {
  const refused = attempt?.act === "refund" ? attempt : null;
  const sent = refused?.form ?? null;
  const typedCase = sent?.case ?? caseRef ?? "";
  const options = data.payments.map((payment) => ({
    value: payment.reference,
    label: t("fin10.payOption", { payment: payment.reference, premises: premisesLine(payment.premises) }),
    detail: t(payment.method === "card" ? "fin10.payCard" : "fin10.payTransfer", { m: money(payment.amountMinor, locale), d: day(payment.paidOn, locale) }),
  }));
  const chosen = data.payments.find((payment) => payment.reference === sent?.payment) ?? null;
  const error = (name: "payment" | "case" | "amount") => (refused !== null ? refundFieldError(refused, name, typedCase, t) : null);
  const errors = { payment: error("payment"), case: error("case"), amount: error("amount") };
  return (
    <form action={recordRefundAct}>
      <Panel gap="xl" density="console" locale={locale}>
        <Panel variant="plain" level={2} title={t("fin10.recordCorrection")} description={t("fin10.frDesc")} compact density="console" locale={locale}>
          {refused !== null && refused.field === null ? <ActRefusal code={refused.code} t={t} locale={locale} /> : null}
          <Combobox
            wrap
            label={t("fin10.frPayment")}
            helper={t("fin10.frPaymentHelp")}
            name="payment_id"
            options={options}
            {...(chosen !== null ? { value: chosen.reference } : {})}
            selectedDetail
            required
            {...(errors.payment !== null ? { error: errors.payment } : {})}
            density="console"
            width="var(--container-md)"
            locale={locale}
          />
          <TextField
            label={t("fin10.frCase")}
            helper={t("fin10.frCaseHelp")}
            name="case_ref"
            value={typedCase}
            {...(errors.case !== null ? { error: errors.case } : {})}
            mono
            required
            autoComplete="off"
            width="var(--container-md)"
            density="console"
            locale={locale}
          />
          <MoneyField
            label={t("fin10.frAmount")}
            name="amount"
            amountMinor={sent?.amountMinor ?? null}
            required
            {...(errors.amount !== null ? { error: errors.amount } : {})}
            density="console"
            width="var(--space-64)"
            locale={locale}
          />
        </Panel>
        <Divider />
        <ButtonRow>
          <Button variant="primary" size="sm" type="submit" locale={locale}>
            {t("fin10.frSubmit")}
          </Button>
          <Button variant="secondary" size="sm" href={routes.opsCorrections(data.selected?.reference ?? null)} locale={locale}>
            {t("fin10.fcCancel")}
          </Button>
        </ButtonRow>
      </Panel>
    </form>
  );
}

function Detail({
  correction,
  staff,
  confirmSend,
  attempt,
  t,
  locale,
}: {
  correction: CorrectionDetail;
  staff: Staff;
  /** The list's Send opened the page on this correction's confirmation. */
  confirmSend: boolean;
  attempt: CorrectionAttempt | null;
  t: Translate;
  locale: Locale;
}) {
  const { original, chargeback, refund } = correction;
  const officer = holds(staff, "ACT-FIN-OP");
  const status = stateOf(correction, t, locale);
  // The case's remedy linkage is where the refund is linked back to the case (SCR-CAS-10); its readers open it.
  const caseFact =
    correction.case !== null
      ? [
          {
            label: t("fin10.fCase"),
            value: correction.case,
            kind: "id" as const,
            note: t("fin10.nCase"),
            ...(holds(staff, "ACT-CAS", "ACT-FIN-OP") ? { action: { label: t("fin10.openRemedy"), href: routes.opsCaseRemedy(correction.case) } } : {}),
          },
        ]
      : [];
  // A second payment names the payment that had already paid the fee it pays again.
  const duplicates = correction.duplicates;
  const duplicatesFact =
    duplicates !== null
      ? [
          {
            label: t("fin10.fDuplicates"),
            value: duplicates.payment,
            kind: "id" as const,
            note: duplicates.reconciledAt !== null ? t("fin10.nDuplicates", { d: day(duplicates.reconciledAt, locale) }) : t("fin10.nDuplicatesPaid"),
          },
        ]
      : [];
  return (
    <Panel
      title={t(`fin10.panelTitle.${correction.kind}`, { ref: correction.reference, payment: correction.payment, case: correction.case ?? "" })}
      status={{ family: status.family, label: status.label }}
      level={2}
      gap="xl"
      density="console"
      locale={locale}
    >
      <Panel variant="plain" level={3} title={t("fin10.sOriginal")} compact density="console" locale={locale}>
        <FactList
          columns={2}
          density="console"
          locale={locale}
          items={[
            { label: t("fin10.fPayment"), value: correction.payment, kind: "id", note: t(`fin10.nPayment.${original.method}`, { decision: correction.decision }) },
            { label: t("fin10.fPremises"), value: premisesLine(correction.premises) },
            { label: t("fin10.fAmount"), value: { amountMinor: original.amountMinor, currency: "VND" }, kind: "money" },
            { label: t("fin10.fPaid"), value: original.paidAt, kind: datetimeOrDate(original.paidAt) },
            ...(original.reconciledAt !== null
              ? [
                  {
                    label: t("fin10.fReconciled"),
                    value: original.reconciledAt,
                    kind: datetimeOrDate(original.reconciledAt),
                    ...(original.settlementConfirmation !== null ? { note: t("fin10.nReconciled", { ref: original.settlementConfirmation }) } : {}),
                  },
                ]
              : []),
            ...(original.invoice !== null
              ? [
                  {
                    label: t("fin10.fInvoice"),
                    value: original.invoice.number,
                    kind: "id" as const,
                    note:
                      original.invoice.correctedBy !== null
                        ? t("fin10.nInvoice", { ts: momentOrDay(original.invoice.issuedAt, locale), corrective: original.invoice.correctedBy })
                        : t("fin10.nInvoiceIssued", { ts: momentOrDay(original.invoice.issuedAt, locale) }),
                  },
                ]
              : []),
            ...(chargeback !== null ? [{ label: t("fin10.fPayState"), value: { family: "danger", label: t("fin10.pDisputed") }, kind: "status" as const }] : []),
            ...caseFact,
            ...duplicatesFact,
          ]}
        />
      </Panel>
      {chargeback !== null ? (
        <>
          <Divider />
          <Panel variant="plain" level={3} title={t("fin10.sChargeback")} compact density="console" locale={locale}>
            <FactList
              columns={2}
              density="console"
              locale={locale}
              items={[
                { label: t("fin10.fCharge"), value: { amountMinor: chargeback.amountMinor, currency: "VND" }, kind: "money", note: t(chargeback.whole ? "fin10.nCharge" : "fin10.nChargePart") },
                { label: t("fin10.fRecorded"), value: chargeback.recordedAt, kind: "datetime", note: t("fin10.nRecorded", { name: chargeback.recordedBy, notice: chargeback.notice }) },
                ...(correction.raised !== null ? [{ label: t("fin10.fRaised"), value: correction.raised.at, kind: "datetime" as const, note: correction.raised.by }] : []),
                ...(correction.consequencesSet !== null
                  ? [{ label: t("fin10.fSet"), value: correction.consequencesSet.at, kind: "datetime" as const, note: correction.consequencesSet.by }]
                  : []),
              ]}
            />
          </Panel>
          <Divider />
          <Consequences correction={correction} t={t} locale={locale} />
          <Components correction={correction} t={t} locale={locale} />
        </>
      ) : null}
      {refund !== null ? (
        <>
          <Divider />
          <Refund correction={correction} staff={staff} t={t} locale={locale} />
          <Divider />
          <Consequences correction={correction} t={t} locale={locale} />
        </>
      ) : null}
      {correction.review !== null ? (
        <>
          <Divider />
          <Review correction={correction} staff={staff} t={t} locale={locale} />
        </>
      ) : null}
      {refund !== null && refund.approval === null && correction.approvalReader !== "reader" ? (
        <>
          <Divider />
          <RefundApproval correction={correction} attempt={attempt} t={t} locale={locale} />
        </>
      ) : null}
      {officer && refund !== null && refund.approval?.decision === "approved" && refund.sent === null ? (
        <>
          <Divider />
          {attempt !== null && attempt.act === "send" ? <ActRefusal code={attempt.code} t={t} locale={locale} /> : null}
          <ConfirmSend
            action={sendRefundAct}
            correction={correction.reference}
            initiallyOpen={confirmSend}
            copy={{
              button: t("fin10.rdYes"),
              title: t("fin10.rdTitle", { ref: correction.reference }),
              text: t(original.method === "card" ? "fin10.rdTextCard" : "fin10.rdText", { m: money(refund.amountMinor, locale), d: day(original.paidAt, locale) }),
              yes: t("fin10.rdYes"),
              no: t("fin10.fcCancel"),
            }}
            facts={[
              { label: t("fin10.fAmount"), value: money(refund.amountMinor, locale) },
              { label: t("fin10.fTo"), value: t("fin10.vTo") },
              { label: t("fin10.fPayment"), value: correction.payment },
              { label: t("fin10.fApproved"), value: t("fin10.vPerson", { name: refund.approval.by, role: t("fin.approverRole"), st: moment(refund.approval.at, locale) }) },
              {
                label: t("fin10.fProposedBy"),
                value:
                  refund.preparer === "system"
                    ? t("fin10.vSystem", { name: refund.preparedBy, st: moment(refund.preparedAt, locale) })
                    : t("fin10.vPerson", { name: refund.preparedBy, role: t("fin.officer"), st: moment(refund.preparedAt, locale) }),
              },
            ]}
            locale={locale}
          />
        </>
      ) : null}
      {officer && correction.state !== "CLOSED" ? (
        <>
          <Divider />
          {attempt !== null && attempt.act === "close" ? <ActRefusal code={attempt.code} t={t} locale={locale} /> : null}
          <form action={closeCorrectionAct}>
            <input type="hidden" name="correction" value={correction.reference} />
            <Button variant="secondary" size="sm" type="submit" {...closeState(correction, t)} locale={locale}>
              {t("fin10.close")}
            </Button>
          </form>
        </>
      ) : null}
    </Panel>
  );
}

/**
 * The refund a correction makes: the amount, where it goes, who proposed and who approved it, when it was sent; and the
 * calculation the correction linked, which TAR's console opens for its readers.
 */
function Refund({ correction, staff, t, locale }: { correction: CorrectionDetail; staff: Staff; t: Translate; locale: Locale }) {
  const { refund, recalculation } = correction;
  if (refund === null) return null;
  const approval = refund.approval;
  return (
    <Panel variant="plain" level={3} title={t("fin10.sRefund")} compact density="console" locale={locale}>
      <FactList
        columns={2}
        density="console"
        locale={locale}
        items={[
          {
            label: t("fin10.fRefund"),
            value: { amountMinor: refund.amountMinor, currency: "VND" },
            kind: "money",
            note: t(refund.amountMinor === correction.original.amountMinor ? "fin10.nCharge" : "fin10.nChargePart"),
          },
          { label: t("fin10.fTo"), value: t("fin10.vTo") },
          {
            label: t("fin10.fProposedBy"),
            value: refund.preparedBy,
            note:
              refund.preparer === "system"
                ? t("fin10.nSystem", { st: moment(refund.preparedAt, locale) })
                : t("fin10.nRole", { role: t("fin.officer"), st: moment(refund.preparedAt, locale) }),
          },
          approval === null
            ? { label: t("fin10.fApproved"), value: { family: "attention", label: t("fin10.dWaitApprover") }, kind: "status" as const }
            : {
                label: t("fin10.fApproved"),
                value: approval.by,
                note:
                  approval.decision === "approved"
                    ? t("fin10.nRole", { role: t("fin.approverRole"), st: moment(approval.at, locale) })
                    : t("fin10.nDeclined", { st: moment(approval.at, locale), reason: approval.comment }),
              },
          ...(refund.sent !== null ? [{ label: t("fin10.fSent"), value: refund.sent.at, kind: "datetime" as const, note: refund.sent.by }] : []),
          ...(correction.held !== null
            ? [
                {
                  label: t("fin10.fHeld"),
                  value: correction.held.reference,
                  kind: "id" as const,
                  note: t(correction.groundsReserved ? "fin10.nHeldReserved" : `fin10.nHeld.${correction.held.state}`),
                  ...(holds(staff, "ACT-FIN-OP", "ACT-FIN-APR", "ACT-AUD") ? { action: { label: t("fin10.openSuspense"), href: routes.opsSuspense() } } : {}),
                },
              ]
            : []),
          ...(recalculation !== null
            ? [
                {
                  label: t("fin10.fRecalc"),
                  value: recalculation.reference,
                  kind: "id" as const,
                  note: t("fin10.nRecalc", { before: money(recalculation.feeBeforeMinor, locale), after: money(recalculation.feeAfterMinor, locale) }),
                  ...(holds(staff, "ACT-OPS", "ACT-FIN-OP", "ACT-AUD") ? { action: { label: t("fin10.openRecalc"), href: routes.opsCalculation(recalculation.reference) } } : {}),
                },
              ]
            : []),
        ]}
      />
    </Panel>
  );
}

/**
 * Approve the refund or Decline it, for the finance approver who did not prepare it; the one who prepared it reads
 * the segregation line instead, with its code, and any other reader the facts above.
 */
function RefundApproval({ correction, attempt, t, locale }: { correction: CorrectionDetail; attempt: CorrectionAttempt | null; t: Translate; locale: Locale }) {
  const refund = correction.refund;
  if (refund === null) return null;
  const refused = attempt !== null && attempt.act === "approval" ? attempt : null;
  if (correction.approvalReader === "same-actor") {
    return (
      <Banner family="attention" title={t("fin15.sodTitle")} code="SOD_PREPARER_IS_APPROVER" density="console" locale={locale}>
        {t("fin15.sodText")}
      </Banner>
    );
  }
  if (correction.approvalReader !== "approver") return null;
  return (
    <>
      {correction.groundsReserved && refused?.code !== "FIN_GROUNDS_RESERVED" ? (
        <Banner family="neutral" title={t("fin10.grTitle")} code="FIN_GROUNDS_RESERVED" density="console" locale={locale}>
          {t("fin10.grText")}
        </Banner>
      ) : null}
      {refused !== null && refused.field === null ? <ActRefusal code={refused.code} t={t} locale={locale} /> : null}
      <ApproverDecision
        action={decideRefundAct}
        subject={{ name: "correction", value: correction.reference }}
        copy={{
          reason: t("fin15.reason"),
          reasonHelp: t("fin15.reasonHelp"),
          approve: t("fin10.approve"),
          decline: t("fin15.decline"),
          dialogTitle: t("fin10.adTitle", { m: money(refund.amountMinor, locale), ref: correction.reference }),
          dialogText: t("fin10.adText"),
          dialogYes: t("fin10.approve"),
          dialogNo: t("fin15.dlgNo"),
        }}
        facts={[
          // A refund names the case that ordered it; the return of a second payment, the payment that paid the fee first.
          ...(correction.case !== null ? [{ label: t("fin10.fCase"), value: correction.case }] : []),
          ...(correction.duplicates !== null ? [{ label: t("fin10.fDuplicates"), value: correction.duplicates.payment }] : []),
          { label: t("fin10.fProposedBy"), value: refund.preparedBy },
        ]}
        initialReason={refused?.reason ?? ""}
        reasonError={refused !== null && refused.field === "reason" ? t("fin15.eReason") : null}
        approveUnavailable={correction.groundsReserved ? t("fin10.grWhy") : null}
        locale={locale}
      />
    </>
  );
}

/** Close the correction is offered once every consequence agrees; while a review runs it says why it waits (DR-368). */
function closeState(correction: CorrectionDetail, t: Translate): { disabled?: boolean; disabledReason?: string } {
  if (correction.state === "AGREED") return {};
  if (correction.state === "OWNING_REVIEW_OPEN")
    return { disabled: true, disabledReason: t((correction.review?.overdueSince ?? null) !== null ? "fin10.closeWhyOver" : "fin10.closeWhyOpen") };
  return { disabled: true, disabledReason: t("fin10.closeWhyRaised") };
}

function Consequences({ correction, t, locale }: { correction: CorrectionDetail; t: Translate; locale: Locale }) {
  const { invoice, settlement, record } = correction.consequences;
  const agreed: StatusValue = { family: "positive", label: t("fin10.sAgreed") };
  const notDecided: StatusValue = { family: "neutral", label: t("fin10.notDecided") };
  const waiting: StatusValue = { family: "attention", label: t("fin10.state.OWNING_REVIEW_OPEN") };
  const recordRow = (() => {
    if (record === null) return { what: { text: t("fin10.notDecided") }, st: notDecided };
    if (record.record === null) return { what: { text: t("fin10.cRecNone") }, st: agreed };
    if (record.agreed && record.review === null) {
      // A second payment's return leaves the fee paid once, in full; a refund leaves the fee less the refund paid.
      return { what: { text: t(correction.kind === "duplicate" ? "fin10.cRecStandsDup" : "fin10.cRecStands", { record: record.record }) }, st: agreed };
    }
    const opened =
      record.review !== null && record.openedAt !== null
        ? {
            text: t("fin10.cRec", { review: record.review, record: record.record }),
            ...(record.proposedAt !== null ? { detail: t("fin10.cRecD", { st1: moment(record.openedAt, locale), st2: moment(record.proposedAt, locale) }) } : {}),
          }
        : { text: t("fin10.cRecWaiting", { record: record.record }) };
    return { what: opened, st: record.agreed ? agreed : waiting };
  })();
  return (
    <Panel variant="plain" level={3} title={t("fin10.sConsequences")} compact density="console" locale={locale}>
      <Table
        columns={[
          { key: "area", label: t("fin10.cArea"), kind: "strong", minWidth: "var(--space-32)" },
          { key: "what", label: t("fin10.cDetermined"), kind: "stack" },
          { key: "st", label: t("fin10.cAgrees"), kind: "status", minWidth: "var(--space-48)" },
        ]}
        rows={[
          {
            _key: "invoice",
            area: t("fin10.aInvoice"),
            what:
              invoice === null
                ? { text: t("fin10.notDecided") }
                : invoice.corrective !== null
                  ? {
                      text: t("fin10.cInv", { corrective: invoice.corrective }),
                      detail: t("fin10.cInvD", { name: invoice.producedBy, at: moment(invoice.producedAt, locale), original: invoice.original }),
                    }
                  : // Nothing was invoiced for this money: no corrective document, and the fee's own invoice stands.
                    { text: invoice.stands !== null ? t("fin10.cInvStands", { original: invoice.stands }) : t("fin10.cInvNone") },
            st: invoice !== null ? agreed : notDecided,
          },
          {
            _key: "settlement",
            area: t("fin10.aSettlement"),
            what:
              settlement !== null
                ? {
                    text: t("fin10.cSet", { m: money(settlement.debitMinor, locale) }),
                    ...(settlement.recovery !== null
                      ? { detail: t("fin10.cSetD", { r: money(settlement.recovery.amountMinor, locale), recipients: settlement.recovery.recipients.join(t("fin10.and")) }) }
                      : {}),
                  }
                : { text: t("fin10.notDecided") },
            st: settlement !== null ? agreed : notDecided,
          },
          { _key: "record", area: t("fin10.aRecord"), ...recordRow },
        ]}
        density="console"
        caption={t("fin10.sConsequences")}
        locale={locale}
      />
    </Panel>
  );
}

function Components({ correction, t, locale }: { correction: CorrectionDetail; t: Translate; locale: Locale }) {
  const fee = correction.components.reduce((sum, component) => sum + component.amountMinor, 0);
  return (
    <Panel
      variant="plain"
      level={3}
      title={t("fin10.sComponents")}
      description={t("fin10.sComponentsDesc", { m: money(fee, locale) })}
      compact
      density="console"
      locale={locale}
    >
      <Table
        columns={[
          { key: "comp", label: t("fin10.cComp"), minWidth: "var(--space-48)" },
          { key: "rcp", label: t("fin10.cRecipient") },
          { key: "amt", label: t("fin10.cAmount"), kind: "money", align: "end", unit: "VND" },
          { key: "rmt", label: t("fin10.cRemit"), kind: "stack" },
          { key: "now", label: t("fin10.cNow"), kind: "status", minWidth: "var(--space-56)" },
        ]}
        rows={correction.components.map((component) => {
          const remittance = component.remittance;
          return {
            _key: component.layer,
            comp: t(`fin.layer.${component.layer}`),
            rcp: component.recipient,
            amt: { amountMinor: component.amountMinor, currency: "VND" },
            rmt:
              remittance === null
                ? { text: t("fin10.rmNone"), muted: true }
                : {
                    text: remittance.reference,
                    mono: true,
                    detail:
                      remittance.state === "confirmed" && remittance.on !== null
                        ? t("fin10.rmConfirmed", { d: day(remittance.on, locale) })
                        : t("fin10.rmSuspended", { recipient: component.recipient }),
                  },
            now:
              component.recovery === "held"
                ? { family: "attention", label: t("fin10.sHeld"), detail: t("fin10.nowHeld", { recipient: component.recipient }) }
                : { family: "neutral", label: t("fin10.notDecided"), detail: t("fin10.nowKept") },
          };
        })}
        density="console"
        caption={t("fin10.sComponents")}
        locale={locale}
      />
    </Panel>
  );
}

/** The review the correction waits for, with Open the review, which opens SCR-CER-06 once the owning service opened one. */
function Review({ correction, staff, t, locale }: { correction: CorrectionDetail; staff: Staff; t: Translate; locale: Locale }) {
  const review = correction.review;
  if (review === null) return null;
  const overdue = review.overdueSince;
  const action = openReview(review.reference, staff, t);
  return (
    <Panel variant="plain" level={3} title={t("fin10.sReview")} {...(action !== null ? { action } : {})} compact density="console" locale={locale}>
      <FactList
        columns={2}
        density="console"
        locale={locale}
        items={[
          review.reference !== null
            ? { label: t("fin10.fReview"), value: review.reference, kind: "id", note: t("fin10.nReview", { record: review.record }) }
            : { label: t("fin10.fReview"), value: t("fin10.noReviewYet"), note: t("fin10.nReview", { record: review.record }) },
          { label: t("fin10.fOwner"), value: t("fin10.vOwner") },
          {
            label: t("fin10.fDue"),
            value: t("fin10.vDue", { d: day(review.dueBy, locale), n: review.workingDays }),
            note: overdue !== null ? t("fin10.nDueOver", { d: day(overdue, locale) }) : t("fin10.nDue"),
          },
          ...(review.proposedAt !== null
            ? [{ label: t("fin10.fProposal"), value: t("fin10.vProposal"), note: t("fin10.nProposal", { st: moment(review.proposedAt, locale), approver: review.approver }) }]
            : []),
          ...(correction.exception !== null
            ? [
                {
                  label: t("fin10.fException"),
                  value: correction.exception.raisedAt,
                  kind: "datetime" as const,
                  note: t("fin10.nExceptionEvent", { record: correction.exception.record, event: correction.exception.event, payment: correction.payment }),
                },
              ]
            : []),
        ]}
      />
    </Panel>
  );
}
