import { Button, PageHeader, Panel, Select, Table, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { count, day, moment, plropsTranslator, said } from "@/features/player-ops/copy";
import { Failure } from "@/features/player-ops/Failure";
import { LinkFilter } from "@/features/player-ops/LinkFilter";
import { loadAcceptance, type AcceptanceView, type BatchView, type OutcomeKind } from "@/lib/api/player";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PLR07_VIEWS } from "@/lib/mock/player";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** An outcome in words and shape: a quarantined event is held, never refused, and a refusal is not drawn as a crash. */
const OUTCOME: Readonly<Record<OutcomeKind, "positive" | "neutral" | "attention" | "danger">> = {
  ACCEPTED: "positive",
  DUPLICATE: "neutral",
  QUARANTINED: "attention",
  BELOW_THRESHOLD: "neutral",
  REFUSED: "neutral",
};

/**
 * SCR-PLR-07 Evidence acceptance, the evidence console's landing: the latest batch a device sent, the outcome of every
 * event in it, and the events quarantined rather than refused, retained and attributable until a disposition releases
 * or excludes them. The device is chosen above; one that has sent nothing yet says since when. The auditor reads it too
 * (PERM-484) and opens the device's record from it.
 */
export default async function EvidenceAcceptancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-EVD", "ACT-AUD");
  // PERM-472: the device record is the operations officer's and the auditor's to read.
  const recordReader = staff.roles.includes("ACT-OPS") || staff.roles.includes("ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = plropsTranslator(locale);
  const view = reviewView(params, PLR07_VIEWS);
  const asked = typeof params.device === "string" && params.device !== "" ? params.device : null;
  const outcome = view === "loading" ? null : await loadAcceptance(staff, asked, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const batch = data?.batch ?? null;
  const held = batch?.held.length ?? 0;

  return (
    <OpsFrame
      console="evidence"
      current="acceptance"
      staff={staff}
      searchLabel={t("plrops.evSearch")}
      keyMap={held > 0 ? [{ keys: ["J", "K"], label: t("plr07.kHeld") }] : []}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("plrops.evArea") }, { label: t("plr07.crumb"), href: routes.evidenceAcceptance() }, ...(data !== null ? [{ label: data.device.id }] : [])]}
          title={data !== null ? t("plr07.title", { d: data.device.id }) : t("plr07.crumb")}
          {...(data !== null && batch !== null ? { meta: batchMeta(data, batch, t, locale) } : {})}
          locale={locale}
        >
          {data !== null && recordReader ? (
            <Button variant="secondary" size="sm" href={routes.opsDevice(data.device.id)} locale={locale}>
              {t("plr07.openRecord")}
            </Button>
          ) : null}
          <Button variant="quiet" size="sm" href={routes.ops()} locale={locale}>
            {t("plrops.close")}
          </Button>
        </PageHeader>
        {view === "loading" ? <ViewState view="loading" skeleton="table" rows={6} density="console" locale={locale} /> : null}
        {failure !== null ? <Failure failure={failure} errorText={t("plr07.errText")} prefix="plrops" t={t} locale={locale} /> : null}
        {data !== null ? (
          <form method="get" action={routes.evidenceAcceptance()} style={{ display: "contents" }}>
            <LinkFilter chips={[]} clearHref={routes.evidenceAcceptance()} summary={null} label={t("plr07.filters")} locale={locale}>
              <Select
                label={t("plr07.fDevice")}
                name="device"
                options={data.devices.map((device) => ({ value: device.id, label: t("plr07.deviceOption", { d: device.id, p: device.premises }) }))}
                value={data.device.id}
                density="console"
                width="var(--space-96)"
                locale={locale}
              />
              <Button variant="secondary" size="sm" type="submit" locale={locale}>
                {t("plr07.show")}
              </Button>
            </LinkFilter>
          </form>
        ) : null}
        {data !== null && batch === null ? (
          <ViewState
            view="empty"
            empty={{ variant: "not-started", title: t("plr07.emptyTitle", { d: data.device.id, e: day(data.device.enrolledAt, locale) }), text: t("plr07.emptyText") }}
            density="console"
            level={2}
            locale={locale}
          />
        ) : null}
        {batch !== null ? <Batch batch={batch} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function batchMeta(data: AcceptanceView, batch: BatchView, t: Translate, locale: Locale): string {
  return t("plr07.meta", {
    n: count(batch.events, locale),
    a: count(batch.firstSequence, locale),
    b: count(batch.lastSequence, locale),
    p: data.device.premises.name,
    ts: moment(batch.receivedAt, locale),
    pv: batch.policyVersion,
    ev: batch.entitlementVersion,
  });
}

/** "+41 phút 8 giây": how far the device clock ran from the trusted time. */
function drift(seconds: number, t: Translate): string {
  const sign = seconds < 0 ? "−" : "+";
  const whole = Math.abs(seconds);
  return t("plr07.drift", { sign, m: Math.floor(whole / 60), s: whole % 60 });
}

function Batch({ batch, t, locale }: { batch: BatchView; t: Translate; locale: Locale }) {
  const held = batch.held;
  const disposition = batch.disposition ?? "";
  return (
    <>
      <Panel title={t("plr07.outcome")} level={2} density="console" locale={locale}>
        <Table
          columns={[
            { key: "r", label: t("plr07.cOutcome"), kind: "status" },
            { key: "n", label: t("plr07.cEvents"), kind: "count", align: "end" },
            { key: "why", label: t("plr07.cWhy") },
          ]}
          rows={batch.outcomes.map((row) => ({
            _key: row.kind,
            ...(row.kind === "QUARANTINED" ? { _quarantined: true } : {}),
            ...(row.code !== null ? { _message: { severity: "neutral", text: t(`plrops.refusal.${row.code}`), code: row.code } } : {}),
            r: { family: OUTCOME[row.kind], label: t(`plr07.kind.${row.kind}`) },
            n: row.count,
            why: said(row.why, locale),
          }))}
          totals={{ label: t("plr07.whole"), values: { n: batch.events } }}
          density="console"
          caption={t("plr07.outcome")}
          locale={locale}
        />
      </Panel>
      {held.length > 0 ? (
        <Panel
          title={t(held.length === 1 ? "plr07.heldTitleOne" : "plr07.heldTitle", { n: count(held.length, locale) })}
          description={t("plr07.heldText", { dsp: disposition })}
          level={2}
          density="console"
          locale={locale}
        >
          <Table
            columns={[
              { key: "ev", label: t("plr07.cEvent"), kind: "id" },
              { key: "dev", label: t("plr07.cDeviceTime"), unit: "GMT+7", kind: "stamp" },
              { key: "basis", label: t("plr07.cTrusted"), unit: "GMT+7", kind: "stamp" },
              { key: "drift", label: t("plr07.cDrift"), align: "end", nowrap: true, help: t("plr07.driftHelp") },
              { key: "s", label: t("plr07.cTreatment"), kind: "status" },
            ]}
            rows={held.map((event) => ({
              _key: event.event,
              _quarantined: true,
              ev: event.event,
              dev: event.deviceTime,
              basis: event.trustedTime,
              drift: drift(event.driftSeconds, t),
              s: { family: "attention", label: t("plr07.treat", { dsp: disposition }) },
            }))}
            density="console"
            caption={t(held.length === 1 ? "plr07.heldTitleOne" : "plr07.heldTitle", { n: count(held.length, locale) })}
            rowFocus
            locale={locale}
          />
        </Panel>
      ) : null}
    </>
  );
}
