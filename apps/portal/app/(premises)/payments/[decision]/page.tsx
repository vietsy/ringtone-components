import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Button, ButtonRow, FactList, Link, PageHeader, Panel, Skeleton, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { loadPaymentPosition, type InvoiceNumber, type PaymentCheck, type PaymentPosition } from "@/lib/api/finance";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { FIN02_VIEWS } from "@/lib/mock/finance";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";
import en from "@/messages/screens/fin.en.json";
import vi from "@/messages/screens/fin.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;
type Facts = Parameters<typeof FactList>[0]["items"];
type Failure = { code: string; traceId: string | null; retryable: boolean };
type Family = "positive" | "attention" | "danger" | "neutral" | "info";

/**
 * SCR-FIN-02 Payment position. The payer reads where the payment of a decision stands: what RightOne has
 * verified (money received, reconciled, invoiced) and what it is still waiting for, with the way on. Check
 * again reads it afresh, which is how a payer waiting for a transfer sees it arrive.
 */
export default async function PaymentPositionPage({
  params,
  searchParams,
}: {
  params: Promise<{ decision: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const principal = await requirePrincipal();
  const [{ decision }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, FIN02_VIEWS);
  const outcome = view === "loading" ? null : await loadPaymentPosition(principal.sessionId, decision, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";

  // A transfer that matches no record belongs to no premises yet, and a refused reader stays in her party.
  const context =
    data !== null && data.premises !== null
      ? { premises: data.premises, period: data.subject.reference, label: t("fin02.premisesLabel") }
      : { premises: data?.party ?? principal.party, label: t("fin02.partyLabel") };

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("payments", frame, locale)}
      account={principal.account}
      context={context}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("fin02.crumb"), href: routes.payments() }]}
          title={data !== null ? title(data, t, locale) : t("fin02.titleGeneric")}
          {...(data !== null ? { status: status(data, t), meta: t("fin02.asOf", { time: R1_FORMAT.formatTimestamp(data.asOf, locale) ?? "" }) } : {})}
          locale={locale}
        >
          {data !== null && (
            <Button variant="secondary" size="md" icon="refresh-cw" href={routes.paymentPosition(decision)} locale={locale}>
              {t("fin02.check")}
            </Button>
          )}
        </PageHeader>
        {view === "loading" ? (
          <Loading frame={frame} t={t} locale={locale} />
        ) : failure !== null || data === null ? (
          <Failed failure={failure} phone={phone} t={t} locale={locale} />
        ) : (
          <Content data={data} decision={decision} frame={frame} t={t} locale={locale} />
        )}
      </div>
    </PortalShell>
  );
}

function Failed({ failure, phone, t, locale }: { failure: Failure | null; phone: boolean; t: Translate; locale: Locale }) {
  if (failure?.code === "SRS_RESOURCE_NOT_ACCESSIBLE") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
        <ViewState
          level={2}
          view="refused"
          refusal={{ code: failure.code, title: t("fin02.nfTitle"), text: t("fin02.nfText"), family: "attention" }}
          density="portal"
          locale={locale}
        />
        <div>
          <Button variant="secondary" size="md" icon="arrow-left" href={routes.payments()} fullWidth={phone} locale={locale}>
            {t("fin02.back")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <ViewState
      level={2}
      view="error"
      errorTitle={t("fin02.errTitle")}
      errorText={t("fin02.errText")}
      {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure?.retryable ?? true}
      density="portal"
      locale={locale}
    />
  );
}

function grid(frame: Frame) {
  const narrow = frame !== "desktop";
  return {
    display: "grid",
    gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "minmax(0, 1fr) var(--container-sm)",
    gridTemplateAreas: narrow ? "'verify' 'facts'" : "'verify facts'",
    gap: frame === "phone" ? "var(--space-4)" : "var(--space-6)",
    alignItems: "start",
  } as const;
}

