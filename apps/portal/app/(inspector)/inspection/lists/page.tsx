import { R1_FORMAT } from "@rightone/formatting";
import { Banner, ChoiceList, Combobox, Divider, FactList, PageHeader, Panel, Select } from "@/components/r1";
import { requestList } from "@/features/inspection/actions";
import { ConsoleFailure, ConsoleFrame } from "@/features/inspection/ConsoleFrame";
import { ShortcutButton } from "@/features/inspection/ShortcutButton";
import { SupplyList } from "@/features/inspection/SupplyList";
import { refusalOf, refusalSentence, timestamp } from "@/features/inspection/words";
import {
  LIST_KINDS as KINDS,
  loadInspectionLists,
  type InspectionLists,
  type ListAttempt,
  type RefusalCode,
  type Supply,
  type SupplyState,
} from "@/lib/api/inspection";
import { readForPage } from "@/lib/api/flash";
import { requireInspector } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import { translator, type Locale, type Translate } from "@/lib/i18n/translate";
import { VER07_VIEWS } from "@/lib/mock/inspection";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";
import en from "@/messages/screens/ver.en.json";
import vi from "@/messages/screens/ver.vi.json";

type SearchParams = Record<string, string | string[] | undefined>;

const STATES: readonly SupplyState[] = ["REQUESTED", "READY", "FAILED", "DISPOSED"];
/** A supply's state in its family: only a ready one is positive, and one that failed is never drawn as empty. */
const STATE_FAMILY = { REQUESTED: "info", READY: "positive", FAILED: "danger", DISPOSED: "neutral" } as const;
/** Header refusals under which nothing can be requested. */
const NO_ACTS: readonly RefusalCode[] = ["NO_EFFECTIVE_APPOINTMENT", "APPOINTMENT_SUSPENDED", "AUTHORITY_NOT_ACTIVE"];
/** Header refusals said with Retry. */
const RETRYABLE: readonly RefusalCode[] = ["PREMISES_READ_UNAVAILABLE", "POLICY_READ_UNAVAILABLE"];
/** The rows the skeleton draws while the supplies are read. */
const LOADING_ROWS = 5;

/**
 * SCR-VER-07 Inspection lists. On the authority's desk, an inspector requests a supply of either list for the
 * jurisdiction or part of it, within the day's limit, and opens the authority's supplies, newest first.
 */
export default async function InspectionListsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Signed in as an inspector, or sent to sign in.
  const inspector = await requireInspector();
  const params = await searchParams;
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);
  const view = reviewView(params, VER07_VIEWS);
  const attempt = readForPage<ListAttempt>(params);
  const outcome = view === "loading" ? null : await loadInspectionLists(inspector.sessionId, view, attempt);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  // The rows' keys are listed only while the table that binds them is on the page.
  const rowsShown = failure === null && (data === null || data.suppliesRefusal === null);

  return (
    <ConsoleFrame
      account={inspector.account}
      keyMap={
        rowsShown
          ? [
              { keys: ["J", "K"], label: t("ver07.kRows") },
              { keys: ["Enter"], label: t("ver07.kOpen") },
            ]
          : []
      }
      t={t}
      locale={locale}
    >
      <PageHeader
        crumbs={[{ label: t("console.crumb") }]}
        // Until the read names the authority, the page is named by its place in the rail.
        title={data !== null ? t("ver07.title", { authority: data.authorityCode }) : t("console.rail.lists")}
        {...(data !== null ? { meta: t("ver07.meta", { t: timestamp(data.asOf, locale) }) } : {})}
        locale={locale}
      />
      {failure !== null ? (
        <ConsoleFailure failure={failure} refusals={["NOT_AUTHORISED"]} t={t} locale={locale} />
      ) : (
        <Lists data={data} t={t} locale={locale} />
      )}
    </ConsoleFrame>
  );
}

function Lists({ data, t, locale }: { data: InspectionLists | null; t: Translate; locale: Locale }) {
  const refusal = data?.refusal ?? null;

  return (
    <>
      {refusal !== null && (
        <Banner
          family="attention"
          title={refusalOf(t, refusal).title}
          code={refusal}
          {...(RETRYABLE.includes(refusal)
            ? { actions: { label: t("ver.retry"), icon: "refresh-cw", variant: "secondary", href: routes.inspectionLists() } }
            : {})}
          density="console"
          locale={locale}
        >
          {refusalOf(t, refusal).text}
        </Banner>
      )}
      {/* The request offers the appointments the read returns, so it waits for them. */}
      {data !== null && <Request data={data} t={t} locale={locale} />}
      <Supplies data={data} t={t} locale={locale} />
    </>
  );
}

