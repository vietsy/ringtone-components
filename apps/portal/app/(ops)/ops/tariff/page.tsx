import { Banner, Button, Combobox, DateField, FilterBar, PageHeader, Panel, Table, Tabs, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { askedDay, moment, tariffTabs, tarTranslator } from "@/features/tariff/console";
import { redirect } from "next/navigation";
import { holds, requireStaff } from "@/lib/api/session";
import { loadPremisesCalculations, type Calculation, type PremisesCalculations } from "@/lib/api/tariff";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { TAR_VIEWS } from "@/lib/mock/tariff";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/**
 * SCR-TAR-08 Calculations of a premises, the tariff workspace's landing. No board draws it: it is built from TAR's
 * `03-screen-specifications.md` and `02-wireframes.md` on the console pattern of the finance lists. The reader chooses
 * a premises and a period, and reads every calculation recorded for it, a reproduction under the calculation it
 * reproduces; a reference opens SCR-TAR-09.
 */
export default async function CalculationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // The operations officer, the finance operator and the auditor read calculations; the data owner reads the watches.
  const staff = await requireStaff("ACT-OPS", "ACT-FIN-OP", "ACT-AUD", "ACT-DAT");
  // The data owner's one screen in this family is the declared classifications.
  if (!holds(staff, "ACT-OPS", "ACT-FIN-OP", "ACT-AUD")) redirect(routes.opsDeclaredClasses());
  const params = await searchParams;
  const locale = await getLocale();
  const t = tarTranslator(locale);
  const view = reviewView(params, TAR_VIEWS);
  const filter = {
    premises: text(params.premises),
    from: askedDay(params["period-from"] ?? params.from),
    to: askedDay(params["period-to"] ?? params.to),
  };
  const outcome = view === "loading" ? null : await loadPremisesCalculations(staff, filter, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const chosen = data?.premisesOptions.find((entry) => entry.id === data.filter.premises) ?? null;

  return (
    <OpsFrame
      console="operations"
      current="tariff"
      staff={staff}
      searchLabel={t("tar.search")}
      // The rows' keys are listed only while the table that binds them is on the page.
      keyMap={
        (data?.rows?.length ?? 0) > 0
          ? [
              { keys: ["↑", "↓"], label: t("tar.kMove") },
              { keys: ["Enter"], label: t("tar.kOpen") },
            ]
          : []
      }
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          title={chosen !== null ? t("tar08.title", { premises: chosen.name }) : t("tar08.titlePlain")}
          {...(data !== null ? { meta: t("tar.asOf", { ts: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        />
        <Tabs tabs={tariffTabs(staff, t)} value="calculations" label={t("tar.tabs")} density="console" locale={locale} />
        {failure !== null && failure.code !== "CURSOR_INVALID" ? (
          failure.code === "NOT_AUTHORISED" ? (
            <ViewState
              view="refused"
              refusal={{ code: failure.code, title: t("tar.refusal.NOT_AUTHORISED.title"), text: t("tar.refusal.NOT_AUTHORISED.text"), family: "attention" }}
              level={2}
              density="console"
              locale={locale}
            />
          ) : (
            <ViewState
              view="error"
              errorTitle={t("tar.errTitle")}
              errorText={t("tar.errText")}
              {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
              retryable={failure.retryable}
              level={2}
              density="console"
              locale={locale}
            />
          )
        ) : (
          <List data={data} asked={filter} cursorRefused={failure?.code === "CURSOR_INVALID"} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function List({
  data,
  asked,
  cursorRefused,
  t,
  locale,
}: {
  data: PremisesCalculations | null;
  asked: { premises: string | null; from: string | null; to: string | null };
  cursorRefused: boolean;
  t: Translate;
  locale: Locale;
}) {
  const filter = data?.filter ?? { premises: asked.premises, from: asked.from, to: asked.to };
  const rows = data?.rows ?? null;
  return (
    <>
      {/* The filters are the request's fields: Show reads the list again for the premises and the period. */}
      <form action={routes.opsTariff()}>
        <FilterBar label={t("tar08.filters")} shortcut="/" locale={locale}>
          <Combobox
            wrap
            label={t("tar.premises")}
            name="premises"
            options={(data?.premisesOptions ?? []).map((entry) => ({ value: entry.id, label: entry.name }))}
            {...(filter.premises !== null ? { value: filter.premises } : {})}
            placeholder={t("tar08.choosePremises")}
            required
            density="console"
            width="var(--container-xs)"
            locale={locale}
          />
          <DateField
            label={t("tar.period")}
            name="period"
            range
            fromLabel={t("tar.from")}
            toLabel={t("tar.to")}
            {...(filter.from !== null ? { value: filter.from } : {})}
            {...(filter.to !== null ? { to: filter.to } : {})}
            {...(cursorRefused ? { error: t("tar.refusal.CURSOR_INVALID.title") } : {})}
            helper={false}
            density="console"
            locale={locale}
          />
          <Button variant="primary" size="sm" type="submit" loading={data === null && !cursorRefused} locale={locale}>
            {t("tar.show")}
          </Button>
        </FilterBar>
      </form>
      {cursorRefused ? (
        <Banner family="attention" title={t("tar.refusal.CURSOR_INVALID.title")} code="CURSOR_INVALID" density="console" locale={locale}>
          {t("tar.refusal.CURSOR_INVALID.text")}
        </Banner>
      ) : rows === null && data !== null ? (
        <ViewState view="empty" empty={{ variant: "not-started", title: t("tar08.emptyChoose"), action: false }} level={2} density="console" locale={locale} />
      ) : (
        <Panel compact density="console" locale={locale}>
          <Table
            columns={[
              { key: "ref", label: t("tar08.cRef"), kind: "id" },
              { key: "date", label: t("tar08.cDate"), kind: "date", short: true },
              { key: "purpose", label: t("tar08.cPurpose"), kind: "stack" },
              { key: "version", label: t("tar08.cVersion"), kind: "mono" },
              { key: "amount", label: t("tar08.cAmount"), kind: "money", unit: "VND" },
              { key: "marks", label: t("tar08.cMarks"), kind: "status" },
            ]}
            rows={(rows ?? []).map((row) => calculationRow(row, t))}
            loading={data === null ? 5 : false}
            density="console"
            rowFocus
            {...(rows !== null && rows.length > 0 ? { sortNote: t("tar08.sortNote") } : {})}
            empty={{ variant: "filtered", title: t("tar08.emptyNone"), action: false }}
            caption={t("tar08.titlePlain")}
            {...(rows !== null && rows.length > 0 ? { footer: t("tar08.endNote") } : {})}
            locale={locale}
          />
        </Panel>
      )}
    </>
  );
}

/** One calculation: its reference opens it; the marks say a reproduction's outcome or that the premises was out of scope. */
function calculationRow(row: Calculation, t: Translate): Record<string, unknown> {
  const answered =
    row.reproduces !== null
      ? t("tar08.reproduces", { ref: row.reproduces.reference })
      : row.answered.kind === "decision"
        ? t("tar08.answeredDecision", { ref: row.answered.reference })
        : row.answered.kind === "correction"
          ? t(row.answered.case !== null ? "tar08.answeredCorrectionCase" : "tar08.answeredCorrection", { ref: row.answered.reference, case: row.answered.case ?? "" })
          : t("tar08.answeredReview", { ref: row.answered.application });
  const mark =
    row.reproduces !== null
      ? { family: row.reproduces.outcome === "MATCH" ? "positive" : "danger", label: row.reproduces.outcome }
      : row.classification.scope !== "IN_SCOPE"
        ? { family: row.classification.scope === "INDETERMINATE" ? "attention" : "neutral", label: row.classification.scope }
        : row.cap.applied
          ? { family: "neutral", label: "CAP" }
          : null;
  return {
    _key: row.reference,
    _href: routes.opsCalculation(row.reference),
    ref: row.reference,
    date: row.decisionDate,
    purpose: { text: row.purpose, detail: answered },
    version: row.version,
    amount: row.amountMinor,
    marks: mark,
  };
}
