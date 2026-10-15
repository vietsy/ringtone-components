import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Breakdown, Button, EmptyState, FactList, Link, PageHeader, Panel, Table, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import {
  loadInvoice,
  loadInvoiceList,
  type InvoiceList,
  type IssuedInvoice,
  type RightsLayer,
  type UnissuedInvoice,
} from "@/lib/api/finance";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { FIN03_INVOICE_VIEWS, FIN03_VIEWS, type Fin03InvoiceView } from "@/lib/mock/finance";
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
  crumbs?: { label: string; href?: string }[];
  status?: { family: "positive" | "neutral" | "attention"; label: string };
  meta?: string;
  context?: { premises: string; period?: string; label: string };
};

const LAYER_KEYS: Readonly<Record<RightsLayer, string>> = {
  authors: "fin03.authors",
  performers: "fin03.performers",
  producers: "fin03.producers",
};

function isInvoiceView(view: string): view is Fin03InvoiceView {
  return (FIN03_INVOICE_VIEWS as readonly string[]).includes(view);
}

/**
 * SCR-FIN-03 Invoices and corrective documents, where the portal's Payments item opens: every invoice and
 * corrective document of the party, the latest first, as the session holds them. One invoice, and an invoice
 * not issued, are review states only: an invoice has no address of its own yet.
 */
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const query = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, FIN03_VIEWS);
  const phone = frame === "phone";
  const party = { premises: principal.party, label: t("fin03.partyLabel") };

  let header: Header;
  let body: React.ReactNode;
  if (view === "loading") {
    header = { title: t("fin03.listTitle"), context: party };
    body = <InvoiceTable rows={[]} loading frame={frame} t={t} locale={locale} />;
  } else if (view !== null && isInvoiceView(view)) {
    const outcome = await loadInvoice(view);
    const read = outcome.data;
    if (read === null) {
      header = { title: t("fin03.titleGeneric"), context: party };
      body = <Failed failure={outcome.failure} phone={phone} t={t} locale={locale} />;
    } else if (read.kind === "issued") {
      header = issuedHeader(read.invoice, t, locale);
      body = <Issued invoice={read.invoice} frame={frame} t={t} locale={locale} />;
    } else {
      header = unissuedHeader(read.invoice, t, locale);
      body = <Unissued invoice={read.invoice} frame={frame} t={t} locale={locale} />;
    }
  } else {
    const outcome = await loadInvoiceList(principal.sessionId, view);
    const list = outcome.data;
    if (list === null) {
      header = { title: t("fin03.titleGeneric"), context: party };
      body = <Failed failure={outcome.failure} phone={phone} t={t} locale={locale} />;
    } else {
      header = listHeader(list, t, locale);
      body = <List list={list} frame={frame} t={t} locale={locale} />;
    }
  }

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("payments", frame, locale)}
      account={principal.account}
      {...(header.context !== undefined ? { context: header.context } : {})}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          {...(header.crumbs !== undefined ? { crumbs: header.crumbs } : {})}
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

/** The Payments item opens the list, so the list has no crumb; every other page leads back to it by its name. */
function backCrumb(t: Translate) {
  return [{ label: t("fin03.crumbInv"), href: routes.payments() }];
}

