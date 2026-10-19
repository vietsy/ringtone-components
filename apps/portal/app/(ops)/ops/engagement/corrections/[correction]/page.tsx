import { notFound } from "next/navigation";
import { ApprovalPair, Banner, Button, ButtonRow, FactList, PageHeader, Panel, Skeleton, Toast } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { authoriseCorrectionAct } from "@/features/engagement/actions";
import { ConfirmAct } from "@/features/engagement/ConfirmAct";
import { actorName, count, engTranslator, refusalWords, signed } from "@/features/engagement/copy";
import { EventBlock } from "@/features/engagement/EventBlock";
import { LoadFailure, RefusalBanner } from "@/features/engagement/Refusals";
import { readForPage } from "@/lib/api/flash";
import { loadCorrection, type CorrectionViewData, type EngagementAttempt } from "@/lib/api/engagement";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { ENG_VIEWS } from "@/lib/mock/engagement";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const FORM = "eng09-authorise";

/**
 * SCR-ENG-09 Correct a ledger event, once proposed: the event, the ground and delta with the resulting balance, and
 * the authorisation block with both actors. Two separations are enforced and never conflated: the proposer is refused
 * CORRECTION_SELF_AUTHORISATION, the person who recorded the event CORRECTION_RECORDER_CONFLICT, and each sees the
 * control disabled with their own sentence rather than meeting it after pressing. The business approver authorises,
 * confirmed with what the act does; the backend checks every separation again. While the capability is withheld no
 * correction can be recorded, so Authorise is disabled with that sentence, and the backend refuses CAPABILITY_WITHHELD.
 */
export default async function CorrectionPage({ params, searchParams }: { params: Promise<{ correction: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-MKT-OP", "ACT-BIZ-APR", "ACT-REP", "ACT-AUD");
  const [{ correction: id }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = engTranslator(locale);
  const view = reviewView(query, ENG_VIEWS);
  const outcome = view === "loading" ? null : await loadCorrection(staff, id, view);
  if (outcome?.failure?.code === "NOT_FOUND") notFound();
  const kept = readForPage<EngagementAttempt>(query);
  const attempt = kept?.page === "eng09" ? kept : null;
  const data = outcome?.data ?? null;

  return (
    <OpsFrame console="operations" current="engagement" staff={staff} searchLabel={t("engOps.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("engHome.title"), href: routes.opsEngagement() }]}
          title={t("eng09.title")}
          meta={t("eng09.correctionMeta", { id })}
          {...(data !== null ? { status: data.authorisedBy !== null ? { family: "neutral" as const, label: t("eng09.authorised") } : { family: "attention" as const, label: t("eng09.awaiting") } } : {})}
          locale={locale}
        />
        {view === "loading" ? (
          <Panel density="console" locale={locale}>
            <Skeleton variant="facts" rows={4} density="console" locale={locale} />
          </Panel>
        ) : null}
        {outcome?.failure ? <LoadFailure failure={outcome.failure} errTitle={t("eng09.errTitle")} errText={t("eng.errText")} t={t} locale={locale} density="console" /> : null}
        {data !== null ? <Authorisation data={data} attempt={attempt} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Authorisation({ data, attempt, t, locale }: { data: CorrectionViewData; attempt: EngagementAttempt | null; t: Translate; locale: Locale }) {
  const authorised = data.authorisedBy !== null;
  // The sentence of the separation that applies to the reader, before they press anything.
  const separation = data.reader === "proposer" ? "CORRECTION_SELF_AUTHORISATION" : data.reader === "recorder" ? "CORRECTION_RECORDER_CONFLICT" : null;
  const words = separation !== null ? refusalWords(separation, t) : null;
  // The refusal's last sentence says an attempt was recorded; before an attempt, the separation is said without it.
  const attempted = attempt?.refusal?.code === separation;
  const before = separation === "CORRECTION_SELF_AUTHORISATION" ? t("eng09.ownText") : t("eng09.recorderText");
  const withheld = data.capability.state === "WITHHELD";
  const disabledReason = withheld ? t("eng09.withheld") : words !== null ? `${words.title} ${before}` : data.reader === "no-role" ? t("eng09.approverOnly") : null;
  const back = data.read !== null ? routes.opsEngagementSupport({ read: data.read, event: data.event.id }) : routes.opsEngagement();
  return (
    <>
      {attempt?.done === "authorised" ? (
        <div style={{ maxWidth: "var(--container-lg)" }}>
          <Toast family="positive" title={t("eng09.doneTitle")} locale={locale}>
            {t("eng09.doneText", { event: data.correctingEvent ?? "", n: count(data.balance, locale) })}
          </Toast>
        </div>
      ) : null}
      {attempt?.refusal && attempt.refusal.code !== separation ? <RefusalBanner refusal={attempt.refusal} t={t} locale={locale} density="console" /> : null}
      {withheld && !authorised ? (
        <Banner family="info" title={t("eng09.withheld")} density="console" locale={locale}>
          {t("eng08.withheldText")}
        </Banner>
      ) : null}
      <EventBlock data={data} t={t} locale={locale} />
      <Panel title={t("eng09.correctionTitle")} level={2} density="console" locale={locale}>
        <FactList
          columns={2}
          density="console"
          locale={locale}
          items={[
            { label: t("eng09.fGround"), value: t(`eng.ground.${data.ground}`), note: data.ground },
            { label: t("eng09.fDelta"), value: t(data.delta < 0 ? "eng04.pointsMinus" : "eng04.pointsPlus", { n: signed(data.delta, locale) }) },
            { label: t(authorised ? "eng09.fBalanceNow" : "eng09.fResulting"), value: t("eng09.balanceValue", { n: count(data.resulting, locale) }) },
            ...(data.correctingEvent !== null ? [{ label: t("eng09.fCorrecting"), value: data.correctingEvent, kind: "id" as const }] : []),
          ]}
        />
        <Text size="sm" tone="secondary">
          {t("eng09.never")}
        </Text>
      </Panel>
      <Panel title={t("eng09.authorisationTitle")} level={2} density="console" locale={locale}>
        <ApprovalPair
          preparer={{ name: actorName(data.proposedBy, t), role: t("eng09.proposerRole"), at: data.proposedAt }}
          approver={data.authorisedBy !== null ? { name: actorName(data.authorisedBy, t), role: t("eng09.approverRole"), at: data.authorisedAt ?? "" } : null}
          {...(authorised ? { decision: "approved" as const } : { awaiting: t("eng09.awaitingWho") })}
          {...(words !== null && separation !== null && !authorised ? { sameActor: { code: separation, title: words.title, text: attempted ? words.text : before, family: "attention" as const } } : {})}
          preparerLabel={t("eng09.proposer")}
          approverLabel={t("eng09.authoriser")}
          locale={locale}
        />
        <form id={FORM} action={authoriseCorrectionAct}>
          <input type="hidden" name="correction" value={data.id} />
        </form>
        <ButtonRow align="between">
          <Button variant="secondary" size="sm" icon="arrow-left" href={back} locale={locale}>
            {t(data.read !== null ? "eng09.back" : "eng09.backHome")}
          </Button>
          {!authorised ? (
            <ConfirmAct
              formId={FORM}
              label={t("eng09.authorise")}
              disabledReason={disabledReason}
              dialog={{ title: t("eng09.authoriseDialog", { id: data.id }), description: t("eng09.authoriseConfirm"), confirm: t("eng09.authorise"), back: t("eng.back") }}
              locale={locale}
            />
          ) : null}
        </ButtonRow>
      </Panel>
    </>
  );
}
