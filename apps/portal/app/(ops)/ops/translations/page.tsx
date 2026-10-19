import { Banner, Button, ButtonRow, EmptyState, FactList, FilterBar, PageHeader, Panel, Select, SidePanel, Skeleton, StatusLine, Table, TextField, Toast, ViewState, type StatusValue } from "@/components/r1";
import { consoleArea } from "@/components/shells/ops-nav";
import { OpsFrame } from "@/components/shells/OpsFrame";
import { day, moment, svcTranslator } from "@/features/continuity/console";
import { ShortcutButton } from "@/features/player-ops/ShortcutButton";
import { recordTranslationAct } from "@/features/translations/actions";
import { readForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { loadTranslations, type SourceVersionOption, type TranslationAttempt, type TranslationRegister, type TranslationRow } from "@/lib/api/translations";
import { getLocale } from "@/lib/i18n/locale";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { TRANSLATIONS_VIEWS } from "@/lib/mock/translations";
import { routes } from "@/lib/routes";
import { reviewView } from "@/lib/view/demo-view";

type SearchParams = Record<string, string | string[] | undefined>;

const STATE_FAMILY: Readonly<Record<TranslationRow["state"], StatusValue["family"]>> = { current: "positive", superseded: "neutral" };

const one = (value: string | string[] | undefined): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/**
 * SCR-SVC-21 Translation register, on the operations console. The operations officer types a content key in the
 * vocabulary of the module that publishes it (there is no list of every key) and reads the translations of that
 * content: the Vietnamese version each was approved against, whether that version is still in force, and since when a
 * translation is superseded and by which version. The Vietnamese text is the authoritative one. Recording a translation
 * links it to an approved Vietnamese version; a draft or a version awaiting approval is refused, as is a second
 * translation into the same language against the same version.
 */
export default async function TranslationRegisterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const staff = await requireStaff("ACT-OPS");
  const params = await searchParams;
  const locale = await getLocale();
  const t = svcTranslator(locale);
  const view = reviewView(params, TRANSLATIONS_VIEWS);
  const contentKey = one(params.content)?.toUpperCase() ?? null;
  const kept = readForPage<TranslationAttempt>(params);
  const attempt = kept !== null && kept.contentKey === contentKey ? kept : null;
  const outcome = view === "loading" || contentKey === null ? null : await loadTranslations(staff, contentKey, view);
  const data = outcome?.data ?? null;
  const failure = outcome?.failure ?? null;
  const recording = data !== null && one(params.record) !== null;

  return (
    <OpsFrame
      console="operations"
      current="translations"
      staff={staff}
      searchLabel={t("svc21.search")}
      keyMap={[
        ...((data?.translations.length ?? 0) > 0 ? [{ keys: ["J", "K"], label: t("svc21.kRows") }] : []),
        ...(data !== null ? [{ keys: ["Alt", "N"], label: t("svc21.kRecord") }] : []),
        ...(recording ? [{ keys: ["Esc"], label: t("svc21.kEsc") }] : []),
      ]}
      locale={locale}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <PageHeader crumbs={[{ label: consoleArea("operations", locale) }]} title={t("svc21.title")} meta={t("svc21.meta")} locale={locale}>
          <Button variant="quiet" size="sm" href={routes.ops()} locale={locale}>
            {t("svc.close")}
          </Button>
          {data !== null ? (
            <ShortcutButton variant="primary" size="sm" icon="plus" shortcut="Alt+N" href={routes.opsTranslations({ content: data.contentKey, record: "1" })} locale={locale}>
              {t("svc21.record")}
            </ShortcutButton>
          ) : null}
        </PageHeader>
        {attempt?.recorded !== null && attempt?.recorded !== undefined ? (
          <div style={{ maxWidth: "var(--container-lg)" }}>
            <Toast
              family="positive"
              title={t("svc21.recordedTitle", { lang: t(`svc21.langIn.${attempt.recorded.languageCode}`), v: attempt.recorded.sourceVersion })}
              locale={locale}
            >
              {t("svc21.recordedText", { v: attempt.recorded.sourceVersion })}
            </Toast>
          </div>
        ) : null}
        <form action={routes.opsTranslations()}>
          <FilterBar label={t("svc21.fBar")} shortcut="/" locale={locale}>
            <TextField
              label={t("svc21.fContent")}
              name="content"
              {...(contentKey !== null ? { value: contentKey } : {})}
              placeholder={t("svc21.fContentHint")}
              mono
              width="var(--space-96)"
              density="console"
              locale={locale}
            />
            <Button variant="secondary" size="sm" icon="search" type="submit" locale={locale}>
              {t("svc21.show")}
            </Button>
          </FilterBar>
        </form>
        {view === "loading" ? (
          <Skeleton variant="table" rows={3} columns={4} density="console" locale={locale} />
        ) : contentKey === null ? (
          <EmptyState variant="not-started" title={t("svc21.nsTitle")} icon="search" level={2} action={false} density="console" locale={locale}>
            {t("svc21.nsText")}
          </EmptyState>
        ) : failure?.code === "CONTENT_NOT_FOUND" ? (
          <ViewState
            view="refused"
            refusal={{ code: failure.code, title: t("svc21.nfTitle", { key: contentKey }), text: t("svc.refusal.CONTENT_NOT_FOUND"), family: "neutral" }}
            level={2}
            density="console"
            locale={locale}
          />
        ) : failure !== null ? (
          <ViewState
            view="error"
            errorTitle={t("svc21.errTitle")}
            errorText={t("svc.errorText")}
            {...(failure.traceId !== null ? { traceId: failure.traceId } : {})}
            retryable={failure.retryable}
            level={2}
            density="console"
            locale={locale}
          />
        ) : data !== null ? (
          <Register data={data} t={t} locale={locale} />
        ) : null}
      </div>
      {recording && data !== null ? <RecordForm data={data} attempt={attempt?.refusal !== null ? attempt : null} t={t} locale={locale} /> : null}
    </OpsFrame>
  );
}

