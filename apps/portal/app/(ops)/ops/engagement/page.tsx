import { NavList, PageHeader, Panel, Skeleton, StatusLine, Table } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { actorName, capabilityStatus, classWords, engTranslator, moment, signed } from "@/features/engagement/copy";
import { LoadFailure } from "@/features/engagement/Refusals";
import { loadEngagementHome, type EngagementHomeView } from "@/lib/api/engagement";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The engagement workspace's home on the operations console: the "operations portal home" SCR-ENG-08, 10 and 12 open
 * from, which ENG's inventory names and no screen specifies. The capability's state in words, the screens the
 * reader's roles open, and the corrections waiting for a second person, the one way the business approver, who reads
 * no support view, reaches SCR-ENG-09.
 */
export default async function EngagementHomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-MKT-OP", "ACT-BIZ-APR", "ACT-REP", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = engTranslator(locale);
  const view = reviewView(params, ENG_VIEWS);
  const outcome = view === "loading" ? null : await loadEngagementHome(staff, view);

  return (
    <OpsFrame console="operations" current="engagement" staff={staff} searchLabel={t("engOps.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader title={t("engHome.title")} meta={t("engHome.meta", { name: staff.account, position: staff.position })} locale={locale} />
        {view === "loading" ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="facts" rows={3} density="console" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure ? <LoadFailure failure={outcome.failure} errTitle={t("engHome.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="console" /> : null}
        {outcome?.data ? <Home data={outcome.data} staff={staff} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Home({ data, staff, t, locale }: { data: EngagementHomeView; staff: Staff; t: Translate; locale: Locale }) {
  const { capability } = data;
  const status = capabilityStatus(capability.state, t);
  const screens = [
    ...(holds(staff, "ACT-BIZ-APR", "ACT-OPS", "ACT-AUD") ? [{ label: t("eng12.title"), href: routes.opsEngagementRelease(), icon: "shield-check", detail: t("engHome.d12") }] : []),
    ...(holds(staff, "ACT-MKT-OP") ? [{ label: t("eng08.title"), href: routes.opsQualifyingAction(), icon: "plus", detail: t("engHome.d08") }] : []),
    ...(holds(staff, "ACT-OPS") ? [{ label: t("eng10.title"), href: routes.opsEngagementSupport(), icon: "search", detail: t("engHome.d10") }] : []),
    ...(holds(staff, "ACT-REP", "ACT-AUD") ? [{ label: t("eng11.title"), href: routes.opsEngagementMetrics(), icon: "chart-column", detail: t("engHome.d11") }] : []),
    ...(holds(staff, "ACT-AUD") ? [{ label: t("engAssure.title"), href: routes.opsEngagementAssurance(), icon: "history", detail: t("engHome.dAssure") }] : []),
  ];
  return (
    <>
      <Panel title={t("engHome.capabilityTitle")} level={2} status={status} density="console" locale={locale}>
        <StatusLine
          family={status.family}
          text={
            capability.state === "WITHHELD"
              ? t(capability.withheld === "withdrawn" ? "engHome.withdrawn" : "engHome.withheld")
              : t("engHome.released", { classes: classWords(capability.scope, t), ts: moment(capability.effectiveFrom ?? "", locale) })
          }
          locale={locale}
        />
      </Panel>
      <NavList label={t("engHome.screens")} items={screens} locale={locale} />
      {data.awaiting !== null ? (
        <Panel title={t("engHome.awaitingTitle")} level={2} compact density="console" locale={locale}>
          <Table
            columns={[
              { key: "id", label: t("engHome.cCorrection"), kind: "id" },
              { key: "participant", label: t("engHome.cParticipant"), kind: "stack" },
              { key: "event", label: t("engHome.cEvent"), kind: "mono" },
              { key: "delta", label: t("engHome.cDelta"), kind: "text", align: "end" },
              { key: "ground", label: t("engHome.cGround") },
              { key: "proposed", label: t("engHome.cProposed"), kind: "stack" },
            ]}
            rows={data.awaiting.map((correction) => ({
              _key: correction.id,
              _href: routes.opsCorrection(correction.id),
              id: correction.id,
              participant: { text: correction.participant.name, detail: correction.participant.ref, mono: false },
              event: correction.event,
              delta: signed(correction.delta, locale),
              ground: t(`eng.ground.${correction.ground}`),
              proposed: { text: actorName(correction.proposedBy, t), detail: moment(correction.proposedAt, locale) },
            }))}
            density="console"
            rowFocus
            caption={t("engHome.awaitingTitle")}
            empty={{ variant: "governed", title: t("engHome.awaitingEmpty"), action: false }}
            locale={locale}
          />
        </Panel>
      ) : null}
    </>
  );
}
