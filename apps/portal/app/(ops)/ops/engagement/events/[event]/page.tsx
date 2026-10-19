import { PageHeader, Panel, Skeleton } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { actorName, engTranslator, moment } from "@/features/engagement/copy";
import { EventDetail } from "@/features/engagement/EventDetail";
import { LoadFailure } from "@/features/engagement/Refusals";
import { loadLedgerEvent } from "@/lib/api/engagement";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-ENG-04 One ledger event, opened by an operations officer from SCR-ENG-10 under the support read they recorded:
 * the read is in the address, and an event of a participant the read was not for, or a read that is not the reader's,
 * is refused PARTICIPANT_NOT_SELF without naming whose it is. The same body the participant reads.
 */
export default async function SupportEventPage({ params, searchParams }: { params: Promise<{ event: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-MKT-OP", "ACT-BIZ-APR", "ACT-REP", "ACT-AUD");
  const [{ event: id }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = engTranslator(locale);
  const view = reviewView(query, ENG_VIEWS);
  const read = typeof query.read === "string" ? query.read : null;
  const outcome = view === "loading" ? null : await loadLedgerEvent({ staff, read }, id, view);
  const event = outcome?.data ?? null;
  const back = read !== null ? routes.opsEngagementSupport({ read, event: id }) : routes.opsEngagementSupport();

  return (
    <OpsFrame console="operations" current="engagement" staff={staff} searchLabel={t("engOps.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("engHome.title"), href: routes.opsEngagement() },
            { label: t("eng10.title"), href: back },
          ]}
          title={t("eng04.title")}
          {...(event !== null ? { meta: t("eng04.meta", { ts: moment(event.recordedAt, locale), by: actorName(event.recordedBy, t) }) } : {})}
          locale={locale}
        />
        {view === "loading" ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="facts" rows={7} density="console" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure ? <LoadFailure failure={outcome.failure} errTitle={t("eng04.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="console" /> : null}
        {event !== null && read !== null ? (
          <EventDetail
            event={event}
            eventHref={(other) => routes.opsEngagementEvent(other, read)}
            back={{ href: back, label: t("eng04.backSupport") }}
            density="console"
            t={t}
            locale={locale}
          />
        ) : null}
      </div>
    </OpsFrame>
  );
}
