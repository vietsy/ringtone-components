import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Button, ButtonRow, EmptyState, PageHeader, Table, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { requirePrincipal } from "@/lib/api/session";
import { holderStatus } from "@/features/status-records/holder";
import { recordStatus } from "@/features/status-records/words";
import { loadHolderPremises, loadPremisesStatusRecords, type HolderPremises, type PremisesStatusRecords } from "@/lib/api/status-records";
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

/** How many pages Xem thêm has opened, from the address; one page of 25 when it names none. */
function pagesOf(value: string | string[] | undefined): number {
  const asked = typeof value === "string" ? Number.parseInt(value, 10) : 1;
  return Number.isInteger(asked) && asked >= 1 && asked <= 40 ? asked : 1;
}

/**
 * SCR-CER-11 Status records of a premises. The premises principal, or a delegate within her delegation, reads which
 * records the premises the address names holds, those still waiting to issue first, since when each is in its state
 * and for how long it is in force, and opens one. With no premises named the page asks which one (PREMISES_FILTER_REQUIRED)
 * and lists the premises PTY answers the person may read the records of.
 */
export default async function StatusRecordsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, CER11_VIEWS);
  const premises = typeof params.premises === "string" && params.premises.trim() !== "" ? params.premises.trim() : null;
  const pages = pagesOf(params.pages);
  const outcome = view === "loading" ? null : await loadPremisesStatusRecords(principal, view, premises, pages);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  // A list that names no premises offers those the person may read the records of.
  const choice = view === null && failure?.code === "PREMISES_FILTER_REQUIRED" ? ((await loadHolderPremises(principal)).data ?? []) : null;
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
          crumbs={[{ label: t("cer11.crumb"), href: data?.register ? routes.portfolioPremises(data.register) : routes.premisesPortfolio() }]}
          title={title}
          {...(data !== null ? { meta: meta(data, t, locale) } : {})}
          locale={locale}
        />
        <Body view={view} data={data} failure={failure} choice={choice} pages={pages} frame={frame} t={t} locale={locale} />
      </div>
    </PortalShell>
  );
}

function Body({
  view,
  data,
  failure,
  choice,
  pages,
  frame,
  t,
  locale,
}: {
  view: string | null;
  data: PremisesStatusRecords | null;
  failure: { code: string; traceId: string | null; retryable: boolean } | null;
  choice: readonly HolderPremises[] | null;
  pages: number;
  frame: Frame;
  t: Translate;
  locale: Locale;
}) {
  const phone = frame === "phone";
  if (view === "loading") return <RecordsTable rows={[]} stacked={false} loading frame={frame} t={t} locale={locale} />;

  if (failure !== null) {
    if (failure.code === "PREMISES_FILTER_REQUIRED") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
          <Banner family="attention" title={t("cer11.prTitle")} code={failure.code} density="portal" locale={locale}>
            {t("cer11.prText")}
          </Banner>
          {choice !== null && <PremisesChoice choice={choice} frame={frame} t={t} locale={locale} />}
        </div>
      );
    }
    if (REFUSALS.has(failure.code)) {
      const unavailable = failure.code === "REFERENCE_DATA_UNAVAILABLE";
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
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
          <div>
            <Button variant="secondary" size="md" icon="arrow-left" href={routes.statusRecords()} fullWidth={phone} locale={locale}>
              {t("cer11.otherPremises")}
            </Button>
          </div>
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

  const back = <BackRow data={data} more={null} frame={frame} t={t} locale={locale} />;
  if (data === null || (data.records.length === 0 && data.pending.length === 0)) {
    return (
      <>
        <EmptyState variant="not-started" title={t("cer11.emptyTitle")} level={2} action={false} density="portal" locale={locale}>
          {t("cer11.emptyText")}
        </EmptyState>
        {back}
      </>
    );
  }

  // A list that spans premises names each record's premises under its reference; a pending record names its decision.
  const spans = data.records.some((record) => record.premises !== null);
  const stacked = spans || data.pending.length > 0;
  const pendingRows = data.pending.map((record) => ({
    _key: record.key,
    // What it waits on first, in the holder's words (FR-CER-001); an approval wait is not the holder's to read.
    ...(record.waitingOn[0] !== undefined ? { _message: { severity: "warning", text: t(`cer.condition.${record.waitingOn[0]}`) } } : {}),
    ref: { text: t("cer11.notIssued"), detail: t("cer11.pendingOn", { decision: record.key }) },
    st: { ...recordStatus(t, "PENDING_ISSUE"), detail: t("cer11.since", { date: R1_FORMAT.formatDate(record.since, locale) ?? "" }) },
    period: frame === "tablet" ? R1_FORMAT.formatPeriod(record.from, record.to, locale) : { from: record.from, to: record.to },
    act: [{ label: t("cer11.view"), ariaLabel: `${t("cer11.view")} ${record.key}`, href: routes.statusRecord(record.key), variant: "quiet" }],
  }));
  const rows = data.records.map((record) => ({
    _key: record.reference,
    ...(record.followsChangeOn !== null
      ? { _message: { severity: "neutral", text: t("cer11.followsChange", { date: R1_FORMAT.formatDate(record.followsChangeOn, locale) ?? "" }) } }
      : {}),
    ref: record.premises !== null ? { text: record.reference, mono: true, detail: record.premises } : stacked ? { text: record.reference, mono: true } : record.reference,
    st: {
      // The canvas draws an active record with the seal, in the info family, and says since when; every other
      // state wears its family's badge (design/03 convention 7).
      ...recordStatus(t, holderStatus(record.state)),
      detail: t("cer11.since", { date: R1_FORMAT.formatDate(record.since, locale) ?? "" }),
    },
    // At 768 px a period is written as text so it can wrap under its column; a period cell never wraps.
    period: frame === "tablet" ? R1_FORMAT.formatPeriod(record.from, record.to, locale) : { from: record.from, to: record.to },
    act: [{ label: t("cer11.view"), ariaLabel: `${t("cer11.view")} ${record.reference}`, href: routes.statusRecord(record.reference), variant: "quiet" }],
  }));

  return (
    <>
      <RecordsTable rows={[...pendingRows, ...rows]} stacked={stacked} loading={false} frame={frame} t={t} locale={locale} caption={data.premises ?? t("cer11.titleGeneric")} />
      <BackRow data={data} more={data.nextCursor !== null && data.premisesId !== null ? routes.statusRecords(data.premisesId, pages + 1) : null} frame={frame} t={t} locale={locale} />
    </>
  );
}

