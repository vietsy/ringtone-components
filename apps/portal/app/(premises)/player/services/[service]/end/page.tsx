import { PageHeader, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { endService } from "@/features/venue/actions";
import { day, serviceStatus, venTranslator } from "@/features/venue/copy";
import { EndServiceForm } from "@/features/venue/EndServiceForm";
import { readDate } from "@/features/venue/fields";
import { LoadError, RefusalBanner, VenueShell } from "@/features/venue/Frame";
import { readForPage } from "@/lib/api/flash";
import { requirePrincipal } from "@/lib/api/session";
import { loadEndingStep, type EndingAttempt } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import { VEN11_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-VEN-11 End the service: the premises' own request that its Player service end, from the earliest date the
 * ending policy allows or a later one, confirmed in a dialog because it cannot be withdrawn. Recorded, the service's
 * page shows the ending waiting for its date.
 */
export default async function EndServicePage({ params, searchParams }: { params: Promise<{ service: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ service }, query] = await Promise.all([params, searchParams]);
  const [locale, frame] = await Promise.all([getLocale(), getFrame(query)]);
  const t = venTranslator(locale);
  const view = reviewView(query, VEN11_VIEWS);
  const outcome = view === "loading" ? null : await loadEndingStep(principal, service, view);
  const last = readForPage<EndingAttempt>(query);
  const attempt = last?.page === "ending" && last.service === service ? last : null;
  const step = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  // ALREADY_ENDED and a refused authority go in the page header; a date the policy does not allow, beside the date.
  const header = attempt !== null && attempt.code !== "EFFECTIVE_DATE_BEFORE_POLICY" ? attempt.code : step?.ended === true ? "ALREADY_ENDED" : null;

  return (
    <VenueShell account={principal.account} frame={frame} locale={locale} context={step !== null ? { premises: step.service.premises.name, period: step.service.code } : null}>
      <PageHeader
        crumbs={[
          { label: t("ven.crumb"), href: routes.player() },
          ...(step !== null ? [{ label: step.service.premises.name, href: routes.playerService(service) }] : []),
        ]}
        title={t("ven11.title")}
        {...(step !== null ? { status: serviceStatus(step.service.status, t), meta: t("ven11.meta", { code: step.service.code, premises: step.service.premises.name }) } : {})}
        locale={locale}
      />
      <Text size="base">{t("ven.line")}</Text>
      {header !== null ? <RefusalBanner code={header} t={t} locale={locale} /> : null}
      {failure !== null && failure.code === "NOT_AUTHORISED_FOR_PREMISES" ? <RefusalBanner code={failure.code} t={t} locale={locale} /> : null}
      {failure !== null && failure.code !== "NOT_AUTHORISED_FOR_PREMISES" ? <LoadError failure={failure} locale={locale} /> : null}
      {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={3} density="portal" locale={locale} /> : null}
      {step !== null ? (
        <EndServiceForm
          copy={{
            whenTitle: t("ven11.whenTitle"),
            endOn: t("ven11.endOn"),
            endHelp: t("ven11.endHelp", { d: day(`${step.earliest}T12:00:00+07:00`, locale) }),
            reason: t("ven11.reason"),
            reasonHelp: t("ven11.reasonHelp"),
            doesTitle: t("ven11.doesTitle"),
            does: [t("ven11.does1"), t("ven11.does2"), t("ven11.does3")],
            end: t("ven11.end"),
            cancel: t("ven11.cancel"),
            dialogTitle: t("ven11.dlgTitle"),
            dialogText: t("ven11.dlgText"),
            confirm: t("ven11.dlgYes"),
            keep: t("ven11.dlgNo"),
            endedReason: t("ven.refusal.ALREADY_ENDED"),
          }}
          premises={step.service.premises.name}
          earliest={step.earliest}
          initialDate={attempt !== null ? (readDate(attempt.date) ?? "") : ""}
          initialReason={attempt?.reason ?? ""}
          dateError={attempt?.code === "EFFECTIVE_DATE_BEFORE_POLICY" ? t("ven.refusal.EFFECTIVE_DATE_BEFORE_POLICY") : null}
          ended={step.ended}
          action={endService.bind(null, step.service.code)}
          cancelHref={routes.playerService(step.service.code)}
          phone={frame === "phone"}
          locale={locale}
        />
      ) : null}
    </VenueShell>
  );
}
