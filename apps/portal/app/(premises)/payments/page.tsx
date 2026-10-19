import { R1_FORMAT } from "@rightone/formatting";
import { redirect } from "next/navigation";
import { Button, EmptyState, PageHeader, Table, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { loadInvoiceList, type InvoiceList } from "@/lib/api/finance";
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
type Failure = { code: string; traceId: string | null; retryable: boolean };
type Header = {
  title: string;
  crumbs?: { label: string; href?: string }[];
  status?: { family: "positive" | "neutral" | "attention"; label: string };
  meta?: string;
  context?: { premises: string; period?: string; label: string };
};

function isInvoiceView(view: string): view is Fin03InvoiceView {
  return (FIN03_INVOICE_VIEWS as readonly string[]).includes(view);
}

/**
 * SCR-FIN-03 Invoices and corrective documents, where the portal's Payments item opens: every invoice and
 * corrective document of the party, the latest first, as the session holds them, and the invoices not issued yet.
 * Each row opens its document on its own page (`invoices/[invoice]`), the original of a corrected invoice as much as
 * any other; the review states of one invoice are drawn there.
 */
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const query = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = translator({ vi, en }, locale);
  const view = reviewView(query, FIN03_VIEWS);
  const phone = frame === "phone";
  const party = { premises: principal.party, label: t("fin03.partyLabel") };

  // The review states of one invoice belong to its page; the canvas draws them on Pasteur's first invoice.
  if (view !== null && isInvoiceView(view)) redirect(`${routes.invoice("1C26TRO 00000418")}?view=${view}`);

  let header: Header;
  let body: React.ReactNode;
  if (view === "loading") {
    header = { title: t("fin03.listTitle"), context: party };
    body = <InvoiceTable rows={[]} loading frame={frame} t={t} locale={locale} />;
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
  if (list.invoices.length === 0 && list.pending.length === 0) {
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
  if (list.invoices.length === 0 && list.pending.length === 0) {
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
  // An invoice not issued yet opens on the page of its payment's invoice, which says why.
  const pending = list.pending.map((entry) => ({
    _key: entry.payment,
    _href: routes.invoice(entry.payment),
    doc: { text: t("fin03.kPending", { reference: entry.instruction }), detail: t(entry.reason === "FIN_EINVOICE_UNAVAILABLE" ? "fin03.kPendingDown" : "fin03.kPendingSettle") },
    premises: entry.premises,
    issued: null,
    amount: entry.amountMinor,
    st: { family: "attention", label: t("fin03.notIssued") },
  }));
  const rows = list.invoices.map((invoice) => ({
    _key: invoice.number,
    _href: routes.invoice(`${invoice.series} ${invoice.number}`),
    doc: {
      text: invoiceNo(invoice.series, invoice.number, frame),
      mono: true,
      detail:
        invoice.corrects !== null
          ? // A corrective document made under a case's remedy names the case, as the refund it records does.
            t(invoice.case !== null ? "fin03.kCorrectiveCase" : "fin03.kCorrective", { number: invoiceNo(invoice.series, invoice.corrects, frame), case: invoice.case ?? "" })
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
  return <InvoiceTable rows={[...pending, ...rows]} loading={false} frame={frame} t={t} locale={locale} />;
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
