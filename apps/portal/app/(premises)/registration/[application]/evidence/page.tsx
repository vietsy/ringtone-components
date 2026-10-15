import { redirect } from "next/navigation";
import { Banner, Button, ButtonRow, Divider, EmptyState, ItemList, Panel, Skeleton } from "@/components/r1";
import { Text } from "@/components/Text";
import { ClaimForm } from "@/features/registration/ClaimForm";
import { DraftFrame, DraftUnavailable, StepError } from "@/features/registration/DraftFrame";
import { UploadList, type UploadEntry } from "@/features/registration/UploadList";
import { addClaim, addDocument } from "@/features/registration/actions";
import { count, day, missingFor, missingKey, missingTitle, percent, regTranslator, span } from "@/features/registration/copy";
import { readForPage } from "@/lib/api/flash";
import {
  loadApplicationDraft,
  loadEvidenceStep,
  type ApplicationDraft,
  type EvidenceAttempt,
  type EvidenceStep,
  type RequiredDocument,
  type RightsLayer,
} from "@/lib/api/registration";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG04_VIEWS } from "@/lib/mock/registration";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

const LAYERS: readonly RightsLayer[] = ["AUTHORS", "PERFORMERS", "PRODUCERS"];
const DOCUMENT_ERRORS: Readonly<Record<string, string>> = {
  DOCUMENT_INVALID: "reg04.docInvalid",
  EVIDENCE_NOT_REQUESTED: "reg.refusal.EVIDENCE_NOT_REQUESTED.text",
};
const CLAIM_ERRORS: Readonly<Record<string, string>> = {
  ASSERTION_DUPLICATE: "reg04.duplicate",
  ASSERTION_PERIOD_INVALID: "reg04.periodInvalid",
  RIGHTS_LAYER_UNKNOWN: "reg04.layerUnknown",
};

/** Where a document is recorded: a document the rules ask for, or one a claim asks for (`backend/registration.ts`). */
const rulesSlot = (document: RequiredDocument) => `rules:${document.item}`;
const claimSlot = (claim: EvidenceStep["claims"][number], document: RequiredDocument) => `claim:${claim.kind}:${claim.layer}:${document.item}`;

/**
 * SCR-REG-04 Evidence and claims. Each document the rules ask for, and a claim when the premises does not
 * use a kind of music right; what is still needed before the review is listed at the foot.
 */
