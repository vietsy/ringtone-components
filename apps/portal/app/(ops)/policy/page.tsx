import { Banner, Button, EmptyState, FilterBar, PageHeader, Select, Skeleton, Table, ViewState, type StatusValue } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { decides, documentTitle, drafts, pubTranslator, refusalWords, shortDay } from "@/features/public/console";
import { loadPublicDocuments, type DocumentClass, type DocumentList, type DocumentRow, type DocumentStatusFilter, type VersionLine } from "@/lib/api/public";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { POLICY_VIEWS } from "@/lib/mock/public";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const CLASSES: readonly DocumentClass[] = ["PAGE", "LEGAL"];
const STATUSES: readonly DocumentStatusFilter[] = ["DRAFT", "SUBMITTED", "WITHDRAWN"];
const one = (value: string | string[] | undefined): string | null => (typeof value === "string" && value !== "" ? value : null);

/**
 * SCR-PUB-14 Public documents, the policy console's landing: every public page and RightOne Player legal document with
 * its version in effect, the versions upcoming and the one open, filtered by class and by the state of a version. The
 * author of a class opens its draft or starts a new version (SCR-PUB-15); the approver of a class reviews a submitted
 * one (SCR-PUB-16); a version in effect or upcoming opens where the reader can act on it. Publication currency
 * (SCR-PUB-17) is a click away for the readers it admits.
 */
