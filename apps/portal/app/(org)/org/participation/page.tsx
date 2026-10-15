import { redirect } from "next/navigation";
import { Banner, Button, DateField, FactList, NavList, PageHeader, Panel, StatusLine, Table, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { orgContext, orgNav } from "@/components/shells/org-nav";
import { PortalShell } from "@/components/shells/PortalShell";
import { amendmentDetail, count, day, participationStatus, partTranslator, time } from "@/features/participation/copy";
import { readDate } from "@/features/participation/fields";
import { loadMyParticipation, loadParticipationStanding, type MyParticipation, type ScopeView } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CAT02_READERS, CAT02_STATES, CAT02_VIEWS } from "@/lib/mock/participation";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-CAT-02 My participation and represented scope. The organisation reads its participation's state and the
 * scope in force on a date it chooses, with each right-and-territory combination the scope leaves out named;
 * from here it proposes an amendment (SCR-CAT-03) or answers a notified decision (SCR-CAT-25).
 *
 * Portal sign-in and the nav's Participation land here. An organisation with no participation has nothing to
 * read here yet and goes to the application (SCR-CAT-01, "where the organisation has no participation").
 *
 * Review: `?view=`, `?state=` and `?reader=` draw the board's axes; each state is drawn for the organisation
 * the board draws in it.
 */
export default async function ParticipationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const cmo = await requireCmo();
  const params = await searchParams;
  const [locale, frame, standing] = await Promise.all([getLocale(), getFrame(params), loadParticipationStanding(cmo)]);
  const t = partTranslator(locale);
  const view = reviewView(params, CAT02_VIEWS);
  const state = reviewView({ view: params.state }, CAT02_STATES);
  const reader = reviewView({ view: params.reader }, CAT02_READERS);
  const reviewing = view !== null || state !== null || reader !== null;
  const legal = reader === "legal";

  // The date is a visible control with no hidden default (CAT 03 convention 3): today until one is chosen; a
  // cleared date resolves nothing.
  const asked = params.as_of;
  const asOf = typeof asked === "string" ? readDate(asked) : undefined;
  const outcome =
    view === "loading" ? null : await loadMyParticipation(cmo, asOf, reviewing ? { view: view ?? "populated", state: state ?? "active" } : null, locale);
  if (!reviewing && outcome !== null && outcome.data === null && outcome.failure === null) redirect(routes.orgApply());
  const page = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const participation = page?.participation ?? null;
  const phone = frame === "phone";

  const organisation = reviewing && participation !== null ? participation.organisation : cmo.organisationName;
  const reference = reviewing ? (participation?.reference ?? null) : standing.reference;
  const line = reference !== null ? t("part.context", { reference }) : t("part.contextNone");
  const status = participation !== null ? participationStatus(participation.state, t) : null;
  const amendOff = participation !== null ? amendmentBlocked(participation, t, locale) : null;
  const waiting = participation?.state === "APPLIED" || participation?.state === "APPROVED";

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={legal ? [] : orgNav("participation", standing.open, locale)}
      account={legal ? (page?.legalReader ?? cmo.account) : cmo.account}
      context={orgContext(organisation, line, locale)}
      {...(legal ? { surfaceLabel: t("part.surfaceLegal") } : {})}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("part.crumb") }]}
          title={t("part02.title")}
          {...(status !== null ? { status } : {})}
          {...(participation !== null ? { meta: meta(participation, t, locale) } : {})}
          locale={locale}
        >
          {/* Download evidence is left out: the mock keeps no file to download (README). */}
          {!legal && participation !== null ? (
            <Button
              variant="primary"
              size="md"
              href={routes.orgAmendScope()}
              disabled={amendOff !== null}
              {...(amendOff !== null ? { disabledReason: amendOff } : {})}
              locale={locale}
            >
              {t("part02.amend")}
            </Button>
          ) : null}
        </PageHeader>
        {participation !== null && participation.stop !== null ? <StopBanner participation={participation} legal={legal} t={t} locale={locale} /> : null}
        <ViewState
          view={
            view === "loading"
              ? "loading"
              : failure !== null
                ? failure.code === "ROLE_OUT_OF_SCOPE"
                  ? "refused"
                  : "error"
                : waiting
                  ? "empty"
                  : "populated"
          }
          {...(participation !== null && waiting ? { empty: { variant: "governed", title: waitingSentence(participation, t, locale) } } : {})}
          refusal={{ code: "ROLE_OUT_OF_SCOPE", title: t("part02.refusedTitle"), text: t("part.refusal.ROLE_OUT_OF_SCOPE"), family: "neutral" }}
          {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
          errorText={t("part02.errorText")}
          density="portal"
          rows={6}
          locale={locale}
        >
          {participation !== null ? (
            <div style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0, 1fr)" : "minmax(0, 1fr) var(--container-sm)", gap: "var(--space-6)", alignItems: "start" }}>
              <Panel
                title={t("part02.scopeTitle")}
                description={legal ? t("part02.scopeDescLegal", { org: participation.shortName }) : t("part02.scopeDesc")}
                density="portal"
                locale={locale}
              >
                <AsAt scope={page?.scope ?? null} params={params} t={t} locale={locale} />
                {page !== null && page.scope !== null ? <Scope scope={page.scope} participation={participation} phone={phone} t={t} locale={locale} /> : null}
              </Panel>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
                <Panel title={t("part02.factsTitle")} density="portal" locale={locale}>
                  <FactList items={facts(participation, t, locale)} locale={locale} />
                </Panel>
                {!legal && links(participation, t, locale).length > 0 ? (
                  <Panel density="portal" locale={locale}>
                    <NavList title={t("part02.changesTitle")} items={links(participation, t, locale)} />
                  </Panel>
                ) : null}
                {/* The legal reader's stop controls open SCR-CAT-21 and 22, which have no route here (README). */}
              </div>
            </div>
          ) : null}
        </ViewState>
      </div>
    </PortalShell>
  );
}

