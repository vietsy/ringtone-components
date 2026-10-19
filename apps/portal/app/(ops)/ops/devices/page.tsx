import { Banner, Button, Combobox, PageHeader, Pagination, SearchField, Select, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { certificationCell, count, day, deviceStatus, moment, plropsTranslator, sessionStatus } from "@/features/player-ops/copy";
import { Failure } from "@/features/player-ops/Failure";
import { LinkFilter } from "@/features/player-ops/LinkFilter";
import { ShortcutButton } from "@/features/player-ops/ShortcutButton";
import { DEVICE_STATUSES, loadDeviceEstate, type DeviceEstate, type EstateFilter, type EstateRow } from "@/lib/api/player";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PLR01_VIEWS } from "@/lib/mock/player";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
/** The rows the skeleton draws while the estate is read. */
const LOADING_ROWS = 8;

/** The filter in the address, so a link or a reload keeps it. */
function filterOf(params: SearchParams): EstateFilter {
  const status = one(params.status);
  return {
    device: one(params.device),
    premises: one(params.premises_id),
    status: DEVICE_STATUSES.find((candidate) => candidate === status) ?? null,
    supplier: one(params.supplier),
  };
}

/**
 * SCR-PLR-01 Device estate, the Player devices workspace's landing: every enrolled device with its condition, its
 * playback as last reported, its supplier's certification and the evidence it holds, soonest certification end first.
 * A device whose certification ended stays listed with the word, and a banner says its evidence is not accepted.
 */
