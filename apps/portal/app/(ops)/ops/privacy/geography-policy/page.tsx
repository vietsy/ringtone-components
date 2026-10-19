import {
  Banner,
  Button,
  ButtonRow,
  ChoiceList,
  Columns,
  DateField,
  FactList,
  FilterBar,
  PageHeader,
  Panel,
  Select,
  StatusLine,
  Table,
  TextField,
  ViewState,
} from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { approveGeographyAct, previewGeographyAct } from "@/features/data-governance/actions";
import { ConfirmApproval } from "@/features/data-governance/ConfirmApproval";
import { datTranslator, day, levelWords, moment } from "@/features/data-governance/console";
import { DifferencingSwitch } from "@/features/data-governance/DifferencingSwitch";
import { SubmitButton } from "@/features/data-governance/SubmitButton";
import {
  loadGeographyPolicy,
  type GeographyAttempt,
  type GeographyDraft,
  type GeographyDraftInput,
  type GeographyLevel,
  type GeographyPolicyPage,
  type GeographyPolicyVersion,
  type PreviewRow,
} from "@/lib/api/data-governance";
import { readForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { DAT_VIEWS } from "@/lib/mock/data-governance";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const LEVELS: readonly GeographyLevel[] = ["province", "ward"];
const APPROVE_FORM = "geography-approve";

/**
 * SCR-DAT-16 Geography policy, in the privacy operations workspace of the operations console. The data protection
 * officer reads the policy in force and what it releases or suppresses to artists over a period, prepares a new
 * version, previews it, and approves it with its effective day; the refusals of `POST /geography-policies` stand at
 * the fields they concern. A version takes effect on its day, so the one in force stays until then. The artist's part
 * of this screen (ACT-ART, `GET /artist-geography`) belongs to the artist portal, which is reserved.
 */
export default async function GeographyPolicyScreen({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-DPO");
  const params = await searchParams;
  const locale = await getLocale();
  const t = datTranslator(locale);
  const view = reviewView(params, DAT_VIEWS);
  const area = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const period = params.period === "sep" ? "sep" : "q3";
  const attempt = readForPage<GeographyAttempt>(params);
  const draft = attempt !== null && attempt.act !== "approved" ? attempt.draft : null;
  const editing = draft !== null || params.draft === "new";
  const outcome = view === "loading" ? null : await loadGeographyPolicy(staff, { area, period }, draft, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;

  return (
    <OpsFrame
      console="operations"
      current="privacy"
      staff={staff}
      searchLabel={t("dat16.search")}
      keyMap={
        data !== null
          ? [
              { keys: ["J", "K"], label: t("dat16.kNext") },
              { keys: ["Esc"], label: t("dat16.kEsc") },
            ]
          : []
      }
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader
          crumbs={[{ label: t("dat16.crumb") }]}
          title={t("dat16.title")}
          {...(data !== null ? { status: { family: "positive" as const, label: t("dat16.effective") }, meta: policySummary(data.inForce, t) } : {})}
          locale={locale}
        >
          {!editing && (
            <Button variant="secondary" size="sm" icon="plus" href={routes.opsGeographyPolicy({ q: area, period, draft: "new" })} locale={locale}>
              {t("dat16.newVersion")}
            </Button>
          )}
          <Button variant="quiet" size="sm" icon="refresh-cw" href={routes.opsGeographyPolicy({ q: area, period })} locale={locale}>
            {t("dat.refresh")}
          </Button>
        </PageHeader>
        {attempt?.act === "approved" && (
          <StatusLine
            family="positive"
            text={t("dat16.approvedLine", { v: attempt.version, d: day(attempt.effectiveFrom, locale) })}
            detail={t("dat16.approvedDetail")}
            live
            locale={locale}
          />
        )}
        {failure !== null ? (
          <ViewState
            view="error"
            errorTitle={t("dat16.errTitle")}
            errorText={t("dat16.errText")}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            level={2}
            density="console"
            locale={locale}
          />
        ) : data === null ? (
          <ViewState view="loading" skeleton="table" rows={6} columns={4} density="console" locale={locale} />
        ) : (
          <Policy data={data} editing={editing} attemptId={typeof params.attempt === "string" ? params.attempt : null} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

/** "Mức tỉnh, tối thiểu 10 cơ sở, kiểm tra suy luận hiệu số theo cả khu vực lẫn kỳ." */
function policySummary(policy: GeographyPolicyVersion, t: Translate): string {
  return t("dat16.meta", {
    levels: levelWords(t, policy.permittedLevels, "short"),
    min: policy.minimumPopulation,
    diff: t(policy.differencingAcrossPeriods ? "dat16.metaDiffBoth" : "dat16.metaDiffAreas"),
  });
}

function Policy({ data, editing, attemptId, t, locale }: { data: GeographyPolicyPage; editing: boolean; attemptId: string | null; t: Translate; locale: Locale }) {
  const { preview } = data;
  const released = preview.rows.filter((row) => row.outcome === "RELEASE").length;
  const periodWords = t(`dat16.periodIn.${preview.period}`);
  const minimum = preview.under === "DRAFT" && data.draft !== null ? Number(data.draft.input.minimum) : data.inForce.minimumPopulation;

  return (
    <>
      <form action={routes.opsGeographyPolicy()}>
        <FilterBar label={t("dat16.fBar")} shortcut="/" summary={t("dat16.summary", { n: preview.rows.length, r: released, s: preview.rows.length - released })} locale={locale}>
          {/* The draft being previewed is kept through a new filter. */}
          {editing && <input type="hidden" name="draft" value="new" />}
          {editing && attemptId !== null && <input type="hidden" name="attempt" value={attemptId} />}
          <TextField label={t("dat16.fText")} name="q" value={preview.area} placeholder={t("dat16.fHint")} width="var(--space-56)" density="console" locale={locale} />
          <Select
            label={t("dat16.fPeriod")}
            name="period"
            options={[
              { value: "q3", label: t("dat16.period.q3") },
              { value: "sep", label: t("dat16.period.sep") },
            ]}
            value={preview.period}
            width="var(--space-48)"
            density="console"
            locale={locale}
          />
          <Button variant="secondary" size="sm" type="submit" locale={locale}>
            {t("dat16.filter")}
          </Button>
        </FilterBar>
      </form>
      <Columns side="md">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
          <Panel
            title={t(preview.under === "DRAFT" ? "dat16.prevNew" : "dat16.prevCur", { period: periodWords })}
            description={t("dat16.previewNote")}
            level={2}
            density="console"
            locale={locale}
          >
            <Table
              columns={[
                { key: "scope", label: t("dat16.cScope"), kind: "strong" },
                { key: "level", label: t("dat16.cLevel") },
                { key: "venues", label: t("dat16.cVenues"), kind: "count", align: "end" },
                { key: "out", label: t("dat16.cOutcome"), kind: "status" },
              ]}
              rows={preview.rows.map((row) => previewRow(row, preview.period, minimum, t))}
              density="console"
              caption={t(preview.under === "DRAFT" ? "dat16.prevNew" : "dat16.prevCur", { period: periodWords })}
              rowFocus
              {...(preview.rows.length > 0 ? { sortNote: t("dat16.sortNote") } : {})}
              empty={{ variant: "filtered", title: t("dat16.filteredTitle"), text: t("dat16.filteredText") }}
              locale={locale}
            />
          </Panel>
          <Panel title={t("dat16.artistTitle")} description={t("dat16.artistNote")} level={2} density="console" locale={locale}>
            <Banner family="info" code="GEOGRAPHY_BELOW_MINIMUM" level={3} compact density="console" locale={locale}>
              {t("dat.refusal.GEOGRAPHY_BELOW_MINIMUM")}
            </Banner>
            <Banner family="neutral" code="DIFFERENCING_WOULD_DISCLOSE" level={3} compact density="console" locale={locale}>
              {t("dat.refusal.DIFFERENCING_WOULD_DISCLOSE")}
            </Banner>
          </Panel>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
          {editing && <NewVersion data={data} t={t} locale={locale} />}
          <Panel as="aside" title={t("dat16.policyTitle")} level={2} density="console" locale={locale}>
            <FactList items={versionFacts(data.inForce, t, locale)} density="console" locale={locale} />
          </Panel>
          {data.next !== null && (
            <Panel as="aside" title={t("dat16.nextTitle", { v: data.next.version })} level={2} density="console" locale={locale}>
              <FactList items={versionFacts(data.next, t, locale)} density="console" locale={locale} />
            </Panel>
          )}
        </div>
      </Columns>
    </>
  );
}

/** A scope: its name (with the month where the figure is for one month of the quarter), level, premises, `DR-92`. */
function previewRow(row: PreviewRow, period: "q3" | "sep", minimum: number, t: Translate): Record<string, unknown> {
  const released = row.outcome === "RELEASE";
  return {
    _key: row.key,
    scope: period === "q3" && row.period === "2026-09" ? t("dat16.scopeMonth", { area: row.area, month: t("dat16.month.2026-09") }) : row.area,
    level: t(`dat16.level.label.${row.level}`),
    venues: row.venues,
    out: released
      ? { family: "positive", label: t("dat16.released") }
      : {
          family: "attention",
          label: t("dat16.suppressed"),
          detail: row.reason === "DIFFERENCING_WOULD_DISCLOSE" ? t("dat16.diffReason") : t("dat16.belowReason", { min: minimum }),
        },
  };
}

function versionFacts(version: GeographyPolicyVersion, t: Translate, locale: Locale) {
  return [
    { label: t("dat16.fVersion"), value: String(version.version) },
    { label: t("dat16.fLevels"), value: levelWords(t, version.permittedLevels, "label") },
    { label: t("dat16.fDefault"), value: t(`dat16.level.label.${version.defaultLevel}`) },
    { label: t("dat16.fMin"), value: t("dat16.venues", { n: version.minimumPopulation }) },
    { label: t("dat16.fDiff"), value: t(version.differencingAcrossPeriods ? "dat16.diffBoth" : "dat16.diffAreas") },
    { label: t("dat16.fFrom"), value: version.effectiveFrom, kind: "date" as const },
    ...(version.effectiveTo !== null ? [{ label: t("dat16.fTo"), value: version.effectiveTo, kind: "date" as const }] : []),
    ...(version.approvedBy !== null && version.approvedAt !== null
      ? [{ label: t("dat16.fApproved"), value: t("dat16.approvedBy", { who: version.approvedBy, at: moment(version.approvedAt, locale) }) }]
      : []),
  ];
}

/** Why the version cannot be approved yet, from the first field refused, or because it has not been previewed. */
function approveWhy(draft: GeographyDraft | null, t: Translate): string | null {
  if (draft === null) return t("dat16.approveWhyPreview");
  if (draft.previewed) return null;
  const field = (["levels", "defaultLevel", "minimum", "effectiveFrom"] as const).find((name) => draft.refusals[name] !== undefined);
  return field === undefined ? t("dat16.approveWhyPreview") : t(`dat16.approveWhy.${field}`);
}

/** The new version: its fields as typed or as the policy in force has them, previewed, then approved once confirmed. */
function NewVersion({ data, t, locale }: { data: GeographyPolicyPage; t: Translate; locale: Locale }) {
  const draft = data.draft;
  const input: GeographyDraftInput = draft?.input ?? {
    levels: data.inForce.permittedLevels,
    defaultLevel: data.inForce.defaultLevel,
    minimum: String(data.inForce.minimumPopulation),
    differencing: data.inForce.differencingAcrossPeriods,
    effectiveFrom: data.defaultEffectiveFrom,
  };
  const refusals = draft?.refusals ?? {};
  const sentence = (code: string | undefined) => (code !== undefined ? t(`dat.refusal.${code}`) : null);
  const levelError =
    refusals.levels === "LEVEL_NOT_PERMITTED" ? t("dat16.levelRefused", { levels: levelWords(t, data.approvedLevels, "in") }) : sentence(refusals.levels);
  const defaultError = sentence(refusals.defaultLevel);
  const minimumError = sentence(refusals.minimum);
  const overlap = draft?.overlap ?? null;
  const fromError =
    refusals.effectiveFrom === "EFFECTIVE_PERIOD_OVERLAP" && overlap !== null
      ? `${t("dat.refusal.EFFECTIVE_PERIOD_OVERLAP")} ${overlap.from === overlap.to ? t("dat16.overlapDay", { d: day(overlap.from, locale) }) : t("dat16.overlapDays", { from: day(overlap.from, locale), to: day(overlap.to, locale) })}`
      : sentence(refusals.effectiveFrom);
  const latest = data.next ?? data.inForce;
  const suppressed = data.preview.under === "DRAFT" ? data.preview.rows.filter((row) => row.outcome !== "RELEASE").length : null;
  const levels = input.levels.filter((level): level is GeographyLevel => (LEVELS as readonly string[]).includes(level));
  const keep = { q: data.preview.area, period: data.preview.period };

  return (
    <Panel as="aside" title={t("dat16.newTitle")} description={t("dat16.newNote")} level={2} density="console" locale={locale}>
      <form action={previewGeographyAct} noValidate style={{ display: "contents" }}>
        <input type="hidden" name="q" value={keep.q} />
        <input type="hidden" name="period" value={keep.period} />
        <ChoiceList
          legend={t("dat16.levels")}
          helper={t("dat16.levelsHelp")}
          name="levels"
          options={LEVELS.map((level) => ({ value: level, label: t(`dat16.level.label.${level}`) }))}
          value={[...input.levels]}
          multiple
          required
          {...(levelError !== null ? { error: levelError } : {})}
          density="console"
          locale={locale}
        />
        <Select
          label={t("dat16.fDefault")}
          name="default_level"
          options={LEVELS.map((level) => ({ value: level, label: t(`dat16.level.label.${level}`) }))}
          value={input.defaultLevel}
          required
          {...(defaultError !== null ? { error: defaultError } : {})}
          width="var(--space-48)"
          density="console"
          locale={locale}
        />
        <TextField
          label={t("dat16.minimum")}
          name="minimum_population"
          value={input.minimum}
          suffix={t("dat16.venuesUnit")}
          helper={t("dat16.minimumHelp")}
          inputMode="numeric"
          required
          {...(minimumError !== null ? { error: minimumError } : {})}
          width="var(--space-48)"
          density="console"
          locale={locale}
        />
        <DifferencingSwitch name="differencing" label={t("dat16.diffSwitch")} helper={t("dat16.diffSwitchHelp")} checked={input.differencing} locale={locale} />
        <DateField
          label={t("dat16.effectiveFrom")}
          name="effective_from"
          {...(input.effectiveFrom !== "" ? { value: input.effectiveFrom } : {})}
          required
          {...(fromError !== null ? { error: fromError } : {})}
          density="console"
          locale={locale}
        />
        <ButtonRow>
          <ConfirmApproval
            formId={APPROVE_FORM}
            label={t("dat16.approve", { v: data.nextVersionNo })}
            disabledReason={approveWhy(draft, t)}
            dialog={{
              title: t("dat16.dlgTitle", { v: data.nextVersionNo }),
              description: t("dat16.dlgText", {
                d: day(input.effectiveFrom, locale),
                levels: levelWords(t, levels, "in"),
                min: input.minimum,
                prev: latest.version,
              }),
              confirm: t("dat16.approve", { v: data.nextVersionNo }),
              back: t("dat16.cancel"),
            }}
            facts={[
              { label: t("dat16.dLevels"), value: levelWords(t, levels, "label") },
              { label: t("dat16.dMin"), value: t("dat16.venues", { n: input.minimum }) },
              { label: t("dat16.dFrom"), value: input.effectiveFrom, kind: "date" },
              ...(suppressed !== null ? [{ label: t("dat16.dSuppressed"), value: suppressed, kind: "count" as const }] : []),
            ]}
            locale={locale}
          />
          <SubmitButton variant="secondary" size="sm" locale={locale}>
            {t("dat16.preview")}
          </SubmitButton>
          <Button variant="quiet" size="sm" href={routes.opsGeographyPolicy(keep)} locale={locale}>
            {t("dat16.cancel")}
          </Button>
        </ButtonRow>
      </form>
      {/* The approval sends the version as it was previewed, not the fields as they may have been changed since. */}
      {draft?.previewed === true && (
        <form id={APPROVE_FORM} action={approveGeographyAct}>
          <input type="hidden" name="q" value={keep.q} />
          <input type="hidden" name="period" value={keep.period} />
          {draft.input.levels.map((level) => (
            <input key={level} type="hidden" name="levels" value={level} />
          ))}
          <input type="hidden" name="default_level" value={draft.input.defaultLevel} />
          <input type="hidden" name="minimum_population" value={draft.input.minimum} />
          <input type="hidden" name="differencing" value={draft.input.differencing ? "on" : "off"} />
          <input type="hidden" name="effective_from" value={draft.input.effectiveFrom} />
        </form>
      )}
    </Panel>
  );
}
