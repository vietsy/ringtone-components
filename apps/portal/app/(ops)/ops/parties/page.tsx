import { Banner, ChoiceList, Columns, PageHeader, Pagination, Table, TextField } from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { createPartyAction } from "@/features/parties/actions";
import { codeStatus, count, day, moment, partyTranslator, refusal } from "@/features/parties/copy";
import { PanelForm } from "@/features/parties/PanelForm";
import { ShortcutButton } from "@/features/parties/ShortcutButton";
import { PartyFailure } from "@/features/parties/PartyFailure";
import { PartyFilter } from "@/features/parties/PartyFilter";
import { PartyTabs } from "@/features/parties/PartyTabs";
import { readForPage } from "@/lib/api/flash";
import { PARTY_KINDS, PARTY_STATES, loadPartyList, type PartyAttempt, type PartyList, type PartyRow } from "@/lib/api/parties";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PARTIES_VIEWS } from "@/lib/mock/parties";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/** The skeleton's rows while the register is read: the board's eleven. */
const LOADING_ROWS = 11;

/**
 * SCR-PTY-01 Party search and list, the Parties and premises workspace's landing. Every party in the national
 * register by legal name, with its record, its masked registration number, its kind and its state; a superseded
 * record carries the surviving party on the line under it. The officer creates a party record beside the list; it
 * starts in DRAFT and is identified from its own page. Assurance reads the same list and creates nothing.
 */
export default async function PartiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = partyTranslator(locale);
  const asked = reviewView(params, PARTIES_VIEWS);
  const view = asked === "loading" ? null : asked;
  const filter = { q: text(params.q), state: text(params.state) };
  const outcome = asked === "loading" ? null : await loadPartyList(staff, filter, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const mayCreate = holds(staff, "ACT-OPS");
  const attempt = readForPage<PartyAttempt>(params);
  const creating = mayCreate && (params.panel === "create" || attempt?.form === "create");

  return (
    <OpsFrame
      console="operations"
      current="parties"
      staff={staff}
      searchLabel={t("party.search")}
      keyMap={[
        // The row keys are bound by the table, so they are listed only while it has rows.
        ...(data !== null && data.rows.length > 0
          ? [
              { keys: ["J", "K"], label: t("pty01.kMove") },
              { keys: ["Enter"], label: t("pty01.kOpen") },
            ]
          : []),
        { keys: ["/"], label: t("pty01.kFilter") },
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("party.crumb") }]}
          title={t("pty01.title")}
          {...(data !== null ? { meta: t("pty01.meta", { ts: moment(data.asOf, locale) }) } : {})}
          locale={locale}
        >
          {mayCreate ? (
            <ShortcutButton variant="primary" size="sm" icon="plus" shortcut="Alt+N" href={routes.opsParties({ ...filter, panel: "create" })} locale={locale}>
              {t("pty01.create")}
            </ShortcutButton>
          ) : null}
        </PageHeader>
        <PartyTabs current="parties" openReviews={data?.openReviews ?? null} t={t} locale={locale} />
        <PartyFilter
          words={{
            filters: t("pty01.filters"),
            search: t("pty01.fSearch"),
            placeholder: t("pty01.searchPh"),
            state: t("pty01.fState"),
            allStates: t("pty01.allStates"),
            chipSearch: t("pty01.chipSearch"),
            chipState: t("pty01.chipState"),
          }}
          states={PARTY_STATES.map((state) => ({ value: state, label: t(`party.status.${state}`) }))}
          value={data?.filter ?? filter}
          summary={data !== null ? t("pty01.count", { n: count(data.rows.length, locale) }) : ""}
          locale={locale}
        />
        <Columns side="md" single={!creating}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
            {failure?.code === "CURSOR_INVALID" ? (
              <Banner
                family="attention"
                title={refusal(t, "CURSOR_INVALID").title}
                code="CURSOR_INVALID"
                action={{ label: t("pty01.reloadFirst"), icon: "refresh-cw", variant: "secondary", href: routes.opsParties() }}
                density="console"
                locale={locale}
              >
                {refusal(t, "CURSOR_INVALID").text}
              </Banner>
            ) : failure !== null ? (
              <PartyFailure failure={failure} errorTitle={t("pty01.errTitle")} density="console" t={t} locale={locale} />
            ) : (
              <List data={data} t={t} locale={locale} />
            )}
          </div>
          {creating ? <CreatePanel attempt={attempt?.form === "create" ? attempt : null} search={filter} t={t} locale={locale} /> : null}
        </Columns>
      </div>
    </OpsFrame>
  );
}