/** Where the version a translation was approved against stands, in words: the whole meaning of the row. */
function sourceWords(row: TranslationRow, data: TranslationRegister, t: Translate): string {
  if (row.sourcePhase === "IN_EFFECT") return t("svc21.src.IN_EFFECT", { v: row.sourceVersion });
  if (row.sourcePhase === "UPCOMING") return t("svc21.src.UPCOMING", { v: row.sourceVersion });
  return data.inForce !== null ? t("svc21.src.SUPERSEDED", { v: row.sourceVersion, now: data.inForce.label }) : t("svc21.src.SUPERSEDED_NONE", { v: row.sourceVersion });
}

function Register({ data, t, locale }: { data: TranslationRegister; t: Translate; locale: Locale }) {
  return (
    <>
      <Panel title={t("svc21.sourceTitle")} level={2} density="console" locale={locale}>
        <FactList
          items={[
            { label: t("svc21.fKey"), value: data.contentKey, kind: "mono" },
            {
              label: t("svc21.fInForce"),
              value: data.inForce === null ? null : data.inForce.effectiveFrom !== null ? t("svc21.inForceValue", { v: data.inForce.label, d: day(data.inForce.effectiveFrom, locale) }) : data.inForce.label,
              missing: t("svc21.noneInForce"),
              note: t("svc21.authoritative"),
            },
            { label: t("svc21.fRead"), value: data.readAt, kind: "datetime" },
          ]}
          columns={2}
          density="console"
          locale={locale}
        />
      </Panel>
      <Panel title={t("svc21.listTitle")} level={2} density="console" locale={locale}>
        <Table
          columns={[
            { key: "language", label: t("svc21.cLanguage"), kind: "stack" },
            { key: "source", label: t("svc21.cSource"), kind: "stack" },
            { key: "state", label: t("svc21.cState"), kind: "status" },
            { key: "approver", label: t("svc21.cApprover"), kind: "person" },
          ]}
          rows={data.translations.map((row) => ({
            _key: row.id,
            language: { text: row.languageCode, detail: t(`svc21.langName.${row.languageCode}`), mono: true },
            source: { text: t("svc21.version", { v: row.sourceVersion }), detail: sourceWords(row, data, t) },
            state: {
              family: STATE_FAMILY[row.state],
              label: t(`svc21.state.${row.state}`),
              ...(row.state === "superseded" && row.supersededAt !== null && row.supersededByVersion !== null
                ? { detail: t("svc21.supersededDetail", { at: moment(row.supersededAt, locale), v: row.supersededByVersion }) }
                : {}),
            },
            approver: { name: row.approvedBy, detail: moment(row.approvedAt, locale) },
          }))}
          density="console"
          caption={t("svc21.listTitle")}
          {...(data.translations.length > 0 ? { sortNote: t("svc21.sortNote") } : {})}
          empty={{ variant: "governed", title: t("svc21.emptyTitle"), text: t("svc21.emptyText"), action: false }}
          rowFocus
          locale={locale}
        />
      </Panel>
      <StatusLine family="info" text={t("svc21.note")} detail={t("svc21.noteDetail")} locale={locale} />
    </>
  );
}