/** The header's line, per state, in the board's words. */
function meta(participation: MyParticipation, t: Translate, locale: Locale): string {
  const { state, effectiveFrom, stop } = participation;
  const from = effectiveFrom !== null ? day(effectiveFrom, locale) : "";
  switch (state) {
    case "APPLIED":
      return participation.appliedAt !== null ? t("part02.metaApplied", { time: time(participation.appliedAt), date: day(participation.appliedAt, locale) }) : "";
    case "APPROVED":
      return t("part02.metaApproved", { date: participation.approvedOn !== null ? day(participation.approvedOn, locale) : "", from });
    case "ACTIVE":
      return [t("part02.metaActive", { date: from }), ...(participation.lastReviewedOn !== null ? [t("part02.metaReviewed", { date: day(participation.lastReviewedOn, locale) })] : [])].join(" ");
    case "SUSPENDED":
      return t("part02.metaSuspended", { from, date: stop !== null ? day(stop.effectiveFrom, locale) : "" });
    case "WITHDRAWN":
      return t("part02.metaWithdrawn", { from, date: stop !== null ? day(stop.effectiveFrom, locale) : "" });
  }
}

/** Why the scope cannot be amended in this state, or null when it can (Amend scope: "State is ACTIVE"). */
function amendmentBlocked(participation: MyParticipation, t: Translate, locale: Locale): string | null {
  switch (participation.state) {
    case "ACTIVE":
      return null;
    case "APPLIED":
      return t("part02.amendOffApplied");
    case "APPROVED":
      return t("part02.amendOffApproved", { date: participation.effectiveFrom !== null ? day(participation.effectiveFrom, locale) : "" });
    case "SUSPENDED":
      return t("part02.amendOffSuspended");
    case "WITHDRAWN":
      return t("part02.amendOffWithdrawn");
  }
}

