import { R1_FORMAT } from "@rightone/formatting";
import { notFound } from "next/navigation";
import { Button, DateField, FactList, PageHeader, Panel, Table, ViewState, type Family } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { orgContext, orgNav } from "@/components/shells/org-nav";
import { Text } from "@/components/Text";
import { completenessValue, participationLine, subTranslator } from "@/features/submissions/copy";
import { readDate } from "@/features/submissions/fields";
import { loadParticipationStanding } from "@/lib/api/participation";
import { requireCmo } from "@/lib/api/session";
import { loadClaim, reviewFor, type ClaimPage, type ClaimState, type OrgReader, type ShareRecord } from "@/lib/api/submissions";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CAT07_VIEWS } from "@/lib/mock/submissions";
import { routes } from "@/lib/routes";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/** SM-22 in SCR-CAT-07's state badge: active is a fact, not an achievement, so it is neutral. */
const STATE_FAMILY: Readonly<Record<ClaimState, Family>> = {
  DECLARED: "attention",
  VALIDATED: "attention",
  ACTIVE: "neutral",
  SUPERSEDED: "neutral",
  WITHDRAWN: "danger",
};

/**
 * SCR-CAT-07 Claim detail and shares, as the claiming organisation reads it. The shares are read as at a date,
 * today unless the reader picks another, grouped by kind with a total for each; completeness is DR-30's answer
 * for each kind at that date, in words. Activation is the gateway's catalogue officer's, so the page says so
 * and offers nothing to press.
 *
 * Correct the record (SCR-CAT-14) and Withdraw the claim (SCR-CAT-23) are gateway screens with no portal
 * route (G-12), so they are left out.
 */
export default async function ClaimPageScreen({
  params,
  searchParams,
}: {
  params: Promise<{ claim: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const cmo = await requireCmo();
  const [{ claim: reference }, query] = await Promise.all([params, searchParams]);
  const [locale, frame, standing] = await Promise.all([getLocale(), getFrame(query), loadParticipationStanding(cmo)]);
  const t = subTranslator(locale);
  const view = reviewFor(cmo, query, CAT07_VIEWS);
  // The date the reader asked for: absent, today; cleared or unreadable, refused.
  const asked = typeof query.as_of === "string" ? (readDate(query.as_of) ?? "") : null;
  const outcome = view === "loading" ? null : await loadClaim(cmo, reference, asked, view);
  if (outcome?.failure?.code === "CLAIM_NOT_FOUND") notFound();
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const claim = data?.claim ?? null;
  const phone = frame === "phone";
  const reader: OrgReader = data?.reader ?? {
    organisationName: cmo.organisationName,
    account: cmo.account,
    participation: { reference: standing.reference, state: standing.state },
  };
  const viewState = view === "loading" ? "loading" : failure === null ? "populated" : failure.code === "ROLE_OUT_OF_SCOPE" ? "refused" : "error";
  const date = (value: string) => R1_FORMAT.formatDate(value, locale) ?? "";

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={orgNav("claims", standing.open, locale)}
      account={reader.account}
      context={orgContext(reader.organisationName, participationLine(t, reader.participation), locale)}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("cat07.crumb") }]}
          title={t("cat07.title", { reference: claim?.reference ?? reference })}
          {...(claim !== null
            ? {
                status: { family: STATE_FAMILY[claim.state], label: t(`cat07.state.${claim.state}`) },
                meta: t("cat07.meta", { title: claim.subject.title, territory: claim.territory, from: date(claim.effectiveFrom), recorded: date(claim.recordedOn) }),
              }
            : {})}
          locale={locale}
        />
        <ViewState
          view={viewState}
          refusal={{ code: "ROLE_OUT_OF_SCOPE", title: t("cat07.refusedTitle"), text: t("cat07.refusedText"), family: "neutral" }}
          {...(failure !== null && failure.traceId !== null ? { traceId: failure.traceId } : {})}
          {...(failure !== null ? { retryable: failure.retryable } : {})}
          errorText={t("cat07.errorText")}
          density="portal"
          rows={6}
          locale={locale}
        >
          {data !== null ? <Body page={data} phone={phone} t={t} locale={locale} /> : null}
        </ViewState>
      </div>
    </PortalShell>
  );
}

