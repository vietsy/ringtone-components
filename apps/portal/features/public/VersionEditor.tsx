import type { ReactNode } from "react";
import {
  Button,
  ButtonRow,
  Columns,
  DateField,
  Divider,
  FactList,
  ItemList,
  LegalTextViewer,
  Panel,
  TextField,
} from "@/components/r1";
import type { AwaitedChange, DocumentStanding, LegalSection, PolicyRefusal, SourceKind, SourceRef } from "@/lib/api/public";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { day, refusalWords, versionFrom } from "./console";
import { SubmitAs } from "./SubmitAs";

/** The fields a refusal is placed beside (convention 3); every other refusal is in the page's header. */
const FIELD_REFUSALS: Readonly<Record<string, string>> = {
  VERSION_LABEL_EXISTS: "version_label",
  BODY_REQUIRED: "body",
  SOURCE_KIND_INVALID: "sources",
  EFFECTIVE_DATE_INVALID: "effective_from",
};

/** Whether a refusal is shown beside its field rather than in the header. */
export const besideField = (refusal: PolicyRefusal | null): boolean => refusal !== null && FIELD_REFUSALS[refusal.code] !== undefined;

/**
 * SCR-PUB-15's editor as both of its entries draw it: the version's label and effective instant, the sources it
 * describes, its text, and Gửi duyệt, Lưu (or Tạo phiên bản for a new one) and Về danh sách tài liệu; beside them the
 * document's required sections, present or missing in the text, and its published versions. A version the reader may
 * not change is drawn read only; `aside` adds the panels its state allows (withdrawal, approval).
 */
