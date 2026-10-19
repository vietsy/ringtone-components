import { Banner, Button, ButtonRow, FactList, PageHeader, Panel, Skeleton, Toast } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { Text } from "@/components/Text";
import { readForPage } from "@/lib/api/flash";
import { loadParticipation, loadReferral, type CapabilitySummary, type EngagementAttempt, type ReferralView } from "@/lib/api/engagement";
import type { Artist } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import { requestReferralAct } from "./actions";
import { engTranslator, moment, withheldSentence, withheldWords } from "./copy";
import type { ParticipantPortal } from "./participant";
import { LoadFailure, RefusalBanner } from "./Refusals";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-ENG-05 Referral reference, the artist's alone. No board or Figma frame draws it: it is built from ENG's
 * specification and wireframe. Today the version governing now enables no referral programme (`CFG-60`), so the page
 * says so as a fact with the decision that would change it, and Request a reference is drawn disabled with that
 * sentence beside it. Once a version enables one, the live reference and the instant it was issued, attached to the
 * display profile and never to the account; before one is issued, that none has been. While the capability is withheld
 * the capability's sentence stands above, with the request disabled.
 */
export async function ReferralScreen({ portal, artist, params }: { portal: ParticipantPortal; artist: Artist; params: SearchParams }) {
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = engTranslator(locale);
  const view = reviewView(params, ENG_VIEWS);
  const failing = view === "error" ? view : null;
  const [participation, outcome] = view === "loading" ? [null, null] : await Promise.all([loadParticipation(artist, failing), loadReferral(artist, failing)]);
  const kept = readForPage<EngagementAttempt>(params);
  const attempt = kept?.page === "eng05" ? kept : null;
  const capability = participation?.data?.capability ?? null;
  const phone = frame === "phone";
  const size = phone ? "lg" : "md";
  const code = outcome?.failure?.code ?? null;

  return (
    <PortalShell fill layout={phone ? "phone" : "desktop"} nav={portal.nav(frame, locale)} account={portal.account} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("eng01.title"), href: portal.home },
            { label: t("eng02.title"), href: portal.balance() },
          ]}
          title={t("eng05.title")}
          meta={t("eng01.meta", { party: portal.party })}
          locale={locale}
        />
        {attempt?.done === "issued" || attempt?.done === "replay" ? (
          <Toast family="positive" title={t(`eng05.${attempt.done}`)} locale={locale}>
            {t("eng05.issuedText")}
          </Toast>
        ) : null}
        {attempt?.refusal?.code === "PARTICIPATION_NOT_ENROLLED" ? (
          <Banner family="attention" title={t("eng05.notTaking")} code={attempt.refusal.code} live density="portal" locale={locale}>
            {t("eng05.notTakingText")}
          </Banner>
        ) : attempt?.refusal ? (
          <RefusalBanner refusal={attempt.refusal} t={t} locale={locale} density="portal" />
        ) : null}
        {capability?.state === "WITHHELD" && (code === "CAPABILITY_WITHHELD" || code === "REFERRAL_PROGRAMME_NOT_ENABLED") ? (
          <Banner family="info" title={withheldWords(capability, t).title} density="portal" locale={locale}>
            {withheldWords(capability, t).text}
          </Banner>
        ) : null}
        {view === "loading" ? (
          <Panel density="portal" locale={locale}>
            <Skeleton variant="facts" rows={2} density="portal" locale={locale} />
          </Panel>
        ) : null}
        {code === "REFERRAL_PROGRAMME_NOT_ENABLED" || code === "CAPABILITY_WITHHELD" ? (
          <Unavailable code={code} capability={capability} phone={phone} t={t} locale={locale} />
        ) : outcome?.failure ? (
          <LoadFailure failure={outcome.failure} errTitle={t("eng05.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="portal" />
        ) : null}
        {outcome?.data ? <Reference data={outcome.data} capability={capability} phone={phone} t={t} locale={locale} /> : null}
        <ButtonRow>
          <Button variant="secondary" size={size} icon="arrow-left" href={portal.balance()} fullWidth={phone} locale={locale}>
            {t("eng05.back")}
          </Button>
          <Button variant="secondary" size={size} href={portal.points} fullWidth={phone} locale={locale}>
            {t("eng.whatPoints")}
          </Button>
        </ButtonRow>
      </div>
    </PortalShell>
  );
}

