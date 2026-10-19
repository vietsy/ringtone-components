import { redirect } from "next/navigation";
import { Banner, Divider, Panel } from "@/components/r1";
import { Text } from "@/components/Text";
import { AttestForm } from "@/features/registration/AttestForm";
import { DraftFrame, DraftUnavailable, StepError } from "@/features/registration/DraftFrame";
import { MissingBanner } from "@/features/registration/MissingBanner";
import { sendApplication } from "@/features/registration/actions";
import { count, regTranslator } from "@/features/registration/copy";
import { readForPage } from "@/lib/api/flash";
import { loadApplicationDraft, loadAttestationStep, type ApplicationDraft, type AttestAttempt, type AttestationStep } from "@/lib/api/registration";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG06_VIEWS } from "@/lib/mock/registration";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The refusals of an attempt to confirm or send, as a banner above the button. A refusal that rules
 * RightOne must resolve is neutral; the way on, where there is one, is the banner's primary action.
 */
const REFUSALS: Readonly<Record<string, { title: string; text: string; family: "neutral" | "attention"; way?: "review" | "facts" | "decision" }>> = {
  TARIFF_UNAVAILABLE: { title: "reg06.partTitle", text: "reg06.partText", family: "attention" },
  FACTS_CHANGED_SINCE_PREVIEW: { title: "reg06.factsTitle", text: "reg06.factsText", family: "attention", way: "review" },
  EXPLANATION_SUPERSEDED: { title: "reg06.supTitle", text: "reg06.supText", family: "attention", way: "review" },
  RECONFIRMATION_REQUIRED: { title: "reg06.recTitle", text: "reg06.recText", family: "attention", way: "facts" },
  INTENDED_PERIOD_INVALID: { title: "reg06.perTitle", text: "reg06.perText", family: "attention", way: "decision" },
  EXPLANATION_NOT_APPROVED: { title: "reg06.enaTitle", text: "reg06.enaText", family: "neutral" },
  USE_START_REQUIRED: { title: "reg.refusal.USE_START_REQUIRED.title", text: "reg.refusal.USE_START_REQUIRED.text", family: "attention" },
  RULEBOOK_EXCEEDS_FACT_LIMIT: { title: "reg.refusal.RULEBOOK_EXCEEDS_FACT_LIMIT.title", text: "reg.refusal.RULEBOOK_EXCEEDS_FACT_LIMIT.text", family: "attention" },
  RULEBOOK_NOT_APPROVED: { title: "reg.refusal.RULEBOOK_NOT_APPROVED.title", text: "reg.refusal.RULEBOOK_NOT_APPROVED.text", family: "neutral" },
  TARIFF_NOT_APPROVED: { title: "reg.refusal.TARIFF_NOT_APPROVED.title", text: "reg.refusal.TARIFF_NOT_APPROVED.text", family: "neutral" },
  PROCESSING_NOT_PERMITTED: { title: "reg.refusal.PROCESSING_NOT_PERMITTED.title", text: "reg.refusal.PROCESSING_NOT_PERMITTED.text", family: "attention" },
};

/**
 * SCR-REG-06 Attest and submit. Two confirmations, the only ones on the route, unticked each time the page
 * opens; then the application goes to RightOne and its status page opens. The confirmation carries what the
 * review showed, so answers changed since are refused rather than confirmed unseen.
 */
