import { Banner, Button, ButtonRow, FactList, Link, PageHeader, Panel, Skeleton, Toast } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { Text } from "@/components/Text";
import { readForPage } from "@/lib/api/flash";
import { loadParticipation, type EngagementAttempt, type ParticipationView } from "@/lib/api/engagement";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";
import { stopTakingPartAct, takePartAct } from "./actions";
import { classWords, engTranslator, moment, participationStatus, withheldSentence, withheldWords } from "./copy";
import type { ParticipantPortal } from "./participant";
import { LoadFailure, RefusalBanner } from "./Refusals";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-ENG-01 Take part in engagement, in the portal the participant reads it in. No board or Figma frame draws it: it
 * is built from ENG's specification and wireframe on the premises portal's pattern. The participant's status in words,
 * the two sentences about what taking part does not change, and the one act that applies: Take part while the
 * capability is released to their class, Stop taking part whenever they take part, never disabled and never confirmed.
 * While the capability is withheld the page says why in the sentence of its cause, as information rather than an error.
 */
export async function TakePartScreen({ portal, params }: { portal: ParticipantPortal; params: SearchParams }) {
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = engTranslator(locale);
  const view = reviewView(params, ENG_VIEWS);
  const outcome = view === "loading" ? null : await loadParticipation(portal.who, view);
  const kept = readForPage<EngagementAttempt>(params);
  const attempt = kept?.page === "eng01" ? kept : null;
  const phone = frame === "phone";

  return (
    <PortalShell fill layout={phone ? "phone" : "desktop"} nav={portal.nav(frame, locale)} account={portal.account} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader title={t("eng01.title")} meta={t("eng01.meta", { party: portal.party })} locale={locale} />
        <Text size="base" measure="2xl">
          {t("eng01.optional")}
        </Text>
        {attempt?.done === "stopped" ? (
          <Toast family="neutral" title={t("eng01.stoppedTitle")} locale={locale}>
            {t("eng01.stoppedText")}
          </Toast>
        ) : null}
        {attempt?.refusal ? <RefusalBanner refusal={attempt.refusal} t={t} locale={locale} density="portal" /> : null}
        {view === "loading" ? (
          <Panel density="portal" locale={locale}>
            <Skeleton variant="facts" rows={3} density="portal" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure ? <LoadFailure failure={outcome.failure} errTitle={t("eng01.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="portal" /> : null}
        {outcome?.data ? <Participation data={outcome.data} portal={portal} phone={phone} t={t} locale={locale} /> : null}
      </div>
    </PortalShell>
  );
}

function Participation({ data, portal, phone, t, locale }: { data: ParticipationView; portal: ParticipantPortal; phone: boolean; t: Translate; locale: Locale }) {
  const { capability } = data;
  const taking = data.state === "ENROLLED" || data.state === "SUSPENDED";
  const eligible = capability.scope.includes(data.participant.participantClass);
  // Why Take part is unavailable, in the words of the condition: the capability's cause, its suspension, or the scope.
  const unavailable =
    capability.state === "WITHHELD"
      ? withheldSentence(capability, t)
      : capability.state === "SUSPENDED"
        ? t("eng.refusal.CAPABILITY_SUSPENDED.text")
        : !eligible
          ? `${t("eng.refusal.PARTICIPANT_NOT_ELIGIBLE.title")} ${t("eng.named.classes", { classes: classWords(capability.scope, t) })}`
          : null;
  const size = phone ? "lg" : "md";
  return (
    <>
      {capability.state === "WITHHELD" ? (
        <Banner family="info" title={withheldWords(capability, t).title} density="portal" locale={locale}>
          {withheldWords(capability, t).text}
        </Banner>
      ) : null}
      {capability.state === "SUSPENDED" ? (
        <Banner family="attention" title={t("eng.refusal.CAPABILITY_SUSPENDED.title")} density="portal" locale={locale}>
          {t("eng.refusal.CAPABILITY_SUSPENDED.text")}
        </Banner>
      ) : null}
      <Panel title={t("eng01.statusTitle")} level={2} status={participationStatus(data.state, t)} density="portal" locale={locale}>
        <FactList
          density="portal"
          locale={locale}
          items={[
            // SM-51 has no transition for a withdrawn release: the state stays, and the note says it has no effect.
            { label: t("eng01.fStatus"), value: t(`eng01.state.${data.state}`), ...(taking && capability.withheld === "withdrawn" ? { note: t("eng01.withdrawnNote") } : {}) },
            { label: t("eng01.fProfile"), value: data.displayProfile.name, note: data.displayProfile.ref },
            ...(data.lastTransitionAt !== null ? [{ label: t("eng01.fSince"), value: moment(data.lastTransitionAt, locale) }] : []),
          ]}
        />
        <Text size="sm" tone="secondary">
          {t("eng01.confer")} <Link href={portal.points} locale={locale}>{t("eng01.seeBelow")}</Link>
        </Text>
      </Panel>
      <ButtonRow align={phone ? "start" : "between"}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <Button variant="secondary" size={size} href={portal.points} fullWidth={phone} locale={locale}>
            {t("eng.whatPoints")}
          </Button>
          {/* SCR-ENG-02 is an exit of this screen whatever the status: unenrolled, it says so in its governed-empty words. */}
          <Button variant="secondary" size={size} href={portal.balance()} fullWidth={phone} locale={locale}>
            {t("eng.balanceLink")}
          </Button>
        </div>
        {taking ? (
          <form action={stopTakingPartAct.bind(null, portal.kind)}>
            <Button type="submit" variant="secondary" size={size} fullWidth={phone} locale={locale}>
              {t("eng01.stop")}
            </Button>
          </form>
        ) : (
          <form action={takePartAct.bind(null, portal.kind)}>
            <Button type="submit" variant="primary" size={size} {...(unavailable !== null ? { disabled: true, disabledReason: unavailable } : {})} fullWidth={phone} locale={locale}>
              {t("eng01.take")}
            </Button>
          </form>
        )}
      </ButtonRow>
    </>
  );
}
