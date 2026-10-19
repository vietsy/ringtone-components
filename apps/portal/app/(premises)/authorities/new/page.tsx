import { Button, Columns, FactList, PageHeader, Panel, Skeleton } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { grantAction } from "@/features/parties/actions";
import { actsWords, authorityWords, joinNames, partyTranslator, wordsOf } from "@/features/parties/copy";
import { GrantedAside } from "@/features/parties/GrantedAside";
import { GrantForm } from "@/features/parties/GrantForm";
import { PartyFailure } from "@/features/parties/PartyFailure";
import { SecurityRefusal } from "@/features/parties/SecurityRefusal";
import { readForPage } from "@/lib/api/flash";
import { loadAuthority, loadGrantForm, type AuthorityDetail, type PartyAttempt } from "@/lib/api/parties";
import { currentStaff, holds, requirePartyPrincipal, type Principal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PARTIES_VIEWS } from "@/lib/mock/parties";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PTY-12 Grant an authority, on the premises portal. The principal names the person and where they may act, what
 * they may do, the basis and its evidence, and the period; the authorities already granted sit beside the form. The
 * authority granted is shown in place with what it allows. The security admin is refused this screen on the security
 * console: POST /authorities admits the principal alone.
 */
export default async function GrantPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await currentStaff();
  const params = await searchParams;
  if (staff !== null && holds(staff, "ACT-SEC")) return <SecurityRefusal staff={staff} locale={await getLocale()} />;
  const principal = await requirePartyPrincipal();
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = partyTranslator(locale);
  const asked = reviewView(params, PARTIES_VIEWS);
  const outcome = asked === "loading" ? null : await loadGrantForm(principal, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const attempt = readForPage<PartyAttempt>(params);
  const granted = attempt?.form === "grant" && attempt.refusal === null && attempt.done !== null ? (await loadAuthority({ principal }, attempt.done, null)).data : null;
  const phone = frame === "phone";
  const narrow = phone || frame === "tablet";
  const gap = phone ? "var(--space-4)" : "var(--space-6)";

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("premises", frame, locale)}
      account={principal.account}
      context={{ premises: data?.party.legalName ?? principal.party, label: t("party.partyLabel") }}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <PageHeader
            crumbs={[{ label: data?.party.legalName ?? principal.party }, { label: t("pty11.title"), href: routes.partyAuthorities() }]}
            title={t("pty12.titleGrant")}
            meta={t("pty12.metaGrant", { party: data?.party.legalName ?? principal.party })}
            locale={locale}
          />
        </div>
        <Columns single={narrow} gap={phone ? 4 : 6}>
          <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
            {failure !== null ? (
              <PartyFailure failure={failure} screen="pty11" errorTitle={t("pty12.errTitle")} density="portal" t={t} locale={locale} />
            ) : granted !== null ? (
              <Granted authority={granted} principal={principal} phone={phone} t={t} locale={locale} />
            ) : data === null ? (
              <Panel density="portal" locale={locale}>
                <Skeleton variant="facts" rows={8} density="portal" locale={locale} />
              </Panel>
            ) : (
              <GrantForm data={data} action={grantAction} cancelHref={routes.partyAuthorities()} attempt={attempt?.form === "grant" ? attempt : null} phone={phone} locale={locale} />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            {data !== null ? <GrantedAside authorities={data.existing} selected={null} phone={phone} locale={locale} /> : null}
          </div>
        </Columns>
      </div>
    </PortalShell>
  );
}

/** The authority just granted, with what it allows, and the way back to the list. */
function Granted({ authority, principal, phone, t, locale }: { authority: AuthorityDetail; principal: Principal; phone: boolean; t: Translate; locale: Locale }) {
  const scope = authority.premises?.name ?? t("pty11.partyWide");
  const acts = joinNames(authority.acts.map((act) => t(`party.act.${act}`).toLocaleLowerCase()), t);
  return (
    <Panel
      family="positive"
      title={t("pty12.doneTitle")}
      description={t(authority.state === "PENDING_START" ? "pty12.doneTextLater" : "pty12.doneText", { person: authority.person, acts, scope })}
      level={2}
      inset={phone ? "sm" : "md"}
      density="portal"
      locale={locale}
    >
      <FactList
        items={[
          { label: t("pty12.fPersonShort"), value: authority.person },
          { label: t("pty12.fScopeShort"), value: scope },
          { label: t("pty12.fMay"), value: actsWords(authority.acts, t) },
          { label: t("pty12.fPeriodShort"), value: authority.to !== null ? { from: authority.from, to: authority.to } : authority.from, kind: authority.to !== null ? "period" : "date" },
          { label: t("pty12.fState"), value: authorityWords(authority.state, authority.from, t, locale), kind: "status" },
          ...(authority.basis !== null ? [{ label: t("pty12.fBasisShort"), value: wordsOf(authority.basis, "basis", t) }] : []),
          ...(authority.evidence !== null ? [{ label: t("pty12.fEvidenceShort"), value: authority.evidence, kind: "id" as const }] : []),
          ...(authority.granted !== null ? [{ label: t("pty12.fGranted"), value: authority.granted.at, kind: "datetime" as const, note: authority.granted.by === principal.account ? t("pty12.byYou") : authority.granted.by }] : []),
        ]}
        density="portal"
        locale={locale}
      />
      <div>
        <Button variant="primary" size="md" href={routes.partyAuthorities()} fullWidth={phone} locale={locale}>
          {t("pty12.backList")}
        </Button>
      </div>
    </Panel>
  );
}