export default async function DeviceEstatePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS");
  const params = await searchParams;
  const locale = await getLocale();
  const t = plropsTranslator(locale);
  const view = reviewView(params, PLR01_VIEWS);
  const criteria = filterOf(params);
  const outcome = view === "loading" ? null : await loadDeviceEstate(staff, criteria, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame
      console="operations"
      current="devices"
      staff={staff}
      searchLabel={t("plrops.search")}
      keyMap={[
        { keys: ["J", "K"], label: t("plr01.kRows") },
        { keys: ["Enter"], label: t("plr01.kOpen") },
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("plrops.area") }, { label: t("plr01.title") }]}
          title={t("plr01.title")}
          {...(data !== null ? { meta: estateMeta(data, t, locale) } : {})}
          locale={locale}
        >
          <Button variant="quiet" size="sm" href={routes.ops()} locale={locale}>
            {t("plrops.close")}
          </Button>
          <ShortcutButton variant="primary" size="sm" icon="plus" shortcut="Alt+N" href={routes.opsEnrolDevice()} locale={locale}>
            {t("plr01.enrol")}
          </ShortcutButton>
        </PageHeader>
        {failure !== null ? (
          <Failure failure={failure} errorText={t("plr01.errText")} prefix="plrops" t={t} locale={locale} />
        ) : data !== null && data.total === 0 ? (
          <ViewState view="empty" empty={{ variant: "not-started", title: t("plr01.emptyTitle"), text: t("plr01.emptyText") }} density="console" level={2} locale={locale} />
        ) : (
          <Estate data={data} criteria={criteria} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

/** "11 thiết bị: 8 đang hoạt động, 1 mới đăng ký, ... Cập nhật lúc ...": the states the estate holds, in SM-200's order. */
function estateMeta(data: DeviceEstate, t: Translate, locale: Locale): string {
  const parts = DEVICE_STATUSES.filter((status) => (data.counts[status] ?? 0) > 0).map((status) => t(`plr01.count.${status}`, { n: count(data.counts[status] ?? 0, locale) }));
  return t("plr01.meta", { n: count(data.total, locale), parts: parts.join(", "), u: moment(data.asOf, locale) });
}

function Estate({ data, criteria, t, locale }: { data: DeviceEstate | null; criteria: EstateFilter; t: Translate; locale: Locale }) {
  const rows = data?.rows ?? [];
  const premises = data?.premisesOptions.find((option) => option.id === criteria.premises) ?? null;
  const chips = [
    ...(criteria.device !== null ? [{ label: t("plr01.chipDevice", { s: criteria.device }), href: routes.opsDevices({ ...criteria, device: null }) }] : []),
    ...(premises !== null ? [{ label: t("plr01.chipPremises", { s: premises.name }), href: routes.opsDevices({ ...criteria, premises: null }) }] : []),
    ...(criteria.status !== null ? [{ label: t("plr01.chipStatus", { s: t(`plrops.status.${criteria.status}`) }), href: routes.opsDevices({ ...criteria, status: null }) }] : []),
    ...(criteria.supplier !== null ? [{ label: t("plr01.chipSupplier", { s: criteria.supplier }), href: routes.opsDevices({ ...criteria, supplier: null }) }] : []),
  ];
  const total = data?.total ?? 0;
  return (
    <>
      {(data?.expired ?? []).map((entry) => (
        <Banner
          key={entry.device}
          family="attention"
          title={t("plr01.bannerTitle", { device: entry.device, supplier: entry.supplier, d: day(entry.on, locale) })}
          code="DEVICE_NOT_CERTIFIED"
          density="console"
          locale={locale}
        >
          {t("plrops.refusal.DEVICE_NOT_CERTIFIED")}
        </Banner>
      ))}
      <form method="get" action={routes.opsDevices()} style={{ display: "contents" }}>
        <LinkFilter
          chips={chips}
          clearHref={routes.opsDevices()}
          summary={chips.length > 0 && data !== null ? t("plr01.summary", { a: count(rows.length, locale), b: count(total, locale) }) : null}
          label={t("plr01.filters")}
          locale={locale}
        >
          <SearchField label={t("plr01.find")} name="device" {...(criteria.device !== null ? { value: criteria.device } : {})} density="console" width="var(--space-60)" locale={locale} />
          <Combobox
            wrap
            label={t("plr01.fPremises")}
            name="premises_id"
            options={(data?.premisesOptions ?? []).map((option) => ({ value: option.id, label: option.name }))}
            {...(criteria.premises !== null ? { value: criteria.premises } : {})}
            placeholder={t("plr01.allPremises")}
            density="console"
            width="var(--space-64)"
            locale={locale}
          />
          <Select
            label={t("plr01.fStatus")}
            name="status"
            options={[{ value: "", label: t("plr01.all") }, ...DEVICE_STATUSES.map((status) => ({ value: status, label: t(`plrops.status.${status}`) }))]}
            value={criteria.status ?? ""}
            density="console"
            width="var(--space-48)"
            locale={locale}
          />
          <Select
            label={t("plr01.fSupplier")}
            name="supplier"
            options={[{ value: "", label: t("plr01.all") }, ...(data?.suppliers ?? []).map((supplier) => ({ value: supplier, label: supplier }))]}
            value={criteria.supplier ?? ""}
            density="console"
            width="var(--space-48)"
            locale={locale}
          />
          <Button variant="secondary" size="sm" type="submit" locale={locale}>
            {t("plr01.show")}
          </Button>
        </LinkFilter>
      </form>
      <Table
        columns={[
          { key: "id", label: t("plr01.cDevice"), kind: "id" },
          { key: "prem", label: t("plr01.cPremises"), minWidth: "var(--space-48)" },
          { key: "cond", label: t("plr01.cStatus"), kind: "status" },
          { key: "sess", label: t("plr01.cSession"), kind: "status", missing: t("plr01.noSession") },
          { key: "cert", label: t("plr01.cCert"), kind: "status", missing: t("plr01.noCert") },
          { key: "wait", label: t("plr01.cWaiting"), kind: "count", align: "end", help: t("plr01.waitHelp") },
          { key: "held", label: t("plr01.cHeld"), kind: "count", align: "end", help: t("plr01.heldHelp") },
          { key: "seen", label: t("plr01.cSeen"), unit: "GMT+7", kind: "stamp", priority: "low" },
        ]}
        rows={rows.map((row) => estateRow(row, t, locale))}
        density="console"
        caption={t("plr01.title")}
        rowFocus
        {...(rows.length > 0 ? { sortNote: t("plr01.sortNote") } : {})}
        loading={data === null ? LOADING_ROWS : false}
        empty={{ variant: "filtered", title: t("plr01.filteredTitle"), text: t("plr01.filteredText", { n: count(total, locale) }), action: false }}
        locale={locale}
      />
      {rows.length > 0 && (
        <Pagination
          summary={rows.length === 1 ? t("plr01.pagerOne") : t("plr01.pager", { n: count(rows.length, locale) })}
          hasPrev={false}
          hasNext={false}
          density="console"
          label={t("plr01.pages")}
          locale={locale}
        />
      )}
    </>
  );
}

/** One device: its reference opens its record; a device whose evidence is quarantined says so without colour alone. */
function estateRow(row: EstateRow, t: Translate, locale: Locale): Record<string, unknown> {
  return {
    _key: row.id,
    _href: routes.opsDevice(row.id),
    ...((row.status === "LOST" || row.status === "COMPROMISED") && row.held > 0 ? { _quarantined: true } : {}),
    id: row.id,
    prem: row.premises.name,
    cond: deviceStatus(row.status, t),
    sess: row.session === null ? null : sessionStatus(row.session, t),
    cert: row.certification === null ? null : certificationCell(row.certification, t, locale),
    wait: row.waiting,
    held: row.held,
    seen: row.lastContact,
  };
}
