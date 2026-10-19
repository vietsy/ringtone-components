import { EmptyState, PageHeader, Table } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { actsWords, codeStatus, moment, partyTranslator, shortDay } from "@/features/parties/copy";
import { PartyChooser } from "@/features/parties/PartyChooser";
import { PartyFailure } from "@/features/parties/PartyFailure";
import { loadAuthorityParties, loadSecurityAuthorities, type AuthorityList, type AuthorityRow } from "@/lib/api/parties";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PARTIES_VIEWS } from "@/lib/mock/parties";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PTY-11 on the security console, read only: one party's authorities with their codes, and beside each the line
 * that says it grants nothing, ended on its own or was revoked and by whom; a revocation that has not reached every
 * decision point shows its exception under the row. The principal grants, amends and revokes them on the premises
 * portal; the security admin and assurance read them here.
 */
export default async function SecurityAuthoritiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-SEC", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = partyTranslator(locale);
  const asked = reviewView(params, PARTIES_VIEWS);
  const party = typeof params.party === "string" && params.party !== "" ? params.party : null;
  const parties = (await loadAuthorityParties(staff)).data ?? [];
  const outcome = party === null || asked === "loading" ? null : await loadSecurityAuthorities(staff, party, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame
      console="security"
      current="authorities"
      staff={staff}
      searchLabel={t("party.secSearch")}
      keyMap={
        data !== null && data.authorities.length > 0
          ? [
              { keys: ["J", "K"], label: t("pty11.kMove") },
              { keys: ["Enter"], label: t("pty11.kOpen") },
            ]
          : []
      }
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("party.secArea") }, { label: t("pty11.title"), ...(party !== null ? { href: routes.securityPartyAuthorities() } : {}) }]}
          title={data?.party.legalName ?? t("pty11.title")}
          {...(data !== null ? { meta: secMeta(data, t, locale) } : party === null ? { meta: t("pty11.secChooseMeta") } : {})}
          locale={locale}
        />
        <PartyChooser words={{ filters: t("pty11.secFilters"), party: t("pty11.secParty"), placeholder: t("pty11.secPartyPh") }} parties={parties} value={party} locale={locale} />
        {party === null ? (
          <EmptyState variant="not-started" icon="key-round" title={t("pty11.secChooseTitle")} level={2} action={false} density="console" locale={locale}>
            {t("pty11.secChooseText")}
          </EmptyState>
        ) : failure !== null ? (
          <PartyFailure failure={failure} screen="pty02" errorTitle={t("pty11.errTitle")} density="console" t={t} locale={locale} />
        ) : data !== null && data.authorities.length === 0 ? (
          <EmptyState variant="governed" icon="key-round" title={t("pty11.secEmptyTitle")} level={2} action={false} density="console" locale={locale}>
            {data.party.principal !== null ? t("pty11.secEmptyText", { name: data.party.principal, party: data.party.legalName }) : t("pty11.secEmptyNone")}
          </EmptyState>
        ) : (
          <Table
            columns={[
              { key: "ref", label: t("pty11.cRef"), kind: "id" },
              { key: "person", label: t("pty11.cPerson"), kind: "strong" },
              { key: "scope", label: t("pty11.cScopeActs"), kind: "stack", minWidth: "var(--space-40)" },
              { key: "period", label: t("pty11.cPeriod"), kind: "period", short: true },
              { key: "state", label: t("pty11.cState"), kind: "status" },
              { key: "note", label: t("pty11.cNote"), kind: "text", minWidth: "var(--space-40)", missing: t("pty11.noNote") },
            ]}
            rows={(data?.authorities ?? []).map((row) => securityRow(row, t, locale))}
            loading={data === null ? 4 : false}
            density="console"
            rowFocus
            caption={t("pty11.listTitle")}
            locale={locale}
          />
        )}
      </div>
    </OpsFrame>
  );
}

function secMeta(data: AuthorityList, t: Translate, locale: Locale): string {
  const u = moment(data.asOf, locale);
  if (data.party.principal === null) return t("pty11.secMetaNoPrincipal", { rec: data.party.record, n: String(data.authorities.length), u });
  return t(data.authorities.length > 0 ? "pty11.secMeta" : "pty11.secMetaEmpty", { rec: data.party.record, name: data.party.principal, n: String(data.authorities.length), u });
}

/** One authority as the security console reads it: its code, and the line a badge cell cannot carry in its own column. */
function securityRow(row: AuthorityRow, t: Translate, locale: Locale): Record<string, unknown> {
  const note =
    row.state === "PENDING_START"
      ? t("pty11.dsStarts", { d: shortDay(row.from, locale) })
      : row.state === "EXPIRED" && row.to !== null
        ? t("pty11.dsEnded", { d: shortDay(row.to, locale) })
        : row.state === "REVOKED" && row.revoked !== null
          ? t("pty11.dsRevoked", { ts: moment(row.revoked.at, locale), name: row.revoked.by })
          : row.state === "LAPSED"
            ? t("pty11.dsLapsed")
            : null;
  return {
    _key: row.reference,
    _href: routes.securityPartyAuthority(row.reference),
    ...(row.unpropagated !== null
      ? { _message: { severity: "warning", text: t("pty11.msgNotProp", { point: t(`pty13.point.${row.unpropagated.point}`), ts: moment(row.unpropagated.acknowledgedAt, locale) }) } }
      : {}),
    ref: row.reference,
    person: row.person,
    scope: { text: row.premises?.name ?? t("pty11.partyWide"), detail: actsWords(row.acts, t) },
    period: { from: row.from, to: row.to },
    state: codeStatus(row.state, t),
    note,
  };
}