export default async function SubmitPage({
  params,
  searchParams,
}: {
  params: Promise<{ application: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const principal = await requirePrincipal();
  const [{ application }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = regTranslator(locale);
  const view = reviewView(query, REG06_VIEWS);
  const draft = await loadApplicationDraft(principal.sessionId, application, "attestation", view);
  if (draft.failure?.code === "APPLICATION_NOT_EDITABLE") redirect(routes.application(application));
  const outcome = draft.failure !== null ? null : await loadAttestationStep(principal, application, view);
  const last = readForPage<AttestAttempt>(query);
  const attempt = last?.page === "attest" && last.application === application ? last : null;
  const read = outcome?.data ?? null;
  // A refused attempt comes back with its refusal, the items it names, and the boxes as they were ticked.
  const step: AttestationStep | null =
    read !== null && attempt !== null
      ? { ...read, confirmed: attempt.confirmed, changeDutyAcknowledged: attempt.changeDutyAcknowledged, refusal: attempt.refusal, missing: attempt.missing }
      : read;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";

  return (
    <DraftFrame
      step="attestation"
      reference={application}
      draft={draft.data}
      title={t("reg06.title")}
      savedAt={draft.data !== null && failure === null ? draft.data.savedAt : null}
      frame={frame}
      t={t}
      locale={locale}
    >
      {draft.failure !== null ? <DraftUnavailable failure={draft.failure} phone={phone} t={t} locale={locale} /> : null}
      {failure !== null ? <StepError failure={failure} t={t} locale={locale} /> : null}
      {step !== null && draft.data !== null ? (
        <Attest step={step} draft={draft.data} sending={view === "sending"} phone={phone} t={t} locale={locale} />
      ) : null}
    </DraftFrame>
  );
}

function Attest({
  step,
  draft,
  sending,
  phone,
  t,
  locale,
}: {
  step: AttestationStep;
  draft: ApplicationDraft;
  sending: boolean;
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const reference = draft.reference;
  const code = step.refusal?.code ?? null;
  const refusal = code !== null ? REFUSALS[code] : undefined;
  const governing = step.refusal?.governingDecision ?? null;
  const way =
    refusal?.way === "review"
      ? { label: t("reg06.again"), href: routes.applicationReview(reference), variant: "primary" as const }
      : refusal?.way === "facts"
        ? { label: t("reg06.recAction"), href: routes.applicationFacts(reference), variant: "primary" as const }
        : refusal?.way === "decision" && governing !== null
          ? { label: t(phone ? "reg06.perActionShort" : "reg06.perAction", { ref: governing }), href: routes.decision(governing), variant: "primary" as const }
          : null;
  const missing = code === "REQUIRED_ITEMS_MISSING";
  // With a way on in a banner above, sending steps back to secondary so the page keeps one primary action.
  const variant = missing || way !== null ? "secondary" : "primary";

  return (
    <AttestForm
      copy={{
        confirmTitle: t("reg06.confirmTitle"),
        box1: t("reg06.box1", { premises: draft.premises }),
        box1Help: t("reg06.box1Help", { party: step.party }),
        box2: t("reg06.box2"),
        // The period the explanation quoted: TAR's change-report period (CFG-360), the thirty-day default while none is approved.
        box2Help: t("reg06.box2Help", { days: count(step.changeReportDays, locale) }),
        recordLine: t("reg06.recordLine"),
        confirm: t(step.sendPending ? "reg06.sendAgain" : "reg06.confirm"),
        sending: t("reg06.sending"),
        offUntick: t("reg06.offUntick"),
        back: t("reg06.back"),
      }}
      action={sendApplication.bind(null, reference)}
      confirmed={step.confirmed}
      changeDutyAcknowledged={step.changeDutyAcknowledged}
      box2Error={code === "ATTESTATION_NOT_CONFIRMED" ? t("reg06.notConfirmed") : null}
      variant={variant}
      pending={sending}
      backHref={routes.applicationReview(reference)}
      phone={phone}
      locale={locale}
    >
      <Divider />
      <Panel variant="plain" level={2} title={t("reg06.afterTitle")} density="portal" locale={locale}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <Text size="base">
            {t("reg06.o1")}
          </Text>
          <Text size="base">
            {t("reg06.o2")}
          </Text>
          <Text size="base">
            {t("reg06.o3")}
          </Text>
        </div>
      </Panel>
      <Divider />
      {/* What the review showed, carried with the confirmation (explanation_presentation_id, facts_digest). */}
      <input type="hidden" name="explanation_presentation_id" value={step.shown?.presentation ?? ""} />
      <input type="hidden" name="facts_digest" value={step.shown?.factsDigest ?? ""} />
      {refusal !== undefined && code !== null ? (
        <div aria-live="polite" style={{ minWidth: 0 }}>
          <Banner family={refusal.family} title={t(refusal.title)} code={code} {...(way !== null ? { action: way } : {})} density="portal" locale={locale}>
            {t(refusal.text)}
          </Banner>
        </div>
      ) : null}
      {missing ? (
        <div aria-live="polite" style={{ minWidth: 0 }}>
          <MissingBanner items={step.missing} reference={reference} t={t} locale={locale} />
        </div>
      ) : null}
    </AttestForm>
  );
}
