import { Banner, Button, Columns, PageHeader, Pagination, Table, TextField, Toast } from "@/components/r1";
import { Text } from "@/components/Text";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { raiseCandidacyAction } from "@/features/parties/actions";
import { codeStatus, count, joinNames, moment, partyTranslator, refusal } from "@/features/parties/copy";
import { PanelForm } from "@/features/parties/PanelForm";
import { PartyFailure } from "@/features/parties/PartyFailure";
import { PartyTabs } from "@/features/parties/PartyTabs";
import { ReviewFilter } from "@/features/parties/ReviewFilter";
import { readForPage } from "@/lib/api/flash";
import { REVIEW_KINDS, loadReviewQueue, type PartyAttempt, type ReviewQueue, type ReviewRow } from "@/lib/api/parties";
import { holds, requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { PARTIES_VIEWS } from "@/lib/mock/parties";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const text = (value: string | string[] | undefined) => (typeof value === "string" && value !== "" ? value : null);

/**
 * SCR-PTY-04 Identification review queue: every open review, oldest first - a duplicate candidacy of two records, or
 * the identification a manual declaration sent to review - with the day it was opened and its age in whole days, a
 * figure and never a colour band. Nothing closes a review but a decision, so an empty queue means decisions were made.
 * Raise candidacy opens a review for two party records an officer thinks are one (POST /duplicate-candidates); it links
 * nothing, and the review is decided on SCR-PTY-05 like any other.
 */
export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS", "ACT-AUD");
  const params = await searchParams;
  const locale = await getLocale();
  const t = partyTranslator(locale);
  const asked = reviewView(params, PARTIES_VIEWS);
  const filter = { kind: text(params.kind), age: text(params.age) };
  const outcome = asked === "loading" ? null : await loadReviewQueue(staff, filter, asked);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const kinds = REVIEW_KINDS.map((kind) => ({ value: kind, label: t(`party.reviewKind.${kind}`) }));
  const attempt = readForPage<PartyAttempt>(params);
  const raised = attempt?.form === "candidacy" ? attempt : null;
  const raising = holds(staff, "ACT-OPS") && (params.panel === "candidacy" || (raised?.refusal ?? null) !== null);
  const ages = [
    { value: "7", label: t("pty04.age7") },
    { value: "14", label: t("pty04.age14") },
  ];

  return (
    <OpsFrame
      console="operations"
      current="parties"
      staff={staff}
      searchLabel={t("party.search")}
      keyMap={
        data !== null && data.rows.length > 0
          ? [
              { keys: ["J", "K"], label: t("pty01.kMove") },
              { keys: ["Enter"], label: t("pty04.kOpen") },
            ]
          : []
      }
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("party.crumb"), href: routes.opsParties() }]}
          title={t("pty04.title")}
          meta={data !== null ? t("pty04.meta", { ts: moment(data.asOf, locale) }) : t("pty04.rule")}
          locale={locale}
        >
          {holds(staff, "ACT-OPS") ? (
            <Button variant="secondary" size="sm" icon="plus" href={routes.opsRaiseCandidacy()} locale={locale}>
              {t("pty04.raise")}
            </Button>
          ) : null}
        </PageHeader>
        {raised !== null && raised.refusal === null && typeof raised.done === "string" ? (
          <div style={{ maxWidth: "var(--container-lg)" }}>
            <Toast family="positive" title={t("pty04.rcDone", { review: raised.done })} locale={locale}>
              {t("pty04.rcDoneText")}
            </Toast>
          </div>
        ) : null}
        <PartyTabs current="reviews" openReviews={data?.open ?? null} t={t} locale={locale} />
        <ReviewFilter
          words={{
            filters: t("pty04.filters"),
            kind: t("pty04.fKind"),
            allKinds: t("pty04.allKinds"),
            age: t("pty04.fAge"),
            anyAge: t("pty04.anyAge"),
            chipKind: t("pty04.chipKind"),
            chipAge: t("pty04.chipAge"),
          }}
          kinds={kinds}
          ages={ages}
          value={data !== null ? { kind: data.filter.kind, age: data.filter.age !== null ? String(data.filter.age) : null } : filter}
          summary={data !== null ? t("pty04.count", { n: count(data.rows.length, locale) }) : ""}
          locale={locale}
        />
        {failure?.code === "CURSOR_INVALID" ? (
          <Banner
            family="attention"
            title={refusal(t, "CURSOR_INVALID").title}
            code="CURSOR_INVALID"
            action={{ label: t("pty01.reloadFirst"), icon: "refresh-cw", variant: "secondary", href: routes.opsIdentificationReviews() }}
            density="console"
            locale={locale}
          >
            {refusal(t, "CURSOR_INVALID").text}
          </Banner>
        ) : failure !== null ? (
          <PartyFailure failure={failure} errorTitle={t("pty04.errTitle")} density="console" t={t} locale={locale} />
        ) : (
          <Columns side="md" single={!raising}>
            <Queue data={data} t={t} locale={locale} />
            {raising ? <CandidacyPanel attempt={raised} t={t} locale={locale} /> : null}
          </Columns>
        )}
      </div>
    </OpsFrame>
  );
}

