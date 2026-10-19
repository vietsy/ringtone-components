import { Banner, Button, ButtonRow, DateField, PageHeader, Panel, Table, Tabs } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { ConsoleFailure } from "@/features/registration/ConsoleFailure";
import { day, moment, refusal, regOpsTranslator } from "@/features/registration/console-copy";
import { reportingTabs } from "@/features/registration/reporting";
import { loadRegistrationPolicy, type PolicyRow, type RegistrationPolicy } from "@/lib/api/registration-review";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { REG17_VIEWS, reviewViewOf } from "@/lib/mock/registration-review";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** Vietnam is seven hours ahead of UTC all year, with no daylight saving. */
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** An instant's date and time in Vietnam, as the date field with time takes them. */
function vietnam(instant: string): { date: string; time: string } {
  const shifted = new Date(Date.parse(instant) + VIETNAM_OFFSET_MS).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

/**
 * SCR-REG-17 Effective registration policy. At a chosen instant - the moment the page opened until another is
 * chosen - which version of each registration rule is in force and, where none is approved, the default that
 * applies instead; a version approved with a later start is listed under the row in force. Rule versions are
 * prepared and approved in Governance; this screen reads them.
 */
export default async function RegistrationPolicyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-POL-PRE", "ACT-POL-APR", "ACT-OPS");
  const query = await searchParams;
  const locale = await getLocale();
  const t = regOpsTranslator(locale);
  const asked = reviewView(query, REG17_VIEWS);
  const asOf = typeof query.as_of === "string" ? query.as_of : null;
  const outcome = asked === "loading" ? null : await loadRegistrationPolicy(staff, asOf, reviewViewOf("17", asked));
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const refused = failure?.code === "NOT_AUTHORISED";
  const asOfRequired = failure?.code === "AS_OF_REQUIRED";
  const unavailable = failure?.code === "POLICY_READ_UNAVAILABLE";
  const shown = data !== null ? vietnam(data.asOf) : null;

  return (
    <OpsFrame console="operations" current="reports" staff={staff} searchLabel={t("regops.searchReports")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("regops.reportsArea") }]}
          title={t("reg17.title")}
          {...(data !== null ? { meta: t("reg17.meta", { at: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        />
        <Tabs tabs={reportingTabs(staff, t)} value="policy" label={t("regrep.tabs")} density="console" locale={locale} />
        {refused && failure !== null ? (
          <ConsoleFailure failure={failure} screen="reg17" t={t} locale={locale} />
        ) : (
          <>
            <Panel as="div" locale={locale}>
              <form action={routes.opsRegistrationPolicy()} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <DateField
                  label={t("reg17.asAt")}
                  name="as_of"
                  withTime
                  value={shown?.date ?? ""}
                  time={shown?.time ?? ""}
                  required
                  {...(asOfRequired ? { error: refusal(t, "AS_OF_REQUIRED").text } : {})}
                  density="console"
                  locale={locale}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                  <Button type="submit" variant="primary" size="sm" locale={locale}>
                    {t("reg17.show")}
                  </Button>
                </div>
              </form>
            </Panel>
            {unavailable ? (
              <Banner family="attention" title={refusal(t, "POLICY_READ_UNAVAILABLE").title} code="POLICY_READ_UNAVAILABLE" level={2} density="console" locale={locale}>
                {refusal(t, "POLICY_READ_UNAVAILABLE").text}
              </Banner>
            ) : failure !== null && !asOfRequired ? (
              <ConsoleFailure failure={failure} screen="reg17" t={t} locale={locale} />
            ) : (
              <Rules data={data} loading={asked === "loading"} t={t} locale={locale} />
            )}
          </>
        )}
        <ButtonRow>
          {!refused ? (
            <Button variant="secondary" size="sm" icon="refresh-cw" href={routes.opsRegistrationPolicy(asOf)} locale={locale}>
              {t("regops.reload")}
            </Button>
          ) : null}
          <Button variant="quiet" size="sm" href={routes.ops()} locale={locale}>
            {t("regops.close")}
          </Button>
        </ButtonRow>
      </div>
    </OpsFrame>
  );
}

function Rules({ data, loading, t, locale }: { data: RegistrationPolicy | null; loading: boolean; t: Translate; locale: Locale }) {
  if (data === null && !loading) return null;
  return (
    <Panel title={t("reg17.caption")} level={2} density="console" locale={locale}>
      <Table
        columns={[
          { key: "rule", label: t("reg17.cRule"), kind: "stack", width: "30%" },
          { key: "version", label: t("reg17.cVersion"), kind: "stack", width: "25%" },
          { key: "inForce", label: t("reg17.cInForce") },
        ]}
        rows={(data?.rows ?? []).map((row) => ruleRow(row, t, locale))}
        density="console"
        caption={t("reg17.caption")}
        loading={loading ? 7 : false}
        {...(!loading ? { footer: t("reg17.footer") } : {})}
        locale={locale}
      />
    </Panel>
  );
}

/** One rule: its version and what is in force, or none approved and the default (CFG-325 to 329, CFG-12). */
function ruleRow(row: PolicyRow, t: Translate, locale: Locale): Record<string, unknown> {
  const version = row.version;
  return {
    _key: row.rule,
    ...(row.later !== null
      ? {
          _message: {
            severity: "info",
            // An amnesty approved to come names its days (FR-REG-021).
            text:
              row.later.amnesty !== undefined
                ? t("reg17.laterAmnesty", { v: row.later.id, from: day(row.later.amnesty.from, locale), to: day(row.later.amnesty.to, locale) })
                : t("reg17.later", { v: row.later.id, d: day(row.later.from, locale) }),
          },
        }
      : {}),
    rule: { text: t(`reg17.r.${row.rule}`), detail: row.rule },
    version:
      version !== null
        ? { text: version.id, detail: t("reg17.from", { d: day(version.from, locale) }) }
        : { text: t("reg17.none"), ...(row.defaultInForce !== null ? { detail: t("reg17.default", { cfg: row.defaultInForce }) } : {}), muted: true },
    inForce:
      version === null
        ? t(`reg17.d.${row.rule}`)
        : version.amnesty !== undefined
          ? t("reg17.amnesty", { v: version.id, from: day(version.amnesty.from, locale), to: day(version.amnesty.to, locale) })
          : t(`reg17.f.${row.rule}`, { v: version.id }),
  };
}
