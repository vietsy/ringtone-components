import { Banner, Divider, FactList, PageHeader, Panel, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { recordReinstatement } from "@/features/venue/console-actions";
import { actionStatus, refusal, sentence } from "@/features/venue/console-copy";
import { serviceStatus, venTranslator } from "@/features/venue/copy";
import { ReinstatementForm } from "@/features/venue/ReinstatementForm";
import { readForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { loadReinstatementStep, type ReinstatementAttempt, type ReinstatementStep } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN15_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-VEN-15 Reinstatement: return a suspended or restricted service to active once every condition of its latest
 * enforcement action has evidence. NOT_REINSTATABLE and NOT_AUTHORISED are said in the header; CONDITIONS_NOT_MET
 * above the conditions, the evidence kept.
 */
export default async function ReinstatementPage({ params, searchParams }: { params: Promise<{ service: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS");
  const [{ service }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = venTranslator(locale);
  const view = reviewView(query, VEN15_VIEWS);
  const kept = readForPage<ReinstatementAttempt>(query);
  const attempt = kept?.service === service ? kept : null;
  const outcome = view === "loading" ? null : await loadReinstatementStep(staff, service, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const header = data?.refusal ?? (attempt?.code === "NOT_AUTHORISED" || attempt?.code === "NOT_REINSTATABLE" ? attempt.code : null);

  return (
    <OpsFrame console="operations" current="services" staff={staff} searchLabel={t("venops.search")} keyMap={[{ keys: ["Esc"], label: t("venops.kEsc") }]} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("venops.area") }, { label: t("venops.register"), href: routes.opsServices() }, ...(data !== null ? [{ label: data.head.premises.name, href: routes.opsService(service) }] : [])]}
          title={t("ven15.title")}
          {...(data !== null ? { status: serviceStatus(data.head.status, t), meta: t("ven14.meta", { code: data.head.code, premises: data.head.premises.name }) } : {})}
          locale={locale}
        />
        {header !== null ? (
          <Banner family="neutral" title={refusal(header, t).title} code={header} level={2} density="console" live locale={locale}>
            {refusal(header, t).text}
          </Banner>
        ) : null}
        {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={6} density="console" locale={locale} /> : null}
        {failure !== null ? (
          failure.code === "ENTITLEMENT_NOT_FOUND" ? (
            <ViewState view="refused" refusal={{ ...refusal(failure.code, t), family: "neutral", action: { label: t("ven13.back"), href: routes.opsServices() } }} density="console" level={2} locale={locale} />
          ) : (
            <ViewState
              view="error"
              errorTitle={t("ven.errTitle")}
              errorText={t("ven.errText")}
              {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
              retryable={failure.retryable}
              density="console"
              level={2}
              locale={locale}
            />
          )
        ) : null}
        {data !== null ? <Reinstate service={service} data={data} attempt={attempt} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

function Reinstate({ service, data, attempt, t, locale }: { service: string; data: ReinstatementStep; attempt: ReinstatementAttempt | null; t: Translate; locale: Locale }) {
  const action = data.action;
  return (
    <>
      <Text size="sm">{t("ven.line")}</Text>
      <Panel gap="xl" density="console" locale={locale}>
        {action !== null ? (
          <>
            <Panel variant="plain" level={2} title={t("ven15.enfTitle")} gap="sm" density="console" locale={locale}>
              <FactList
                items={[
                  { label: t("ven13.fAction"), value: actionStatus(action.action, t), kind: "status" },
                  { label: t("ven13.fEffective"), value: action.effectiveAt, kind: "datetime" },
                  { label: t("ven13.fGround"), value: action.ground[locale] },
                  { label: t("ven13.fUnder"), value: action.policy[locale] },
                ]}
                columns={2}
                density="console"
                locale={locale}
              />
            </Panel>
            <Divider />
          </>
        ) : null}
        <ReinstatementForm
          copy={{
            condTitle: t(action?.action === "RESTRICT" ? "ven15.condTitleRestriction" : "ven15.condTitle"),
            condHelp: t("ven15.condHelp"),
            evidence: t("ven15.evidence"),
            has: t("ven15.has"),
            none: t("ven15.none"),
            effective: t("ven15.effective"),
            effectiveHelp: t("ven15.effectiveHelp"),
            reinstate: t("ven15.reinstate"),
            cancel: t("ven15.cancel"),
            missing: t("ven15.missing"),
            dlgTitle: t("ven15.dlgTitle"),
            dlgText: t("ven15.dlgText"),
            dlgYes: t("ven15.dlgYes"),
            dlgNo: t("ven15.dlgNo"),
          }}
          premises={data.head.premises.name}
          conditions={(action?.conditions ?? []).map((condition) => ({ code: condition.code, text: condition.text[locale] }))}
          initialEvidence={attempt?.evidence ?? {}}
          initialEffective={attempt?.effectiveAt ?? data.now}
          refusal={attempt?.code === "CONDITIONS_NOT_MET" ? notMet(attempt, action?.conditions ?? [], t) : null}
          blocked={data.refusal !== null ? sentence(data.refusal, t) : null}
          action={recordReinstatement.bind(null, service, action?.id ?? "", (action?.conditions ?? []).map((condition) => condition.code))}
          cancelHref={routes.opsService(service)}
          locale={locale}
        />
      </Panel>
    </>
  );
}

/** CONDITIONS_NOT_MET naming the conditions the attempt sent no evidence for, by their codes. */
function notMet(attempt: ReinstatementAttempt, conditions: readonly { code: string }[], t: Translate) {
  const words = refusal("CONDITIONS_NOT_MET", t);
  const missing = conditions.filter((condition) => (attempt.evidence[condition.code] ?? "").trim() === "").map((condition) => condition.code);
  return missing.length === 0 ? words : { ...words, text: `${words.text} ${t("ven15.missingNamed", { codes: missing.join(", ") })}` };
}
