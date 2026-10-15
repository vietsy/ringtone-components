import { R1_FORMAT } from "@rightone/formatting";
import { Banner, EmptyState, PageHeader, Table, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { requirePrincipal } from "@/lib/api/session";
import { loadPremisesStatusRecords, type PremisesStatusRecords } from "@/lib/api/status-records";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { CER11_VIEWS } from "@/lib/mock/status-records";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";
import en from "@/messages/screens/cer.en.json";
import vi from "@/messages/screens/cer.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

/** Refusals that replace the list. Any other failure is our outage and reads as the error state. */
const REFUSALS = new Set(["NOT_AUTHORISED_FOR_PREMISES", "REFERENCE_DATA_UNAVAILABLE"]);

/**
 * SCR-CER-11 Status records of a premises. The premises principal reads which records the premises holds,
 * since when each is in its state and for how long it is in force, and opens one. The portal's address names
 * no premises yet, so the session's list is every record of the party, each row naming its premises.
 */
export default async function StatusRecordsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, CER11_VIEWS);
  const outcome = view === "loading" ? null : await loadPremisesStatusRecords(principal.sessionId, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";

  const title = data?.premises ? t("cer11.title", { premises: data.premises }) : t("cer11.titleGeneric");
  const context = data?.premises
    ? { premises: data.premises, label: t("cer11.premisesLabel") }
    : { premises: data?.party ?? principal.party, label: t("cer11.partyLabel") };

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
          crumbs={[{ label: t("cer11.crumb") }]}
          title={title}
          {...(data !== null ? { meta: meta(data, t, locale) } : {})}
          locale={locale}
        />
        <Body view={view} data={data} failure={failure} frame={frame} t={t} locale={locale} />
      </div>
    </PortalShell>
  );
}

function Body({
  view,
  data,
  failure,
  frame,
  t,
  locale,
}: {
  view: string | null;
  data: PremisesStatusRecords | null;
  failure: { code: string; traceId: string | null; retryable: boolean } | null;
  frame: Frame;
  t: Translate;
  locale: Locale;
}) {
  if (view === "loading") return <RecordsTable rows={[]} spans={false} loading frame={frame} t={t} locale={locale} />;

  if (failure !== null) {
    if (failure.code === "PREMISES_FILTER_REQUIRED") {
      return (
        <div style={{ maxWidth: "var(--container-3xl)" }}>
          <Banner family="attention" title={t("cer11.prTitle")} code={failure.code} density="portal" locale={locale}>
            {t("cer11.prText")}
          </Banner>
        </div>
      );
    }
    if (REFUSALS.has(failure.code)) {
      const unavailable = failure.code === "REFERENCE_DATA_UNAVAILABLE";
      return (
        <div style={{ maxWidth: "var(--container-3xl)" }}>
          <ViewState
            view="refused"
            refusal={{
              code: failure.code,
              title: t(unavailable ? "cer11.unTitle" : "cer11.naTitle"),
              text: t(unavailable ? "cer11.unText" : "cer11.naText"),
              family: "attention",
              ...(unavailable ? { action: { label: t("cer11.tryAgain"), icon: "refresh-cw", href: routes.statusRecords() } } : {}),
            }}
            density="portal"
            locale={locale}
          />
        </div>
      );
    }
    return (
      <ViewState
        view="error"
        errorTitle={t("cer11.errTitle")}
        errorText={t("cer11.errText")}
        {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
        retryable={failure.retryable}
        density="portal"
        locale={locale}
      />
    );
  }

  if (data === null || data.records.length === 0) {
    return (
      <EmptyState variant="not-started" title={t("cer11.emptyTitle")} level={2} action={false} density="portal" locale={locale}>
        {t("cer11.emptyText")}
      </EmptyState>
    );
  }

  // A list that spans premises names each record's premises under its reference.
  const spans = data.records.some((record) => record.premises !== null);
  const rows = data.records.map((record) => ({
    _key: record.reference,
    ...(record.followsChangeOn !== null
      ? { _message: { severity: "neutral", text: t("cer11.followsChange", { date: R1_FORMAT.formatDate(record.followsChangeOn, locale) ?? "" }) } }
      : {}),
    ref: record.premises !== null ? { text: record.reference, mono: true, detail: record.premises } : record.reference,
    st: {
      // The canvas draws an active record with the seal, in the info family, and says since when; a suspended
      // one reads as its holder's page draws it.
      ...(record.state === "suspended" ? { family: "danger", label: t("cer12.suspended") } : { family: "info", label: t("cer11.active"), variant: "seal" }),
      detail: t("cer11.since", { date: R1_FORMAT.formatDate(record.since, locale) ?? "" }),
    },
    // At 768 px a period is written as text so it can wrap under its column; a period cell never wraps.
    period: frame === "tablet" ? R1_FORMAT.formatPeriod(record.from, record.to, locale) : { from: record.from, to: record.to },
    act: [{ label: t("cer11.view"), ariaLabel: `${t("cer11.view")} ${record.reference}`, href: routes.statusRecord(record.reference), variant: "quiet" }],
  }));

  return <RecordsTable rows={rows} spans={spans} loading={false} frame={frame} t={t} locale={locale} caption={data.premises ?? t("cer11.titleGeneric")} />;
}

function RecordsTable({
  rows,
  spans,
  loading,
  frame,
  t,
  locale,
  caption,
}: {
  rows: Record<string, unknown>[];
  spans: boolean;
  loading: boolean;
  frame: Frame;
  t: Translate;
  locale: Locale;
  caption?: string;
}) {
  return (
    <Table
      columns={[
        { key: "ref", label: t("cer11.colRef"), kind: spans ? "stack" : "id" },
        { key: "st", label: t("cer11.colStatus"), kind: "status" },
        { key: "period", label: t("cer11.colPeriod"), kind: frame === "tablet" ? "text" : "period" },
        { key: "act", kind: "actions", align: "end" },
      ]}
      rows={rows}
      loading={loading ? 2 : false}
      density="portal"
      layout={frame === "phone" ? "cards" : "table"}
      caption={caption ?? t("cer11.titleGeneric")}
      locale={locale}
    />
  );
}

function meta(data: PremisesStatusRecords, t: Translate, locale: Locale): string {
  const asOf = R1_FORMAT.formatTimestamp(data.asOf, locale) ?? "";
  if (data.records.length === 0) return t("cer11.metaNone", { asOf });
  if (data.records.length === 1) return t("cer11.metaOne", { asOf });
  return t("cer11.metaMany", { count: data.records.length, asOf });
}