/** A Vietnamese version as the form offers it: its label and where it stands, so a draft is seen to be one. */
function versionLabel(version: SourceVersionOption, t: Translate): string {
  const standing = version.status === "PUBLISHED" ? t(`svc21.phase.${version.phase ?? "IN_EFFECT"}`) : t(`svc21.status.${version.status}`);
  return t("svc21.option", { v: version.label, s: standing });
}

/**
 * The record form beside the register: the language and the Vietnamese version the translation was approved against.
 * A refusal comes back with what was chosen and the field it concerns marked; one that names no field is above the form.
 */
function RecordForm({ data, attempt, t, locale }: { data: TranslationRegister; attempt: TranslationAttempt | null; t: Translate; locale: Locale }) {
  const refusal = attempt?.refusal ?? null;
  const at = (field: string) => (refusal !== null && refusal.field === field ? refusal : null);
  const languageError = at("language_code");
  const sourceError = at("source_version");
  return (
    <SidePanel title={t("svc21.formTitle")} eyebrow={data.contentKey} open density="console" locale={locale}>
      <form action={recordTranslationAct} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <input type="hidden" name="content_key" value={data.contentKey} />
        <StatusLine family="info" text={t("svc21.formNote")} locale={locale} />
        {refusal !== null && refusal.field === null ? (
          <Banner family="attention" title={t(`svc.refusal.${refusal.code}`)} code={refusal.code} live density="console" locale={locale}>
            {t("svc21.alreadyText", { lang: t(`svc21.langIn.${refusal.values.languageCode ?? ""}`), v: refusal.values.sourceVersion ?? "" })}
          </Banner>
        ) : null}
        <Select
          label={t("svc21.fLanguage")}
          name="language_code"
          options={data.languages.map((code) => ({ value: code, label: t("svc21.langOption", { code, name: t(`svc21.langName.${code}`) }) }))}
          placeholder={t("svc21.languagePick")}
          {...(attempt !== null && attempt.input.languageCode !== "" ? { value: attempt.input.languageCode } : {})}
          required
          {...(languageError !== null ? { error: t("svc.refusal.FIELD_MISSING") } : {})}
          density="console"
          locale={locale}
        />
        <Select
          label={t("svc21.fSource")}
          name="source_version"
          helper={t("svc21.sourceHelp")}
          options={data.versions.map((version) => ({ value: version.label, label: versionLabel(version, t) }))}
          placeholder={t("svc21.sourcePick")}
          {...(attempt !== null && attempt.input.sourceVersion !== "" ? { value: attempt.input.sourceVersion } : {})}
          required
          {...(sourceError !== null
            ? { error: sourceError.code === "FIELD_MISSING" ? t("svc.refusal.FIELD_MISSING") : t("svc21.notApproved", { v: sourceError.values.sourceVersion ?? "" }) }
            : {})}
          density="console"
          locale={locale}
        />
        <ButtonRow>
          <Button variant="primary" size="sm" type="submit" locale={locale}>
            {t("svc21.recordDo")}
          </Button>
          <Button variant="quiet" size="sm" href={routes.opsTranslations({ content: data.contentKey })} locale={locale}>
            {t("svc21.cancel")}
          </Button>
        </ButtonRow>
      </form>
    </SidePanel>
  );
}