/** The request, disabled with the sentence of what holds it back, or sent from its own form. */
function RequestReference({ reason, phone, locale, t }: { reason: string | null; phone: boolean; locale: Locale; t: Translate }) {
  return (
    <form action={requestReferralAct}>
      <ButtonRow>
        <Button type="submit" variant="primary" size={phone ? "lg" : "md"} {...(reason !== null ? { disabled: true, disabledReason: reason } : {})} fullWidth={phone} locale={locale}>
          {t("eng05.request")}
        </Button>
      </ButtonRow>
    </form>
  );
}

/** Today's state: no programme enabled (named with its decision), or the capability withheld. */
function Unavailable({ code, capability, phone, t, locale }: { code: string; capability: CapabilitySummary | null; phone: boolean; t: Translate; locale: Locale }) {
  const reason = code === "CAPABILITY_WITHHELD" && capability !== null ? withheldSentence(capability, t) : t("eng05.noProgramme");
  return (
    <Panel title={t("eng05.referenceTitle")} level={2} status={{ family: "neutral", label: t("eng05.notAvailable") }} density="portal" locale={locale}>
      {code === "REFERRAL_PROGRAMME_NOT_ENABLED" ? (
        <>
          <FactList density="portal" locale={locale} items={[{ label: t("eng05.fAvailability"), value: t("eng.refusal.REFERRAL_PROGRAMME_NOT_ENABLED.title") }]} />
          <Text size="sm" tone="secondary" measure="2xl">
            {t("eng.refusal.REFERRAL_PROGRAMME_NOT_ENABLED.text")}
          </Text>
        </>
      ) : null}
      <RequestReference reason={reason} phone={phone} t={t} locale={locale} />
    </Panel>
  );
}

/** A programme is enabled: the reference issued, or none yet with the request offered to a participant taking part. */
function Reference({ data, capability, phone, t, locale }: { data: ReferralView; capability: CapabilitySummary | null; phone: boolean; t: Translate; locale: Locale }) {
  const reference = data.reference;
  if (reference !== null) {
    return (
      <Panel title={t("eng05.referenceTitle")} level={2} status={{ family: "positive", label: t("eng05.issuedStatus") }} density="portal" locale={locale}>
        <FactList
          density="portal"
          locale={locale}
          items={[
            { label: t("eng05.fReference"), value: reference.value, kind: "mono" },
            { label: t("eng05.fIssued"), value: moment(reference.issuedAt, locale) },
            { label: t("eng05.fProfile"), value: reference.displayProfile.name, note: reference.displayProfile.ref },
            { label: t("eng05.fProgramme"), value: t("eng05.programmeValue", { n: data.programme.version }) },
          ]}
        />
        <Text size="sm" tone="secondary" measure="2xl">
          {t("eng05.profileNote")}
        </Text>
      </Panel>
    );
  }
  const reason = capability?.state === "WITHHELD" ? withheldSentence(capability, t) : !data.takingPart ? t("eng05.notTakingText") : null;
  return (
    <Panel title={t("eng05.referenceTitle")} level={2} density="portal" locale={locale}>
      <FactList density="portal" locale={locale} items={[{ label: t("eng05.fProgramme"), value: t("eng05.programmeValue", { n: data.programme.version }) }]} />
      <Text size="base">{t("eng05.empty")}</Text>
      <RequestReference reason={reason} phone={phone} t={t} locale={locale} />
    </Panel>
  );
}
