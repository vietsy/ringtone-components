import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Button, ButtonRow, EmptyState, FactList, PageHeader, Panel, Select, Skeleton, Table, ViewState } from "@/components/r1";
import { artistNav } from "@/components/shells/artist-nav";
import { PortalShell } from "@/components/shells/PortalShell";
import { Text } from "@/components/Text";
import { loadArtistGeography, type ArtistGeographyPage, type GeographyAnswer, type GeographyAsk, type GeographyPeriod } from "@/lib/api/artist-geography";
import { requireArtist } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { GEOGRAPHY_VIEWS } from "@/lib/mock/artist-geography";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import en from "@/messages/screens/art.en.json";
import vi from "@/messages/screens/art.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" ? value.trim() : "");

const count = (value: number, locale: Locale) => R1_FORMAT.formatCount(value, locale) ?? "";
const moment = (iso: string, locale: Locale) => R1_FORMAT.formatTimestamp(iso, locale) ?? "";
const span = (period: GeographyPeriod, locale: Locale) => R1_FORMAT.formatPeriod(period.from, period.to, locale) ?? "";

/** A released figure is positive, a suppressed one a fact rather than a fault, a refusal attention. */
const OUTCOME_FAMILY = { RELEASE: "positive", SUPPRESS: "neutral", REFUSE: "attention" } as const;

/**
 * Where the artist's works were used, as `GET /reporting/artist-geography` answers it (`FR-DAT-012`, `037`, `038`). No
 * board draws an artist's location view: it is built from DAT's specification and refusal wording on the participant
 * portal's pattern. The artist asks one province, the level of detail and a period; the answer is the plays of their
 * works aggregated to the level the geography policy and their disclosure basis permit, with the basis stated. A
 * figure for too few venues is suppressed and says so, never zero and never "no use"; a figure that, beside one they
 * already hold, would disclose a single venue is refused naming the scope it was compared with; which venue it was is
 * never told, the request recorded and the view kept at the level permitted. Every answer is recorded, and the answers
 * the artist was given are listed beneath.
 */
export default async function ArtistGeographyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const artist = await requireArtist();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, GEOGRAPHY_VIEWS);
  const area = text(params.area);
  const asked: GeographyAsk | null = area !== "" ? { area, level: text(params.level) || "province", period: text(params.period) || "2026-Q3", identify: text(params.identify) === "yes" } : null;
  const outcome = view === "loading" ? null : await loadArtistGeography(artist, asked, view === "error" ? view : null);
  const data = outcome?.data ?? null;
  const phone = frame === "phone";

  return (
    <PortalShell fill layout={phone ? "phone" : "desktop"} nav={artistNav("geography", frame, locale)} account={artist.account} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader title={t("art.geo.title")} meta={t("art.geo.meta", { name: artist.account })} locale={locale} />
        <Text size="base" measure="2xl">
          {t("art.geo.intro")}
        </Text>
        {view === "loading" ? (
          <Panel density="portal" locale={locale}>
            <Skeleton variant="facts" rows={3} density="portal" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure ? (
          outcome.failure.code === "INTERNAL_ERROR" || outcome.failure.code === "SERVICE_NOT_CONFIGURED" ? (
            <ViewState
              view="error"
              errorTitle={t("art.geo.errTitle")}
              errorText={t("art.geo.errText")}
              {...(outcome.failure.traceId !== null ? { traceId: outcome.failure.traceId } : {})}
              retryable={outcome.failure.retryable}
              level={2}
              density="portal"
              locale={locale}
            />
          ) : (
            <ViewState view="refused" refusal={{ code: outcome.failure.code, title: t("art.geo.askAgain"), family: "neutral" }} level={2} density="portal" locale={locale} />
          )
        ) : null}
        {data !== null ? <Geography data={data} asked={asked} phone={phone} t={t} locale={locale} /> : null}
      </div>
    </PortalShell>
  );
}

const levelWords = (level: string, t: Translate) => (level === "province" || level === "ward" ? t(`art.geo.level.${level}`) : level);

