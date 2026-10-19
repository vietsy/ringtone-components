import { Button, EmptyState, PageHeader, Table, ViewState } from "@/components/r1";
import { deviceCondition, plrTranslator } from "@/features/venue/copy";
import { LoadError, VenueShell } from "@/features/venue/Frame";
import { requirePrincipal } from "@/lib/api/session";
import { loadDevices } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import { DEVICES_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The Player devices of the premises the person acts for, each opening its venue view (SCR-PLR-04, or SCR-PLR-05 once
 * its offline limit ran out), and the way to issue a pairing code for another (SCR-IAM-06). No board draws this
 * list: it is the portal's way to the device screens, laid out as the Player landing is.
 */
export default async function DevicesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = plrTranslator(locale);
  const view = reviewView(params, DEVICES_VIEWS);
  const outcome = view === "loading" ? null : await loadDevices(principal, view);
  const devices = outcome?.data ?? null;
  const phone = frame === "phone";

  return (
    <VenueShell account={principal.account} frame={frame} locale={locale} context={{ premises: principal.party, period: t("plr.role"), label: t("plr.actingFor") }}>
      <PageHeader crumbs={[{ label: t("plr.crumb"), href: routes.player() }]} title={t("devices.title")} meta={t("devices.meta")} locale={locale}>
        <Button variant="primary" size="md" icon="smartphone" href={routes.playerPairing()} fullWidth={phone} locale={locale}>
          {t("devices.pair")}
        </Button>
      </PageHeader>
      {outcome !== null && outcome.failure !== null ? <LoadError failure={outcome.failure} locale={locale} /> : null}
      {view === "loading" ? <ViewState view="loading" skeleton={phone ? "card" : "table"} rows={4} density="portal" locale={locale} /> : null}
      {devices !== null && devices.length === 0 ? (
        <EmptyState variant="not-started" title={t("devices.emptyTitle")} level={2} action={false} density="portal" locale={locale}>
          {t("devices.emptyText")}
        </EmptyState>
      ) : null}
      {devices !== null && devices.length > 0 ? (
        <Table
          columns={[
            { key: "device", label: t("devices.cDevice"), kind: "stack" },
            { key: "premises", label: t("devices.cPremises"), kind: "strong" },
            { key: "state", label: t("devices.cState"), kind: "status" },
            { key: "asOf", label: t("devices.cAsOf"), kind: "stamp", nowrap: true },
          ]}
          rows={devices.map((device) => ({
            _key: device.id,
            _href: routes.playerDevice(device.id),
            device: { text: device.id, mono: true, ...(device.name !== null ? { detail: device.name } : {}) },
            premises: device.premises.name,
            state: deviceCondition(device, t),
            asOf: device.asOf,
          }))}
          layout={phone ? "cards" : "table"}
          density="portal"
          caption={t("devices.title")}
          locale={locale}
        />
      ) : null}
    </VenueShell>
  );
}
