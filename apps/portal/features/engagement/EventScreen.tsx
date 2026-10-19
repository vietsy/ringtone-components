import { PageHeader, Panel, Skeleton } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { loadLedgerEvent } from "@/lib/api/engagement";
import { getLocale } from "@/lib/i18n/locale";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import { actorName, engTranslator, moment } from "./copy";
import { EventDetail } from "./EventDetail";
import type { ParticipantPortal } from "./participant";
import { LoadFailure } from "./Refusals";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-ENG-04 One ledger event, the participant's own, in the portal they read it in. No board or Figma frame draws it:
 * it is built from ENG's specification and wireframe. An event recorded while the capability was released stays
 * readable whatever its state now; another participant's event is refused without naming whose it is.
 */
export async function EventScreen({ portal, id, params }: { portal: ParticipantPortal; id: string; params: SearchParams }) {
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = engTranslator(locale);
  const view = reviewView(params, ENG_VIEWS);
  const outcome = view === "loading" ? null : await loadLedgerEvent({ participant: portal.who }, id, view);
  const event = outcome?.data ?? null;
  const phone = frame === "phone";

  return (
    <PortalShell fill layout={phone ? "phone" : "desktop"} nav={portal.nav(frame, locale)} account={portal.account} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("eng01.title"), href: portal.home },
            { label: t("eng02.title"), href: portal.balance() },
          ]}
          title={t("eng04.title")}
          {...(event !== null ? { meta: t("eng04.meta", { ts: moment(event.recordedAt, locale), by: actorName(event.recordedBy, t) }) } : {})}
          locale={locale}
        />
        {view === "loading" ? (
          <Panel density="portal" locale={locale}>
            <Skeleton variant="facts" rows={7} density="portal" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure ? <LoadFailure failure={outcome.failure} errTitle={t("eng04.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="portal" /> : null}
        {event !== null ? <EventDetail event={event} eventHref={portal.event} back={{ href: portal.balance(), label: t("eng04.back") }} density="portal" t={t} locale={locale} /> : null}
      </div>
    </PortalShell>
  );
}
