import { Banner, Button, ButtonRow, DateField, PageHeader, Pagination, Panel, Skeleton, Table } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { Text } from "@/components/Text";
import { loadBalance, loadParticipation, type BalanceView, type CapabilitySummary, type LedgerRow } from "@/lib/api/engagement";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";
import { count, derived, engTranslator, fieldParts, moment, readInstant, refusalSentence, rowWords, signed, withheldWords } from "./copy";
import type { ParticipantPortal } from "./participant";
import { LoadFailure } from "./Refusals";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/**
 * SCR-ENG-02 Balance and history, in the portal the participant reads it in. No board or Figma frame draws it: it is
 * built from ENG's specification and wireframe. The figure says it is derived and from how many events, and the
 * disclosure stands in the same view, because a figure without what it is worth is the impression `BR-ENG-05` forbids.
 * The history is keyset-paginated and can be read as at a past instant, as it stood then: a correction recorded later
 * is not there. A future instant is refused, never clamped, and the refusal names the latest instant that may be asked.
 * While the capability is withheld the page shows neither figure nor history, only the sentence of its cause. An artist
 * reaches their referral reference from here (SCR-ENG-05).
 */
export async function BalanceScreen({ portal, params }: { portal: ParticipantPortal; params: SearchParams }) {
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = engTranslator(locale);
  const view = reviewView(params, ENG_VIEWS);
  const failing = view === "error" ? view : null;
  // The instant as the date field sends it, or as a page link carries it (ISO).
  const askedRaw = text(params.as_at);
  const asked = askedRaw !== null ? (readInstant(askedRaw) ?? (Number.isNaN(Date.parse(askedRaw)) ? null : askedRaw)) : null;
  const after = text(params.after);
  const [participation, first] =
    view === "loading" ? [null, null] : await Promise.all([loadParticipation(portal.who, failing), loadBalance(portal.who, asked, after, failing)]);
  // An as-at in the future is the field's refusal, naming the latest instant; the figure beside it is the one at now.
  const latest = first?.failure?.code === "AS_AT_IN_FUTURE" ? (first.named?.latest ?? null) : null;
  const future = first?.failure?.code === "AS_AT_IN_FUTURE";
  const outcome = future ? await loadBalance(portal.who, null, null, failing) : first;
  const phone = frame === "phone";
  const size = phone ? "lg" : "md";

  return (
    <PortalShell fill layout={phone ? "phone" : "desktop"} nav={portal.nav(frame, locale)} account={portal.account} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("eng01.title"), href: portal.home }]} title={t("eng02.title")} meta={t("eng01.meta", { party: portal.party })} locale={locale} />
        {view === "loading" ? (
          <>
            <Panel density="portal" locale={locale}>
              <Skeleton variant="text" rows={2} density="portal" locale={locale} />
            </Panel>
            <Panel density="portal" locale={locale}>
              <Skeleton variant="table" rows={5} density="portal" locale={locale} />
            </Panel>
          </>
        ) : null}
        {outcome?.failure ? (
          <Failure code={outcome.failure.code} capability={participation?.data?.capability ?? null} outcome={outcome} t={t} locale={locale} />
        ) : null}
        {outcome?.data ? <Balance data={outcome.data} portal={portal} asked={future ? { raw: askedRaw, latest } : null} frame={frame} t={t} locale={locale} /> : null}
        <ButtonRow>
          <Button variant="secondary" size={size} href={portal.points} fullWidth={phone} locale={locale}>
            {t("eng.whatPoints")}
          </Button>
          {portal.referral !== null ? (
            <Button variant="secondary" size={size} href={portal.referral} fullWidth={phone} locale={locale}>
              {t("eng02.referral")}
            </Button>
          ) : null}
          <Button variant="quiet" size={size} icon="arrow-left" href={portal.home} fullWidth={phone} locale={locale}>
            {t("eng02.back")}
          </Button>
        </ButtonRow>
      </div>
    </PortalShell>
  );
}

