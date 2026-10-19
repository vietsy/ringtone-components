import { R1_FORMAT } from "@rightone/formatting";
import { Banner, Columns, ItemList, PageHeader, Panel, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { recordEnforcement } from "@/features/venue/console-actions";
import { classWord, refusal, sentence } from "@/features/venue/console-copy";
import { serviceStatus, venTranslator } from "@/features/venue/copy";
import { EnforcementForm } from "@/features/venue/EnforcementForm";
import { readForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { loadEnforcementStep, type EnforcementAttempt, type EnforcementKind, type EnforcementStep } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN14_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const KINDS: readonly EnforcementKind[] = ["SUSPEND", "RESTRICT", "REVOKE"];

/** Refusals that are about the record and the policy rather than a field: said in the panel, not in red. */
const NEUTRAL = ["POLICY_NOT_APPROVED", "STATE_NOT_ENFORCEABLE"];

/**
 * SCR-VEN-14 Enforcement action: suspend, restrict or revoke one service on a ground the approved enforcement policy
 * lists, with its effective time, notice, remedy and reinstatement conditions. Recorded, the case file shows the new
 * row; refused, every code is said above the action row with the fields kept (NOT_AUTHORISED in the header).
 */
export default async function EnforcementActionPage({ params, searchParams }: { params: Promise<{ service: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS");
  const [{ service }, query] = await Promise.all([params, searchParams]);
  const locale = await getLocale();
  const t = venTranslator(locale);
  const view = reviewView(query, VEN14_VIEWS);
  const attempt = readForPage<EnforcementAttempt>(query);
  const outcome = view === "loading" ? null : await loadEnforcementStep(staff, service, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const code = attempt?.service === service ? attempt.code : null;

  return (
    <OpsFrame console="operations" current="services" staff={staff} searchLabel={t("venops.search")} keyMap={[{ keys: ["Esc"], label: t("venops.kEsc") }]} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("venops.area") }, { label: t("venops.register"), href: routes.opsServices() }, ...(data !== null ? [{ label: data.head.premises.name, href: routes.opsService(service) }] : [])]}
          title={t("ven14.title")}
          {...(data !== null ? { meta: t("ven14.meta", { code: data.head.code, premises: data.head.premises.name }) } : {})}
          locale={locale}
        />
        {code === "NOT_AUTHORISED" ? <HeaderRefusal code={code} t={t} locale={locale} /> : null}
        {view === "loading" ? <ViewState view="loading" skeleton="facts" rows={8} density="console" locale={locale} /> : null}
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
        {data !== null ? <Form service={service} data={data} attempt={attempt?.service === service ? attempt : null} t={t} locale={locale} /> : null}
      </div>
    </OpsFrame>
  );
}

/** A refusal about the reader's authority, in the page header (convention 3). */
function HeaderRefusal({ code, t, locale }: { code: string; t: Translate; locale: Locale }) {
  const words = refusal(code, t);
  return (
    <Banner family="neutral" title={words.title} code={code} level={2} density="console" live locale={locale}>
      {words.text}
    </Banner>
  );
}

function Form({ service, data, attempt, t, locale }: { service: string; data: EnforcementStep; attempt: EnforcementAttempt | null; t: Translate; locale: Locale }) {
  const code = attempt?.code ?? null;
  const words = (key: string) => Object.fromEntries(KINDS.map((kind) => [kind, t(`${key}.${kind}`)])) as Record<EnforcementKind, string>;
  const policy = data.policy;
  return (
    <>
      <Text size="sm">{t("ven.line")}</Text>
      <Columns>
        <EnforcementForm
          copy={{
            nowTitle: t("ven14.nowTitle"),
            action: t("ven14.action"),
            hints: words("ven14.hint"),
            actions: words("venops.action"),
            ground: t("ven14.ground"),
            groundPh: t("ven14.groundPh"),
            effective: t("ven14.effective"),
            when: { NOW: t("ven14.when.NOW"), AT: t("ven14.when.AT") },
            whenHints: { NOW: t("ven14.whenHint.NOW"), AT: t("ven14.whenHint.AT") },
            effectiveAt: t("ven14.effectiveAt"),
            effectiveHelp: t("ven14.effectiveHelp"),
            notice: t("ven14.notice"),
            noticeHelp: t("ven14.noticeHelp"),
            noticePh: t("ven14.noticePh"),
            remedy: t("ven14.remedy"),
            remedyHelp: t("ven14.remedyHelp"),
            conds: t("ven14.conds"),
            condsHelp: t("ven14.condsHelp"),
            condCode: t("ven14.condCode"),
            condText: t("ven14.condText"),
            cond: t("ven14.cond"),
            addCond: t("ven14.addCond"),
            record: t("ven14.record"),
            cancel: t("ven14.cancel"),
            fillFirst: t("venops.fillFirst"),
            dlgTitle: t("ven14.dlgTitle"),
            dlgText: t("ven14.dlgText"),
            dlgTitleNow: t("ven14.dlgTitleNow"),
            dlgTextNow: t("ven14.dlgTextNow"),
            dlgYes: words("ven14.dlgYes"),
            dlgNo: t("ven14.dlgNo"),
          }}
          premises={data.head.premises.name}
          facts={[
            { label: t("ven14.fStatus"), value: serviceStatus(data.head.status, t), kind: "status" },
            { label: t("ven14.fSince"), value: data.head.since, kind: "datetime" },
            { label: t("ven14.fClass"), value: classWord(data.head.classification, t) ?? t("venops.none") },
            { label: t("ven14.fDevice"), value: data.head.device ?? t("venops.none"), ...(data.head.device !== null ? { kind: "mono" as const } : {}) },
          ]}
          grounds={(policy?.grounds ?? []).map((ground) => ({ value: ground.code, label: ground.words[locale] }))}
          policy={policy === null ? null : { name: policy.name[locale], version: policy.version, effective: policy.effectiveFrom }}
          notices={data.notices.map((notice) => ({
            value: notice.reference,
            label: notice.issuedAt === null ? notice.reference : t("ven14.noticeOption", { ref: notice.reference, d: R1_FORMAT.formatDate(notice.issuedAt, locale) ?? "" }),
          }))}
          initial={attempt?.values ?? { action: "SUSPEND", ground: "", when: "NOW", effectiveAt: "", notice: "", remedy: "", conditions: [] }}
          refusal={code === null || code === "NOT_AUTHORISED" ? null : { ...refusal(code, t), family: NEUTRAL.includes(code) ? "neutral" : "attention" }}
          errors={{
            ...(code === "ACTION_NOT_PERMITTED_FOR_GROUND" ? { action: sentence(code, t) } : {}),
            ...(code === "GROUND_NOT_LISTED" ? { ground: sentence(code, t) } : {}),
            ...(code === "EFFECTIVE_AT_IN_PAST" ? { effective: sentence(code, t) } : {}),
          }}
          action={recordEnforcement.bind(null, service)}
          cancelHref={routes.opsService(service)}
          locale={locale}
        />
        <Panel as="aside" title={t("ven14.effectTitle")} level={2} compact gap="sm" density="console" locale={locale}>
          <ItemList items={[1, 2, 3].map((n) => ({ key: `e${String(n)}`, title: t(`ven14.effect.${String(n)}`) }))} readOnly density="console" label={t("ven14.effectTitle")} locale={locale} />
        </Panel>
      </Columns>
    </>
  );
}