/** Before it is active no scope is in force: the governed empty state says why and until when. */
function waitingSentence(participation: MyParticipation, t: Translate, locale: Locale): string {
  return participation.state === "APPROVED" && participation.effectiveFrom !== null
    ? t("part02.emptyApproved", { date: day(participation.effectiveFrom, locale) })
    : t("part02.emptyApplied");
}

/** A suspension or a withdrawal, with its recorded reason; the legal reader is not offered the organisation's way on. */
function StopBanner({ participation, legal, t, locale }: { participation: MyParticipation; legal: boolean; t: Translate; locale: Locale }) {
  const stop = participation.stop;
  if (stop === null) return null;
  const suspended = stop.kind === "suspension";
  // The organisation's sentence and code are the organisation's; the legal reader reads the reason alone.
  const own = !(legal && suspended);
  const action = legal
    ? null
    : suspended
      ? participation.decision !== null
        ? { label: t("part02.answerThis"), href: routes.orgObjection(participation.decision), variant: "secondary" as const }
        : null
      : { label: t("part02.applyAgain"), href: routes.orgApply(), variant: "secondary" as const };
  return (
    <Banner
      family={suspended ? "danger" : "neutral"}
      title={t(suspended ? "part02.suspendedTitle" : "part02.withdrawnTitle", { date: day(stop.effectiveFrom, locale) })}
      {...(suspended && own ? { code: "PARTICIPATION_SUSPENDED" } : {})}
      {...(action !== null ? { action } : {})}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <Text>{t("part02.reason", { reason: stop.reason })}</Text>
        {own ? <Text>{suspended ? t("part02.suspendedText") : t("part02.withdrawnText", { count: count(stop.claimsKept ?? 0, locale) })}</Text> : null}
      </div>
    </Banner>
  );
}

/**
 * The date the scope is read for and Show, as a form that reloads the page for that date. Review keeps its
 * axes across the reload.
 */
