import { Columns, FactList, PageHeader, Panel, Skeleton } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ActsPanel, AuthorityFacts, PropagationTable, StateLine, VersionsTable } from "@/features/parties/AuthorityParts";
import { codeStatus, partyTranslator, wordsOf } from "@/features/parties/copy";
import { PartyFailure } from "@/features/parties/PartyFailure";
import { loadAuthority, type AuthorityDetail } from "@/lib/api/parties";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PARTIES_VIEWS } from "@/lib/mock/parties";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PTY-13 on the security console, read only: GET /authorities/{id} admits the security admin. The versions and
 * the acts performed under the authority, and for a revocation who made it, from when, why, and where it reached -
 * a point that has not confirmed it stopped granting carries the exception it raised. The principal revokes; this
 * console only reads.
 */
export default async function SecurityAuthorityPage({ params, searchParams }: { params: Promise<{ authority: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-SEC", "ACT-AUD");
  const { authority: reference } = await params;
  const query = await searchParams;
  const locale = await getLocale();
  const t = partyTranslator(locale);
  const asked = reviewView(query, PARTIES_VIEWS);
  const outcome = asked === "loading" ? null : await loadAuthority({ staff }, reference, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame console="security" current="authorities" staff={staff} searchLabel={t("party.secSearch")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[
            { label: t("party.secArea") },
            { label: t("pty11.title"), href: routes.securityPartyAuthorities() },
            ...(data !== null ? [{ label: data.party.legalName, href: routes.securityPartyAuthorities(data.party.record) }] : []),
          ]}
          title={data?.person ?? t("pty13.titleLoading", { ref: reference })}
          {...(data !== null
            ? { status: codeStatus(data.state, t), meta: t("pty13.secMeta", { ref: data.reference, scope: data.premises?.name ?? t("pty11.partyWide") }) }
            : {})}
          locale={locale}
        />
        {failure !== null ? (
          <PartyFailure failure={failure} screen="pty11" errorTitle={t("pty13.errTitle")} density="console" t={t} locale={locale} />
        ) : data === null ? (
          <Panel title={t("pty13.factsTitle")} locale={locale}>
            <Skeleton variant="facts" rows={6} density="console" locale={locale} />
          </Panel>
        ) : (
          <Record data={data} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Record({ data, t, locale }: { data: AuthorityDetail; t: Translate; locale: Locale }) {
  const revocation = data.state === "REVOKED" ? data.revocation : null;
  const late = revocation?.propagation?.filter((point) => point.stoppedAt === null).length ?? 0;
  return (
    <Columns>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        {revocation !== null && revocation.propagation !== null ? (
          <Panel
            title={t("pty13.propTitle")}
            description={t("pty13.propDesc")}
            {...(late > 0
              ? {
                  status: { family: "attention" as const, label: t("pty13.secPropLate", { n: String(late) }) },
                  // The exception the late point raised, on the register data console's queue (finding F-11).
                  actions: [{ kind: "link" as const, label: t("pty13.openException"), href: routes.opsRegisterExceptions(`EXC-${data.reference}`) }],
                }
              : {})}
            locale={locale}
          >
            <PropagationTable points={revocation.propagation} density="console" phone={false} tablet={false} t={t} locale={locale} />
          </Panel>
        ) : null}
        {data.state === "EXPIRED" || data.state === "LAPSED" ? (
          <Panel title={t(data.state === "EXPIRED" ? "pty13.endedTitle" : "pty13.lapsedTitle")} locale={locale}>
            <StateLine authority={data} t={t} locale={locale} />
          </Panel>
        ) : null}
        {data.state === "PENDING_START" ? (
          <Panel title={t("pty13.notStartedTitle")} locale={locale}>
            <StateLine authority={data} t={t} locale={locale} />
          </Panel>
        ) : null}
        <Panel title={t("pty13.versionsTitle")} locale={locale}>
          <VersionsTable versions={data.versions} density="console" phone={false} t={t} locale={locale} />
        </Panel>
        <ActsPanel authority={data} density="console" phone={false} tablet={false} inset="md" t={t} locale={locale} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        {revocation !== null ? (
          <Panel title={t("pty13.secRevTitle")} locale={locale}>
            <FactList
              items={[
                { label: t("pty13.fRevokedBy"), value: t("pty13.secRevBy", { name: revocation.by }) },
                { label: t("pty13.fRevokedFrom"), value: revocation.at, kind: "datetime" },
                { label: t("pty13.fGround"), value: wordsOf(revocation.ground, "ground", t) },
              ]}
              locale={locale}
            />
          </Panel>
        ) : null}
        <Panel as="aside" title={t("pty13.factsTitle")} locale={locale}>
          <AuthorityFacts authority={data} reader="security" density="console" t={t} locale={locale} />
        </Panel>
      </div>
    </Columns>
  );
}
