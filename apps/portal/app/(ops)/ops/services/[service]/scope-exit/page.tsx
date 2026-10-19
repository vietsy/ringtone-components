import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Columns, ItemList, PageHeader, Panel, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { recordScopeExit } from "@/features/venue/console-actions";
import { classInline, refusal, sentence } from "@/features/venue/console-copy";
import { day, serviceStatus, venTranslator } from "@/features/venue/copy";
import { ScopeExitForm } from "@/features/venue/ScopeExitForm";
import { readForPage } from "@/lib/api/flash";
import { holds, requireStaff } from "@/lib/api/session";
import { loadScopeExitStep, SCOPE_DETAILS, type ScopeExitAttempt, type ScopeExitStep, type ScopeFamily } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN16_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** The cause families as the request names them (REG, CER, PTY) and as the record keeps them. */
const FAMILIES: readonly (readonly [string, ScopeFamily])[] = [
  ["REG", "REGISTRATION"],
  ["CER", "CERTIFICATE"],
  ["PTY", "PREMISES"],
];

/**
 * SCR-VEN-16 Record a scope exit: a premises left the direct-licence scope because of an event in REG, CER or PTY,
 * and its service ends from that event's instant. Operations open it from the case file and return there; legal
 * comes by a direct link, reads no case file, and sees the exit confirmed in place.
 */
export default async function ScopeExitPage({ params, searchParams }: { params: Promise<{ service: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-LGL");
  const [{ service }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = venTranslator(locale);
  const operations = holds(staff, "ACT-OPS");
  const view = reviewView(query, VEN16_VIEWS);
  const kept = readForPage<ScopeExitAttempt>(query);
  const attempt = kept?.service === service ? kept : null;
  const outcome = view === "loading" ? null : await loadScopeExitStep(staff, service, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const recorded = attempt?.recorded ?? null;
  // ALREADY_ENDED and NOT_AUTHORISED are about the record or the reader: in the header (design/03).
  const header = recorded !== null ? null : (data?.refusal ?? (attempt?.code === "NOT_AUTHORISED" || attempt?.code === "ALREADY_ENDED" ? attempt.code : null));

  return (
    <OpsFrame
      console="operations"
      current="services"
      staff={staff}
      searchLabel={t(operations ? "venops.search" : "venops.searchLegal")}
      keyMap={[{ keys: ["Esc"], label: t("venops.kEsc") }]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={
            operations
              ? [{ label: t("venops.area") }, { label: t("venops.register"), href: routes.opsServices() }, ...(data !== null ? [{ label: data.head.premises.name, href: routes.opsService(service) }] : [])]
              : [{ label: t("venops.area") }]
          }
          title={t("ven16.title")}
          {...(data !== null ? { status: serviceStatus(data.head.status, t), meta: meta(data, t, locale) } : {})}
          locale={locale}
        />
        {header !== null ? (
          <Banner family="neutral" title={refusal(header, t).title} code={header} level={2} density="console" live locale={locale}>
            {refusal(header, t).text}
          </Banner>
        ) : null}
        {recorded !== null && data !== null ? (
          <Banner family="info" title={t("ven16.recTitle")} level={2} density="console" live locale={locale}>
            {t("ven16.recText", { premises: data.head.premises.name, ts: R1_FORMAT.formatTimestamp(recorded.effectiveAt, locale) ?? "" })}
          </Banner>
        ) : null}
        {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={6} density="console" locale={locale} /> : null}
        {failure !== null ? (
          failure.code === "ENTITLEMENT_NOT_FOUND" ? (
            <ViewState
              view="refused"
              refusal={{ ...refusal(failure.code, t), family: "neutral", action: { label: t(operations ? "ven13.back" : "ven16.cancel"), href: operations ? routes.opsServices() : routes.ops() } }}
              density="console"
              level={2}
              locale={locale}
            />
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
        {data !== null ? <Exit service={service} data={data} attempt={attempt} operations={operations} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

/** "Mã dịch vụ RPS-… tại Then Cửa Kitchen – Phan Xích Long. Loại cơ sở: nhà hàng. Đăng ký ngày 5 tháng 9, 2026." */
function meta(data: ScopeExitStep, t: Translate, locale: Locale): string {
  const values = { code: data.head.code, premises: data.head.premises.name, d: day(data.head.enrolledAt, locale) };
  return data.head.classification === null ? t("ven16.metaNoClass", values) : t("ven16.meta", { ...values, cls: classInline(data.head.classification, t) });
}

function Exit({
  service,
  data,
  attempt,
  operations,
  t,
  locale,
}: {
  service: string;
  data: ScopeExitStep;
  attempt: ScopeExitAttempt | null;
  operations: boolean;
  t: Translate;
  locale: Locale;
}) {
  const code = attempt?.code ?? null;
  const field = attempt?.field ?? null;
  const error = code !== null && field !== null && code !== "NOT_AUTHORISED" && code !== "ALREADY_ENDED" ? sentence(code, t) : null;
  return (
    <>
      <Text size="sm">{t("ven.line")}</Text>
      <Columns>
        <ScopeExitForm
          copy={{
            causeTitle: t("ven16.causeTitle"),
            family: t("ven16.family"),
            families: FAMILIES.map(([value, family]) => ({ value, label: t(`venops.family.${family}`) })),
            detail: t("ven16.detail"),
            detailPh: t("ven16.detailPh"),
            details: Object.fromEntries(FAMILIES.map(([value, family]) => [value, SCOPE_DETAILS[family].map((detail) => ({ value: detail, label: t(`venops.detail.${detail}`) }))])),
            event: t("ven16.event"),
            eventHelp: t("ven16.eventHelp"),
            effective: t("ven16.effective"),
            effectiveHelp: t("ven16.effectiveHelp"),
            evidence: t("ven16.evidence"),
            evidenceHelp: t("ven16.evidenceHelp"),
            record: t("ven16.record"),
            cancel: t("ven16.cancel"),
            fillFirst: t("venops.fillFirst"),
            dlgTitle: t("ven16.dlgTitle"),
            dlgText: t("ven16.dlgText"),
            dlgYes: t("ven16.dlgYes"),
            dlgNo: t("ven16.dlgNo"),
          }}
          premises={data.head.premises.name}
          initial={attempt?.values ?? { family: "REG", detail: "", event: "", effectiveAt: "", evidence: "" }}
          errors={error !== null && field !== null ? { [field]: error } : {}}
          locked={(attempt?.recorded ?? null) !== null || data.refusal !== null}
          // Recorded here, the screen confirms in place and offers no act; ended otherwise, the act says why not.
          lockedReason={(attempt?.recorded ?? null) === null && data.refusal !== null ? sentence(data.refusal, t) : null}
          action={recordScopeExit.bind(null, service)}
          cancelHref={operations ? routes.opsService(service) : routes.ops()}
          locale={locale}
        />
        <Panel as="aside" title={t("ven16.recordsTitle")} level={2} compact gap="sm" density="console" locale={locale}>
          <ItemList items={[1, 2, 3].map((n) => ({ key: `r${String(n)}`, title: t(`ven16.records.${String(n)}`) }))} readOnly density="console" label={t("ven16.recordsTitle")} locale={locale} />
        </Panel>
      </Columns>
    </>
  );
}
