import { Banner, Button, ButtonRow, EmptyState, PageHeader, Panel, Select, Table, TextField } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { Text } from "@/components/Text";
import { linkRemedy, recheckLinkage } from "@/features/cases/console-actions";
import { ConsoleFailure } from "@/features/cases/ConsoleFailure";
import { casOpsTranslator, day, fieldRefusal, moment, opsStatus, refusalWords } from "@/features/cases/copy";
import { SubmitButton } from "@/features/cases/SubmitButton";
import { loadRemedyPage, type ConsoleAttempt, type RemedyPage, type RemedyRow } from "@/lib/api/cases";
import { readForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { CONSOLE_VIEWS } from "@/lib/mock/cases";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SCR-CAS-10 Remedy linkage: every artefact kind the remedy in force requires, and nothing it does not; what is
 * linked against each; and whether that artefact names the case from its own side - a read of the module that holds
 * it, refreshed on demand, and the screen says when it was read. The case closes when the answer is complete, and
 * says why it cannot while it is not.
 */
export default async function RemedyLinkagePage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-CAS", "ACT-FIN-OP");
  const [{ reference: raw }, query] = await Promise.all([params, searchParams]);
  const reference = decodeURIComponent(raw);
  const locale = await getLocale();
  const t = casOpsTranslator(locale);
  const view = reviewView(query, CONSOLE_VIEWS);
  const attempt = readForPage<ConsoleAttempt>(query);
  const kept = attempt !== null && attempt.subject === reference ? attempt : null;
  const outcome = view === "loading" ? null : await loadRemedyPage(staff, reference, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const header = kept !== null && Object.keys(kept.refusal.fields).length === 0 ? refusalWords(t, kept.refusal, locale) : null;

  return (
    <OpsFrame console="operations" current="cases" staff={staff} searchLabel={t("casops.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader
          crumbs={[{ label: t("cas03.title"), href: routes.opsCases() }, { label: reference, href: routes.opsCase(reference) }]}
          title={t("cas10.title", { ref: reference })}
          {...(data !== null
            ? {
                status: opsStatus(data.state),
                ...(data.remedy !== null ? { meta: t(data.fromAppeal !== null ? "cas10.metaAppeal" : "cas10.meta", { remedy: t(`cas.remedy.${data.remedy}`), appeal: data.fromAppeal ?? "" }) } : {}),
              }
            : {})}
          locale={locale}
        >
          <Button variant="quiet" size="sm" icon="arrow-left" href={routes.opsCase(reference)} locale={locale}>
            {t("cas06.back")}
          </Button>
        </PageHeader>
        {header !== null ? (
          <Banner family="danger" title={header.title} code={header.code} live density="console" locale={locale}>
            {header.text}
          </Banner>
        ) : null}
        {failure !== null ? (
          <ConsoleFailure failure={failure} errorTitle={t("cas10.errTitle")} errorText={t("casops.errText")} t={t} locale={locale} />
        ) : (
          <Linkage data={data} kept={kept?.form === "link" ? kept : null} t={t} locale={locale} />
        )}
      </div>
    </OpsFrame>
  );
}

function Linkage({ data, kept, t, locale }: { data: RemedyPage | null; kept: ConsoleAttempt | null; t: Translate; locale: Locale }) {
  if (data !== null && data.rows.length === 0) {
    return (
      <EmptyState variant="no-obligation" title={t("cas10.emptyTitle")} level={2} density="console" locale={locale}>
        {t("cas10.emptyText")}
      </EmptyState>
    );
  }
  const linkable = (data?.rows ?? []).filter((row) => row.link === null || !row.link.namesCase).map((row) => row.kind).filter((kind) => data?.mayLink.includes(kind) === true);
  const open = data !== null && (data.state === "DECIDED" || data.state === "REMEDY_IN_PROGRESS");
  const typed = (name: string) => {
    const value = kept?.values[name];
    return typeof value === "string" ? value : "";
  };
  const kindError = kept !== null ? Object.keys(kept.refusal.fields)[0] ?? null : null;
  // The refund lives in FIN: while none is linked, the finance officer records it there, the case filled in.
  const refundToRecord = data !== null && data.mayLink.includes("refund") && data.rows.some((row) => row.kind === "refund" && row.link === null);
  return (
    <>
      <Panel title={t("cas10.required")} level={2} density="console" gap="md" locale={locale}>
        <Table
          columns={[
            { key: "kind", label: t("cas10.cKind") },
            { key: "ref", label: t("cas10.cRef"), kind: "stack" },
            { key: "names", label: t("cas10.cNames"), kind: "status" },
          ]}
          rows={(data?.rows ?? []).map((row) => linkRow(row, t, locale))}
          loading={data === null ? 4 : false}
          density="console"
          caption={t("cas10.required")}
          locale={locale}
        />
        <Text size="sm" tone="secondary">
          {t("cas10.readNote")}
        </Text>
      </Panel>
      {data !== null ? <Answer data={data} t={t} locale={locale} /> : null}
      {data !== null && open ? (
        <Panel title={t("cas10.linkTitle")} level={2} density="console" gap="md" locale={locale}>
          {linkable.length > 0 ? (
            <form action={linkRemedy.bind(null, data.reference)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--space-60), 1fr))", gap: "var(--space-4)", alignItems: "end" }}>
              <Select
                label={t("cas10.kind")}
                name="artefact_kind"
                options={linkable.map((kind) => ({ value: kind, label: t(`casops.artefactName.${kind}`) }))}
                value={typed("artefact_kind") !== "" ? typed("artefact_kind") : (linkable[0] ?? "")}
                density="console"
                locale={locale}
              />
              <TextField
                label={t("cas10.ref")}
                name="artefact_ref"
                value={typed("artefact_ref")}
                mono
                autoComplete="off"
                helper={t("cas10.refHelp")}
                {...(kindError !== null ? fieldRefusal(t, kept?.refusal ?? null, kindError, t("cas10.ref"), locale) : {})}
                density="console"
                locale={locale}
              />
              <div>
                <SubmitButton variant="primary" size="sm" locale={locale}>
                  {t("cas10.link")}
                </SubmitButton>
              </div>
            </form>
          ) : (
            <Text size="sm" tone="secondary">
              {t(data.mayLink.length > 0 ? "cas10.nothingToLink" : "cas10.noAuthority")}
            </Text>
          )}
          {refundToRecord ? (
            <ButtonRow>
              <Button variant="quiet" size="sm" icon="arrow-right" href={routes.opsCorrections(null, "refund", data.reference)} locale={locale}>
                {t("cas10.recordRefund")}
              </Button>
            </ButtonRow>
          ) : null}
        </Panel>
      ) : null}
      {data !== null ? (
        <ButtonRow>
          <form action={recheckLinkage.bind(null, data.reference)}>
            <SubmitButton
              variant="secondary"
              size="sm"
              icon="refresh-cw"
              {...(data.rows.some((row) => row.link !== null) ? {} : { disabled: true, disabledReason: t("cas10.whyRecheck") })}
              locale={locale}
            >
              {t("cas10.recheck")}
            </SubmitButton>
          </form>
        </ButtonRow>
      ) : null}
    </>
  );
}

/** One required kind: the reference linked, or none; and whether it names the case, in words, or a dash while nothing is linked. */
function linkRow(row: RemedyRow, t: Translate, locale: Locale): Record<string, unknown> {
  return {
    _key: row.kind,
    ...(row.link !== null && !row.link.namesCase ? { _tone: "attention" } : {}),
    kind: t(`casops.artefactName.${row.kind}`),
    ref:
      row.link !== null
        ? { text: row.link.reference, mono: true, detail: t("cas10.linkedBy", { by: row.link.linkedBy, t: moment(row.link.checkedAt, locale) }) }
        : { text: t("cas10.notLinked"), muted: true },
    names:
      row.link === null
        ? { family: "neutral", label: "–", plain: true }
        : row.link.namesCase
          ? { family: "positive", label: t("cas10.yes") }
          : { family: "attention", label: t("cas10.no") },
  };
}

/** The answer for the remedy as a whole: why the case cannot close, or that it has. */
function Answer({ data, t, locale }: { data: RemedyPage; t: Translate; locale: Locale }) {
  const { linkage } = data;
  if (linkage.complete) {
    return (
      <Banner family="neutral" title={t("cas10.completeTitle")} code="ALL_REQUIRED_LINKED" density="console" locale={locale}>
        {linkage.closedOn !== null ? t("cas10.completeText", { d: day(linkage.closedOn, locale) }) : t("cas10.completeOpen")}
      </Banner>
    );
  }
  const sentences = [
    ...(linkage.missing.length > 0 ? [refusalWords(t, { code: "REMEDY_LINKAGE_INCOMPLETE", fields: {}, detail: { kind: linkage.missing.join(", ") } }, locale).text] : []),
    ...linkage.absent.map((reference) => refusalWords(t, { code: "BACK_REFERENCE_ABSENT", fields: {}, detail: { reference } }, locale).text),
  ];
  return (
    <Banner family="attention" title={t("cas10.blockedTitle")} code={linkage.missing.length > 0 ? "REMEDY_LINKAGE_INCOMPLETE" : "BACK_REFERENCE_ABSENT"} density="console" locale={locale}>
      {`${sentences.join(" ")} ${t("cas10.blockedTail")}`}
    </Banner>
  );
}