function List({ data, t, locale }: { data: PartyList | null; t: Translate; locale: Locale }) {
  const rows = data?.rows ?? [];
  const filtered = data !== null && (data.filter.q !== null || data.filter.state !== null);
  const n = count(rows.length, locale);
  return (
    <>
      <Table
        columns={[
          { key: "name", label: t("pty01.cName"), kind: "strong" },
          { key: "rec", label: t("pty01.cRec"), kind: "id" },
          { key: "reg", label: t("pty01.cReg"), kind: "mono", missing: t("party.noReg") },
          { key: "kind", label: t("pty01.cKind") },
          { key: "st", label: t("pty01.cState"), kind: "status" },
        ]}
        rows={rows.map((row) => partyRow(row, t, locale))}
        density="console"
        rowFocus
        {...(rows.length > 0 ? { sortNote: t("pty01.sortNote") } : {})}
        loading={data === null ? LOADING_ROWS : false}
        empty={{ variant: "filtered", title: t("pty01.emptyTitle"), text: t("pty01.emptyText"), action: false }}
        caption={t("pty01.title")}
        locale={locale}
      />
      {data !== null && rows.length > 0 ? (
        <Pagination
          summary={t("pty01.pager", { n })}
          hasNext={false}
          endNote={t(filtered ? "pty01.endFiltered" : "pty01.endAll")}
          density="console"
          label={t("pty01.pages")}
          locale={locale}
        />
      ) : null}
    </>
  );
}

/** One party; a superseded record carries the surviving party on the line under it, never only in a tooltip. */
function partyRow(row: PartyRow, t: Translate, locale: Locale): Record<string, unknown> {
  const survivor = row.supersededBy;
  return {
    _key: row.record,
    _href: routes.opsParty(row.record),
    ...(survivor !== null
      ? { _message: { severity: "neutral", text: t("party.superseded", { name: survivor.legalName, rec: survivor.record, d: day(survivor.on, locale), by: survivor.by }) } }
      : {}),
    name: row.legalName,
    rec: row.record,
    reg: row.businessRegistration,
    kind: t(`party.kind.${row.kind}`),
    st: codeStatus(row.state, t),
  };
}

/** Create party: the kind, the legal name and, where it has one, the registration number, masked as it is typed. */
function CreatePanel({
  attempt,
  search,
  t,
  locale,
}: {
  attempt: PartyAttempt | null;
  /** The list's search, which closing the panel keeps. */
  search: { q: string | null; state: string | null };
  t: Translate;
  locale: Locale;
}) {
  const value = (name: string) => {
    const typed = attempt?.values[name];
    return typeof typed === "string" ? typed : "";
  };
  const failed = attempt?.refusal ?? null;
  const error = (field: string) => (failed !== null && failed.field === field ? { error: refusal(t, failed.code, "pty01", failed.values).text } : {});
  return (
    <PanelForm
      action={createPartyAction}
      title={t("pty01.create")}
      eyebrow={t("pty01.createEyebrow")}
      submit={t("pty01.create")}
      cancel={t("party.cancel")}
      closeHref={routes.opsParties(search)}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Text size="sm" tone="secondary">
          {t("pty01.createDesc")}
        </Text>
        <ChoiceList
          legend={t("pty01.fKind")}
          name="party_kind"
          options={PARTY_KINDS.map((kind) => ({ value: kind, label: t(`party.kind.${kind}`) }))}
          value={value("party_kind") || "ORGANISATION"}
          {...(failed?.field === "party_kind" ? { error: refusal(t, failed.code).text } : {})}
          required
          density="console"
          locale={locale}
        />
        <TextField label={t("pty01.fLegalName")} helper={t("pty01.fLegalNameHelp")} name="legal_name" value={value("legal_name")} {...error("legal_name")} required wrap density="console" width="100%" locale={locale} />
        <TextField
          label={t("pty01.fRegistration")}
          helper={t("pty01.fRegistrationHelp")}
          name="identifying_reference"
          masked
          revealable
          inputMode="numeric"
          {...error("identifying_reference")}
          density="console"
          width="var(--container-3xs)"
          locale={locale}
        />
      </div>
    </PanelForm>
  );
}
