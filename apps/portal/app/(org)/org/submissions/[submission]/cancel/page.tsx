import { R1_FORMAT } from "@rightone/formatting";
import { notFound, redirect } from "next/navigation";
import { Banner, FactList, PageHeader, Panel, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { orgContext, orgNav } from "@/components/shells/org-nav";
import { Text } from "@/components/Text";
import { CancelSubmissionForm } from "@/features/submissions/CancelSubmissionForm";
import { StatePoll } from "@/features/submissions/StatePoll";
import { cancelSubmission } from "@/features/submissions/actions";
import { channelAndFormat, participationLine, subTranslator, submissionMeta, submissionStatus } from "@/features/submissions/copy";
import { readForPage } from "@/lib/api/flash";
import { loadParticipationStanding } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { loadCancellation, reviewFor, type CancelAttempt, type OrgReader } from "@/lib/api/submissions";
import { getLocale } from "@/lib/i18n/locale";
import { CAT24_VIEWS } from "@/lib/mock/submissions";
import { routes } from "@/lib/routes";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/** How often the open form asks whether processing has begun. */
const POLL_MS = 15_000;

/**
 * SCR-CAT-24 Cancel a submission. While the submission is still RECEIVED the administrator gives a reason and
 * cancels it, after a confirmation that names what is lost; SCR-CAT-05 then reads it back cancelled, under the
 * reference it kept. Once processing has begun the form is replaced, not disabled, by the refusal and the way to
 * the outcomes; the page checks the state while the form is open so the switch happens in place.
 */
export default async function CancelSubmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ submission: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const cmo = await requireCmo();
  const [{ submission: reference }, query] = await Promise.all([params, searchParams]);
  const [locale, frame, standing] = await Promise.all([getLocale(), getFrame(query), loadParticipationStanding(cmo)]);
  const t = subTranslator(locale);
  const view = reviewFor(cmo, query, CAT24_VIEWS);
  const kept = view === null ? readForPage<CancelAttempt>(query) : null;
  const outcome = view === "loading" ? null : await loadCancellation(cmo, reference, view, kept?.page === "cancel" ? kept : null);
  if (outcome?.failure?.code === "SUBMISSION_NOT_FOUND") notFound();
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const submission = data?.submission ?? null;
  // A cancelled submission has nothing left to cancel: its own page says so, under the reference it kept.
  if (submission?.state === "CANCELLED") redirect(routes.orgSubmission(submission.reference));
  const phone = frame === "phone";
  const reader: OrgReader = data?.reader ?? {
    organisationName: cmo.organisationName,
    account: cmo.account,
    participation: { reference: standing.reference, state: standing.state },
  };
  const viewState = view === "loading" ? "loading" : failure === null ? "populated" : failure.code === "NOT_YOUR_SUBMISSION" ? "refused" : "error";
  const shown = submission?.reference ?? reference;
  const open = submission?.state === "RECEIVED";
  const records = submission?.records ?? null;
  const entered = data?.entered ?? null;

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={orgNav("submissions", standing.open, locale)}
      account={reader.account}
      context={orgContext(reader.organisationName, participationLine(t, reader.participation), locale)}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("cat24.crumb"), href: routes.orgSubmission(shown) }]}
          title={t("cat24.title", { reference: shown })}
          {...(submission !== null ? { status: submissionStatus(t, submission.state), meta: submissionMeta(t, submission, locale) } : {})}
          locale={locale}
        />
        <ViewState
          view={viewState}
          refusal={{ code: "NOT_YOUR_SUBMISSION", title: t("cat05.refusedTitle"), text: t("sub.refusal.NOT_YOUR_SUBMISSION"), family: "neutral" }}
          {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
          {...(failure !== null ? { retryable: failure.retryable } : {})}
          errorText={t("cat24.errorText")}
          density="portal"
          rows={4}
          locale={locale}
        >
          {submission !== null ? (
            <div style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0, 1fr)" : "minmax(0, 1fr) var(--container-sm)", gap: "var(--space-6)", alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
                {open ? (
                  <>
                    <Banner family="attention" title={t("cat24.windowTitle")} density="portal" locale={locale}>
                      {t("cat24.windowText")}
                    </Banner>
                    <CancelSubmissionForm
                      copy={{
                        reasonTitle: t("cat24.reasonTitle"),
                        reason: t("cat24.reason"),
                        reasonHelp: t("cat24.reasonHelp"),
                        cancel: t("cat24.cancelSub", { reference: submission.reference }),
                        keep: t("cat24.keep"),
                        missing: t("sub.refusal.FIELD_MISSING", { field: t("sub.field.reason") }),
                        title: t("cat24.dlgTitle", { reference: submission.reference }),
                        text: records !== null ? t("cat24.dlgText", { count: R1_FORMAT.formatCount(records, locale) ?? "" }) : t("cat24.dlgTextAny"),
                        confirm: t("cat24.dlgYes"),
                        back: t("cat24.dlgNo"),
                      }}
                      action={cancelSubmission.bind(null, submission.reference)}
                      // The board types its sample reason; a person starts from what a refused attempt kept, or nothing.
                      initialReason={view !== null ? t("cat24.reasonSample") : (entered?.reason ?? "")}
                      refusal={entered?.refusal === "FIELD_MISSING" ? t("sub.refusal.FIELD_MISSING", { field: t("sub.field.reason") }) : null}
                      initiallyOpen={view === "confirm"}
                      keepHref={routes.orgSubmission(submission.reference)}
                      phone={phone}
                      locale={locale}
                    />
                    {view === null ? <StatePoll everyMs={POLL_MS} /> : null}
                  </>
                ) : (
                  <Banner
                    family="neutral"
                    title={t("cat24.beganTitle")}
                    role="alert"
                    action={{ label: t("cat24.toOutcomes"), href: routes.orgSubmission(submission.reference), variant: "primary" }}
                    density="portal"
                    locale={locale}
                  >
                    {t("cat24.beganText")}
                  </Banner>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
                <Panel as="aside" title={t("cat24.subTitle")} density="portal" locale={locale}>
                  <FactList
                    items={[
                      { label: t("cat05.fReference"), value: submission.reference, kind: "id" },
                      { label: t("cat05.fRecords"), value: records, kind: "count" },
                      { label: t("cat05.fChannel"), value: channelAndFormat(t, submission) },
                      { label: t("cat05.fReceived"), value: submission.receivedAt, kind: "datetime" },
                    ]}
                    locale={locale}
                  />
                </Panel>
                <Panel as="aside" title={t("cat24.keepsTitle")} density="portal" locale={locale}>
                  <Text size="base">{t("cat24.keepsText", { reference: submission.reference })}</Text>
                </Panel>
              </div>
            </div>
          ) : null}
        </ViewState>
      </div>
    </PortalShell>
  );
}
