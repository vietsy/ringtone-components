import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Breakdown, Button, Columns, FactList, Link, PageHeader, Panel, Skeleton, Table, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { loadInvoice, type IssuedInvoice, type RightsLayer, type UnissuedInvoice } from "@/lib/api/finance";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { FIN03_INVOICE_VIEWS } from "@/lib/mock/finance";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";
import en from "@/messages/screens/fin.en.json";
import vi from "@/messages/screens/fin.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;
type Facts = Parameters<typeof FactList>[0]["items"];
type Failure = { code: string; traceId: string | null; retryable: boolean };
type Header = {
  title: string;
  status?: { family: "positive" | "neutral" | "attention"; label: string };
  meta?: string;
  context: { premises: string; period?: string; label: string };
};

const LAYER_KEYS: Readonly<Record<RightsLayer, string>> = {
  authors: "fin03.authors",
  performers: "fin03.performers",
  producers: "fin03.producers",
};

/** The review states of one invoice, with the page's own loading state. */
const VIEWS = [...FIN03_INVOICE_VIEWS, "loading"] as const;

/**
 * SCR-FIN-03, one invoice: the issued invoice or corrective document its number names, with the documents of its
 * payment, the amount by component and what it records, kept within the payer's reach (Retrieve the issued invoice);
 * the original of a corrected invoice opens here as any other does, beside its corrective document (Retrieve the
 * original of a corrected invoice). Addressed by a payment's reference, the invoice of that payment, or why it is not
 * issued yet: the payment is not settled (a refusal, with its code), or the e-invoice service was down when it fell
 * due (a condition, without one).
 */
export default async function InvoicePage({ params, searchParams }: { params: Promise<{ invoice: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ invoice }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, VIEWS);
  const phone = frame === "phone";
  const party = { premises: principal.party, label: t("fin03.partyLabel") };
  const outcome = view === "loading" ? null : await loadInvoice(principal.sessionId, invoice, view);
  const read = outcome?.data ?? null;

  let header: Header;
  let body: React.ReactNode;
  if (outcome === null) {
    header = { title: t("fin03.titleGeneric"), context: party };
    body = <Loading frame={frame} t={t} locale={locale} />;
  } else if (read === null) {
    header = { title: t("fin03.titleGeneric"), context: party };
    body = <Failed failure={outcome.failure} phone={phone} t={t} locale={locale} />;
  } else if (read.kind === "issued") {
    header = issuedHeader(read.invoice, t, locale);
    body = <Issued invoice={read.invoice} frame={frame} t={t} locale={locale} />;
  } else {
    header = unissuedHeader(read.invoice, t, locale);
    body = <Unissued invoice={read.invoice} frame={frame} t={t} locale={locale} />;
  }

  return (
    <PortalShell fill layout={phone ? "phone" : "desktop"} nav={premisesNav("payments", frame, locale)} account={principal.account} context={header.context} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("fin03.crumbInv"), href: routes.payments() }]}
          title={header.title}
          {...(header.status !== undefined ? { status: header.status } : {})}
          {...(header.meta !== undefined ? { meta: header.meta } : {})}
          locale={locale}
        />
        {body}
      </div>
    </PortalShell>
  );
}

/** A series and its number are one reference; a phone card lets the pair wrap between the two (FIN F-14). */
function invoiceNo(series: string, number: string, frame: Frame): string {
  return `${series}${frame === "phone" ? " " : "\u00a0"}${number}`;
}

function Loading({ frame, t, locale }: { frame: Frame; t: Translate; locale: Locale }) {
  const inset = frame === "phone" ? "sm" : "md";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: frame === "phone" ? "var(--space-4)" : "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
      <Panel title={t("fin03.docsTitle")} inset={inset} density="portal" locale={locale}>
        <Skeleton variant="table" rows={2} columns={4} density="portal" locale={locale} />
      </Panel>
      <Panel title={t("fin03.factsTitle")} inset={inset} density="portal" locale={locale}>
        <Skeleton variant="facts" rows={6} density="portal" locale={locale} />
      </Panel>
    </div>
  );
}