/** Xem thêm where a cursor was returned, then Back to the premises' page (SCR-PTY-07). */
function BackRow({ data, more, frame, t, locale }: { data: PremisesStatusRecords | null; more: string | null; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  return (
    <ButtonRow>
      {more !== null && (
        <Button variant="secondary" size="md" icon="chevron-down" href={more} fullWidth={phone} locale={locale}>
          {t("cer11.more")}
        </Button>
      )}
      <Button
        variant="secondary"
        size="md"
        icon="arrow-left"
        href={data?.register ? routes.portfolioPremises(data.register) : routes.premisesPortfolio()}
        fullWidth={phone}
        locale={locale}
      >
        {t("cer11.back")}
      </Button>
    </ButtonRow>
  );
}

/** The premises the person may read the records of, each opening its list; none when PTY answers none. */
function PremisesChoice({ choice, frame, t, locale }: { choice: readonly HolderPremises[]; frame: Frame; t: Translate; locale: Locale }) {
  if (choice.length === 0) {
    return (
      <EmptyState variant="not-started" title={t("cer11.noPremisesTitle")} level={2} action={false} density="portal" locale={locale}>
        {t("cer11.noPremisesText")}
      </EmptyState>
    );
  }
  return (
    <Table
      columns={[
        { key: "premises", label: t("cer11.colPremises"), kind: "stack" },
        { key: "act", kind: "actions", align: "end" },
      ]}
      rows={choice.map((premises) => ({
        _key: premises.register,
        premises: { text: premises.name, detail: premises.register },
        act: [{ label: t("cer11.openPremises"), ariaLabel: `${t("cer11.openPremises")} ${premises.name}`, href: routes.statusRecords(premises.id), variant: "quiet" }],
      }))}
      density="portal"
      layout={frame === "phone" ? "cards" : "table"}
      caption={t("cer11.chooseCaption")}
      locale={locale}
    />
  );
}

function RecordsTable({
  rows,
  stacked,
  loading,
  frame,
  t,
  locale,
  caption,
}: {
  rows: Record<string, unknown>[];
  stacked: boolean;
  loading: boolean;
  frame: Frame;
  t: Translate;
  locale: Locale;
  caption?: string;
}) {
  return (
    <Table
      columns={[
        { key: "ref", label: t("cer11.colRef"), kind: stacked ? "stack" : "id" },
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
  const count = data.records.length + data.pending.length;
  if (count === 0) return t("cer11.metaNone", { asOf });
  if (count === 1) return t("cer11.metaOne", { asOf });
  return t("cer11.metaMany", { count, asOf });
}