function AsAt({ scope, params, t, locale }: { scope: ScopeView | null; params: SearchParams; t: Translate; locale: Locale }) {
  const kept = (["view", "state", "reader", "frame"] as const).flatMap((name) => {
    const value = params[name];
    return typeof value === "string" ? [{ name, value }] : [];
  });
  return (
    <form action={routes.orgParticipation()} noValidate>
      {kept.map(({ name, value }) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--space-3)" }}>
        <DateField
          label={t("part02.asAt")}
          {...(scope !== null ? { value: scope.asOf } : { error: t("part.refusal.AS_OF_REQUIRED") })}
          required
          name="as_of"
          width="var(--space-56)"
          locale={locale}
        />
        <Button type="submit" variant="secondary" size="md" locale={locale}>
          {t("part02.apply")}
        </Button>
      </div>
    </form>
  );
}

/** The combinations the scope leaves out, then the rows in force, as the board draws them. */
function Scope({ scope, participation, phone, t, locale }: { scope: ScopeView; participation: MyParticipation; phone: boolean; t: Translate; locale: Locale }) {
  return (
    <>
      {scope.gaps.map((gap) => (
        <StatusLine
          key={`${gap.right}-${gap.territory}`}
          family="attention"
          text={t(`part02.gap.${gap.right}`, { territory: t(`part.terr.${gap.territory}`) })}
          detail={[t("part02.gapDetail"), ...(gap.addedFrom !== null ? [t("part02.gapAdded", { date: day(gap.addedFrom, locale) })] : [])].join(" ")}
          cutout="surface"
          locale={locale}
        />
      ))}
      <Table
          layout={phone ? "cards" : "table"}
          columns={[
            { key: "right", label: t("part02.cRight"), kind: "strong" },
            { key: "rep", label: t("part02.cRep") },
            { key: "terr", label: t("part02.cTerr") },
            { key: "from", label: t("part02.cFrom"), kind: "date" },
            { key: "to", label: t("part02.cTo") },
            { key: "sup", label: t("part02.cSup"), kind: "status", help: t("part02.supHelp") },
          ]}
          rows={scope.rows.map((row) => ({
            _key: `${row.right}-${row.repertoire}-${row.territory}-${row.from}`,
            right: t(`part.right.${row.right}`),
            rep: t(`part.rep.${row.repertoire}`),
            terr: t(`part.terr.${row.territory}`),
            from: row.from,
            to: row.to !== null ? day(row.to, locale) : t("part02.open"),
            sup:
              row.claimedSubjects > 0
                ? { family: "neutral", label: t("part02.supported"), plain: true, detail: t("part02.supportedDetail", { n: count(row.claimedSubjects, locale) }) }
                : { family: "attention", label: t("part02.notSupported"), plain: true, detail: t("part02.notSupportedDetail") },
          }))}
          empty={{
            variant: "governed",
            action: false,
            title: t("part02.tableEmpty", { date: day(scope.asOf, locale) }),
            // The board names the three rows Sông Cầu's withdrawal closed (README).
            ...(participation.state === "WITHDRAWN" ? { text: t("part02.closedRows") } : {}),
          }}
          density="org"
          caption={t("part02.scopeTitle")}
          sortNote={t("part02.sortNote")}
          locale={locale}
        />
    </>
  );
}

/** "This participation": what the board lists for the state. */
function facts(participation: MyParticipation, t: Translate, locale: Locale) {
  const { state, stop, kind, approvedOn, effectiveFrom } = participation;
  const byOn = stop !== null ? t("part02.byOn", { name: stop.decidedBy, date: day(stop.decidedOn, locale) }) : "";
  return [
    { label: t("part02.fOrg"), value: participation.organisation, provenance: "registry-sourced" as const },
    { label: t("part02.fRef"), value: participation.reference, kind: "id" as const },
    ...((state === "ACTIVE" || state === "SUSPENDED") && kind !== null ? [{ label: t("part02.fKind"), value: t(`part02.kind.${kind}`) }] : []),
    ...(state === "ACTIVE" && approvedOn !== null ? [{ label: t("part02.fEighth"), value: approvedOn, kind: "date" as const }] : []),
    ...(state === "ACTIVE" && effectiveFrom !== null ? [{ label: t("part02.fActive"), value: effectiveFrom, kind: "date" as const }] : []),
    ...(state === "APPROVED" && effectiveFrom !== null ? [{ label: t("part02.fTakes"), value: effectiveFrom, kind: "date" as const }] : []),
    ...(state === "SUSPENDED" ? [{ label: t("part02.fSuspendedBy"), value: byOn }] : []),
    ...(state === "WITHDRAWN" ? [{ label: t("part02.fWithdrawnBy"), value: byOn }] : []),
  ];
}

/**
 * "Changes and answers": each pending amendment, and the way to answer a decision, open only once one has
 * been notified. A suspension offers its own answer; a withdrawal offers none here (its banner says the route).
 * An amendment's line carries no link: its route takes no reference to open it by (README).
 */
function links(participation: MyParticipation, t: Translate, locale: Locale) {
  const { stop, decision } = participation;
  if (stop?.kind === "withdrawal") return [];
  if (stop?.kind === "suspension") {
    return decision !== null
      ? [{ label: t("part02.answerSuspension"), detail: t("part02.answerSuspensionDetail"), icon: "scale", href: routes.orgObjection(decision) }]
      : [];
  }
  return [
    ...participation.amendments.map((amendment) => ({
      label: t("part02.amendmentLink", { reference: amendment.reference }),
      detail: amendmentDetail(amendment, t, locale),
      icon: "file-text",
    })),
    decision !== null
      ? { label: t("part02.answer"), icon: "scale", href: routes.orgObjection(decision) }
      : { label: t("part02.answer"), icon: "scale", disabled: true, reason: t("part02.answerOff") },
  ];
}