function Failed({ failure, phone, t, locale }: { failure: Failure | null; phone: boolean; t: Translate; locale: Locale }) {
  if (failure?.code === "SRS_RESOURCE_NOT_ACCESSIBLE") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
        <ViewState
          level={2}
          view="refused"
          refusal={{ code: failure.code, title: t("fin03.nfOneTitle"), text: t("fin03.nfOneText"), family: "attention" }}
          density="portal"
          locale={locale}
        />
        <div>
          <Button variant="secondary" size="md" icon="arrow-left" href={routes.payments()} fullWidth={phone} locale={locale}>
            {t("fin03.back")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <ViewState
      level={2}
      view="error"
      errorTitle={t("fin03.errTitle")}
      errorText={t("fin03.errText")}
      {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure?.retryable ?? true}
      density="portal"
      locale={locale}
    />
  );
}

// ------------------------------------------------------------------ an issued invoice or corrective document

function issuedHeader(invoice: IssuedInvoice, t: Translate, locale: Locale): Header {
  const corrective = invoice.corrects !== null;
  return {
    title: t(corrective ? "fin03.oneCorrTitle" : "fin03.oneTitle", { number: `${invoice.series}\u00a0${invoice.number}` }),
    status: invoice.correction !== null ? { family: "neutral", label: t("fin03.corrected") } : { family: "positive", label: t("fin03.issued") },
    meta: t("fin03.issuedBy", { issuer: invoice.issuer, time: R1_FORMAT.formatTimestamp(invoice.issuedAt, locale) ?? "" }),
    context: { premises: invoice.premises, ...(invoice.payment !== null ? { period: invoice.payment } : {}), label: t("fin03.premisesLabel") },
  };
}

/** Why a corrective document was produced: a card chargeback on its day, a refund a case decided, or neither the canvas names. */
function correctiveDetail(correction: NonNullable<IssuedInvoice["correction"]>, t: Translate, locale: Locale): string {
  if (correction.case !== null) return t("fin03.corrDetailCase", { case: correction.case });
  if (correction.chargebackOn !== null) return t("fin03.corrDetail", { date: R1_FORMAT.formatDate(correction.chargebackOn, locale) ?? "" });
  return t("fin03.corrDetailPlain");
}