export function VersionEditor({
  formId,
  action,
  hidden,
  mode,
  editable,
  values,
  sourceKinds,
  requiredSections,
  sectionKeys,
  standing,
  awaiting,
  refusal,
  missing,
  startNote,
  reading,
  aside,
  t,
  locale,
}: {
  formId: string;
  action: (form: FormData) => Promise<void>;
  hidden: Readonly<Record<string, string>>;
  mode: "new" | "version";
  editable: boolean;
  values: { label: string; effective: string; body: string | null; sources: readonly SourceRef[] };
  sourceKinds: readonly SourceKind[];
  requiredSections: readonly string[];
  sectionKeys: readonly string[];
  standing: DocumentStanding;
  awaiting: readonly AwaitedChange[];
  refusal: PolicyRefusal | null;
  missing: string | null;
  startNote: string | null;
  /** A version the reader may not change, as it reads: its title and its text by sections. */
  reading?: { title: string; sections: readonly LegalSection[] };
  aside?: ReactNode;
  t: Translate;
  locale: Locale;
}) {
  const fieldError = (name: string): string | null => {
    if (missing === name) return t(name === "version_label" ? "pub15.labelMissing" : "pub15.effectiveMissing");
    if (refusal === null || FIELD_REFUSALS[refusal.code] !== name) return null;
    const words = refusalWords(refusal, t);
    return words.text !== null ? `${words.title} ${words.text}` : words.title;
  };
  const labelError = fieldError("version_label");
  const effectiveError = fieldError("effective_from");
  const bodyError = fieldError("body");
  const sourcesError = fieldError("sources");
  const readOnly = !editable;
  const refOf = (kind: SourceKind) => values.sources.find((source) => source.kind === kind)?.ref ?? "";
  const waiting = (kind: SourceKind) => awaiting.filter((change) => change.kind === kind).map((change) => change.ref);
  const [next = null] = standing.upcoming;

  return (
    <Columns>
      <form id={formId} action={action} noValidate style={{ minWidth: 0 }}>
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <input type="hidden" name="intent" defaultValue="save" />
        <Panel gap="xl" density="console" locale={locale}>
          <Panel variant="plain" title={t("pub15.secVersion")} level={2} density="console" locale={locale}>
            <Columns layout="halves" gap={4}>
              <TextField
                label={t("pub15.label")}
                name="version_label"
                value={values.label}
                required
                readOnly={readOnly}
                mono
                {...(labelError !== null ? { error: labelError } : {})}
                density="console"
                locale={locale}
              />
              {mode === "version" ? (
                <DateField
                  label={t("pub15.effective")}
                  name="effective_from"
                  withTime
                  {...(values.effective !== "" ? { value: values.effective } : { time: "00:00" })}
                  helper={readOnly ? false : t("pub15.effectiveHelp")}
                  readOnly={readOnly}
                  {...(effectiveError !== null ? { error: effectiveError } : {})}
                  density="console"
                  locale={locale}
                />
              ) : null}
            </Columns>
          </Panel>
          <Divider />
          <Panel
            variant="plain"
            title={t("pub15.secSources")}
            description={sourceKinds.length > 0 ? t("pub15.sourcesNote") : t("pub15.noSources")}
            level={2}
            density="console"
            locale={locale}
          >
            {sourceKinds.length > 0 && readOnly ? (
              <FactList items={sourceKinds.map((kind) => ({ label: t(`pubc.source.${kind}`), value: refOf(kind) === "" ? null : refOf(kind), kind: "mono" as const, missing: t("pub15.sourceNone") }))} density="console" locale={locale} />
            ) : null}
            {sourceKinds.length > 0 && !readOnly ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(var(--space-56), 1fr))", gap: "var(--space-4)" }}>
                {sourceKinds.map((kind) => (
                  <TextField
                    key={kind}
                    label={t(`pubc.source.${kind}`)}
                    name={`source-${kind}`}
                    value={refOf(kind)}
                    helper={waiting(kind).length > 0 ? t("pub15.sourceAwaiting", { refs: waiting(kind).join(", ") }) : t("pub15.sourceHelp")}
                    mono
                    {...(sourcesError !== null ? { error: sourcesError } : {})}
                    density="console"
                    locale={locale}
                  />
                ))}
              </div>
            ) : null}
          </Panel>
          <Divider />
          <Panel variant="plain" title={t("pub15.secBody")} {...(startNote !== null ? { description: startNote } : {})} level={2} density="console" locale={locale}>
            {values.body === null ? (
              <FactList items={[{ label: t("pub15.body"), value: t("pub15.notHeld") }]} density="console" locale={locale} />
            ) : readOnly && reading !== undefined ? (
              <LegalTextViewer
                title={reading.title}
                version={values.label}
                {...(values.effective !== "" ? { effective: values.effective } : {})}
                sections={reading.sections.map((section) => ({ id: section.id, heading: section.heading[locale], body: section.body[locale] }))}
                showProgress={false}
                locale={locale}
              />
            ) : (
              <TextField
                label={t("pub15.body")}
                helper={t("pub15.bodyHelp")}
                name="body"
                value={values.body}
                multiline
                rows={14}
                mono
                required
                readOnly={readOnly}
                {...(bodyError !== null ? { error: bodyError } : {})}
                density="console"
                locale={locale}
              />
            )}
          </Panel>
          <Divider />
          {editable ? (
            <ButtonRow label={t("pub15.decision")}>
              <SubmitAs
                formId={formId}
                intent="submit"
                label={t("pub15.submit")}
                variant="primary"
                icon="upload"
                {...(mode === "new" ? { disabledReason: t("pub15.submitWhy") } : {})}
                locale={locale}
              />
              {mode === "new" ? (
                <Button variant="secondary" size="sm" type="submit" locale={locale}>
                  {t("pub15.create")}
                </Button>
              ) : (
                <SubmitAs formId={formId} intent="save" label={t("pub15.save")} locale={locale} />
              )}
              <Button variant="quiet" size="sm" icon="arrow-left" href={routes.policyDocuments()} locale={locale}>
                {t("pub15.back")}
              </Button>
            </ButtonRow>
          ) : (
            <div>
              <Button variant="quiet" size="sm" icon="arrow-left" href={routes.policyDocuments()} locale={locale}>
                {t("pub15.back")}
              </Button>
            </div>
          )}
        </Panel>
      </form>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", minWidth: 0 }}>
        <Panel as="aside" title={t("pub15.required")} description={requiredSections.length > 0 ? t("pub15.requiredNote") : t("pub15.requiredNone")} level={2} density="console" locale={locale}>
          {requiredSections.length > 0 ? (
            <ItemList
              items={requiredSections.map((section) => {
                const present = sectionKeys.includes(section);
                return { key: section, title: section, family: present ? ("positive" as const) : ("attention" as const), detail: t(present ? "pub15.present" : "pub15.missing") };
              })}
              readOnly
              density="console"
              label={t("pub15.required")}
              locale={locale}
            />
          ) : null}
        </Panel>
        <Panel as="aside" title={t("pub15.published")} level={2} density="console" locale={locale}>
          <FactList
            items={[
              { label: t("pub15.fInEffect"), value: versionFrom(standing.inEffect, t, locale) },
              { label: t("pub15.fUpcoming"), value: next !== null && next.effectiveFrom !== null ? t("pubc.versionFrom", { version: next.label, date: day(next.effectiveFrom, locale) }) : t("pubc.none") },
            ]}
            density="console"
            locale={locale}
          />
        </Panel>
        {aside}
      </div>
    </Columns>
  );
}