function Body({ page, phone, t, locale }: { page: ClaimPage; phone: boolean; t: Translate; locale: Locale }) {
  const { claim, completeness } = page;
  const inset = phone ? "sm" : "md";
  const completenessPanel =
    completeness !== null ? (
      <Panel title={t("cat07.compTitle")} {...(phone ? { inset: "sm" as const } : {})} density="portal" locale={locale}>
        <FactList
          items={[
            { label: t("cat07.own"), value: completenessValue(t, "ownership", completeness.ownership, locale), kind: "status" },
            { label: t("cat07.ben"), value: completenessValue(t, "beneficiary", completeness.beneficiary, locale), kind: "status" },
          ]}
          locale={locale}
        />
        <Text size="base" tone="secondary">
          {t("cat07.activation")}
        </Text>
      </Panel>
    ) : null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0, 1fr)" : "minmax(0, 1fr) var(--container-sm)", gap: "var(--space-6)", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        {phone ? completenessPanel : null}
        <Panel title={t("cat07.sharesTitle")} inset={inset} density="portal" locale={locale}>
          {/*
            Changing the date reads the shares and completeness again for it; it does not filter. The browser's own
            check is off so a cleared date reaches the service, which answers AS_OF_REQUIRED.
          */}
          <form method="get" action={routes.orgClaim(claim.reference)} noValidate>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--space-3)" }}>
              <DateField
                label={t("cat07.asAt")}
                value={page.asOf ?? ""}
                required
                name="as_of"
                width="var(--space-56)"
                {...(page.asOfRefusal !== null ? { error: t(`sub.refusal.${page.asOfRefusal}`) } : {})}
                locale={locale}
              />
              <Button variant="secondary" size="md" type="submit" locale={locale}>
                {t("cat07.show")}
              </Button>
            </div>
          </form>
          {page.shares !== null ? <Shares page={page} phone={phone} t={t} locale={locale} /> : null}
        </Panel>
        {phone ? null : completenessPanel}
      </div>
      <Panel as="aside" title={t("cat07.claimTitle")} inset={inset} density="portal" locale={locale}>
        <FactList
          items={[
            { label: t("cat07.fClaim"), value: claim.reference, kind: "id" },
            { label: t("cat07.fClaimant"), value: claim.claimant },
            // The board links the work to its catalogue record (SCR-CAT-09), an operations screen with no portal route.
            { label: t("cat07.fSubject"), value: { text: claim.subject.title, detail: t("cat07.fSubjectDetail", { id: claim.subject.id }) }, kind: "stack" },
            { label: t("cat07.fLayer"), value: t("cat07.fLayerValue", { territory: claim.territory }) },
            { label: t("cat07.fBasis"), value: t(`cat07.basis.${claim.basis}`) },
            ...(claim.source !== null
              ? [
                  {
                    label: t("cat07.fSource"),
                    value: {
                      text: claim.source.submission,
                      detail: t("cat07.fSourceDetail", { index: String(claim.source.record).padStart(5, "0") }),
                      href: routes.orgSubmission(claim.source.submission),
                    },
                    kind: "stack" as const,
                  },
                ]
              : []),
          ]}
          locale={locale}
        />
      </Panel>
    </div>
  );
}

/** The shares effective at the date, grouped by kind, each with its own total (DR-30 sums them apart). */
function Shares({ page, phone, t, locale }: { page: ClaimPage; phone: boolean; t: Translate; locale: Locale }) {
  const { shares, completeness, claim, asOf } = page;
  if (shares === null) return null;
  const pct = (value: number | null) => (value === null ? null : R1_FORMAT.nf(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(value));
  const row = (share: ShareRecord, n: number) => ({
    _key: `${share.kind}-${String(n)}`,
    party: { text: share.forParty !== null ? t("cat07.forParty", { party: share.party, forParty: share.forParty }) : share.party },
    share: pct(share.percent),
    from: share.from,
    to: share.to === null ? t("cat07.open") : (R1_FORMAT.formatDate(share.to, locale) ?? ""),
  });
  const total = (label: string, kind: readonly ShareRecord[]) => ({
    _key: label,
    party: { text: label },
    share: pct(kind.reduce((sum, share) => sum + (share.percent ?? 0), 0)),
    from: null,
    to: null,
  });
  const ownershipStated = shares.ownership.some((share) => share.percent !== null);
  const rows =
    shares.ownership.length + shares.beneficiary.length === 0
      ? []
      : [
          { _group: t("cat07.own") },
          ...shares.ownership.map(row),
          ...(ownershipStated ? [total(t("cat07.ownTotal"), shares.ownership)] : []),
          ...(shares.beneficiary.length === 0
            ? [{ _group: t("cat07.ben"), ...(completeness?.beneficiary.code === "NO_BENEFICIARY_STATED" ? { _groupNote: t("cat07.benGroupNote") } : {}) }]
            : [{ _group: t("cat07.ben") }, ...shares.beneficiary.map(row), total(t("cat07.benTotal"), shares.beneficiary)]),
        ];
  const empty = claim.wholeInterest
    ? { variant: "governed", action: false as const, title: t("cat07.wholeTitle") }
    : {
        variant: "governed",
        action: false as const,
        title: t("cat07.absentTitle", { date: R1_FORMAT.formatDate(asOf ?? "", locale) ?? "" }),
        ...(shares.nextFrom !== null ? { text: t("cat07.absentText", { from: R1_FORMAT.formatDate(shares.nextFrom, locale) ?? "" }) } : {}),
      };
  return (
    <Table
      layout={phone ? "cards" : "table"}
      columns={[
        { key: "party", label: t("cat07.cParty"), kind: "stack" },
        { key: "share", label: t("cat07.cShare"), unit: "%", align: "end", num: true, width: "var(--space-28)" },
        { key: "from", label: t("cat07.cFrom"), kind: "date" },
        { key: "to", label: t("cat07.cTo") },
      ]}
      rows={rows}
      empty={empty}
      density="org"
      caption={t("cat07.sharesTitle")}
      sortNote={t("cat07.sortNote")}
      locale={locale}
    />
  );
}
