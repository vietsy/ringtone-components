import { redirect } from "next/navigation";
import { PageHeader, ViewState } from "@/components/r1";
import { orgContext, orgNav } from "@/components/shells/org-nav";
import { PortalShell } from "@/components/shells/PortalShell";
import { actOnApplication } from "@/features/participation/actions";
import { ApplicationForm } from "@/features/participation/ApplicationForm";
import { contextLine, day, partTranslator, time } from "@/features/participation/copy";
import { readForPage } from "@/lib/api/flash";
import {
  REPERTOIRES,
  RIGHTS,
  TERRITORIES,
  loadApplicationForm,
  loadParticipationStanding,
  type ApplicationAttempt,
} from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { CAT01_VIEWS } from "@/lib/mock/participation";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-CAT-01 Participation application. The administrator applies for their own organisation: what the party
 * register holds, the authority evidence, contacts and the scope asked for. Save draft keeps it; Submit
 * application creates the participation at APPLIED and opens SCR-CAT-02, where it waits for its approvals.
 *
 * Entered where the organisation has no participation (CAT 03); one that has, unless it was withdrawn, is
 * sent to SCR-CAT-02, which says where it stands.
 */
export default async function ApplyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cmo = await requireCmo();
  const params = await searchParams;
  const [locale, frame, standing] = await Promise.all([getLocale(), getFrame(params), loadParticipationStanding(cmo)]);
  const t = partTranslator(locale);
  const view = reviewView(params, CAT01_VIEWS);
  if (view === null && standing.state !== null && standing.state !== "WITHDRAWN") redirect(routes.orgParticipation());

  const outcome = view === "loading" ? null : await loadApplicationForm(cmo, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const kept = readForPage<ApplicationAttempt>(params);
  const attempt = view === null && kept?.page === "apply" ? kept : null;
  const phone = frame === "phone";

  // A refused submission shows every value as typed and its refusal; otherwise the draft, with what it lacks.
  const refusal = attempt?.refusal ?? null;
  const flagged = refusal !== null ? (refusal.code === "FIELD_MISSING" ? refusal.fields : []) : (data?.missing ?? []);
  const periodError = refusal !== null && refusal.code !== "FIELD_MISSING" ? t(`part.refusal.${refusal.code}`) : null;
  const savedAt = data?.savedAt ?? null;
  // A review state with data draws the board's organisation, which has no participation; otherwise the
  // signed-in organisation, as its standing reads.
  const drawn = view !== null && data !== null;
  const organisation = drawn ? data.organisation.legalName : cmo.organisationName;
  const line = drawn ? t("part.contextNone") : contextLine(standing, t);

  return (
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
          crumbs={[{ label: t("part.crumb") }]}
          title={t("part01.title")}
          {...(savedAt !== null ? { status: { family: "neutral" as const, label: t("part.draft") }, meta: t("part01.meta", { time: time(savedAt), date: day(savedAt, locale) }) } : {})}
          locale={locale}
        />
        <ViewState
          view={view === "loading" ? "loading" : failure === null ? "populated" : failure.code === "ROLE_OUT_OF_SCOPE" ? "refused" : "error"}
          refusal={{ code: "ROLE_OUT_OF_SCOPE", title: t("part01.refusedTitle"), text: t("part.refusal.ROLE_OUT_OF_SCOPE"), family: "neutral" }}
          {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
          errorText={t("part01.errorText")}
          density="portal"
          rows={8}
          locale={locale}
        >
          {data !== null ? (
            <ApplicationForm
              // A save or a refused submission draws the form afresh from what the server now holds.
              key={`${savedAt ?? "unsaved"}-${typeof params.attempt === "string" ? params.attempt : ""}`}
              action={actOnApplication}
              organisation={data.organisation}
              fields={attempt?.fields ?? data.fields}
              flagged={flagged}
              periodError={periodError}
              registers={{ rights: RIGHTS, repertoires: REPERTOIRES, territories: TERRITORIES }}
              phone={phone}
              locale={locale}
            />
          ) : null}
        </ViewState>
      </div>
    </PortalShell>
  );
}
