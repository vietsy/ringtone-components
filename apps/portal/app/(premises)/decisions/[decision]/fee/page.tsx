import { PageHeader, Panel, Skeleton } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { tarTranslator } from "@/features/tariff/console";
import { feeHeader, FeeSteps, FeeUnavailable } from "@/features/tariff/FeeSteps";
import { requirePrincipal } from "@/lib/api/session";
import { loadFeeExplanation } from "@/lib/api/tariff";
import { getLocale } from "@/lib/i18n/locale";
import { TAR_VIEWS } from "@/lib/mock/tariff";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-TAR-14 How your fee was calculated, opened from the premises' own decision. No board draws it: it is built from
 * TAR's specification and wireframe on the pattern of the premises' decision page. Six steps in the order the
 * calculator took them, in plain words, with no code but the calculation's reference: the facts used, the classes,
 * each rights layer, the exemption, the cap and the rounding, then the amount to pay.
 */
export default async function FeeCalculationPage({ params, searchParams }: { params: Promise<{ decision: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ decision }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = tarTranslator(locale);
  const view = reviewView(query, TAR_VIEWS);
  const outcome = view === "loading" ? null : await loadFeeExplanation(principal, decision, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const calc = data?.calculation ?? null;
  const phone = frame === "phone";
  const back = { href: routes.decision(decision), label: t("tar14.back") };

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("applications", frame, locale)}
      account={principal.account}
      {...(calc !== null ? { context: { premises: calc.premises.name, period: decision } } : {})}
      locale={locale}
    >
      <PageHeader
        crumbs={[
          { label: t("tar14.crumb"), href: routes.applications() },
          { label: t("tar14.crumbDecision", { ref: decision }), href: routes.decision(decision) },
        ]}
        title={calc !== null ? t("tar14.title", { premises: calc.premises.name }) : t("tar14.titlePlain")}
        {...(calc !== null ? { meta: feeHeader(calc, t, locale) } : {})}
        locale={locale}
      />
      {view === "loading" ? (
        <Panel title={t("tar14.loading")} density="portal" locale={locale}>
          <Skeleton variant="facts" rows={6} density="portal" locale={locale} />
        </Panel>
      ) : null}
      {failure !== null ? <FeeUnavailable failure={failure} back={back} phone={phone} t={t} locale={locale} /> : null}
      {calc !== null ? <FeeSteps calc={calc} back={back} frame={frame} t={t} locale={locale} /> : null}
    </PortalShell>
  );
}
