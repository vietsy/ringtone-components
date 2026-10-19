import { Banner, Button, Columns, FactList, PageHeader, Panel, Skeleton, Toast } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { revokeAction } from "@/features/parties/actions";
import { ActsPanel, AuthorityFacts, PropagationTable, StateLine, VersionsTable } from "@/features/parties/AuthorityParts";
import { authorityWords, moment, partyTranslator, refusal, span, wordsOf } from "@/features/parties/copy";
import { PartyFailure } from "@/features/parties/PartyFailure";
import { RevokeForm } from "@/features/parties/RevokeForm";
import { readForPage } from "@/lib/api/flash";
import { loadAuthority, type AuthorityDetail, type PartyAttempt } from "@/lib/api/parties";
import { requirePartyPrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PARTIES_VIEWS } from "@/lib/mock/parties";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PTY-13 Authority detail and revocation, on the premises portal. The authority's facts, its versions with the
 * period each covered, the acts performed under it with the version each was performed under and, once revoked,
 * where the revocation reached. A revocation takes effect from now or from a date and time and needs a ground; acts
 * performed while it was effective stay valid and attributable (FR-PTY-017, 018). A pending authority can be revoked
 * before it starts; an ended one says it needs no revocation. Amend opens SCR-PTY-12 for a new version.
 */
export default async function AuthorityPage({ params, searchParams }: { params: Promise<{ authority: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePartyPrincipal();
  const { authority: reference } = await params;
  const query = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = partyTranslator(locale);
  const asked = reviewView(query, PARTIES_VIEWS);
  const outcome = asked === "loading" ? null : await loadAuthority({ principal }, reference, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const attempt = readForPage<PartyAttempt>(query);
  const mine = attempt !== null && attempt.subject === reference ? attempt : null;
  const phone = frame === "phone";
  const narrow = phone || frame === "tablet";
  const gap = phone ? "var(--space-4)" : "var(--space-6)";
  const party = data?.party.legalName ?? principal.party;
  const live = data !== null && (data.state === "EFFECTIVE" || data.state === "PENDING_START");

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("premises", frame, locale)}
      account={principal.account}
      context={{ premises: party, period: reference, label: t("party.partyLabel") }}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: party }, { label: t("pty11.title"), href: routes.partyAuthorities() }]}
          title={data?.person ?? t("pty13.titleLoading", { ref: reference })}
          {...(data !== null
            ? { status: authorityWords(data.state, data.from, t, locale), meta: `${data.premises?.name ?? t("pty11.partyWide")}. ${data.to !== null ? span(data.from, data.to, locale) : ""}.` }
            : {})}
          locale={locale}
        >
          {live ? (
            <Button variant="secondary" size="md" icon="pencil" href={routes.amendPartyAuthority(reference)} fullWidth={phone} locale={locale}>
              {t("pty13.amend")}
            </Button>
          ) : null}
        </PageHeader>
        {failure !== null ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap, maxWidth: "var(--container-3xl)" }}>
            <PartyFailure failure={failure} screen="pty11" errorTitle={t("pty13.errTitle")} density="portal" t={t} locale={locale} />
            {failure.code === "NOT_YOUR_PARTY" || failure.code === "AUTHORITY_NOT_FOUND" ? (
              <Button variant="secondary" size="md" href={routes.partyAuthorities()} fullWidth={phone} locale={locale}>
                {t("pty12.backList")}
              </Button>
            ) : null}
          </div>
        ) : data === null ? (
          <Panel title={t("pty13.factsTitle")} level={2} density="portal" locale={locale}>
            <Skeleton variant="facts" rows={6} density="portal" locale={locale} />
          </Panel>
        ) : (
          <Record data={data} attempt={mine} frame={frame} narrow={narrow} gap={gap} t={t} locale={locale} />
        )}
      </div>
    </PortalShell>
  );
}