export default async function PublicDocumentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-POL-PRE", "ACT-POL-APR", "ACT-OPS", "ACT-LGL");
  const params = await searchParams;
  const locale = await getLocale();
  const t = pubTranslator(locale);
  const view = reviewView(params, POLICY_VIEWS);
  // A cursor the address carries is sent as it is: the list issues none, so any is refused (CURSOR_INVALID).
  const cursor = one(params.cursor);
  const filter = {
    documentClass: CLASSES.find((documentClass) => documentClass === one(params.class)) ?? null,
    status: STATUSES.find((status) => status === one(params.status)) ?? null,
    cursor,
  };
  const outcome = view === "loading" ? null : await loadPublicDocuments(staff, filter, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const currency = holds(staff, "ACT-POL-PRE", "ACT-POL-APR", "ACT-OPS");
  const meta =
    data === null ? null : data.awaitingApproval === 0 ? t("pub14.metaNone", { n: data.documents }) : data.awaitingApproval === 1 ? t("pub14.metaOne", { n: data.documents }) : t("pub14.meta", { n: data.documents, m: data.awaitingApproval });

  return (
    <OpsFrame
      console="policy"
      current="documents"
      staff={staff}
      searchLabel={t("pubc.search")}
      keyMap={(data?.rows.length ?? 0) > 0 ? [{ keys: ["J", "K"], label: t("pubc.kRows") }, { keys: ["Enter"], label: t("pubc.kOpen") }] : []}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader crumbs={[{ label: t("pubc.policy") }]} title={t("pub14.title")} {...(meta !== null ? { meta } : {})} locale={locale}>
          {currency && failure?.code !== "NOT_AUTHORISED" ? (
            <Button variant="secondary" size="sm" icon="clock" href={routes.policyCurrency()} locale={locale}>
              {t("pub14.currency")}
            </Button>
          ) : null}
        </PageHeader>
        {failure?.code === "NOT_AUTHORISED" ? (
          <ViewState view="refused" refusal={{ code: failure.code, ...words(failure.code, t), family: "attention" }} level={2} density="console" locale={locale} />
        ) : failure !== null && failure.code !== "CURSOR_INVALID" ? (
          <ViewState view="error" errorTitle={t("pubc.errTitle")} errorText={t("pubc.errText")} {...(failure.traceId !== null ? { traceId: failure.traceId } : {})} retryable={failure.retryable} level={2} density="console" locale={locale} />
        ) : (
          <Documents data={data} chosen={filter} cursorRefused={failure?.code === "CURSOR_INVALID"} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function words(code: string, t: Translate): { title: string; text: string } {
  const refusal = refusalWords({ code }, t);
  return { title: refusal.title, text: refusal.text ?? "" };
}

function Documents({
  data,
  chosen,
  cursorRefused,
  t,
  locale,
}: {
  data: DocumentList | null;
  chosen: Readonly<{ documentClass: DocumentClass | null; status: DocumentStatusFilter | null }>;
  cursorRefused: boolean;
  t: Translate;
  locale: Locale;
}) {
  const shown = data?.rows.length ?? 0;
  const filtered = chosen.documentClass !== null || chosen.status !== null;
  const statusWord = chosen.status !== null ? t(`pubc.status.${chosen.status}`) : "";
  return (
    <>
      <form action={routes.policyDocuments()}>
        <FilterBar
          label={t("pub14.filterLabel")}
          shortcut="/"
          {...(data !== null ? { summary: shown === 1 ? t("pub14.summaryOne") : t("pub14.summary", { n: shown }) } : {})}
          active={filtered}
          locale={locale}
        >
          <Select
            label={t("pub14.fClass")}
            name="class"
            options={[
              { value: "", label: t("pub14.all") },
              { value: "PAGE", label: t("pub14.pages") },
              { value: "LEGAL", label: t("pub14.legal") },
            ]}
            value={chosen.documentClass ?? ""}
            width="var(--space-48)"
            density="console"
            locale={locale}
          />
          <Select
            label={t("pub14.fStatus")}
            name="status"
            options={[{ value: "", label: t("pub14.any") }, ...STATUSES.map((status) => ({ value: status, label: t(`pubc.status.${status}`) }))]}
            value={chosen.status ?? ""}
            width="var(--space-48)"
            density="console"
            locale={locale}
          />
          <Button variant="secondary" size="sm" type="submit" locale={locale}>
            {t("pub14.show")}
          </Button>
        </FilterBar>
      </form>
      {cursorRefused ? (
        <Banner
          family="attention"
          title={t("pubc.refusal.CURSOR_INVALID.title")}
          code="CURSOR_INVALID"
          action={{ label: t("pubc.reloadStart"), href: routes.policyDocuments(chosen), icon: "refresh-cw", variant: "secondary" }}
          density="console"
          locale={locale}
        >
          {t("pubc.refusal.CURSOR_INVALID.text")}
        </Banner>
      ) : null}
      {cursorRefused ? null : data === null ? (
        <Skeleton variant="table" rows={9} columns={5} density="console" locale={locale} />
      ) : data.rows.length === 0 ? (
        // The filtered empty is drawn here rather than by the table, so its way out is a link the server can pass.
        <EmptyState
          variant="filtered"
          title={
            chosen.documentClass !== null
              ? t("pub14.emptyClass", { class: t(`pubc.class.${chosen.documentClass}`).toLowerCase(), status: statusWord })
              : t("pub14.emptyTitle", { status: statusWord })
          }
          action={{ label: t("pub14.clear"), href: routes.policyDocuments(), variant: "secondary" }}
          level={2}
          density="console"
          locale={locale}
        />
      ) : (
        <Table
          columns={[
            { key: "doc", label: t("pub14.cDoc"), kind: "stack", minWidth: "var(--space-64)" },
            { key: "effect", label: t("pub14.cEffect"), kind: "stack" },
            { key: "upcoming", label: t("pub14.cUpcoming"), kind: "stack" },
            { key: "open", label: t("pub14.cOpen"), kind: "status" },
            { key: "act", label: t("pub14.cAct"), kind: "actions" },
          ]}
          rows={data.rows.map((row) => documentRow(row, data, t, locale))}
          density="console"
          caption={t("pub14.title")}
          rowFocus
          sortNote={t("pub14.sortNote")}
          locale={locale}
        />
      )}
    </>
  );
}

/**
 * A document's row. A version in effect opens in the editor, read only; one upcoming opens on the approval page for
 * the approver of its class, who may still withdraw it, and in the editor for anyone else.
 */
function documentRow(row: DocumentRow, data: DocumentList | null, t: Translate, locale: Locale): Record<string, unknown> {
  const reader = data?.reader ?? { drafts: [], approves: [], releasesLegal: false };
  const title = documentTitle(row.kind, t);
  const approver = reader.approves.includes(row.documentClass);
  const versionCell = (line: VersionLine | null, rest: readonly VersionLine[] = []) => {
    if (line === null || line.effectiveFrom === null) return { text: t("pubc.none"), muted: true };
    const then = rest.flatMap((next) => (next.effectiveFrom !== null ? [t("pub14.then", { version: next.label, date: shortDay(next.effectiveFrom, locale) })] : []));
    return {
      text: line.label,
      detail: [t("pub14.from", { date: shortDay(line.effectiveFrom, locale) }), ...then].join("; "),
      href: line.phase === "UPCOMING" && approver ? routes.policyVersionReview(line.id) : routes.policyVersion(line.id),
    };
  };
  const [next = null, ...later] = row.upcoming;
  const open = row.open;
  const openCell: StatusValue =
    open === null
      ? { family: "neutral", label: t("pubc.none") }
      : {
          family: open.status === "SUBMITTED" ? "attention" : "neutral",
          label: t(open.status === "SUBMITTED" ? "pub14.openSubmitted" : "pub14.openDraft", { version: open.label }),
          ...(open.draftedBy !== null ? { detail: t("pub14.openBy", { name: open.draftedBy, date: shortDay(open.submittedAt ?? open.savedAt, locale) }) } : {}),
        };
  const acts = [
    ...(drafts(reader, row.documentClass)
      ? [
          open !== null
            ? { label: t("pub14.openDraftA"), ariaLabel: `${t("pub14.openDraftA")} ${title}`, href: routes.policyVersion(open.id), variant: "secondary" as const }
            : { label: t("pub14.newVersionA"), ariaLabel: `${t("pub14.newVersionA")} ${title}`, href: routes.policyNewVersion(row.kind), variant: "secondary" as const },
        ]
      : []),
    ...(approver && open?.status === "SUBMITTED"
      ? [{ label: t("pub14.reviewA"), ariaLabel: `${t("pub14.reviewA")} ${title} ${open.label}`, href: routes.policyVersionReview(open.id), variant: decides(reader, row.documentClass) ? ("primary" as const) : ("secondary" as const) }]
      : []),
  ];
  return {
    _key: row.kind,
    doc: { text: title, detail: t(`pubc.class.${row.documentClass}`) },
    effect: versionCell(row.inEffect),
    upcoming: versionCell(next, later),
    open: openCell,
    act: acts,
  };
}