function Geography({ data, asked, phone, t, locale }: { data: ArtistGeographyPage; asked: GeographyAsk | null; phone: boolean; t: Translate; locale: Locale }) {
  const size = phone ? "lg" : "md";
  const { terms } = data;
  return (
    <>
      <Panel title={t("art.geo.askTitle")} level={2} density="portal" locale={locale}>
        <form action={routes.artistGeography()} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <Select
            label={t("art.geo.area")}
            name="area"
            options={data.areas.map((area) => ({ value: area.code, label: area.name }))}
            value={asked?.area ?? data.areas[0]?.code ?? ""}
            required
            density="portal"
            width="var(--container-xs)"
            locale={locale}
          />
          <Select
            label={t("art.geo.period")}
            name="period"
            options={data.periods.map((period) => ({ value: period.code, label: t(`art.geo.period.${period.code}`) }))}
            value={asked?.period ?? data.periods[0]?.code ?? ""}
            required
            density="portal"
            width="var(--container-xs)"
            locale={locale}
          />
          <Select
            label={t("art.geo.levelLabel")}
            helper={t("art.geo.levelHelp", { level: levelWords(terms.defaultLevel, t) })}
            name="level"
            options={data.levels.map((level) => ({ value: level, label: levelWords(level, t) }))}
            value={asked?.level ?? terms.defaultLevel}
            required
            density="portal"
            width="var(--container-xs)"
            locale={locale}
          />
          <ButtonRow>
            <Button type="submit" variant="primary" size={size} icon="search" fullWidth={phone} locale={locale}>
              {t("art.geo.show")}
            </Button>
          </ButtonRow>
        </form>
        <Text size="sm" tone="secondary" measure="2xl">
          {t("art.geo.policy", { n: terms.version, level: levelWords(terms.defaultLevel, t), min: count(terms.minimum, locale) })}
        </Text>
      </Panel>
      {data.identityRefused !== null ? (
        <Banner family="attention" title={t("art.geo.reason.PREMISES_IDENTITY_NOT_DISCLOSABLE")} code="PREMISES_IDENTITY_NOT_DISCLOSABLE" live density="portal" locale={locale}>
          <Text>{t("art.geo.identityText")}</Text>
          <Text size="sm">{t("art.geo.recordedAt", { ts: moment(data.identityRefused.at, locale) })}</Text>
        </Banner>
      ) : null}
      {data.answer !== null ? <Answer answer={data.answer} phone={phone} t={t} locale={locale} /> : null}
      <Panel title={t("art.geo.releasedTitle")} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        <Table
          columns={[
            { key: "at", label: t("art.geo.cAt"), kind: "datetime" },
            { key: "scope", label: t("art.geo.cScope"), kind: "stack" },
            { key: "level", label: t("art.geo.cLevel") },
            { key: "outcome", label: t("art.geo.cOutcome"), kind: "status" },
          ]}
          rows={data.released.map((release, index) => ({
            _key: `${release.recordedAt}-${String(index)}`,
            at: release.recordedAt,
            scope: { text: release.area.name, detail: t(`art.geo.period.${release.period.code}`) },
            level: levelWords(release.requestedLevel, t),
            outcome: { family: OUTCOME_FAMILY[release.outcome], label: t(`art.geo.outcome.${release.outcome}`) },
          }))}
          density="portal"
          layout={phone ? "cards" : "table"}
          caption={t("art.geo.releasedTitle")}
          empty={{ variant: "governed", title: t("art.geo.releasedEmpty"), action: false }}
          locale={locale}
        />
      </Panel>
    </>
  );
}

