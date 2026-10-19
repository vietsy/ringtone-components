import { PageHeader, Panel, Skeleton } from "@/components/r1";
import { PortalShell } from "@/components/shells/PortalShell";
import { premisesNav } from "@/components/shells/premises-nav";
import { tarTranslator } from "@/features/tariff/console";
import { feeHeader, FeeSteps, FeeUnavailable } from "@/features/tariff/FeeSteps";
import { requirePrincipal } from "@/lib/api/session";
import { loadReviewFeeExplanation } from "@/lib/api/tariff";
import { getLocale } from "@/lib/i18n/locale";
import { TAR_VIEWS } from "@/lib/mock/tariff";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-TAR-14 How your fee was calculated, opened from the review of a draft (SCR-REG-05): the calculation the review
 * recorded, by its reference, in the same six steps the decision's fee page shows. Back returns to the review, which
 * records a new review when it opens; this page records nothing.
 */
export default async function ReviewFeeCalculationPage({
  params,
  searchParams,
}: {
  params: Promise<{ application: string; calculation: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const principal = await requirePrincipal();
  const [{ application, calculation }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = tarTranslator(locale);
  const view = reviewView(query, TAR_VIEWS);
  const outcome = view === "loading" ? null : await loadReviewFeeExplanation(principal, application, calculation, view);
  const failure = outcome?.failure ?? null;
  const calc = outcome?.data?.calculation ?? null;
  const phone = frame === "phone";
  const back = { href: routes.applicationReview(application), label: t("tar14.backReview") };

  return (
    <PortalShell
      fill
      layout={phone ? "phone" : "desktop"}
      nav={premisesNav("applications", frame, locale)}
      account={principal.account}
      {...(calc !== null ? { context: { premises: calc.premises.name, period: application } } : {})}
      locale={locale}
    >
      <PageHeader
        crumbs={[
          { label: t("tar14.crumb"), href: routes.applications() },
          { label: t("tar14.crumbReview", { ref: application }), href: routes.applicationReview(application) },
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
