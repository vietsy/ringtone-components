import { Button, ButtonRow, EmptyState, PageHeader, Panel, StatusLine, Table, ViewState } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { Text } from "@/components/Text";
import { actsWords } from "@/features/parties/copy";
import { LimitationFacts } from "@/features/parties/LimitationFacts";
import { count, licensingStatus, moment, premisesRefusal, premisesTranslator } from "@/features/parties/premises-copy";
import { loadPortfolio, type Portfolio } from "@/lib/api/premises";
import { requirePrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PTY-19 Premises portfolio, on the premises portal. The party the person acts for is the heading; under it, the
 * register's limitation, then the premises their authority covers - every premises the party operates for its
 * principal, the one or few a delegate's authority names for a delegate - each with its status in words and the
 * person's own authority there, which reads as the premises' scope and never as the party's (FR-PTY-021). Another
 * party the person holds an authority for is named and switched to on RightOne ID, never merged in (FR-PTY-007);
 * asking for a party no authority covers is NOT_YOUR_PARTY. The principal opens the party's authorities from here.
 */
export default async function PortfolioPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const params = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(params)]);
  const t = premisesTranslator(locale);
  const asked = typeof params.party === "string" && params.party !== "" ? params.party : null;
  const outcome = await loadPortfolio(principal, asked);
  const data = outcome.data;
  const failure = outcome.failure;
  const refused = failure !== null && (failure.code === "NOT_YOUR_PARTY" || failure.code === "PARTY_NOT_FOUND") ? failure.code : null;
  const phone = frame === "phone";
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
        <PageHeader
          crumbs={[{ label: t("pty19.crumb") }]}
          title={data?.party.legalName ?? principal.party}
          {...(data !== null ? { meta: t("pty19.meta", { n: count(data.rows.length, locale), ts: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        />
        {refused !== null ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap, maxWidth: "var(--container-3xl)" }}>
            <ViewState view="refused" refusal={{ ...premisesRefusal(t, refused), family: "attention" }} density="portal" locale={locale} />
            <Button variant="secondary" size="md" href={routes.premisesPortfolio()} fullWidth={phone} locale={locale}>
              {t("pty19.ownList")}
            </Button>
          </div>
        ) : failure !== null || data === null ? (
          <ViewState view="error" errorTitle={t("pty19.errTitle")} errorText={t("prm.errText")} {...(failure?.traceId ? { traceId: failure.traceId } : {})} retryable density="portal" locale={locale} />
        ) : (
          <Body data={data} phone={phone} t={t} locale={locale} />
        )}
      </div>
    </PortalShell>
  );
}

function Body({ data, phone, t, locale }: { data: Portfolio; phone: boolean; t: Translate; locale: Locale }) {
  return (
    <>
      {data.others.length > 0 ? <StatusLine family="info" text={t("pty19.others", { names: data.others.map((party) => party.legalName).join(", ") })} cutout="surface" locale={locale} /> : null}
      <LimitationFacts limitation={data.limitation} phone={phone} t={t} locale={locale} />
      {data.rows.length === 0 ? (
        <EmptyState variant="not-started" icon="building-2" title={t(data.actor === "PRINCIPAL" ? "pty19.emptyTitle" : "pty19.emptyDelegateTitle")} level={2} density="portal" locale={locale}>
          {t(data.actor === "PRINCIPAL" ? "pty19.emptyText" : "pty19.emptyDelegateText")}
        </EmptyState>
      ) : (
        <Panel title={t(data.actor === "PRINCIPAL" ? "pty19.listTitle" : "pty19.listDelegate")} level={2} inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          <Table
            columns={[
              { key: "name", label: t("pty19.cPremises"), kind: "strong" },
              { key: "ref", label: t("pty19.cRef"), kind: "id" },
              { key: "status", label: t("pty19.cStatus"), kind: "status" },
              { key: "authority", label: t("pty19.cAuthority"), kind: "text" },
            ]}
            rows={data.rows.map((row) => ({
              _key: row.record,
              _href: routes.portfolioPremises(row.record),
              name: row.name,
              ref: row.record,
              status: { ...licensingStatus(row.licensing.status, t), plain: true },
              authority: data.actor === "PRINCIPAL" ? t("pty19.partyWide") : actsWords(row.acts, t),
            }))}
            density="portal"
            layout={phone ? "cards" : "table"}
            caption={t("pty19.listTitle")}
            locale={locale}
          />
          <Text size="sm" tone="muted">
            {t("pty19.only")}
          </Text>
        </Panel>
      )}
      <ButtonRow>
        {data.others.length > 0 ? (
          <Button variant="secondary" size="md" href={routes.chooseOrganisation()} fullWidth={phone} locale={locale}>
            {t("pty19.switch")}
          </Button>
        ) : null}
        {data.actor === "PRINCIPAL" ? (
          <Button variant="primary" size="md" icon="key-round" href={routes.partyAuthorities()} fullWidth={phone} locale={locale}>
            {t("pty19.authorities")}
          </Button>
        ) : null}
      </ButtonRow>
    </>
  );
}
