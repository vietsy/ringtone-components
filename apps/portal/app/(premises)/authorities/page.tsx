import { Button, EmptyState, PageHeader, Panel, Table, Toast, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { actsWords, authorityWords, day, moment, partyTranslator, refusal } from "@/features/parties/copy";
import { PartyFailure } from "@/features/parties/PartyFailure";
import { readForPage } from "@/lib/api/flash";
import { loadPartyAuthorities, type AuthorityList, type AuthorityRow, type PartyAttempt } from "@/lib/api/parties";
import { requirePartyPrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PARTIES_VIEWS } from "@/lib/mock/parties";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame, type Frame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PTY-11 Authorities of a party, on the premises portal. The principal reads who may act for the party they act
 * for: the person, the scope and what they may do, the period, the state in words and, for an authority that has not
 * started or has ended, the line that says it grants nothing and needs no revocation - the two states where a reader
 * assumes a revocation is missing. Grant authority opens SCR-PTY-12; another party asked for by its record is
 * NOT_YOUR_PARTY (FR-PTY-007). On a phone each authority is a card; on a tablet the acts, the period and the
 * reference wait behind the row expander.
 */
export default async function AuthoritiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePartyPrincipal();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = partyTranslator(locale);
  const asked = reviewView(params, PARTIES_VIEWS);
  const party = typeof params.party === "string" && params.party !== "" ? params.party : null;
  const outcome = asked === "loading" ? null : await loadPartyAuthorities(principal, party, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const refused = failure !== null && (failure.code === "NOT_YOUR_PARTY" || failure.code === "PARTY_NOT_FOUND") ? failure.code : null;
  const phone = frame === "phone";
  const attempt = readForPage<PartyAttempt>(params);
  const revoked = attempt?.form === "revoke" && attempt.refusal === null ? (data?.authorities.find((row) => row.reference === attempt.subject) ?? null) : null;

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("premises", frame, locale)}
      account={principal.account}
      {...(refused === null ? { context: { premises: data?.party.legalName ?? principal.party, label: t("party.partyLabel") } } : {})}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: refused !== null ? t("party.portalPremises") : (data?.party.legalName ?? principal.party) }]}
          title={t("pty11.title")}
          {...(data !== null ? { meta: t(data.authorities.length > 0 ? "pty11.meta" : "pty11.metaEmpty", { n: String(data.authorities.length), u: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        >
          {data !== null && data.authorities.length > 0 ? (
            <Button variant="primary" size="md" icon="plus" href={routes.grantPartyAuthority()} fullWidth={phone} locale={locale}>
              {t("pty11.grant")}
            </Button>
          ) : null}
        </PageHeader>
        {revoked !== null && revoked.revoked !== null ? (
          <div style={{ maxWidth: "var(--container-lg)" }}>
            <Toast family="positive" title={t("pty11.toastRevoked")} locale={locale}>
              {t("pty11.toastRevokedText", { person: revoked.person, ref: revoked.reference, ts: moment(revoked.revoked.at, locale) })}
            </Toast>
          </div>
        ) : null}
        {refused !== null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: phone ? "var(--space-4)" : "var(--space-6)", maxWidth: "var(--container-3xl)" }}>
            <ViewState view="refused" refusal={{ ...refusal(t, refused, "pty11"), family: "attention" }} density="portal" locale={locale} />
            <div>
              <Button variant="secondary" size="md" href={routes.partyAuthorities()} fullWidth={phone} locale={locale}>
                {t("pty11.ownList", { party: principal.party })}
              </Button>
            </div>
          </div>
        ) : failure !== null ? (
          <PartyFailure failure={failure} errorTitle={t("pty11.errTitle")} density="portal" t={t} locale={locale} />
        ) : data !== null && data.authorities.length === 0 ? (
          <EmptyState
            variant="not-started"
            icon="key-round"
            title={t("pty11.emptyTitle", { party: data.party.legalName })}
            level={2}
            action={{ label: t("pty11.grant"), href: routes.grantPartyAuthority(), icon: "plus", variant: "primary" }}
            density="portal"
            locale={locale}
          >
            {t("pty11.emptyText")}
          </EmptyState>
        ) : (
          <List data={data} frame={frame} t={t} locale={locale} />
        )}
      </div>
    </PortalShell>
  );
}

function List({ data, frame, t, locale }: { data: AuthorityList | null; frame: Frame; t: Translate; locale: Locale }) {
  const phone = frame === "phone";
  const tablet = frame === "tablet";
  const narrow = phone || tablet;
  return (
    <Panel title={t("pty11.listTitle")} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
      <Table
        columns={[
          { key: "person", label: t("pty11.cPerson"), kind: "strong", ...(!phone ? { minWidth: "var(--space-36)" } : {}) },
          { key: "scope", label: t("pty11.cScope"), kind: "text", ...(!narrow ? { minWidth: "var(--space-48)" } : {}) },
          { key: "acts", label: t("pty11.cActs"), kind: "text", nowrap: !phone, ...(tablet ? { priority: "low" as const } : {}) },
          { key: "period", label: t("pty11.cPeriod"), kind: "period", short: true, ...(tablet ? { priority: "low" as const } : {}) },
          { key: "state", label: t("pty11.cState"), kind: "status", ...(!narrow ? { minWidth: "var(--space-56)" } : {}) },
          { key: "ref", label: t("pty11.cRef"), kind: "id", ...(tablet ? { priority: "low" as const } : {}) },
        ]}
        rows={(data?.authorities ?? []).map((row) => authorityRow(row, t, locale))}
        loading={data === null ? 4 : false}
        density="portal"
        layout={phone ? "cards" : "table"}
        expandable={tablet}
        caption={t("pty11.listTitle")}
        locale={locale}
      />
    </Panel>
  );
}

/** One authority in the principal's words; PENDING_START and EXPIRED each say they grant nothing and need no revocation. */
function authorityRow(row: AuthorityRow, t: Translate, locale: Locale): Record<string, unknown> {
  const words = authorityWords(row.state, row.from, t, locale);
  const detail =
    row.state === "PENDING_START"
      ? t("pty11.dStarts")
      : row.state === "EXPIRED" && row.to !== null
        ? t("pty11.dEnded", { d: day(row.to, locale) })
        : row.state === "LAPSED"
          ? t("pty11.dLapsed")
          : row.state === "REVOKED" && row.revoked !== null
            ? t("pty11.dRevoked", { ts: moment(row.revoked.at, locale) })
            : null;
  return {
    _key: row.reference,
    _href: routes.partyAuthority(row.reference),
    person: row.person,
    scope: row.premises !== null ? row.premises.name : t("pty11.partyWide"),
    acts: actsWords(row.acts, t),
    period: { from: row.from, to: row.to },
    state: { ...words, plain: true, ...(detail !== null ? { detail } : {}) },
    ref: row.reference,
  };
}
