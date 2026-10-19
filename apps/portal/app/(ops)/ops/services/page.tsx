import { R1_FORMAT } from "@rightone/formatting";
import type { Route } from "next";
import { Banner, Button, ButtonRow, PageHeader, Panel, Table, TextField, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { openByCode } from "@/features/venue/console-actions";
import { classWord, refusal } from "@/features/venue/console-copy";
import { ConsoleFilter, type FilterField } from "@/features/venue/ConsoleFilter";
import { ListPager } from "@/features/venue/ListPager";
import { serviceStatus, venTranslator } from "@/features/venue/copy";
import { SubmitButton } from "@/features/venue/SubmitButton";
import { holds, requireStaff, type Staff } from "@/lib/api/session";
import { loadRegister, type EntitlementStatus, type Register, type RegisterFilter } from "@/lib/api/venue";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { VEN12_VIEWS } from "@/lib/mock/venue";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/** The rows the skeleton draws while the register is read (design/03, SCR-VEN-12 Loading). */
const LOADING_ROWS = 20;

/** The SM-10 states, in the order the filter offers them. */
const STATES: readonly EntitlementStatus[] = ["PENDING_TERMS", "ACTIVE", "SUSPENDED", "RESTRICTED", "REVOKED", "ENDED_AT_REQUEST", "ENDED_OUT_OF_SCOPE"];

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/**
 * SCR-VEN-12 Entitlement register, the Player services workspace's landing. Every premises' service, latest enrolment
 * first, filtered by state and premises in the address; a row opens its case file. The register is read by
 * operations alone (PERM-537): the evidence and legal readers this workspace also opens reach one service by the code
 * on the link or letter sent to them, as the specification's entry points have them.
 */
export default async function EntitlementRegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-EVD", "ACT-LGL");
  const params = await searchParams;
  const locale = await getLocale();
  const t = venTranslator(locale);
  const operations = holds(staff, "ACT-OPS");
  const criteria: RegisterFilter = { status: text(params.status), premises: text(params.premises_id) };
  const view = reviewView(params, VEN12_VIEWS);
  const outcome = !operations || view === "loading" ? null : await loadRegister(staff, criteria, view, text(params.after));
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame
      console="operations"
      current="services"
      staff={staff}
      searchLabel={t("venops.search")}
      // The rows' keys are listed only while the table that binds them is on the page.
      {...(operations && failure === null && data?.refusal !== "CURSOR_INVALID"
        ? {
            keyMap: [
              { keys: ["J", "K"], label: t("ven12.kMove") },
              { keys: ["Enter"], label: t("ven12.kOpen") },
            ],
          }
        : {})}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("venops.area") }, { label: t("venops.section") }]} title={t("ven12.title")} meta={t("ven12.meta")} locale={locale}>
          <Button variant="quiet" size="sm" href={routes.ops()} locale={locale}>
            {t("ven12.close")}
          </Button>
        </PageHeader>
        <Text size="sm">{t("ven.line")}</Text>
        {!operations ? (
          <ByCode staff={staff} t={t} locale={locale} />
        ) : failure !== null ? (
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
        ) : (
          <Entitlements data={data} criteria={criteria} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Entitlements({ data, criteria, t, locale }: { data: Register | null; criteria: RegisterFilter; t: Translate; locale: Locale }) {
  const count = (n: number) => R1_FORMAT.formatCount(n, locale) ?? String(n);
  const rows = data?.rows ?? [];
  const premises = data?.premisesOptions ?? [];
  const chosen = premises.find((option) => option.id === criteria.premises) ?? null;
  const knownStatus = STATES.find((status) => status === criteria.status) ?? null;
  const filtered = criteria.status !== null || criteria.premises !== null;
  const fields: FilterField[] = [
    {
      kind: "select",
      label: t("ven12.fState"),
      name: "status",
      value: knownStatus ?? "all",
      width: "var(--space-60)",
      options: [
        { value: "all", label: t("ven12.all"), href: routes.opsServices({ premises: criteria.premises }) },
        ...STATES.map((status) => ({ value: status, label: t(`ven.status.${status}`), href: routes.opsServices({ status, premises: criteria.premises }) })),
      ],
    },
    {
      kind: "combobox",
      label: t("ven12.fPremises"),
      name: "premises_id",
      value: chosen?.id ?? null,
      placeholder: t("ven12.fPremisesPh"),
      width: "var(--space-80)",
      options: premises.map((option) => ({ value: option.id, label: option.name, href: routes.opsServices({ status: criteria.status, premises: option.id }) })),
    },
  ];
  const chips: { label: string; href: Route }[] = [
    ...(knownStatus !== null ? [{ label: t("ven12.chipState", { s: t(`ven.status.${knownStatus}`) }), href: routes.opsServices({ premises: criteria.premises }) }] : []),
    ...(chosen !== null ? [{ label: t("ven12.chipPremises", { p: chosen.name }), href: routes.opsServices({ status: criteria.status }) }] : []),
  ];
  // The count of the whole register, or of the rows shown out of it while a filter is on.
  const summary =
    data === null
      ? null
      : filtered
        ? t("ven12.countOf", { n: count(data.matching), total: count(data.total) })
        : data.total === 1
          ? t("ven12.countOne")
          : t("ven12.count", { n: count(data.total) });

  return (
    <>
      <ConsoleFilter label={t("ven12.fBar")} fields={fields} chips={chips} clearHref={routes.opsServices()} summary={summary} locale={locale} />
      {data?.refusal === "CURSOR_INVALID" ? (
        <Banner
          family="neutral"
          title={refusal("CURSOR_INVALID", t).title}
          code="CURSOR_INVALID"
          action={{ label: t("ven12.reload"), icon: "refresh-cw", variant: "secondary", href: routes.opsServices() }}
          density="console"
          locale={locale}
        >
          {refusal("CURSOR_INVALID", t).text}
        </Banner>
      ) : (
        <>
          <Table
            columns={[
              { key: "code", label: t("ven12.cCode"), kind: "id" },
              { key: "premises", label: t("ven12.cPremises"), truncate: true, maxWidth: "var(--space-64)" },
              { key: "state", label: t("ven12.cState"), kind: "status" },
              { key: "cls", label: t("ven12.cClass"), missing: t("venops.none") },
              { key: "enrolled", label: t("ven12.cEnrolled"), kind: "date", short: true, nowrap: true },
              { key: "ended", label: t("ven12.cEnded"), kind: "date", short: true, nowrap: true, missing: t("venops.none") },
            ]}
            rows={rows.map((row) => ({
              _key: row.code,
              _href: routes.opsService(row.code),
              code: row.code,
              premises: row.premises.name,
              state: serviceStatus(row.status, t),
              cls: classWord(row.classification, t),
              enrolled: row.enrolledAt,
              ended: row.endedAt,
            }))}
            density="console"
            caption={t("ven12.title")}
            rowFocus
            {...(rows.length > 0 ? { sortNote: t("ven12.sortNote") } : {})}
            loading={data === null ? LOADING_ROWS : false}
            empty={{ variant: "filtered", title: t("ven12.emptyTitle"), action: false }}
            locale={locale}
          />
          {data !== null ? (
            <ListPager paging={data.paging} href={(cursor) => routes.opsServices({ ...criteria, after: cursor })} density="console" always t={t} locale={locale} />
          ) : null}
        </>
      )}
    </>
  );
}

/** For evidence and legal readers: one service by its code, to its case file (evidence) or to record its scope exit (legal). */
function ByCode({ staff, t, locale }: { staff: Staff; t: Translate; locale: Locale }) {
  return (
    <Panel title={t("ven12.byCodeTitle")} level={2} gap="lg" density="console" locale={locale}>
      <Text size="sm">{t("ven12.byCodeText")}</Text>
      <form action={openByCode} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: "var(--container-sm)" }}>
        <TextField label={t("ven12.byCode")} name="service_code" required mono density="console" locale={locale} />
        <ButtonRow>
          <SubmitButton variant="primary" size="sm" locale={locale}>
            {holds(staff, "ACT-EVD") ? t("ven12.openCase") : t("ven12.openExit")}
          </SubmitButton>
        </ButtonRow>
      </form>
    </Panel>
  );
}
