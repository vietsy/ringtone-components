import { R1_FORMAT } from "@rightone/formatting";
import { Button, DateField, FactList, PageHeader, Pagination, Panel, Select, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { count, day, plropsTranslator, said } from "@/features/player-ops/copy";
import { Failure } from "@/features/player-ops/Failure";
import { isoDate } from "@/features/player-ops/fields";
import { LinkFilter, SegmentLinks } from "@/features/player-ops/LinkFilter";
import { DECISION_KINDS, loadDecisions, type DecisionKind, type DecisionsView } from "@/lib/api/player";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PLR15_VIEWS } from "@/lib/mock/player";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

const KIND: Readonly<Record<DecisionKind, "positive" | "neutral" | "info">> = { FROM_SCHEDULE: "positive", FROM_DEFAULT_PLAYLIST: "neutral", CYCLE_RESTARTED: "info" };

/**
 * SCR-PLR-15 Playback decisions: what a device selected on one local day and under which rule-set version, from
 * player.playback_decisions. A cycle restart is recorded as its own decision, so it is told apart from a repeat; the
 * day exports with the version applied to each decision.
 */
export default async function PlaybackDecisionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-EVD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = plropsTranslator(locale);
  const view = reviewView(params, PLR15_VIEWS);
  const askedDay = one(params.day);
  const asked = { device: one(params.device), day: askedDay === null ? null : isoDate(askedDay), kind: one(params.kind) };
  const outcome = view === "loading" ? null : await loadDecisions(staff, asked, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const rows = data?.rows ?? [];

  return (
    <OpsFrame
      console="evidence"
      current="decisions"
      staff={staff}
      searchLabel={t("plrops.evSearch")}
      keyMap={rows.length > 0 ? [{ keys: ["J", "K"], label: t("plr15.kRows") }] : []}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("plrops.evArea") }, { label: t("plr15.crumb"), href: routes.evidenceDecisions() }, ...(data !== null ? [{ label: data.device }] : [])]}
          title={data !== null ? t("plr15.title", { d: data.device }) : t("plr15.crumb")}
          {...(data !== null && data.counts.ALL > 0 ? { meta: decisionsMeta(data, t, locale) } : {})}
          locale={locale}
        >
          <Button variant="quiet" size="sm" href={routes.ops()} locale={locale}>
            {t("plrops.close")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon="download"
            {...(data !== null && data.counts.ALL > 0 ? { href: routes.evidenceDecisionsExport(data.device, data.day) } : { disabled: true, disabledReason: t("plr15.exportNone") })}
            locale={locale}
          >
            {t("plr15.export")}
          </Button>
        </PageHeader>
        {view === "loading" ? <ViewState view="loading" skeleton="table" rows={7} density="console" locale={locale} /> : null}
        {failure !== null ? <Failure failure={failure} errorText={t("plr15.errText")} prefix="plrops" t={t} locale={locale} /> : null}
        {data !== null ? <Decisions data={data} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function decisionsMeta(data: DecisionsView, t: Translate, locale: Locale): string {
  const values = {
    p: data.premises.name,
    d: day(data.day, locale),
    n: count(data.counts.ALL, locale),
    e: data.eligibleTracks === null ? "" : count(data.eligibleTracks, locale),
    r: count(data.restarts, locale),
    k: count(data.repeatsBefore, locale),
  };
  if (data.counts.ALL === 1) return t("plr15.metaOne", values);
  return t(data.repeatsBefore === 0 ? "plr15.meta" : "plr15.metaRepeats", values);
}

function Decisions({ data, t, locale }: { data: DecisionsView; t: Translate; locale: Locale }) {
  const kinds = [
    { value: "ALL", label: t("plr15.all"), count: data.counts.ALL, href: routes.evidenceDecisions({ device: data.device, day: data.day }) },
    ...DECISION_KINDS.filter((kind) => data.counts[kind] > 0).map((kind) => ({
      value: kind,
      label: t(`plr15.kind.${kind}`),
      count: data.counts[kind],
      href: routes.evidenceDecisions({ device: data.device, day: data.day, kind }),
    })),
  ];
  return (
    <>
      <form method="get" action={routes.evidenceDecisions()} style={{ display: "contents" }}>
        <LinkFilter chips={[]} clearHref={routes.evidenceDecisions()} summary={null} label={t("plr15.filters")} locale={locale}>
          <Select
            label={t("plr15.fDevice")}
            name="device"
            options={data.devices.map((device) => ({ value: device.id, label: t("plr15.deviceOption", { d: device.id, p: device.premises }) }))}
            value={data.device}
            density="console"
            width="var(--space-96)"
            locale={locale}
          />
          <DateField label={t("plr15.fDay")} name="day" value={data.day} helper={false} density="console" width="var(--space-60)" locale={locale} />
          <Button variant="secondary" size="sm" type="submit" locale={locale}>
            {t("plr15.show")}
          </Button>
        </LinkFilter>
      </form>
      {data.counts.ALL === 0 ? (
        <ViewState view="empty" empty={{ variant: "not-started", title: t("plr15.emptyTitle"), text: t("plr15.emptyText") }} density="console" level={2} locale={locale} />
      ) : (
        <>
          <SegmentLinks label={t("plr15.kindF")} options={kinds} value={data.kind ?? "ALL"} density="console" locale={locale} />
          <Table
            columns={[
              { key: "at", label: t("plr15.cAt"), unit: "GMT+7", kind: "mono" },
              { key: "kind", label: t("plr15.cKind"), kind: "status" },
              { key: "track", label: t("plr15.cTrack"), kind: "strong" },
              { key: "src", label: t("plr15.cSource") },
            ]}
            rows={data.rows.map((row, index) => ({
              _key: `${row.at}-${index}`,
              ...(row.kind === "CYCLE_RESTARTED" ? { _tone: "info" } : {}),
              at: R1_FORMAT.formatTime(row.at) ?? "",
              kind: { family: KIND[row.kind], label: t(`plr15.kind.${row.kind}`) },
              track: said(row.title, locale),
              src: said(row.source, locale),
            }))}
            density="console"
            sort={{ key: "at", dir: "desc" }}
            sortNote={t("plr15.sortNote")}
            caption={t("plr15.tableCaption")}
            rowFocus
            locale={locale}
          />
          <Pagination
            summary={data.rows.length === 1 ? t("plr15.pagerOne") : t("plr15.pager", { n: count(data.rows.length, locale) })}
            hasPrev={false}
            hasNext={false}
            density="console"
            label={t("plr15.pages")}
            locale={locale}
          />
          <Panel title={t("plr15.rulesTitle")} level={2} density="console" locale={locale}>
            <FactList
              columns={2}
              items={[
                {
                  label: t("plr15.rLoudness"),
                  value: data.rules === null ? null : t("plr15.rLoudnessV", { v: data.rules.version, d: day(data.rules.effectiveFrom, locale) }),
                  missing: t("plr15.rNone"),
                  action: { label: t("plr15.rVersions"), href: routes.evidencePlaybackRules() },
                },
                { label: t("plr15.rOrder"), value: t("plr15.rOrderV") },
                { label: t("plr15.rRepeat"), value: t("plr15.rRepeatV") },
                { label: t("plr15.rRunOut"), value: t("plr15.rRunOutV") },
              ]}
              density="console"
              locale={locale}
            />
          </Panel>
        </>
      )}
    </>
  );
}