/** Withheld and lapsed are not errors: each says what it is, and the lapsed statement offers no retry. */
function Failure({
  code,
  capability,
  outcome,
  t,
  locale,
}: {
  code: string;
  capability: CapabilitySummary | null;
  outcome: Awaited<ReturnType<typeof loadBalance>>;
  t: Translate;
  locale: Locale;
}) {
  if (code === "CAPABILITY_WITHHELD" && capability !== null) {
    return (
      <Banner family="info" title={withheldWords(capability, t).title} density="portal" locale={locale}>
        {withheldWords(capability, t).text}
      </Banner>
    );
  }
  if (code === "DISCLOSURE_VERSION_NOT_EFFECTIVE") {
    return (
      <Banner family="attention" title={t("eng.refusal.DISCLOSURE_VERSION_NOT_EFFECTIVE.title")} density="portal" locale={locale}>
        {t("eng.refusal.DISCLOSURE_VERSION_NOT_EFFECTIVE.text")}
      </Banner>
    );
  }
  return outcome.failure !== null ? <LoadFailure failure={outcome.failure} errTitle={t("eng02.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="portal" /> : null;
}

function Balance({
  data,
  portal,
  asked,
  frame,
  t,
  locale,
}: {
  data: BalanceView;
  portal: ParticipantPortal;
  /** An as-at refused as in the future: what was typed, and the latest instant the refusal named. */
  asked: { raw: string | null; latest: string | null } | null;
  frame: Frame;
  t: Translate;
  locale: Locale;
}) {
  const phone = frame === "phone";
  const disclosure = locale === "vi" ? data.disclosure.textVi : data.disclosure.textEn;
  const parts = fieldParts(data.asAt);
  const typed = asked !== null && asked.raw !== null ? fieldParts(readInstant(asked.raw) ?? asked.raw) : parts;
  const refusal = asked !== null ? `${refusalSentence("AS_AT_IN_FUTURE", t)}${asked.latest !== null ? ` ${t("eng.named.latest", { ts: moment(asked.latest, locale) })}` : ""}` : null;
  return (
    <>
      <Panel title={t("eng02.figureTitle")} level={2} density="portal" locale={locale}>
        <Text size="lg" weight="semibold">
          {derived(data.points, data.eventCount, t, locale)}
        </Text>
        {data.asAt !== null ? (
          <Text size="sm" tone="secondary">
            {t("eng02.asAtLine", { ts: moment(data.computedAt, locale) })}
          </Text>
        ) : null}
        {data.negative ? <Text size="sm">{t("eng02.negative")}</Text> : null}
        <Text size="sm" tone="secondary" measure="2xl">
          {disclosure} {t("eng02.disclosureLine", { n: data.disclosure.no, decision: data.disclosure.reservingDecision })}
        </Text>
      </Panel>
      <Panel title={t("eng02.historyTitle")} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        <form action={portal.balance()} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--space-3)" }}>
          <DateField
            label={t("eng02.asAt")}
            helper={t("eng02.asAtHelp")}
            name="as_at"
            {...(typed.date !== "" ? { value: typed.date, time: typed.time } : {})}
            withTime
            {...(refusal !== null ? { error: refusal } : {})}
            density="portal"
            width="var(--container-xs)"
            locale={locale}
          />
          <Button type="submit" variant="secondary" size={phone ? "lg" : "md"} fullWidth={phone} locale={locale}>
            {t("eng02.apply")}
          </Button>
          {data.asAt !== null ? (
            <Button variant="quiet" size={phone ? "lg" : "md"} href={portal.balance()} fullWidth={phone} locale={locale}>
              {t("eng02.now")}
            </Button>
          ) : null}
        </form>
        <Table
          columns={[
            { key: "recorded", label: t("eng02.cDate"), kind: "datetime" },
            { key: "what", label: t("eng02.cWhat"), kind: "stack" },
            { key: "points", label: t("eng02.cPoints"), kind: "stack", align: "end" },
            { key: "open", label: t("eng02.cOpen"), kind: "actions" },
          ]}
          rows={data.history.rows.map((row) => historyRow(row, portal, t, locale))}
          density="portal"
          layout={phone ? "cards" : "table"}
          caption={t("eng02.historyTitle")}
          empty={{ variant: "governed", title: t("eng02.emptyTitle"), ...(data.noPremisesAction ? { text: t("eng02.emptyPremises") } : {}), action: false }}
          locale={locale}
        />
        {data.history.total > 0 ? (
          <Pagination
            summary={t("eng.showing", { shown: count(data.history.shownTo, locale), total: count(data.history.total, locale) })}
            hasNext={data.history.next !== null}
            {...(data.history.next !== null ? { nextHref: portal.balance({ asAt: data.asAt, after: data.history.next }) } : {})}
            hasPrev={data.history.shownTo > data.history.rows.length}
            {...(data.history.shownTo > data.history.rows.length ? { firstHref: portal.balance({ asAt: data.asAt }) } : {})}
            density="portal"
            locale={locale}
          />
        ) : null}
      </Panel>
    </>
  );
}

/** A history row: when, what it was for, the signed value with its sign in words, and whether it corrects or is corrected. */
function historyRow(row: LedgerRow, portal: ParticipantPortal, t: Translate, locale: Locale) {
  const note =
    row.correctedBy !== null
      ? t("eng02.correctedOn", { d: moment(row.correctedBy.recordedAt, locale) })
      : row.kind === "correction"
        ? t("eng02.isCorrection")
        : row.occurredAt !== null
          ? t("eng02.occurred", { ts: moment(row.occurredAt, locale) })
          : undefined;
  return {
    _key: row.id,
    recorded: row.recordedAt,
    what: { text: rowWords(row, t, locale), ...(note !== undefined ? { detail: note } : {}) },
    points: { text: signed(row.points, locale), detail: t(row.points < 0 ? "eng02.minus" : "eng02.plus"), num: true },
    open: [{ label: t("eng02.open"), ariaLabel: t("eng02.openAria", { event: row.id }), href: portal.event(row.id), variant: "quiet" as const }],
  };
}
