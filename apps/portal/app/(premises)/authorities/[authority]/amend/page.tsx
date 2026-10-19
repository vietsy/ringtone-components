import { Columns, PageHeader, Panel, Skeleton } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { amendAction } from "@/features/parties/actions";
import { AmendForm } from "@/features/parties/AmendForm";
import { partyTranslator, scopeWords } from "@/features/parties/copy";
import { GrantedAside } from "@/features/parties/GrantedAside";
import { PartyFailure } from "@/features/parties/PartyFailure";
import { SecurityRefusal } from "@/features/parties/SecurityRefusal";
import { readForPage } from "@/lib/api/flash";
import { loadAmendForm, type PartyAttempt } from "@/lib/api/parties";
import { currentStaff, holds, requirePartyPrincipal } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { PARTIES_VIEWS } from "@/lib/mock/parties";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-PTY-12 Amend an authority: the person, the premises, the basis and the evidence stay; the principal changes what
 * the person may do and the period, from a date, and the current version stays readable with the period it covered.
 * The party's other authorities sit beside the form with this one marked.
 */
export default async function AmendPage({ params, searchParams }: { params: Promise<{ authority: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await currentStaff();
  if (staff !== null && holds(staff, "ACT-SEC")) return <SecurityRefusal staff={staff} locale={await getLocale()} />;
  const principal = await requirePartyPrincipal();
  const { authority: reference } = await params;
  const query = await searchParams;
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = partyTranslator(locale);
  const asked = reviewView(query, PARTIES_VIEWS);
  const outcome = asked === "loading" ? null : await loadAmendForm(principal, reference, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const attempt = readForPage<PartyAttempt>(query);
  const phone = frame === "phone";
  const narrow = phone || frame === "tablet";
  const gap = phone ? "var(--space-4)" : "var(--space-6)";
  const party = data?.authority.party.legalName ?? principal.party;

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
        <div style={{ minWidth: 0 }}>
          <PageHeader
            crumbs={[
              { label: party },
              { label: t("pty11.title"), href: routes.partyAuthorities() },
            ]}
            title={t("pty12.titleAmend", { ref: reference })}
            {...(data !== null ? { meta: t("pty12.metaAmend", { person: data.authority.person, scope: scopeWords(data.authority.premises, t) }) } : {})}
            locale={locale}
          />
        </div>
        <Columns single={narrow} gap={phone ? 4 : 6}>
          <div style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
            {failure !== null ? (
              <PartyFailure failure={failure} screen="pty11" errorTitle={t("pty13.errTitle")} density="portal" t={t} locale={locale} />
            ) : data === null ? (
              <Panel density="portal" locale={locale}>
                <Skeleton variant="facts" rows={6} density="portal" locale={locale} />
              </Panel>
            ) : (
              <AmendForm
                data={data}
                action={amendAction.bind(null, reference)}
                cancelHref={routes.partyAuthority(reference)}
                attempt={attempt?.form === "amend" && attempt.subject === reference ? attempt : null}
                phone={phone}
                locale={locale}
              />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            {data !== null ? <GrantedAside authorities={data.existing} selected={reference} phone={phone} locale={locale} /> : null}
          </div>
        </Columns>
      </div>
    </PortalShell>
  );
}
