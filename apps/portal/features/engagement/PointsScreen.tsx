import { Banner, Button, ButtonRow, Disclosure, FactList, PageHeader, Panel, Skeleton } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { Text } from "@/components/Text";
import { readForPage } from "@/lib/api/flash";
import { loadDisclosure, type DisclosureVersion, type DisclosureView, type EngagementAttempt } from "@/lib/api/engagement";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import { pointDispositionAct } from "./actions";
import { day, engTranslator } from "./copy";
import type { ParticipantPortal } from "./participant";
import { LoadFailure, RefusalBanner } from "./Refusals";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-ENG-03 What these points are, in the portal the participant reads it in. No board or Figma frame draws it: it is
 * built from ENG's specification and wireframe. The effective disclosure in the reader's language, word for word as the
 * DPO approved it, with its version and period so a reader can quote what they were told and when; it is shown whatever
 * the capability's state. Use points is drawn disabled with its condition beside it, because redemption is reserved
 * rather than absent; its form is `POST /engagement/point-dispositions`, so a submission made anyway is refused naming
 * `DEC-30`, recorded, and drawn here from its code. The earlier versions open on this screen with their periods.
 */
export async function PointsScreen({ portal, params }: { portal: ParticipantPortal; params: SearchParams }) {
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = engTranslator(locale);
  const view = reviewView(params, ENG_VIEWS);
  const outcome = view === "loading" ? null : await loadDisclosure(portal.who, view);
  const kept = readForPage<EngagementAttempt>(params);
  const attempt = kept?.page === "eng03" ? kept : null;
  const data = outcome?.data ?? null;
  const phone = frame === "phone";

  return (
    <PortalShell fill layout={phone ? "phone" : "desktop"} nav={portal.nav(frame, locale)} account={portal.account} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("eng01.title"), href: portal.home }]}
          title={t("eng03.title")}
          {...(data !== null ? { meta: t("eng03.meta", { n: data.effective.no, d: day(data.effective.effectiveFrom, locale) }) } : {})}
          locale={locale}
        />
        {attempt?.refusal ? <RefusalBanner refusal={attempt.refusal} t={t} locale={locale} density="portal" /> : null}
        {view === "loading" ? (
          <Panel density="portal" locale={locale}>
            <Skeleton variant="text" rows={4} density="portal" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure?.code === "DISCLOSURE_VERSION_NOT_EFFECTIVE" ? (
          <Banner family="attention" title={t("eng.refusal.DISCLOSURE_VERSION_NOT_EFFECTIVE.title")} density="portal" locale={locale}>
            {t("eng.refusal.DISCLOSURE_VERSION_NOT_EFFECTIVE.text")}
          </Banner>
        ) : outcome?.failure ? (
          <LoadFailure failure={outcome.failure} errTitle={t("eng03.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="portal" />
        ) : null}
        {data !== null ? <Statement data={data} portal={portal} phone={phone} t={t} locale={locale} /> : null}
        <ButtonRow>
          <Button variant="secondary" size={phone ? "lg" : "md"} icon="arrow-left" href={portal.balance()} fullWidth={phone} locale={locale}>
            {t("eng03.back")}
          </Button>
        </ButtonRow>
      </div>
    </PortalShell>
  );
}

const textIn = (version: DisclosureVersion, locale: Locale) => (locale === "vi" ? version.textVi : version.textEn);

function Statement({ data, portal, phone, t, locale }: { data: DisclosureView; portal: ParticipantPortal; phone: boolean; t: Translate; locale: Locale }) {
  const { effective } = data;
  return (
    <>
      <Panel title={t("eng03.statementTitle")} level={2} density="portal" locale={locale}>
        <Text size="base" measure="2xl">
          {textIn(effective, locale)}
        </Text>
        <FactList
          density="portal"
          locale={locale}
          items={[
            { label: t("eng03.fVersion"), value: t("eng03.versionValue", { n: effective.no }) },
            { label: t("eng03.fFrom"), value: effective.effectiveFrom, kind: "date" },
            { label: t("eng03.fDecision"), value: effective.reservingDecision, kind: "mono", note: t("eng03.decisionNote") },
          ]}
        />
      </Panel>
      <Panel title={t("eng03.useTitle")} level={2} density="portal" locale={locale}>
        <Text size="sm" tone="secondary">
          {t("eng.refusal.POINT_DISPOSITION_RESERVED.title")} {t("eng.refusal.POINT_DISPOSITION_RESERVED.text")}
        </Text>
        <form action={pointDispositionAct.bind(null, portal.kind)}>
          <input type="hidden" name="disposition_kind" value="exchange" />
          <ButtonRow>
            <Button type="submit" variant="secondary" size={phone ? "lg" : "md"} disabled disabledReason={t("eng03.useReason", { decision: effective.reservingDecision })} fullWidth={phone} locale={locale}>
              {t("eng03.use")}
            </Button>
          </ButtonRow>
        </form>
      </Panel>
      {data.earlier.length > 0 ? (
        <Disclosure title={t("eng03.earlier")} meta={t("eng03.earlierMeta", { n: data.earlier.length })} level={2} density="portal" locale={locale}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {data.earlier.map((version) => (
              <Panel key={version.no} variant="sunken" title={t("eng03.earlierVersion", { n: version.no })} meta={t("eng03.shownFor", { from: day(version.effectiveFrom, locale), to: day(version.effectiveTo ?? version.effectiveFrom, locale) })} level={3} density="portal" locale={locale}>
                <Text size="sm">{textIn(version, locale)}</Text>
              </Panel>
            ))}
          </div>
        </Disclosure>
      ) : null}
    </>
  );
}
