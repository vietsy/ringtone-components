import { redirect } from "next/navigation";
import { Banner, FactList, PageHeader, Panel, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { orgContext, orgNav } from "@/components/shells/org-nav";
import { PortalShell } from "@/components/shells/PortalShell";
import { lodgeAnswer } from "@/features/participation/actions";
import { day, participationStatus, partTranslator } from "@/features/participation/copy";
import { ObjectionForm } from "@/features/participation/ObjectionForm";
import { readForPage } from "@/lib/api/flash";
import { loadObjectionStep, loadParticipationStanding, type ObjectionAttempt, type ObjectionRecord, type ObjectionStep } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CAT25_VIEWS } from "@/lib/mock/participation";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-CAT-25 Objection and data-subject request. The organisation answers a decision about its participation
 * that it has been notified of: it objects, or asks for its personal data to be corrected or erased, with its
 * ground; it reads the request back with its due date, and the decision and its ground once one is taken.
 *
 * Entered from SCR-CAT-02 for the decision the notice names (`?decision=`). Without one there is nothing to
 * answer and the page goes back there; a reference that names no decision notified to this organisation is
 * the board's not-found state.
 */
export default async function ObjectionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cmo = await requireCmo();
  const params = await searchParams;
  const [locale, frame, standing] = await Promise.all([getLocale(), getFrame(params), loadParticipationStanding(cmo)]);
  const t = partTranslator(locale);
  const view = reviewView(params, CAT25_VIEWS);
  const decision = typeof params.decision === "string" && params.decision.trim() !== "" ? params.decision.trim() : null;
  if (view === null && decision === null) redirect(routes.orgParticipation());

  const outcome = view === "loading" ? null : await loadObjectionStep(cmo, decision, view, locale);
  const step = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const kept = readForPage<ObjectionAttempt>(params);
  const attempt = view === null && kept?.page === "objection" && kept.decision === decision ? kept : null;
  const phone = frame === "phone";

  const participation = step?.participation ?? null;
  const organisation = participation !== null ? participation.organisation : cmo.organisationName;
  const line =
    participation !== null
      ? t(participation.state === "SUSPENDED" ? "part.contextSuspended" : "part.context", { reference: participation.reference })
      : standing.reference !== null
        ? t("part.context", { reference: standing.reference })
        : t("part.contextNone");

  return (
    <div style={{ position: "relative" }}>
      <PortalShell
        fill
        layout={phone ? "phone" : "desktop"}
        nav={orgNav("participation", standing.open, locale)}
        account={cmo.account}
        context={orgContext(organisation, line, locale)}
        locale={locale}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
          <PageHeader
            crumbs={[{ label: t("part.crumb"), href: routes.orgParticipation() }]}
            title={t("part25.title")}
            {...(participation !== null ? { status: participationStatus(participation.state, t) } : {})}
            meta={t("part25.meta")}
            locale={locale}
          />
          <ViewState
            view={view === "loading" ? "loading" : failure === null ? "populated" : failure.code === "OBJECTION_UNKNOWN" ? "refused" : "error"}
            refusal={{ code: "OBJECTION_UNKNOWN", title: t("part25.refusedTitle"), text: t("part.refusal.OBJECTION_UNKNOWN"), family: "neutral" }}
            {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
            errorText={t("part25.errorText")}
            density="portal"
            rows={6}
            locale={locale}
          >
            {step !== null ? (
              <div style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0, 1fr)" : "minmax(0, 1fr) var(--container-sm)", gap: "var(--space-6)", alignItems: "start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
                  <Answer step={step} attempt={attempt} confirm={view === "confirm"} phone={phone} t={t} locale={locale} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
                  <Panel title={t("part25.answeringTitle")} density="portal" locale={locale}>
                    <FactList items={answering(step, t, locale)} locale={locale} />
                  </Panel>
                  <Panel title={t("part25.periodTitle")} density="portal" locale={locale}>
                    <Text size="base">{t("part25.periodText")}</Text>
                    <Text size="base">{t("part25.inForce")}</Text>
                  </Panel>
                </div>
              </div>
            ) : null}
          </ViewState>
        </div>
      </PortalShell>
    </div>
  );
}

/** The request form while nothing is lodged; the lodged request while it is open; the decision once taken. */
function Answer({
  step,
  attempt,
  confirm,
  phone,
  t,
  locale,
}: {
  step: ObjectionStep;
  attempt: ObjectionAttempt | null;
  confirm: boolean;
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const { objection } = step;
  if (objection === null) {
    return (
      <ObjectionForm
        action={lodgeAnswer.bind(null, step.decision.reference)}
        decision={step.decision.reference}
        dueBy={step.dueBy}
        initial={
          attempt !== null
            ? { requested: attempt.requested, ground: attempt.ground }
            : { requested: confirm ? "objection" : null, ground: step.ground }
        }
        flagged={attempt?.refusal.code === "FIELD_MISSING" ? attempt.refusal.fields : []}
        openOnArrival={confirm}
        phone={phone}
        locale={locale}
      />
    );
  }
  if (objection.outcome === null) {
    // A second lodging about the same decision is refused, and the one already lodged is what stands.
    const refused = attempt?.refusal.code === "OBJECTION_ALREADY_OPEN";
    return (
      <>
        <Banner family="info" title={t("part25.openTitle", { date: day(objection.dueAt, locale) })} {...(refused ? { code: "OBJECTION_ALREADY_OPEN" } : {})} density="portal" locale={locale} />
        <Panel title={t("part25.lodgedTitle")} density="portal" locale={locale}>
          <FactList items={lodged(objection, t)} locale={locale} />
        </Panel>
      </>
    );
  }
  return (
    <Panel
      title={t("part25.decidedTitle")}
      status={{ family: "neutral", label: t(`part25.outcome.${objection.outcome.outcome}`) }}
      density="portal"
      locale={locale}
    >
      <FactList
        items={[
          { label: t("part25.fAsked"), value: t(`part25.kind.${objection.requested}`) },
          { label: t("part25.fYourGround"), value: objection.ground },
          { label: t("part25.fDecisionGround"), value: objection.outcome.ground },
          { label: t("part25.fDecided"), value: objection.outcome.decidedAt, kind: "datetime", note: t("part25.decidedNote", { name: objection.outcome.decidedBy }) },
        ]}
        locale={locale}
      />
    </Panel>
  );
}

/** "What you are answering": the decision, the reference the notice gave, and the reason recorded. */
function answering(step: ObjectionStep, t: Translate, locale: Locale) {
  const { decision } = step;
  return [
    {
      label: t("part25.fDecision"),
      value: {
        family: "danger" as const,
        plain: true,
        label: t("part25.decisionSuspension"),
        detail: t("part25.effectiveFrom", { date: day(decision.effectiveFrom, locale) }),
      },
      kind: "status" as const,
    },
    { label: t("part25.fReference"), value: decision.reference, kind: "id" as const, note: t("part25.referenceNote") },
    { label: t("part25.fReason"), value: decision.reason },
  ];
}

function lodged(objection: ObjectionRecord, t: Translate) {
  return [
    { label: t("part25.fObjection"), value: objection.reference, kind: "id" as const },
    { label: t("part25.fRequest"), value: t(`part25.kind.${objection.requested}`) },
    { label: t("part25.fLodged"), value: objection.lodgedAt, kind: "datetime" as const },
    { label: t("part25.fDue"), value: objection.dueAt, kind: "date" as const },
  ];
}