/** Raise candidacy: two party records, a ground, and the review it opens; the refusal stands beside what it names. */
function CandidacyPanel({ attempt, t, locale }: { attempt: PartyAttempt | null; t: Translate; locale: Locale }) {
  const value = (name: string) => {
    const typed = attempt?.values[name];
    return typeof typed === "string" ? typed : "";
  };
  const failed = attempt?.refusal ?? null;
  const error = (field: string) => (failed !== null && failed.field === field ? { error: refusal(t, failed.code, undefined, failed.values).text } : {});
  return (
    <PanelForm action={raiseCandidacyAction} title={t("pty04.rcTitle")} eyebrow={t("pty04.rcEyebrow")} submit={t("pty04.rcSend")} cancel={t("party.cancel")} closeHref={routes.opsIdentificationReviews()} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Text size="sm" tone="secondary">
          {t("pty04.rcIntro")}
        </Text>
        {failed !== null && failed.field === null ? (
          <Banner family="attention" title={refusal(t, failed.code, undefined, failed.values).title} code={failed.code} level={3} density="console" live locale={locale}>
            {refusal(t, failed.code, undefined, failed.values).text}
          </Banner>
        ) : null}
        <input type="hidden" name="subject_kind" value="PARTY" />
        <TextField label={t("pty04.rcLeft")} helper={t("pty04.rcRecordHelp")} name="left_ref" value={value("left_ref")} {...error("left_ref")} mono required density="console" width="var(--container-3xs)" locale={locale} />
        <TextField label={t("pty04.rcRight")} helper={t("pty04.rcRecordHelp")} name="right_ref" value={value("right_ref")} {...error("right_ref")} mono required density="console" width="var(--container-3xs)" locale={locale} />
        <TextField label={t("pty04.rcGround")} helper={t("pty04.rcGroundHelp")} name="ground" value={value("ground")} {...error("ground")} required wrap density="console" width="100%" locale={locale} />
      </div>
    </PanelForm>
  );
}

function Queue({ data, t, locale }: { data: ReviewQueue | null; t: Translate; locale: Locale }) {
  const rows = data?.rows ?? [];
  const filtered = data !== null && (data.filter.kind !== null || data.filter.age !== null);
  const n = count(rows.length, locale);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
      <Table
        columns={[
          { key: "subject", label: t("pty04.cSubject"), kind: "strong", minWidth: "var(--space-80)" },
          { key: "kind", label: t("pty04.cKind"), nowrap: true },
          { key: "records", label: t("pty04.cRecords"), nowrap: true },
          { key: "opened", label: t("pty04.cOpened"), kind: "date", short: true },
          { key: "age", label: t("pty04.cAge"), kind: "count", unit: t("pty04.ageUnit"), help: t("pty04.ageHelp") },
          { key: "st", label: t("pty04.cState"), kind: "status" },
        ]}
        rows={rows.map((row) => reviewRow(row, t))}
        density="console"
        rowFocus
        {...(rows.length > 0 ? { sortNote: t("pty04.sortNote") } : {})}
        loading={data === null ? 4 : false}
        empty={
          filtered
            ? { variant: "filtered", title: t("pty04.emptyFilteredTitle"), text: t("pty04.emptyFilteredText"), action: false }
            : { variant: "governed", title: t("pty04.emptyTitle"), text: t("pty04.emptyText"), action: false }
        }
        caption={t("pty04.title")}
        locale={locale}
      />
      {data !== null && rows.length > 0 ? (
        <Pagination summary={t("pty04.pager", { n })} hasNext={false} endNote={t(filtered ? "pty04.endFiltered" : "pty04.endAll")} density="console" label={t("pty04.pages")} locale={locale} />
      ) : null}
    </div>
  );
}

/** Every row in the queue is OPEN, so the state is drawn quiet; the subject joins the records' names. */
function reviewRow(row: ReviewRow, t: Translate): Record<string, unknown> {
  return {
    _key: row.id,
    _href: routes.opsIdentificationReview(row.id),
    subject: joinNames(row.kind === "DUPLICATE_CANDIDACY" ? [...row.names].reverse() : row.names, t),
    kind: t(`party.reviewKind.${row.kind}`),
    records: (row.kind === "DUPLICATE_CANDIDACY" ? [...row.records].reverse() : row.records).join(", "),
    opened: row.openedAt,
    age: row.age,
    st: codeStatus("OPEN", t, true),
  };
}
