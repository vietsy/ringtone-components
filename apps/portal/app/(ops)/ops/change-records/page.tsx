import { Button, DateField, PageHeader, Select, Table, TextField, ViewState } from "@/components/r1";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { moment, partyTranslator, refusal } from "@/features/parties/copy";
import { readDate } from "@/features/parties/fields";
import { CHANGE_SUBJECT_KINDS, loadChangeRecords, type ChangeRecordList, type ChangeRecordRow } from "@/lib/api/parties";
import { requireStaff } from "@/lib/api/session";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined): string | null => (typeof value === "string" ? value : null);

/**
 * The change records of the party register (GET /change-records, FR-PTY-048): every change in the period asked, the
 * newest first, each with its subject, what changed, the person or process that made it, what it relied on and when.
 * The register is read and never changed here. A period left empty is PERIOD_REQUIRED; before anything is asked the
 * page says what it needs rather than choosing a period for the reader.
 */
export default async function ChangeRecordsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-AUD", "ACT-DAT");
  const query = await searchParams;
  const locale = await getLocale();
  const t = partyTranslator(locale);
  const fromText = one(query.from);
  const toText = one(query.to);
  const kind = one(query.kind);
  const subject = one(query.subject);
  const asked = fromText !== null || toText !== null;
  const outcome = asked ? await loadChangeRecords(staff, { from: readDate(fromText ?? ""), to: readDate(toText ?? ""), subjectKind: kind, subject }) : null;

  return (
    <OpsFrame console="registerData" current="changeRecords" staff={staff} searchLabel={t("party.search")} locale={locale}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <PageHeader crumbs={[{ label: t("chr.crumb") }]} title={t("chr.title")} {...(outcome?.data ? { meta: t("chr.meta", { ts: moment(outcome.data.asOf, locale) }) } : {})} locale={locale} />
        <form method="get" action={routes.opsChangeRecords()} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--space-4)" }}>
          <DateField label={t("chr.fFrom")} name="from" value={readDate(fromText ?? "") ?? ""} helper={false} density="console" width="var(--space-48)" locale={locale} />
          <DateField label={t("chr.fTo")} name="to" value={readDate(toText ?? "") ?? ""} helper={false} density="console" width="var(--space-48)" locale={locale} />
          <Select
            label={t("chr.fKind")}
            name="kind"
            options={[{ value: "", label: t("chr.kind.ALL") }, ...CHANGE_SUBJECT_KINDS.map((value) => ({ value, label: t(`chr.kind.${value}`) }))]}
            value={kind ?? ""}
            density="console"
            width="var(--space-48)"
            locale={locale}
          />
          <TextField label={t("chr.fSubject")} name="subject" value={subject ?? ""} mono density="console" width="var(--space-48)" locale={locale} />
          <Button variant="secondary" size="sm" type="submit" locale={locale}>
            {t("chr.show")}
          </Button>
        </form>
        {outcome === null ? (
          <ViewState view="empty" empty={{ variant: "not-started", title: t("chr.askTitle"), text: t("chr.askText") }} density="console" level={2} locale={locale} />
        ) : outcome.failure !== null ? (
          outcome.failure.code === "PERIOD_REQUIRED" ? (
            <ViewState view="refused" refusal={{ ...refusal(t, "PERIOD_REQUIRED"), family: "attention" }} density="console" locale={locale} />
          ) : (
            <ViewState view="error" errorTitle={t("chr.errTitle")} errorText={t("party.errText")} {...(outcome.failure.traceId ? { traceId: outcome.failure.traceId } : {})} retryable density="console" locale={locale} />
          )
        ) : outcome.data !== null ? (
          <Rows data={outcome.data} t={t} locale={locale} />
        ) : null}
      </div>
    </OpsFrame>
  );
}

function Rows({ data, t, locale }: { data: ChangeRecordList; t: Translate; locale: Locale }) {
  return (
    <Table
      columns={[
        { key: "at", label: t("chr.cAt"), kind: "text", nowrap: true },
        { key: "subject", label: t("chr.cSubject"), kind: "text" },
        { key: "change", label: t("chr.cChange"), kind: "strong" },
        { key: "actor", label: t("chr.cActor"), kind: "text" },
        { key: "relied", label: t("chr.cRelied"), kind: "text" },
      ]}
      rows={data.rows.map((row) => ({
        _key: row.id,
        at: moment(row.at, locale),
        subject: t("chr.subject", { kind: t(`chr.kind.${row.subject.kind}`), ref: row.subject.reference }),
        change: changeWords(row, t),
        actor: row.actor.kind === "PERSON" ? (row.actor.person !== null ? t("chr.personRef", { name: row.actor.name, ref: row.actor.person }) : row.actor.name) : t(`chr.process.${row.actor.name}`),
        relied: reliedWords(row, t),
      }))}
      empty={{ variant: "governed", title: t("chr.emptyTitle"), text: t("chr.emptyText"), action: false }}
      density="console"
      caption={t("chr.title")}
      locale={locale}
    />
  );
}

function changeWords(row: ChangeRecordRow, t: Translate): string {
  if (row.change === "ACT_PERFORMED") return t("chr.change.ACT_PERFORMED", { act: t(`pty13.act.${row.values.act ?? ""}`), subject: row.values.subject ?? "" });
  return t(`chr.change.${row.change}`);
}

function reliedWords(row: ChangeRecordRow, t: Translate): string {
  switch (row.reliedOn.kind) {
    case "AUTHORITY":
      return row.reliedOn.authority !== null ? t("chr.relied.AUTHORITY", { ref: row.reliedOn.authority, v: String(row.reliedOn.version ?? 1) }) : t("chr.relied.REGISTER_PRINCIPAL");
    case "PERMISSION":
      return t(`chr.row.${row.reliedOn.row}`);
    case "RULE":
      return t("chr.relied.RULE", { rule: row.reliedOn.rule });
  }
}
