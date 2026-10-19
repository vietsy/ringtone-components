import { Button, FactList, PageHeader, Panel, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { actsWords } from "@/features/parties/copy";
import { LimitationFacts } from "@/features/parties/LimitationFacts";
import { areaWords, classWords, day, licensingStatus, moment, premisesRefusal, premisesStatus, premisesTranslator } from "@/features/parties/premises-copy";
import { PremisesTimeline } from "@/features/parties/PremisesTimeline";
import { loadPortalPremises, type PortalPremises } from "@/lib/api/premises";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PTY-07 on the premises portal: one premises of the portfolio as its principal or a delegate reads it - the
 * register's facts about the place (its own classification, address and area, FR-PTY-002), the party operating it now,
 * its state and licensing status, what the reader's authority lets them do there, and every relationship and change of
 * the premises with the party then (FR-PTY-022). A premises the reader's authority does not cover is
 * NOT_YOUR_PREMISES and nothing of it is shown (FR-PTY-007).
 */
export default async function PortalPremisesPage({ params, searchParams }: { params: Promise<{ premises: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const { premises } = await params;
  const record = decodeURIComponent(premises);
  const query = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = premisesTranslator(locale);
  const outcome = await loadPortalPremises(principal, record);
  const data = outcome.data;
  const failure = outcome.failure;
  const phone = frame === "phone";
  const gap = phone ? "var(--space-4)" : "var(--space-6)";
  const refused = failure !== null && (failure.code === "NOT_YOUR_PREMISES" || failure.code === "PREMISES_NOT_FOUND") ? failure.code : null;

  return (
    <PortalShell fill layout={phone ? "phone" : "desktop"} nav={premisesNav("premises", frame, locale)} account={principal.account} context={{ premises: principal.party, label: t("party.partyLabel") }} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("pty19.crumb"), href: routes.premisesPortfolio() }]}
          title={data?.name ?? t("pty07.titleGeneric")}
          {...(data !== null ? { status: premisesStatus(data.state, t), meta: t("pty07p.asOf", { ts: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        />
        {refused !== null ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap, maxWidth: "var(--container-3xl)" }}>
            <ViewState view="refused" refusal={{ ...premisesRefusal(t, refused), family: "attention" }} density="portal" locale={locale} />
            <Button variant="secondary" size="md" href={routes.premisesPortfolio()} fullWidth={phone} locale={locale}>
              {t("pty07.myPremises")}
            </Button>
          </div>
        ) : failure !== null || data === null ? (
          <ViewState view="error" errorTitle={t("pty07p.errTitle")} errorText={t("prm.errText")} {...(failure?.traceId ? { traceId: failure.traceId } : {})} retryable density="portal" locale={locale} />
        ) : (
          <Body data={data} phone={phone} t={t} locale={locale} />
        )}
      </div>
    </PortalShell>
  );
}

function Body({ data, phone, t, locale }: { data: PortalPremises; phone: boolean; t: Translate; locale: Locale }) {
  return (
    <>
      <Panel title={t("pty07.entry")} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        <FactList
          items={[
            {
              label: t("pty07.party"),
              value: data.party?.legalName ?? null,
              missing: t("prm.none"),
              ...(data.party !== null && data.party.since !== null ? { note: t("pty07.since", { d: day(data.party.since, locale) }) } : {}),
            },
            { label: t("pty07.lic"), value: licensingStatus(data.licensing.status, t), kind: "status" as const },
            { label: t("pty07p.yours"), value: data.actor === "PRINCIPAL" ? t("pty19.partyWide") : actsWords(data.acts, t) },
            { label: t("pty07.cls"), value: data.classification !== null ? classWords(data.classification, t) : null, missing: t("prm.notRecorded") },
            { label: t("pty07.areaL"), value: data.area !== null ? areaWords(data.area, t) : null, missing: t("prm.notRecorded") },
            { label: t("pty07.address"), value: data.address, missing: t("prm.notRecorded") },
            { label: t("pty07.rec"), value: data.record, kind: "id" as const },
          ]}
          columns={phone ? 1 : 2}
          density="portal"
          locale={locale}
        />
      </Panel>
      <PremisesTimeline timeline={data.timeline} ask={null} density="portal" t={t} locale={locale} />
      <LimitationFacts limitation={data.limitation} phone={phone} t={t} locale={locale} />
    </>
  );
}