/** The answer to what was asked: the figure with its level and basis, the suppression said as such, or the refusal. */
function Answer({ answer, phone, t, locale }: { answer: GeographyAnswer; phone: boolean; t: Translate; locale: Locale }) {
  const title = t("art.geo.answerTitle", { area: answer.area.name, period: t(`art.geo.period.${answer.period.code}`) });
  const status = { family: OUTCOME_FAMILY[answer.outcome], label: t(`art.geo.outcome.${answer.outcome}`) };
  if (answer.outcome === "REFUSE") {
    const named =
      answer.reason === "LEVEL_NOT_PERMITTED"
        ? t("art.geo.approvedLevels", { levels: answer.terms.permittedLevels.map((level) => levelWords(level, t)).join(", ") })
        : answer.compared !== null
          ? t("art.geo.compared", { area: answer.compared.area.name, period: t(`art.geo.period.${answer.compared.period.code}`) })
          : null;
    return (
      <Banner family="attention" title={t(`art.geo.reason.${answer.reason}`)} code={answer.reason} live density="portal" locale={locale}>
        {named !== null ? <Text size="sm">{named}</Text> : null}
        <Text size="sm">{t("art.geo.recordedAt", { ts: moment(answer.recordedAt, locale) })}</Text>
      </Banner>
    );
  }
  if (answer.outcome === "SUPPRESS") {
    return (
      <Panel title={title} level={2} status={status} density="portal" locale={locale}>
        <EmptyState variant="governed" title={t("art.geo.suppressedTitle")} level={3} density="portal" locale={locale}>
          {t("art.geo.reason.GEOGRAPHY_BELOW_MINIMUM")}
        </EmptyState>
      </Panel>
    );
  }
  const basis =
    answer.basis !== null
      ? t("art.geo.basisFiner", { ref: answer.basis.ref, level: levelWords(answer.basis.level, t) })
      : t(answer.reason === "BASIS_NOT_EFFECTIVE" ? "art.geo.basisFallback" : "art.geo.basisDefault");
  return (
    <Panel title={title} level={2} status={status} density="portal" locale={locale}>
      <FactList
        density="portal"
        locale={locale}
        items={[
          { label: t("art.geo.fPlays"), value: t("art.geo.playsValue", { n: count(answer.plays ?? 0, locale) }) },
          { label: t("art.geo.fLevel"), value: levelWords(answer.level ?? answer.terms.defaultLevel, t) },
          { label: t("art.geo.fPeriod"), value: span(answer.period, locale) },
          { label: t("art.geo.fBasis"), value: basis, ...(answer.reason === "AT_MINIMUM_INCLUSIVE" ? { note: t("art.geo.atMinimum") } : {}) },
        ]}
      />
      {answer.reason === "BASIS_NOT_EFFECTIVE" ? <Text size="sm">{t(answer.lapsedBasis !== null ? "art.geo.basisLapsed" : "art.geo.basisNone", { level: levelWords(answer.requestedLevel, t) })}</Text> : null}
      {answer.children.length > 0 ? (
        <Table
          columns={[
            { key: "area", label: t("art.geo.cArea") },
            { key: "plays", label: t("art.geo.fPlays"), kind: "stack", align: "end" },
          ]}
          rows={answer.children.map((child) => ({
            _key: child.area.code,
            area: child.area.name,
            plays: child.suppressed ? { text: t("art.geo.outcome.SUPPRESS"), detail: t("art.geo.childSuppressed") } : { text: count(child.plays ?? 0, locale), num: true },
          }))}
          density="portal"
          layout={phone ? "cards" : "table"}
          caption={t("art.geo.childrenTitle")}
          locale={locale}
        />
      ) : null}
      <Text size="sm" tone="secondary" measure="2xl">
        {t("art.geo.noVenue")}
      </Text>
      <form action={routes.artistGeography()}>
        <input type="hidden" name="area" value={answer.area.code} />
        <input type="hidden" name="level" value={answer.requestedLevel} />
        <input type="hidden" name="period" value={answer.period.code} />
        <input type="hidden" name="identify" value="yes" />
        <ButtonRow>
          <Button type="submit" variant="secondary" size={phone ? "lg" : "md"} fullWidth={phone} locale={locale}>
            {t("art.geo.whichVenue")}
          </Button>
        </ButtonRow>
      </form>
    </Panel>
  );
}
