import type { ReactNode } from "react";
import { Button, Columns, PageHeader, Panel, Stepper, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import type { ApplicationDraft, DraftStep } from "@/lib/api/registration";
import { requirePrincipal } from "@/lib/api/session";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import type { Frame } from "@/lib/view/frame";
import type { LoadOutcome } from "@rightone/ui";
import { applicationStatus, span } from "./copy";

type Failure = NonNullable<LoadOutcome<unknown>["failure"]>;

const STEPS: readonly DraftStep[] = ["facts", "evidence", "review", "attestation"];
const STEP_ROUTE: Readonly<Record<DraftStep, (application: string) => string>> = {
  facts: routes.applicationFacts,
  evidence: routes.applicationEvidence,
  review: routes.applicationReview,
  attestation: routes.applicationSubmit,
};

/**
 * The frame of the four draft steps (SCR-REG-03 to 06), as the canvas draws each of them: the steps in an
 * aside to the left of the header and the body, one column at 768 px and below. The steps already passed
 * link back; the step's own answers save when the person moves on.
 */
export async function DraftFrame({
  step,
  reference,
  draft,
  title,
  savedAt,
  frame,
  t,
  locale,
  children,
}: {
  step: DraftStep;
  /** The application in the address, for the links when the draft itself could not be read. */
  reference: string;
  draft: ApplicationDraft | null;
  title: string;
  savedAt: string | null;
  frame: Frame;
  t: Translate;
  locale: Locale;
  children: ReactNode;
}) {
  const principal = await requirePrincipal();
  const phone = frame === "phone";
  const narrow = frame !== "desktop";
  const current = STEPS.indexOf(step);
  const linked = draft?.reference ?? reference;
  const steps = STEPS.map((name, index) =>
    index < current
      ? { label: t(`reg.step.${name}`), state: "done" as const, href: STEP_ROUTE[name](linked) }
      : { label: t(`reg.step.${name}`), state: index === current ? ("current" as const) : ("todo" as const) },
  );
  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("applications", frame, locale)}
      account={principal.account}
      {...(draft !== null ? { context: { premises: draft.premises, period: draft.reference } } : {})}
      locale={locale}
    >
      <Columns layout="side-main" side="2xs" single={narrow}>
        {
          // Wide: the steps beside the header and the step's form. Narrow: the header, the steps, then the form.
        }
        <div style={{ order: narrow ? 1 : 0, minWidth: 0 }}>
          <Panel as="aside" title={t("reg.stepsTitle")} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
            <Stepper steps={steps} {...(savedAt !== null ? { savedAt } : {})} label={t("reg.stepsTitle")} locale={locale} />
          </Panel>
        </div>
        <div
          style={
            narrow
              ? { display: "contents" }
              : { display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0, maxWidth: "var(--container-2xl)" }
          }
        >
          <div style={{ minWidth: 0 }}>
            <PageHeader
              crumbs={[{ label: t("reg.crumb"), href: routes.applications() }]}
              title={title}
              {...(draft !== null
                ? {
                    status: applicationStatus("DRAFT", t),
                    meta: t("reg.draftMeta", { step: t(`reg.stepLine.${step}`), kind: t(`reg.kind.${draft.kind}`), period: span(draft.period, locale) }),
                  }
                : {})}
              locale={locale}
            />
          </div>
          <div style={{ order: narrow ? 2 : 0, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>{children}</div>
        </div>
      </Columns>
    </PortalShell>
  );
}

/**
 * The body when the draft itself could not be read: not found (or not the person's to see), not the
 * person's to act for, or our failure. The first two are refusals with their sentence and code.
 */
export function DraftUnavailable({ failure, phone, t, locale }: { failure: Failure; phone: boolean; t: Translate; locale: Locale }) {
  if (failure.code === "APPLICATION_NOT_FOUND") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <ViewState
          view="refused"
          refusal={{ code: failure.code, title: t("reg.notFound.title"), text: t("reg.notFound.text"), family: "attention" }}
          density="portal"
          locale={locale}
        />
        <div>
          <Button variant="secondary" size="md" href={routes.applications()} fullWidth={phone} locale={locale}>
            {t("reg.notFound.back")}
          </Button>
        </div>
      </div>
    );
  }
  if (failure.code === "NOT_AUTHORISED_FOR_PREMISES") {
    return (
      <ViewState
        view="refused"
        refusal={{ code: failure.code, title: t("reg.notAuthorised.title"), text: t("reg.notAuthorised.text"), family: "attention" }}
        density="portal"
        locale={locale}
      />
    );
  }
  return <StepError failure={failure} t={t} locale={locale} />;
}

/** Our failure to read a step: the error state with its trace, never an empty step. */
export function StepError({ failure, t, locale }: { failure: Failure; t: Translate; locale: Locale }) {
  return (
    <ViewState
      view="error"
      errorTitle={t("reg.errTitle")}
      errorText={t("reg.errText")}
      {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
      retryable={failure.retryable}
      density="portal"
      locale={locale}
    />
  );
}