/** The request form: the authority acted for, the kind, the areas, and today's count against the limit. */
function Request({ data, t, locale }: { data: InspectionLists; t: Translate; locale: Locale }) {
  const blocked = data.refusal !== null && NO_ACTS.includes(data.refusal) ? data.refusal : null;
  const off = blocked !== null ? { disabled: true, disabledReason: refusalOf(t, blocked).title } : {};
  const atLimit = data.requestedToday >= data.dailyLimit;
  const limit = refusalOf(t, "LIST_SUPPLY_LIMIT_REACHED");
  const count = (n: number) => R1_FORMAT.formatCount(n, locale) ?? String(n);

  return (
    <Panel title={t("ver07.requestTitle")} level={2} density="console" gap="lg" locale={locale}>
      {/* display: contents keeps the form's parts in the panel's own rhythm; the form only carries them to the action. */}
      <form action={requestList} style={{ display: "contents" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-6)", alignItems: "start" }}>
          {/* The authority is asked for only when the inspector holds two or more appointments (design/03). */}
          {data.appointments.length > 1 && (
            <Select
              label={t("ver07.authority")}
              name="appointment_id"
              options={data.appointments.map((appointment) => ({ value: appointment.id, label: appointment.authority }))}
              {...(data.actingFor !== null ? { value: data.actingFor } : {})}
              placeholder={t("ver07.chooseAuthority")}
              required
              {...(data.actingForRefusal !== null ? { error: refusalSentence(t, data.actingForRefusal) } : {})}
              {...off}
              density="console"
              locale={locale}
            />
          )}
          <ChoiceList
            legend={t("ver07.kind")}
            name="list_kind"
            options={KINDS.map((kind) => ({ value: kind, label: t(`console.listKind.${kind}`) }))}
            value={data.requestKind}
            required
            {...off}
            density="console"
            locale={locale}
          />
          <Combobox
            label={t("ver07.areas")}
            name="areas"
            options={data.areaOptions.map((area) => ({ value: area, label: area }))}
            value={[...data.areas]}
            multiple
            placeholder={t("ver07.allAreas")}
            {...(data.areasRefusal !== null ? { error: refusalSentence(t, data.areasRefusal) } : {})}
            {...off}
            density="console"
            locale={locale}
          />
        </div>
        <Divider />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)", alignItems: "center", justifyContent: "space-between" }}>
          <FactList
            items={[
              {
                label: t("ver07.today"),
                value: t("ver07.todayValue", { n: count(data.requestedToday), limit: count(data.dailyLimit) }),
                note: t("ver07.todayNote"),
              },
            ]}
            density="console"
            locale={locale}
          />
          {atLimit ? (
            <div style={{ flex: "1 1 var(--container-md)", minWidth: 0 }}>
              <Banner family="neutral" title={limit.title} code={limit.code} density="console" locale={locale}>
                {data.nextRequestAt !== null ? `${limit.text} ${t("ver07.limitNext", { t: timestamp(data.nextRequestAt, locale) })}` : limit.text}
              </Banner>
            </div>
          ) : (
            <ShortcutButton type="submit" variant="primary" size="sm" icon="plus" shortcut="Alt+R" {...off} locale={locale}>
              {t("ver07.request")}
            </ShortcutButton>
          )}
        </div>
      </form>
    </Panel>
  );
}

/** The authority's supplies, newest first, with the filters they were read with. */
function Supplies({ data, t, locale }: { data: InspectionLists | null; t: Translate; locale: Locale }) {
  const supplies = data?.supplies ?? [];
  const filter = data?.filter ?? { kind: null, state: null };
  const cursor = data?.suppliesRefusal ?? null;

  return (
    <Panel title={t("ver07.supplies")} level={2} density="console" locale={locale}>
      {cursor !== null ? (
        // A page that can no longer be read is said in place of the rows: it is not an empty list.
        <Banner family="attention" title={t("ver.cursorTitle")} code={cursor} density="console" locale={locale}>
          {t("ver.cursorText")}
        </Banner>
      ) : (
        <SupplyList
          columns={[
            { key: "ref", label: t("ver07.cRef"), kind: "id" },
            { key: "kind", label: t("ver07.cKind") },
            { key: "st", label: t("ver07.cState"), kind: "status" },
            { key: "gen", label: t("ver07.cGenerated"), kind: "datetime" },
            { key: "act", kind: "actions" },
          ]}
          rows={supplies.map((supply) => ({ cells: supplyRow(supply, t), kind: supply.kind, state: supply.state }))}
          initial={filter}
          words={{
            filters: t("ver07.filters"),
            kind: t("ver07.kind"),
            state: t("ver07.state"),
            kinds: [{ value: "any", label: t("console.any") }, ...KINDS.map((kind) => ({ value: kind, label: t(`console.listKind.${kind}`) }))],
            states: [{ value: "any", label: t("console.any") }, ...STATES.map((state) => ({ value: state, label: t(`console.supplyState.${state}`) }))],
            chipState: t("ver07.chipState"),
            pager: t("ver07.pager"),
            endNote: t("ver07.endNote"),
            pages: t("ver07.pages"),
            caption: t("ver07.supplies"),
            sortNote: t("ver07.sortNote"),
            empty: { title: t("ver07.emptyTitle") },
            filtered: { title: t("ver07.filteredTitle"), text: t("ver07.filteredText") },
          }}
          loading={data === null ? LOADING_ROWS : false}
          locale={locale}
        />
      )}
    </Panel>
  );
}

/** One supply: its reference opens it, and one that could not be generated says why with its code. */
function supplyRow(supply: Supply, t: Translate): Record<string, unknown> {
  return {
    _key: supply.reference,
    _href: routes.inspectionList(supply.reference),
    ...(supply.failure !== null ? { _message: { severity: "warning", text: refusalSentence(t, supply.failure), code: supply.failure } } : {}),
    ref: supply.reference,
    kind: t(`console.listKind.${supply.kind}`),
    st: {
      family: STATE_FAMILY[supply.state],
      label: t(`console.supplyState.${supply.state}`),
      ...(supply.state === "REQUESTED" ? { working: true } : {}),
    },
    gen: supply.generatedAt ?? { missing: t("ver07.notGenerated") },
    act: [
      {
        label: t("ver07.open"),
        ariaLabel: `${t("ver07.open")} ${supply.reference}`,
        variant: "quiet",
        href: routes.inspectionList(supply.reference),
      },
    ],
  };
}