/** A series and its number are one reference; a phone card lets the pair wrap between the two (FIN F-14). */
function invoiceNo(series: string, number: string, frame: Frame): string {
  return `${series}${frame === "phone" ? " " : "\u00a0"}${number}`;
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

// ------------------------------------------------------------------ the list

function listHeader(list: InvoiceList, t: Translate, locale: Locale): Header {
  const time = R1_FORMAT.formatTimestamp(list.asOf, locale) ?? "";
  if (list.invoices.length === 0) {
    // A premises with no invoice is a page of its own, under the list.
    return {
      title: t("fin03.emptyTitlePage", { premises: list.premises ?? list.party }),
      crumbs: backCrumb(t),
      meta: t("fin03.asOf", { time }),
      context: list.premises !== null ? { premises: list.premises, label: t("fin03.premisesLabel") } : { premises: list.party, label: t("fin03.partyLabel") },
    };
  }
  const corrective = list.invoices.filter((invoice) => invoice.corrects !== null).length;
  return {
    title: t("fin03.listTitle"),
    meta:
      list.invoices.length === 1
        ? t("fin03.metaOne", { time })
        : t("fin03.metaMany", { invoices: list.invoices.length - corrective, corrective, time }),
    context: list.premises !== null ? { premises: list.premises, label: t("fin03.premisesLabel") } : { premises: list.party, label: t("fin03.partyLabel") },
  };
}

function List({ list, frame, t, locale }: { list: InvoiceList; frame: Frame; t: Translate; locale: Locale }) {
  if (list.invoices.length === 0) {
    // A governed empty: the premises' decision has no fee, so there is nothing to invoice.
    const decision = list.decisionWithoutFee;
    return (
      <div style={{ maxWidth: "var(--container-3xl)" }}>
        <EmptyState
          variant="no-obligation"
          title={t("fin03.emptyTitle")}
          level={2}
          action={
            decision !== null
              ? { label: t("fin03.openDecisionRef", { reference: decision }), href: routes.decision(decision), variant: "secondary" }
              : false
          }
          density="portal"
          locale={locale}
        >
          {decision !== null ? t("fin03.emptyText", { reference: decision }) : null}
        </EmptyState>
      </div>
    );
  }
  const rows = list.invoices.map((invoice) => ({
    _key: invoice.number,
    doc: {
      text: invoiceNo(invoice.series, invoice.number, frame),
      mono: true,
      detail:
        invoice.corrects !== null
          ? t("fin03.kCorrective", { number: invoiceNo(invoice.series, invoice.corrects, frame) })
          : t("fin03.kInvoice"),
    },
    premises: invoice.premises,
    issued: invoice.issuedOn,
    amount: invoice.amountMinor,
    st:
      invoice.correctedBy !== null
        ? { family: "neutral", label: t("fin03.corrected"), detail: t("fin03.byDoc", { number: invoiceNo(invoice.series, invoice.correctedBy, frame) }) }
        : { family: "positive", label: t("fin03.issued") },
  }));
  return <InvoiceTable rows={rows} loading={false} frame={frame} t={t} locale={locale} />;
}

function InvoiceTable({
  rows,
  loading,
  frame,
  t,
  locale,
}: {
  rows: Record<string, unknown>[];
  loading: boolean;
  frame: Frame;
  t: Translate;
  locale: Locale;
}) {
  const tablet = frame === "tablet";
  return (
    <Table
      columns={[
        { key: "doc", label: t("fin03.cDoc"), kind: "stack" },
        { key: "premises", label: t("fin03.cPremises"), kind: "text" },
        { key: "issued", label: t("fin03.cIssued"), kind: "date", short: true, ...(tablet ? { priority: "low" as const } : {}) },
        { key: "amount", label: t("fin03.cAmount"), kind: "money", unit: "VND", align: "end" },
        { key: "st", label: t("fin03.cStatus"), kind: "status" },
      ]}
      rows={rows}
      loading={loading ? 4 : false}
      density="portal"
      layout={frame === "phone" ? "cards" : "table"}
      expandable={tablet}
      caption={t("fin03.listCaption")}
      locale={locale}
    />
  );
}

// ------------------------------------------------------------------ one invoice

function issuedHeader(invoice: IssuedInvoice, t: Translate, locale: Locale): Header {
  return {
    title: t("fin03.oneTitle", { number: `${invoice.series}\u00a0${invoice.number}` }),
    crumbs: backCrumb(t),
    status: invoice.correction !== null ? { family: "neutral", label: t("fin03.corrected") } : { family: "positive", label: t("fin03.issued") },
    meta: t("fin03.issuedBy", { issuer: invoice.issuer, time: R1_FORMAT.formatTimestamp(invoice.issuedAt, locale) ?? "" }),
    context: { premises: invoice.premises, period: invoice.payment, label: t("fin03.premisesLabel") },
  };
}

function Issued({ invoice, frame, t, locale }: { invoice: IssuedInvoice; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const narrow = frame !== "desktop";
  const tablet = frame === "tablet";
  const inset = phone ? "sm" : "md";
  const total = invoice.components.reduce((sum, component) => sum + component.amountMinor, 0);
  const correction = invoice.correction;
  const docRows: Record<string, unknown>[] = [
    {
      _key: invoice.number,
      doc: {
        text: invoiceNo(invoice.series, invoice.number, frame),
        mono: true,
        detail: t(correction !== null ? "fin03.origDetail" : "fin03.invShown"),
      },
      issued: invoice.issuedAt.slice(0, 10),
      amount: total,
      st: correction !== null ? { family: "neutral", label: t("fin03.corrected") } : { family: "positive", label: t("fin03.issued") },
    },
    ...(correction !== null
      ? [
          {
            _key: correction.number,
            doc: {
              text: invoiceNo(invoice.series, correction.number, frame),
              mono: true,
              detail: t("fin03.corrDetail", { date: R1_FORMAT.formatDate(correction.chargebackOn, locale) ?? "" }),
            },
            issued: correction.issuedOn,
            amount: -total,
            st: { family: "positive", label: t("fin03.issued") },
          },
        ]
      : []),
  ];
  const facts: Facts = [
    { label: t("fin03.fNumber"), value: `${invoice.series} ${invoice.number}`, kind: "id" },
    { label: t("fin03.fIssuer"), value: invoice.issuer, note: t("fin03.issuerNote") },
    { label: t("fin03.fPayer"), value: invoice.payer },
    { label: t("fin03.fPayment"), value: invoice.payment, kind: "id" },
    { label: t("fin03.fDecision"), value: invoice.decision, kind: "id" },
    invoice.keptUntil !== null
      ? { label: t("fin03.fKeep"), value: invoice.keptUntil, kind: "date" }
      : { label: t("fin03.fKeep"), value: null, missing: t("fin03.keepMissing") },
  ];
  return (
    <>
      <div
        style={{
          display: "grid",
          // Wide: the documents and the amount on the left, the invoice beside them.
          gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "minmax(0, 1fr) var(--container-sm)",
          gridTemplateAreas: narrow ? "'docs' 'fee' 'facts'" : "'docs facts' 'fee facts'",
          gap: phone ? "var(--space-4)" : "var(--space-6)",
          alignItems: "start",
        }}
      >
        <div style={{ gridArea: "docs", minWidth: 0 }}>
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
        <div style={{ gridArea: "fee", minWidth: 0 }}>
          <Panel inset={inset} density="portal" locale={locale}>
            <Breakdown
              title={t(correction !== null ? "fin03.feeOrig" : "fin03.feeInv")}
              description={t("fin03.feeDesc")}
              lines={[
                ...invoice.components.map((component) => ({
                  label: t(LAYER_KEYS[component.layer]),
                  detail: t("fin03.recipient", { recipient: component.recipient }),
                  amountMinor: component.amountMinor,
                })),
                { label: t("fin03.total"), kind: "total" as const, amountMinor: total },
              ]}
              currency="VND"
              locale={locale}
            />
          </Panel>
        </div>
        <div style={{ gridArea: "facts", minWidth: 0 }}>
          <FactsPanel
            as="aside"
            facts={facts}
            links={[
              { label: t("fin03.seePayment"), href: routes.paymentPosition(invoice.decision) },
              { label: t("fin03.openDecision"), href: routes.decision(invoice.decision) },
            ]}
            inset={inset}
            t={t}
            locale={locale}
          />
        </div>
      </div>
      <Back phone={phone} t={t} locale={locale} />
    </>
  );
}

function unissuedHeader(invoice: UnissuedInvoice, t: Translate, locale: Locale): Header {
  return {
    title: t("fin03.insTitle", { reference: invoice.instruction }),
    crumbs: backCrumb(t),
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
  const position = { label: t("fin03.seePosition"), href: routes.paymentPosition(invoice.decision) };
  const facts: Facts = [
    {
      label: t("fin03.fPayment"),
      value:
        reconciledAt === null
          ? { family: "info", label: t("fin03.paidRec"), working: true }
          : { family: "positive", label: t("fin03.paid") },
      kind: "status",
      note:
        reconciledAt === null
          ? t("fin03.byCard", { time: paidAt })
          : t("fin03.byCardRec", { time: paidAt, reconciled: R1_FORMAT.formatTime(reconciledAt) ?? "" }),
    },
    ...(notSettled ? [{ label: t("fin03.fInvoice"), value: null, missing: t("fin03.invMissing") }] : []),
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
          <Banner
            family="attention"
            title={t("fin03.nsTitle")}
            code={invoice.reason}
            action={{ ...position, variant: "secondary" }}
            density="portal"
            locale={locale}
          />
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