function Issued({ invoice, frame, t, locale }: { invoice: IssuedInvoice; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const narrow = frame !== "desktop";
  const tablet = frame === "tablet";
  const inset = phone ? "sm" : "md";
  const correction = invoice.correction;
  const shown = {
    _key: invoice.number,
    doc: {
      text: invoiceNo(invoice.series, invoice.number, frame),
      mono: true,
      detail: t(invoice.corrects !== null ? "fin03.corrShown" : correction !== null ? "fin03.origDetail" : "fin03.invShown"),
    },
    issued: invoice.issuedAt.slice(0, 10),
    amount: invoice.amountMinor,
    st: correction !== null ? { family: "neutral", label: t("fin03.corrected") } : { family: "positive", label: t("fin03.issued") },
  };
  // The other document of the pair opens on its own page: the corrective document from the original, and the original from it.
  const docRows: Record<string, unknown>[] = [
    shown,
    ...(correction !== null
      ? [
          {
            _key: correction.number,
            _href: routes.invoice(`${invoice.series} ${correction.number}`),
            doc: { text: invoiceNo(invoice.series, correction.number, frame), mono: true, detail: correctiveDetail(correction, t, locale) },
            issued: correction.issuedOn,
            amount: null,
            st: { family: "positive", label: t("fin03.issued") },
          },
        ]
      : []),
    ...(invoice.corrects !== null
      ? [
          {
            _key: invoice.corrects,
            _href: routes.invoice(`${invoice.series} ${invoice.corrects}`),
            doc: { text: invoiceNo(invoice.series, invoice.corrects, frame), mono: true, detail: t("fin03.origOpen") },
            issued: null,
            amount: null,
            st: { family: "neutral", label: t("fin03.corrected") },
          },
        ]
      : []),
  ];
  const facts: Facts = [
    { label: t("fin03.fNumber"), value: `${invoice.series} ${invoice.number}`, kind: "id" },
    ...(invoice.corrects !== null ? [{ label: t("fin03.fCorrects"), value: `${invoice.series} ${invoice.corrects}`, kind: "id" as const }] : []),
    { label: t("fin03.fIssuer"), value: invoice.issuer, note: t("fin03.issuerNote") },
    { label: t("fin03.fPayer"), value: invoice.payer },
    invoice.payment !== null ? { label: t("fin03.fPayment"), value: invoice.payment, kind: "id" } : { label: t("fin03.fPayment"), value: null, missing: t("fin03.notNamed") },
    invoice.decision !== null ? { label: t("fin03.fDecision"), value: invoice.decision, kind: "id" } : { label: t("fin03.fDecision"), value: null, missing: t("fin03.notNamed") },
    invoice.keptUntil !== null
      ? { label: t("fin03.fKeep"), value: invoice.keptUntil, kind: "date" }
      : { label: t("fin03.fKeep"), value: null, missing: t("fin03.keepMissing") },
  ];
  const links = [
    ...(invoice.corrects !== null ? [{ label: t("fin03.openOriginal", { number: `${invoice.series}\u00a0${invoice.corrects}` }), href: routes.invoice(`${invoice.series} ${invoice.corrects}`) }] : []),
    ...(invoice.decision !== null
      ? [
          { label: t("fin03.seePayment"), href: routes.paymentPosition(invoice.decision) },
          { label: t("fin03.openDecision"), href: routes.decision(invoice.decision) },
        ]
      : []),
  ];
  return (
    <>
      <Columns single={narrow} gap={phone ? 4 : 6}>
        {
          // Wide: the documents and the amount on the left, the invoice beside them; folded, in that order.
        }
        <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <Panel title={t("fin03.docsTitle")} inset={inset} density="portal" locale={locale}>
              <Table
                columns={[
                  { key: "doc", label: t("fin03.cDoc"), kind: "stack" },
                  { key: "issued", label: t("fin03.cIssued"), kind: "date", short: true, ...(tablet ? { priority: "low" as const } : {}) },
                  { key: "amount", label: t("fin03.cAmount"), kind: "money", unit: "VND", align: "end" },
                  { key: "st", label: t("fin03.cStatus"), kind: "status" },
                ]}
                rows={docRows}
                density="portal"
                layout={phone ? "cards" : "table"}
                expandable={tablet}
                caption={t("fin03.docsTitle")}
                locale={locale}
              />
            </Panel>
          </div>
          <div style={{ minWidth: 0 }}>
            <Panel inset={inset} density="portal" locale={locale}>
              <Breakdown
                title={t(invoice.corrects !== null ? "fin03.feeCorr" : correction !== null ? "fin03.feeOrig" : "fin03.feeInv")}
                {...(invoice.components !== null ? { description: t("fin03.feeDesc") } : {})}
                lines={[
                  ...(invoice.components ?? []).map((component) => ({
                    label: t(LAYER_KEYS[component.layer]),
                    detail: t("fin03.recipient", { recipient: component.recipient }),
                    amountMinor: component.amountMinor,
                  })),
                  { label: t("fin03.total"), kind: "total" as const, amountMinor: invoice.amountMinor },
                ]}
                currency="VND"
                locale={locale}
              />
            </Panel>
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <FactsPanel as="aside" facts={facts} links={links} inset={inset} t={t} locale={locale} />
        </div>
      </Columns>
      <Back phone={phone} t={t} locale={locale} />
    </>
  );
}

// ------------------------------------------------------------------ an invoice not issued yet

function unissuedHeader(invoice: UnissuedInvoice, t: Translate, locale: Locale): Header {
  return {
    title: t("fin03.insTitle", { reference: invoice.instruction }),
    // Once the payment is reconciled the header carries the invoice's state; before, a fact says it.
    ...(invoice.reason === "FIN_EINVOICE_UNAVAILABLE" ? { status: { family: "attention" as const, label: t("fin03.notIssued") } } : {}),
    meta: t("fin03.asOf", { time: R1_FORMAT.formatTimestamp(invoice.asOf, locale) ?? "" }),
    context: { premises: invoice.premises, period: invoice.instruction, label: t("fin03.premisesLabel") },
  };
}

function Unissued({ invoice, frame, t, locale }: { invoice: UnissuedInvoice; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const notSettled = invoice.reason === "FIN_PAYMENT_NOT_SETTLED";
  const paidAt = R1_FORMAT.formatTimestamp(invoice.payment.paidAt, locale) ?? "";
  const reconciledAt = invoice.payment.reconciledAt;
  const card = invoice.payment.method === "card";
  const position = { label: t("fin03.seePosition"), href: routes.paymentPosition(invoice.decision) };
  const facts: Facts = [
    {
      label: t("fin03.fPayment"),
      value: reconciledAt === null ? { family: "info", label: t("fin03.paidRec"), working: true } : { family: "positive", label: t("fin03.paid") },
      kind: "status",
      note:
        reconciledAt === null
          ? t(card ? "fin03.byCard" : "fin03.byTransfer", { time: paidAt })
          : t(card ? "fin03.byCardRec" : "fin03.byTransferRec", { time: paidAt, reconciled: R1_FORMAT.formatTime(reconciledAt) ?? "" }),
    },
    notSettled
      ? { label: t("fin03.fInvoice"), value: null, missing: t("fin03.invMissing") }
      : { label: t("fin03.fInvoice"), value: t("fin03.notIssued"), ...(invoice.failedAt !== null ? { note: t("fin03.failedNote", { time: R1_FORMAT.formatTimestamp(invoice.failedAt, locale) ?? "" }) } : {}) },
    { label: t("fin03.fSeries"), value: invoice.series },
    { label: t("fin03.fIssuer"), value: invoice.issuer, note: t("fin03.issuerNote") },
    { label: t("fin03.fPayer"), value: invoice.payer },
    { label: t("fin03.fDecision"), value: invoice.decision, kind: "id" },
  ];
  return (
    <>
      <div style={{ maxWidth: "var(--container-3xl)" }}>
        {notSettled ? (
          // The invoice asked for is refused while the payment is not settled: a refusal, with its code.
          <Banner family="attention" title={t("fin03.nsTitle")} code={invoice.reason} action={{ ...position, variant: "secondary" }} density="portal" locale={locale} />
        ) : (
          // The e-invoice service was down when the invoice fell due: a condition, without a code.
          <Banner family="attention" title={t("fin03.euTitle")} density="portal" locale={locale}>
            {t("fin03.euText")}
          </Banner>
        )}
      </div>
      <div style={{ maxWidth: "var(--container-3xl)" }}>
        <FactsPanel as="section" facts={facts} links={notSettled ? [] : [position]} inset={phone ? "sm" : "md"} t={t} locale={locale} />
      </div>
      <Back phone={phone} t={t} locale={locale} />
    </>
  );
}

function FactsPanel({
  as,
  facts,
  links,
  inset,
  t,
  locale,
}: {
  as: "aside" | "section";
  facts: Facts;
  links: { label: string; href: string }[];
  inset: "sm" | "md";
  t: Translate;
  locale: Locale;
}) {
  return (
    <Panel as={as} title={t("fin03.factsTitle")} inset={inset} density="portal" locale={locale}>
      <FactList items={facts} density="portal" locale={locale} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-2)" }}>
        {links.map((link) => (
          <Link key={link.label} href={link.href} variant="standalone" size="touch" locale={locale}>
            {link.label}
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function Back({ phone, t, locale }: { phone: boolean; t: Translate; locale: Locale }) {
  return (
    <div>
      <Button variant="quiet" size="md" href={routes.payments()} fullWidth={phone} locale={locale}>
        {t("fin03.back")}
      </Button>
    </div>
  );
}