function Record({ data, attempt, frame, narrow, gap, t, locale }: { data: AuthorityDetail; attempt: PartyAttempt | null; frame: Frame; narrow: boolean; gap: string; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const inset = phone ? "sm" : "md";
  const already = attempt?.refusal?.code === "ALREADY_REVOKED" ? attempt.refusal : null;
  const ended = attempt?.refusal?.code === "AUTHORITY_EXPIRED" ? attempt.refusal : null;
  const amended = attempt?.form === "amend" && attempt.refusal === null;
  const live = data.state === "EFFECTIVE" || data.state === "PENDING_START";
  // The authority's facts lead, in a narrow column on the left as the Figma frame draws it, and first on a phone.
  return (
    <Columns layout="side-main" single={narrow} gap={phone ? 4 : 6}>
      <div style={{ minWidth: 0 }}>
        <Panel as="aside" title={t("pty13.factsTitle")} level={2} inset={inset} density="portal" locale={locale}>
          <AuthorityFacts authority={data} reader="principal" density="portal" t={t} locale={locale} />
        </Panel>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        {amended ? (
          <Toast family="positive" title={t("pty13.toastAmended")} locale={locale}>
            {t("pty13.toastAmendedText", { ref: data.reference })}
          </Toast>
        ) : null}
        {already !== null ? (
          <Banner family="attention" title={t("pty13.arTitle", { ts: moment(already.values.at ?? "", locale) })} code="ALREADY_REVOKED" density="portal" live locale={locale}>
            {refusal(t, "ALREADY_REVOKED").text}
          </Banner>
        ) : null}
        {ended !== null ? (
          <Banner family="attention" title={refusal(t, "AUTHORITY_EXPIRED").title} code="AUTHORITY_EXPIRED" density="portal" live locale={locale}>
            {refusal(t, "AUTHORITY_EXPIRED").text}
          </Banner>
        ) : null}
        {data.revocation !== null && data.state === "REVOKED" ? (
          <>
            <Panel family="danger" title={t("pty13.revokedTitle")} level={2} inset={inset} density="portal" locale={locale}>
              <FactList
                items={[
                  { label: t("pty13.fRevokedBy"), value: data.revokedByReader ? t("pty13.you") : data.revocation.by },
                  { label: t("pty13.fRevokedFrom"), value: data.revocation.at, kind: "datetime" },
                  { label: t("pty13.fGround"), value: wordsOf(data.revocation.ground, "ground", t) },
                ]}
                density="portal"
                locale={locale}
              />
            </Panel>
            {data.revocation.propagation !== null ? (
              <Panel title={t("pty13.propTitle")} description={t("pty13.propDesc")} level={2} inset={inset} density="portal" locale={locale}>
                <PropagationTable points={data.revocation.propagation} density="portal" phone={phone} tablet={frame === "tablet"} t={t} locale={locale} />
              </Panel>
            ) : null}
          </>
        ) : null}
        {data.state === "EXPIRED" || data.state === "LAPSED" ? (
          <Panel title={t(data.state === "EXPIRED" ? "pty13.endedTitle" : "pty13.lapsedTitle")} level={2} inset={inset} density="portal" locale={locale}>
            <StateLine authority={data} t={t} locale={locale} />
          </Panel>
        ) : null}
        {data.state === "PENDING_START" ? (
          <Panel title={t("pty13.notStartedTitle")} level={2} inset={inset} density="portal" locale={locale}>
            <StateLine authority={data} t={t} locale={locale} />
          </Panel>
        ) : null}
        <Panel title={t("pty13.versionsTitle")} level={2} inset={inset} density="portal" locale={locale}>
          <VersionsTable versions={data.versions} density="portal" phone={phone} t={t} locale={locale} />
        </Panel>
        <ActsPanel authority={data} density="portal" phone={phone} tablet={frame === "tablet"} inset={inset} t={t} locale={locale} />
        {live ? <RevokeForm authority={data} action={revokeAction.bind(null, data.reference)} attempt={attempt?.form === "revoke" ? attempt : null} phone={phone} locale={locale} /> : null}
      </div>
    </Columns>
  );
}