function Loading({ frame, t, locale }: { frame: Frame; t: Translate; locale: Locale }) {
  const inset = frame === "phone" ? "sm" : "md";
  return (
    <div style={grid(frame)}>
      <div style={{ gridArea: "verify", minWidth: 0 }}>
        <Panel title={t("fin02.verifyTitle")} inset={inset} density="portal" locale={locale}>
          <Skeleton variant="facts" rows={4} density="portal" locale={locale} />
        </Panel>
      </div>
      <div style={{ gridArea: "facts", minWidth: 0 }}>
        <Panel as="aside" title={t("fin02.factsPay")} inset={inset} density="portal" locale={locale}>
          <Skeleton variant="facts" rows={5} density="portal" locale={locale} />
        </Panel>
      </div>
    </div>
  );
}

function Content({
  data,
  decision,
  frame,
  t,
  locale,
}: {
  data: PaymentPosition;
  decision: string;
  frame: Frame;
  t: Translate;
  locale: Locale;
}) {
  const phone = frame === "phone";
  const inset = phone ? "sm" : "md";
  return (
    <>
      <Notice data={data} decision={decision} phone={phone} t={t} locale={locale} />
      <div style={grid(frame)}>
        <div style={{ gridArea: "verify", minWidth: 0 }}>
          <Panel title={t("fin02.verifyTitle")} inset={inset} density="portal" locale={locale}>
            <FactList items={data.checks.map((check) => verification(check, t, locale))} density="portal" locale={locale} />
          </Panel>
        </div>
        <div style={{ gridArea: "facts", minWidth: 0 }}>
          <Panel
            as="aside"
            title={t(data.subject.kind === "transfer" ? "fin02.factsTransfer" : "fin02.factsPay")}
            inset={inset}
            density="portal"
            locale={locale}
          >
            <FactList items={facts(data, t, locale)} density="portal" locale={locale} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-2)" }}>
              {links(data, decision, t).map((link) => (
                <Link key={link.label} href={link.href} variant="standalone" size="touch" locale={locale}>
                  {link.label}
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
      <div>
        <Button variant="quiet" size="md" href={routes.payments()} fullWidth={phone} locale={locale}>
          {t("fin02.back")}
        </Button>
      </div>
    </>
  );
}

/**
 * Over the page: the chargeback that makes the fee due again, with the way to pay it and to the record it
 * put under review; or the Design Brief's payer message for a transfer held, which states a condition and
 * carries no code.
 */
function Notice({ data, decision, phone, t, locale }: { data: PaymentPosition; decision: string; phone: boolean; t: Translate; locale: Locale }) {
  const { chargeback } = data;
  if (chargeback !== null) {
    const record = data.record;
    const text = t("fin02.dsText", {
      date: R1_FORMAT.formatDate(chargeback.takenBackOn, locale) ?? "",
      payBy: R1_FORMAT.formatDate(chargeback.dueAgainBy, locale) ?? "",
    });
    // Until the payer authorises payment again there is no new instruction to open: the way on is the page where
    // they authorise it, named as that page is titled (SCR-FIN-01).
    const instruction = chargeback.instruction;
    const pay = {
      label: instruction !== null ? t("fin02.openInstr", { reference: instruction }) : t("fin01.title", { reference: decision }),
      href: routes.pay(decision),
      variant: "primary" as const,
    };
    const open = record !== null ? { label: t("fin02.openRecord"), href: routes.statusRecord(record), variant: "secondary" as const } : null;
    if (phone) {
      // A Banner's own buttons cannot take the whole width, so on a phone its two actions are a full-width
      // row in its body; the row names the instruction without its reference, which the facts carry.
      return (
        <div>
          <Banner family="attention" title={t("fin02.dsTitle")} density="portal" locale={locale}>
            {text}
            <div style={{ marginTop: "var(--space-3)" }}>
              <ButtonRow>
                <Button variant="primary" size="md" href={pay.href} fullWidth locale={locale}>
                  {t(instruction !== null ? "fin02.openInstrShort" : "fin01.titleGeneric")}
                </Button>
                {open !== null && (
                  <Button variant="secondary" size="md" href={open.href} fullWidth locale={locale}>
                    {open.label}
                  </Button>
                )}
              </ButtonRow>
            </div>
          </Banner>
        </div>
      );
    }
    return (
      <div>
        <Banner family="attention" title={t("fin02.dsTitle")} actions={open !== null ? [pay, open] : [pay]} density="portal" locale={locale}>
          {text}
        </Banner>
      </div>
    );
  }
  if (data.condition === null) return null;
  const duplicate = data.condition === "duplicate";
  return (
    <div>
      <Banner family="attention" title={t(duplicate ? "fin02.dupTitle" : "fin02.isTitle")} density="portal" locale={locale}>
        {t(duplicate ? "fin02.dupText" : "fin02.isText")}
      </Banner>
    </div>
  );
}

function title(data: PaymentPosition, t: Translate, locale: Locale): string {
  const { subject } = data;
  switch (subject.kind) {
    case "payment":
      return t("fin02.payTitle", { reference: subject.reference });
    case "instruction":
      return t("fin02.insTitle", { reference: subject.reference });
    case "transfer":
      return t("fin02.transferTitle", { date: R1_FORMAT.formatDate(subject.receivedOn, locale) ?? "" });
  }
}

/** On the portal a reconciled payment reads Paid, and a paid one not yet reconciled says so while it works. */
function status(data: PaymentPosition, t: Translate): { family: Family; label: string; working?: boolean } {
  switch (data.status) {
    case "disputed":
      return { family: "danger", label: t("fin02.disputed") };
    case "reconciled":
      return { family: "positive", label: t("fin02.paid") };
    case "failed":
      return { family: "danger", label: t("fin02.failed") };
    case "paid":
      return { family: "info", label: t("fin02.paidRec"), working: true };
    case "held":
      return { family: "attention", label: t("fin02.held") };
  }
}

/** A series and its number are one reference in a sentence: the no-break space keeps them on one line. */
function invoiceRef(invoice: InvoiceNumber): string {
  return `${invoice.series}\u00a0${invoice.number}`;
}

/** Each verified fact as a word on a plain badge, with its line. */
function verification(check: PaymentCheck, t: Translate, locale: Locale): Facts[number] {
  const badge = (family: Family, label: string) => ({ family, label, plain: true });
  const verified = badge("positive", t("fin02.verified"));
  const notYet = badge("attention", t("fin02.notYet"));
  const time = (iso: string) => R1_FORMAT.formatTime(iso) ?? "";
  const stamp = (iso: string) => R1_FORMAT.formatTimestamp(iso, locale) ?? "";
  const date = (iso: string) => R1_FORMAT.formatDate(iso, locale) ?? "";
  const fact = (label: string, value: ReturnType<typeof badge>, note: string) => ({ label: t(label), value, kind: "status" as const, note });
  switch (check.check) {
    case "received":
      return fact("fin02.fReceived", verified, t(check.method === "card" ? "fin02.byCard" : "fin02.byTransfer", { time: stamp(check.at) }));
    case "reconciled":
      return fact(
        "fin02.fReconciled",
        verified,
        check.settlementConfirmedAt !== null
          ? t("fin02.settledSameDay", { settled: time(check.settlementConfirmedAt), reconciled: time(check.at) })
          : t("fin02.sameDay", { time: time(check.at) }),
      );
    case "awaiting-settlement":
      return fact("fin02.fReconciled", notYet, t("fin02.reconcileNote"));
    case "invoice-issued":
      return fact("fin02.fInvoice", badge("positive", t("fin02.issued")), t("fin02.invIssued", { invoice: invoiceRef(check.invoice), time: time(check.at) }));
    case "invoice-corrected":
      return fact(
        "fin02.fInvoice",
        badge("neutral", t("fin02.corrected")),
        t("fin02.invCorrected", { invoice: invoiceRef(check.invoice), date: date(check.correctedOn), corrective: invoiceRef(check.corrective) }),
      );
    case "invoice-requested":
      return fact("fin02.fInvoice", badge("neutral", t("fin02.requested")), t("fin02.requestedNote", { issuer: check.issuer }));
    case "chargeback":
      return fact("fin02.fChargeback", badge("danger", t("fin02.takenBack")), t("fin02.chargebackNote", { date: date(check.at), time: time(check.at) }));
    case "new-payment-awaited":
      return fact("fin02.fNewPay", notYet, t("fin02.newPayNote", { reference: check.instruction, date: date(check.validTo) }));
    case "record-review":
      return fact("fin02.fReview", badge("attention", t("fin02.notDecided")), t("fin02.reviewNote", { record: check.record, date: date(check.dueBy) }));
    case "record-suspended":
      return fact(
        "fin02.fRecord",
        badge("danger", t("fin02.suspendedFrom", { time: time(check.from) })),
        t("fin02.recordNote", { record: check.record, time: time(check.from), decidedAt: time(check.decidedAt) }),
      );
    case "card-declined":
      return fact("fin02.fCard", badge("danger", t("fin02.declined")), t("fin02.declinedNote", { time: stamp(check.at) }));
    case "unmatched":
      return fact("fin02.fMatched", notYet, t("fin02.noMatch"));
    case "matched-as-duplicate":
      return fact("fin02.fMatchedRecord", verified, t("fin02.dupMatch", { date: date(check.on), decision: check.decision, payment: check.paidBy }));
    case "refund-proposed":
      return fact("fin02.fRefund", badge("attention", t("fin02.awaiting")), t("fin02.refundNote", { date: date(check.on) }));
  }
}

/** The payment panel: reference, amount, how it was paid (or the transfer's content), decision, invoice, and the payment it points at. */
function facts(data: PaymentPosition, t: Translate, locale: Locale): Facts {
  const items: Facts = [
    { label: t("fin02.fRef"), value: data.subject.reference, kind: "id" },
    { label: t("fin02.fAmount"), value: data.amountMinor, kind: "money" },
  ];
  if (data.method !== null) items.push({ label: t("fin02.fMethod"), value: t(data.method === "card" ? "fin02.card" : "fin02.transfer") });
  if (data.transferContent !== null) items.push({ label: t("fin02.fContent"), value: data.transferContent });
  if (data.decision !== null) items.push({ label: t("fin02.fDecision"), value: data.decision, kind: "id" });
  if (data.invoice !== null) {
    const correctedBy = data.invoice.correctedBy;
    items.push({
      label: t("fin02.fInvoiceNo"),
      value: `${data.invoice.series} ${data.invoice.number}`,
      kind: "id",
      ...(correctedBy !== null ? { note: t("fin02.invNote", { corrective: invoiceRef(correctedBy) }) } : {}),
    });
  }
  const related = data.related;
  if (related !== null) {
    const stamp = (iso: string) => R1_FORMAT.formatTimestamp(iso, locale) ?? "";
    const date = (iso: string) => R1_FORMAT.formatDate(iso, locale) ?? "";
    switch (related.relation) {
      case "earlier-attempt":
        items.push({ label: t("fin02.fEarlierAttempt"), value: related.payment, kind: "id", note: t("fin02.earlierAttemptNote", { time: stamp(related.declinedAt) }) });
        break;
      case "paid-by":
        items.push({ label: t("fin02.fPaidBy"), value: related.payment, kind: "id", note: t("fin02.paidByNote", { time: stamp(related.at) }) });
        break;
      case "replaces":
        items.push({ label: t("fin02.fReplaces"), value: related.payment, kind: "id", note: t("fin02.replacesNote", { date: date(related.takenBackOn) }) });
        break;
      case "already-paid-by":
        items.push({ label: t("fin02.fAlreadyPaid"), value: related.payment, kind: "id", note: t("fin02.alreadyPaidNote", { date: date(related.reconciledOn) }) });
        break;
    }
  }
  return items;
}

/**
 * The ways on, as the board draws them per state. A reconciled payment also opens the status record it
 * unlocks: the design has no way from a paid fee to its record (deviation awaiting the BA, see README).
 */
function links(data: PaymentPosition, decision: string, t: Translate): { label: string; href: string }[] {
  const openDecision = data.decision !== null ? [{ label: t("fin02.openDecision"), href: routes.decision(data.decision) }] : [];
  const openInvoices = { label: t("fin02.openInvoices"), href: routes.payments() };
  const openRecord = data.record !== null ? [{ label: t("fin02.openRecord"), href: routes.statusRecord(data.record) }] : [];
  switch (data.status) {
    case "reconciled":
      return [...openDecision, openInvoices, ...openRecord];
    case "failed":
      // The transfer that paid it afterwards is this decision's payment, which its position opens on.
      return [{ label: t("fin02.seePayment"), href: routes.paymentPosition(decision) }, ...openDecision];
    case "paid":
      return [...openDecision, ...openRecord];
    case "disputed":
      return [...openDecision, openInvoices];
    case "held":
      return data.decision !== null ? [...openDecision, openInvoices] : [];
  }
}
