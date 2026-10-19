import { Banner, Button, DateField, EmptyState, FilterBar, PageHeader, Select, Skeleton, Table, ViewState, type StatusValue } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { documentTitle, duration, moment, pubTranslator, refusalWords } from "@/features/public/console";
import { loadCurrencyWatches, type CurrencyList, type CurrencyWatch, type WatchStatus } from "@/lib/api/public";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { POLICY_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const STATUSES: readonly WatchStatus[] = ["OPEN", "OVERDUE", "REACHED", "REACHED_LATE", "CANCELLED"];
const FAMILY: Readonly<Record<WatchStatus, StatusValue["family"]>> = { OVERDUE: "danger", OPEN: "attention", REACHED: "positive", REACHED_LATE: "attention", CANCELLED: "neutral" };

const one = (value: string | string[] | undefined): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/** A day as the range field sends it (day/month/year) or as an address carries it (ISO); null when it is neither. */
function askedDay(value: string | null): string | null {
  if (value === null) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  return dmy === null ? null : `${dmy[3]}-${(dmy[2] ?? "").padStart(2, "0")}-${(dmy[1] ?? "").padStart(2, "0")}`;
}

/**
 * SCR-PUB-17 Publication currency: each approved change to a source the public service describes, from its approval to
 * the first instant the public pages served it, overdue first. The sweep's overdue step runs as the list is read, so a
 * change past its 72 hours shows overdue on the next read with no job behind it. An edition published on SCR-PUB-16
 * that names the change closes it here, in time or late. A period that ends before it starts is refused beside the
 * field (PERIOD_INVALID) and the list is read without it.
 */
export default async function PublicationCurrencyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-POL-PRE", "ACT-POL-APR", "ACT-OPS");
  const params = await searchParams;
  const locale = await getLocale();
  const t = pubTranslator(locale);
  const view = reviewView(params, POLICY_VIEWS);
  const status = STATUSES.find((candidate) => candidate === one(params.status)) ?? null;
  const from = askedDay(one(params["period-from"]) ?? one(params.from));
  const to = askedDay(one(params["period-to"]) ?? one(params.to));
  const cursor = one(params.cursor);
  const first = view === "loading" ? null : await loadCurrencyWatches(staff, { status, from, to, cursor }, view);
  // A refused period is said beside the field; the list is read again without it.
  const periodRefused = first?.failure?.code === "PERIOD_INVALID";
  const outcome = periodRefused ? await loadCurrencyWatches(staff, { status, from: null, to: null, cursor }, null) : first;
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame
      console="policy"
      current="currency"
      staff={staff}
      searchLabel={t("pubc.search")}
      keyMap={(data?.rows.length ?? 0) > 0 ? [{ keys: ["J", "K"], label: t("pubc.kRows") }] : []}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          crumbs={[{ label: t("pubc.policy") }]}
          title={t("pub17.title")}
          {...(data !== null ? { meta: t("pub17.meta", { hours: data.periodHours, ts: moment(data.sweptAt, locale) }) } : {})}
          locale={locale}
        >
          <Button variant="secondary" size="sm" icon="file-text" href={routes.policyDocuments()} locale={locale}>
            {t("pub17.docs")}
          </Button>
        </PageHeader>
        {failure?.code === "NOT_AUTHORISED" ? (
          <ViewState
            view="refused"
            refusal={{ code: failure.code, title: refusalWords(failure, t).title, text: refusalWords(failure, t).text ?? "", family: "attention" }}
            level={2}
            density="console"
            locale={locale}
          />
        ) : failure !== null && failure.code !== "CURSOR_INVALID" ? (
          <ViewState view="error" errorTitle={t("pubc.errTitle")} errorText={t("pubc.errText")} {...(failure.traceId !== null ? { traceId: failure.traceId } : {})} retryable={failure.retryable} level={2} density="console" locale={locale} />
        ) : (
          <Watches data={data} asked={{ status, from, to }} periodRefused={periodRefused} cursorRefused={failure?.code === "CURSOR_INVALID"} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Watches({
  data,
  asked,
  periodRefused,
  cursorRefused,
  t,
  locale,
}: {
  data: CurrencyList | null;
  asked: { status: WatchStatus | null; from: string | null; to: string | null };
  periodRefused: boolean;
  cursorRefused: boolean;
  t: Translate;
  locale: Locale;
}) {
  const shown = data?.rows.length ?? 0;
  return (
    <>
      <form action={routes.policyCurrency()}>
        <FilterBar
          label={t("pub17.filterLabel")}
          shortcut="/"
          {...(data !== null ? { summary: shown === 1 ? t("pub17.summaryOne") : t("pub17.summary", { n: shown }) } : {})}
          active={asked.status !== null || asked.from !== null || asked.to !== null}
          locale={locale}
        >
          <Select
            label={t("pub17.fStatus")}
            name="status"
            options={[{ value: "", label: t("pub17.all") }, ...STATUSES.map((status) => ({ value: status, label: t(`pub17.status.${status}`) }))]}
            value={asked.status ?? ""}
            width="var(--space-48)"
            density="console"
            locale={locale}
          />
          <DateField
            label={t("pub17.fPeriod")}
            name="period"
            range
            fromLabel={t("pub17.from")}
            toLabel={t("pub17.to")}
            {...(asked.from !== null ? { value: asked.from } : {})}
            {...(asked.to !== null ? { to: asked.to } : {})}
            {...(periodRefused ? { error: t("pubc.refusal.PERIOD_INVALID.title") } : {})}
            helper={false}
            density="console"
            locale={locale}
          />
          <Button variant="secondary" size="sm" icon="refresh-cw" type="submit" locale={locale}>
            {t("pub17.reload")}
          </Button>
        </FilterBar>
      </form>
      {cursorRefused ? (
        <Banner
          family="attention"
          title={t("pubc.refusal.CURSOR_INVALID.title")}
          code="CURSOR_INVALID"
          action={{ label: t("pubc.reloadStart"), href: routes.policyCurrency(asked), icon: "refresh-cw", variant: "secondary" }}
          density="console"
          locale={locale}
        >
          {t("pubc.refusal.CURSOR_INVALID.text")}
        </Banner>
      ) : null}
      {cursorRefused ? null : data === null ? (
        <Skeleton variant="table" rows={4} columns={6} density="console" locale={locale} />
      ) : data.rows.length === 0 ? (
        // The filtered empty is drawn here rather than by the table, so its way out is a link the server can pass.
        <EmptyState
          variant="filtered"
          title={asked.status !== null ? t("pub17.emptyStatus", { status: t(`pub17.status.${asked.status}`) }) : t("pub17.emptyAll")}
          action={{ label: t("pub17.clear"), href: routes.policyCurrency(), variant: "secondary" }}
          level={2}
          density="console"
          locale={locale}
        />
      ) : (
        <Table
          columns={[
            { key: "source", label: t("pub17.cSource"), kind: "stack", minWidth: "var(--space-56)" },
            { key: "approved", label: t("pub17.cApproved"), kind: "datetime", missing: t("pub17.approvedNone") },
            { key: "due", label: t("pub17.cDue"), kind: "stack" },
            { key: "state", label: t("pub17.cState"), kind: "status" },
            { key: "elapsed", label: t("pub17.cElapsed"), align: "end", num: true, nowrap: true, missing: t("pub17.notMeasured") },
            { key: "from", label: t("pub17.cFrom") },
          ]}
          rows={data.rows.map((watch) => watchRow(watch, data.periodHours, t, locale))}
          density="console"
          caption={t("pub17.title")}
          rowFocus
          sortNote={t("pub17.sortNote")}
          locale={locale}
        />
      )}
    </>
  );
}

/** A watch's row: its due time in words for its state, and what closed it, reopened it or cancelled it under its state. */
function watchRow(watch: CurrencyWatch, hours: number, t: Translate, locale: Locale): Record<string, unknown> {
  const due =
    watch.dueAt === null
      ? { text: watch.measuredFrom === "BASELINE" ? t("pub17.noDue") : t("pub17.readAtUse"), muted: true }
      : watch.status === "OVERDUE"
        ? { text: t("pub17.overdueSince", { ts: moment(watch.overdueAt ?? watch.dueAt, locale) }), detail: t("pub17.period", { hours }) }
        : watch.status === "OPEN"
          ? { text: moment(watch.dueAt, locale), detail: t("pub17.left", { d: duration(Math.max(0, (Date.parse(watch.dueAt) - Date.now()) / 1000), t) }) }
          : { text: moment(watch.dueAt, locale), detail: t("pub17.period", { hours }) };
  const detail =
    watch.reachedBy !== null
      ? t("pub17.reachedBy", { doc: documentTitle(watch.reachedBy.kind, t), version: watch.reachedBy.label })
      : watch.reopenedAt !== null
        ? t("pub17.reopened", { ts: moment(watch.reopenedAt, locale) })
        : watch.cancelReason !== null
          ? t(`pub17.cancelled.${watch.cancelReason}`)
          : null;
  const state: StatusValue = {
    family: watch.measuredFrom === "BASELINE" ? "neutral" : FAMILY[watch.status],
    label: t(`pub17.status.${watch.status}`),
    ...(detail !== null ? { detail } : {}),
  };
  return {
    _key: watch.id,
    ...(watch.status === "OVERDUE" ? { _tone: "danger" } : {}),
    source: { text: t(`pubc.source.${watch.sourceKind}`), detail: watch.versionRef },
    approved: watch.approvedAt,
    due,
    state,
    elapsed: watch.elapsedSeconds !== null ? duration(watch.elapsedSeconds, t) : null,
    from: t(`pub17.measured.${watch.measuredFrom}`),
  };
}