export default async function EvidencePage({
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
  const view = reviewView(query, REG04_VIEWS);
  const draft = await loadApplicationDraft(principal.sessionId, application, "evidence", view);
  if (draft.failure?.code === "APPLICATION_NOT_EDITABLE") redirect(routes.application(application));
  const outcome = draft.failure !== null || view === "loading" ? null : await loadEvidenceStep(principal.sessionId, application, view);
  const last = readForPage<EvidenceAttempt>(query);
  const attempt = last?.page === "evidence" && last.application === application ? last : null;
  const step = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const phone = frame === "phone";

  return (
    <DraftFrame
      step="evidence"
      reference={application}
      draft={draft.data}
      title={t("reg04.title")}
      savedAt={draft.data !== null && failure === null ? draft.data.savedAt : null}
      frame={frame}
      t={t}
      locale={locale}
    >
      {draft.failure !== null ? <DraftUnavailable failure={draft.failure} phone={phone} t={t} locale={locale} /> : null}
      {failure !== null ? <StepError failure={failure} t={t} locale={locale} /> : null}
      {draft.failure === null && view === "loading" ? (
        <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          <Skeleton variant="table" rows={2} columns={3} density="portal" locale={locale} />
          <Divider />
          <Skeleton variant="card" rows={3} density="portal" locale={locale} />
        </Panel>
      ) : null}
      {step !== null && draft.data !== null ? (
        <Evidence step={withAttempt(step, attempt)} draft={draft.data} refused={attempt?.document ?? null} phone={phone} t={t} locale={locale} />
      ) : null}
    </DraftFrame>
  );
}

/** The step with the claim form as the last refused attempt left it. */
function withAttempt(step: EvidenceStep, attempt: EvidenceAttempt | null): EvidenceStep {
  return attempt !== null && attempt.claim !== null ? { ...step, claimAttempt: attempt.claim } : step;
}

function Evidence({
  step,
  draft,
  refused,
  phone,
  t,
  locale,
}: {
  step: EvidenceStep;
  draft: ApplicationDraft;
  /** A document refused on the last attempt, by its slot. */
  refused: EvidenceAttempt["document"];
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const reference = draft.reference;
  const blocked = step.blocked !== null;
  const still = step.stillNeeded.length;
  const stillTitle = still === 1 ? t("reg04.stillOne") : t("reg04.stillN", { count: count(still, locale) });
  const nextReason = blocked ? t("reg04.offRna") : still === 1 ? t("reg04.offStillOne") : still > 0 ? t("reg04.offStill", { count: count(still, locale) }) : null;
  const attempt = step.claimAttempt;
  const claimError = (field: "layer" | "period") =>
    attempt?.refusal?.field === field ? t(CLAIM_ERRORS[attempt.refusal.code] ?? "reg.errText") : null;
  const upload = addDocument.bind(null, reference);
  const documents = (list: readonly RequiredDocument[], slot: (document: RequiredDocument) => string, label: string) => (
    <UploadList
      entries={list.map((document) => entry(document, slot(document), refused, t, locale))}
      upload={upload}
      layout={phone ? "cards" : "list"}
      label={label}
      columns={{ doc: t("reg04.colDoc"), state: t("reg04.colState"), act: t("reg04.colAct") }}
      locale={locale}
    />
  );

  return (
    <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
      {step.blocked !== null ? (
        <>
          <Banner family="neutral" title={t(`reg.refusal.${step.blocked}.title`)} code={step.blocked} density="portal" locale={locale}>
            {t(`reg.refusal.${step.blocked}.text`)}
          </Banner>
          <Divider />
        </>
      ) : (
        <>
          <Panel variant="plain" level={2} title={t("reg04.docsTitle")} density="portal" locale={locale}>
            {/* No document needed is the rules' answer for this registration, not a gap. */}
            {step.documents.length === 0 ? (
              <EmptyState variant="governed" title={t("reg04.emptyTitle")} density="portal" locale={locale}>
                {t("reg04.emptyText")}
              </EmptyState>
            ) : (
              documents(step.documents, rulesSlot, t("reg04.docsTitle"))
            )}
            {step.afterSending.length > 0 ? (
              <Panel
                variant="sunken"
                level={3}
                title={t("reg04.afterTitle")}
                description={t("reg04.afterText")}
                inset={phone ? "sm" : "md"}
                density="portal"
                locale={locale}
              >
                <ItemList
                  items={step.afterSending.map((item) => ({ key: item, title: t(`reg.doc.${item}`) }))}
                  readOnly
                  label={t("reg04.afterTitle")}
                  density="portal"
                  locale={locale}
                />
              </Panel>
            ) : null}
          </Panel>
          <Divider />
          <Panel variant="plain" level={2} title={t("reg04.claimsTitle")} meta={t("reg04.optional")} density="portal" locale={locale}>
            <Text size="base">{t("reg04.consequence")}</Text>
            {step.claims.map((claim) => (
              <Panel
                key={`${claim.kind}-${claim.layer}`}
                variant="sunken"
                level={3}
                title={t(`reg04.claimTitle.${claim.kind}`, { layer: t(`reg.layer.${claim.layer}`) })}
                status={{ family: "neutral", label: t("reg04.notSent") }}
                description={t("reg04.claimFor", { period: span(claim.period, locale) })}
                inset={phone ? "sm" : "md"}
                density="portal"
                locale={locale}
              >
                {documents(claim.documents, (document) => claimSlot(claim, document), t("reg04.evCaption"))}
              </Panel>
            ))}
            <Text size="sm" tone="secondary">
              {t("reg04.noRemove")}
            </Text>
            <ClaimForm
              copy={{
                addClaim: t("reg04.addClaim"),
                kindLegend: t("reg04.kindLegend"),
                kindOptions: [
                  { value: "NON_USE", label: t("reg04.kindNon") },
                  { value: "DIRECT_LICENCE", label: t("reg04.kindDirect") },
                ],
                layerLabel: t("reg04.layerLabel"),
                layerPlaceholder: t("reg04.layerPh"),
                layerOptions: LAYERS.map((layer) => ({ value: layer, label: t(`reg.layer.${layer}`) })),
                periodLabel: t("reg04.periodLabel"),
                periodHelp: t("reg04.periodHelp", { from: day(draft.period.from, locale), to: day(draft.period.to, locale) }),
                fromLabel: t("reg04.fromLabel"),
                toLabel: t("reg04.toLabel"),
                addTheClaim: t("reg04.addTheClaim"),
                cancel: t("reg04.cancel"),
              }}
              action={addClaim.bind(null, reference)}
              initial={
                attempt !== null
                  ? { kind: attempt.kind, layer: attempt.layer, from: attempt.from, to: attempt.to, layerError: claimError("layer"), periodError: claimError("period") }
                  : null
              }
              period={draft.period}
              today={step.today}
              phone={phone}
              locale={locale}
            />
          </Panel>
          <Divider />
          <div aria-live="polite" style={{ minWidth: 0 }}>
            <Panel
              variant="plain"
              level={2}
              title={still > 0 ? stillTitle : t("reg04.stillNone")}
              {...(still === 0 ? { description: t("reg04.stillNoneText") } : {})}
              density="portal"
              locale={locale}
            >
              {still > 0 ? (
                <ItemList
                  items={step.stillNeeded.map((need) => ({ key: missingKey(need), title: missingTitle(need, t), detail: missingFor(need, t) }))}
                  readOnly
                  label={stillTitle}
                  density="portal"
                  locale={locale}
                />
              ) : null}
            </Panel>
          </div>
          <Divider />
        </>
      )}
      <ButtonRow>
        <Button
          variant="primary"
          size="md"
          href={routes.applicationReview(reference)}
          disabled={nextReason !== null}
          {...(nextReason !== null ? { disabledReason: nextReason } : {})}
          fullWidth={phone}
          locale={locale}
        >
          {t("reg04.next")}
        </Button>
        <Button variant="secondary" size="md" href={routes.applicationFacts(reference)} fullWidth={phone} locale={locale}>
          {t("reg04.back")}
        </Button>
        <Button variant="quiet" size="md" href={routes.applications()} fullWidth={phone} locale={locale}>
          {t("reg04.leave")}
        </Button>
      </ButtonRow>
    </Panel>
  );
}

/**
 * One document of a list, with the shorter words a phone card uses beside it. A document refused on the last
 * attempt says why under it.
 */
function entry(document: RequiredDocument, slot: string, refused: EvidenceAttempt["document"], t: Translate, locale: Locale): UploadEntry {
  const megabytes = (bytes: number) => t("reg04.megabytes", { n: count(bytes / 1_000_000, locale) });
  const title = t(`reg.doc.${document.item}`);
  const status = document.status;
  const base = { key: slot, title, message: null, add: null, more: [], busy: false };
  switch (status.state) {
    case "RECEIVED":
      return {
        ...base,
        family: "positive",
        detail: t("reg04.received", { date: day(status.receivedOn, locale), file: status.file.name, size: megabytes(status.file.sizeBytes) }),
        card: { label: t("reg04.receivedWord"), detail: day(status.receivedOn, locale) },
      };
    case "UPLOADING": {
      const progress = t("reg04.progress", { percent: percent(status.percent, locale), size: megabytes(status.file.sizeBytes) });
      return {
        ...base,
        family: "info",
        detail: t("reg04.uploading", { file: status.file.name, progress }),
        // The drawn upload in flight: its Stop control has nothing behind it, as there is no upload to stop.
        more: [{ label: t("reg04.stopUpload"), icon: "x", variant: "quiet" }],
        card: { label: t("reg04.uploadingWord"), detail: progress },
        busy: true,
      };
    }
    case "NEEDED": {
      const refusal = refused !== null && refused.target === slot ? refused.code : status.refusal;
      return {
        ...base,
        family: "attention",
        detail: t("reg04.needed"),
        add: { target: slot, label: t("reg04.addDoc"), variant: "secondary", disabledReason: null },
        message: refusal !== null ? { severity: "error", text: t(DOCUMENT_ERRORS[refusal] ?? "reg.errText") } : null,
        card: { label: t("reg04.needed"), detail: null },
      };
    }
  }
}
