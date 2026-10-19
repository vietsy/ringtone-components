"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Button,
  ButtonRow,
  Columns,
  Combobox,
  DateField,
  Dialog,
  Divider,
  FieldRow,
  FieldRows,
  FileUpload,
  ItemList,
  Panel,
  Select,
  TextField,
} from "@/components/r1";
import { Text } from "@/components/Text";
import type { ChosenFile, GovField, GovRefusal, MandateForm, MandateRegister, Organisation, ScopeRow } from "@/lib/api/governance";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { fileSize, govTranslator, localised, moment, provinceName, refusalSentence, repertoireLabel, rightLabel } from "./copy";
import { EMPTY_ROW } from "./fields";

interface Row extends ScopeRow {
  key: string;
}

type Confirming = "on-arrival" | "by-person" | null;

/**
 * SCR-GOV-14's draft: the form an organisation with no mandate fills in, then saves on this device or submits for
 * approval. The represented rights are rows the person adds and removes, one province each; the evidence is the
 * browser's file chooser, and only the file's name, type and size are sent (there is no document store yet).
 *
 * Submit for approval waits for the evidence, as the board draws it, and asks for confirmation with the rows the
 * organisation would be recognised as representing. Everything else is the server's to answer: a refusal comes
 * back as the page again, with the values as entered and the sentence under the field it names.
 *
 * The dialog the person opens covers the window; the one the canvas draws open on arrival (the confirm view)
 * stays in the page, since a dialog portalled to the window exists only in the browser.
 */
export function MandateDraftForm({
  action,
  organisation,
  register,
  initial,
  savedAt,
  refusal,
  idempotencyKey,
  confirmOnArrival,
  review,
  phone,
  locale,
}: {
  action: (formData: FormData) => Promise<void>;
  organisation: Organisation;
  register: MandateRegister;
  /** The form as it opens: the saved draft, the refused attempt as entered, or one empty row. */
  initial: MandateForm;
  savedAt: string | null;
  /** A refusal that names a field of this form. */
  refusal: GovRefusal | null;
  idempotencyKey: string;
  confirmOnArrival: boolean;
  /**
   * A state the canvas drew, opened with `?view=`: its values are the canvas's, not the organisation's, so the
   * form is drawn to be looked at and sends nothing.
   */
  review: boolean;
  phone: boolean;
  locale: Locale;
}) {
  const t = govTranslator(locale);
  const form = useRef<HTMLFormElement>(null);
  const intent = useRef<HTMLInputElement>(null);
  const made = useRef(initial.rows.length);
  const [authority, setAuthority] = useState(initial.authority);
  const [evidence, setEvidence] = useState<ChosenFile | null>(initial.evidence);
  const [rows, setRows] = useState<Row[]>(() => initial.rows.map((row, index) => ({ ...row, key: `row-${String(index)}` })));
  const [confirming, setConfirming] = useState<Confirming>(confirmOnArrival ? "on-arrival" : null);

  const send = (what: "save" | "submit") => {
    if (review) return;
    if (intent.current !== null) intent.current.value = what;
    form.current?.requestSubmit();
  };
  const change = (key: string, patch: Partial<ScopeRow>) => setRows((before) => before.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const add = () => {
    made.current += 1;
    setRows((before) => [...before, { ...EMPTY_ROW, key: `row-${String(made.current)}` }]);
  };
  const choose = (files: FileList) => {
    const file = files[0];
    if (file !== undefined) setEvidence({ name: file.name, type: file.type, sizeBytes: file.size });
  };
  const errorOf = (field: GovField, row: number | null = null) =>
    refusal?.field === field && refusal.row === row ? { error: refusalSentence(refusal, `gov.field.${field}`, t, locale) } : {};
  const periodError = { ...errorOf("effective_from"), ...errorOf("effective_to") };
  const rightOptions = register.rightTypes.map((value) => ({ value, label: rightLabel(value, t) }));
  const provinceOptions = register.provinces.map((province) => ({ value: province.code, label: province.name }));

  return (
    <>
      <div style={{ maxWidth: "var(--container-3xl)" }}>
        <Text size="base" tone="secondary">
          {t("gov14.draftLead")}
        </Text>
      </div>
      <form ref={form} action={action} noValidate>
        <input type="hidden" name="intent" defaultValue="save" ref={intent} />
        <input type="hidden" name="idempotency_key" value={idempotencyKey} />
        <input type="hidden" name="evidence_name" value={evidence?.name ?? ""} />
        <input type="hidden" name="evidence_type" value={evidence?.type ?? ""} />
        <input type="hidden" name="evidence_size" value={evidence !== null ? String(evidence.sizeBytes) : ""} />
        <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
          <Panel variant="plain" level={2} title={t("gov14.basis")} density="portal" locale={locale}>
            <Columns layout="halves" single={phone}>
              <TextField label={t("gov14.org")} value={organisation.name} readOnly provenance="registry-sourced" wrap density="portal" locale={locale} />
              <Select
                label={t("gov14.authority")}
                name="granting_authority_id"
                options={register.authorities.map((entry) => ({ value: entry.id, label: localised(entry.name, locale) }))}
                value={authority}
                onChange={setAuthority}
                required
                {...errorOf("granting_authority_id")}
                density="portal"
                locale={locale}
              />
              <div style={{ gridColumn: "1 / -1", minWidth: 0 }}>
                <FileUpload
                  density="portal"
                  label={t("gov14.evidence")}
                  helper={t("gov14.evidenceHelp")}
                  accept=".pdf,image/*"
                  required
                  {...(evidence !== null ? { fileName: evidence.name, fileSize: fileSize(evidence.sizeBytes, t, locale) } : {})}
                  onFiles={choose}
                  onReplace={choose}
                  onRemove={() => setEvidence(null)}
                  {...errorOf("authority_evidence_ref")}
                  locale={locale}
                />
              </div>
            </Columns>
          </Panel>
          <Divider />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <FieldRows
              legend={t("gov14.rights")}
              required
              helper={t("gov14.oneRow")}
              addLabel={t("gov14.addRow")}
              count={rows.length}
              onAdd={add}
              {...errorOf("scope")}
              density="portal"
              locale={locale}
            >
              {rows.map((row, index) => (
                <FieldRow
                  key={row.key}
                  title={t("gov14.rowTitle", { n: index + 1 })}
                  columns={3}
                  onRemove={() => setRows((before) => before.filter((entry) => entry.key !== row.key))}
                  density="portal"
                  locale={locale}
                >
                  <Select
                    label={t("gov14.rightType")}
                    name="right_type"
                    options={rightOptions}
                    value={row.rightType}
                    placeholder={t("gov14.rightPh")}
                    onChange={(rightType) => change(row.key, { rightType })}
                    {...errorOf("right_type", index)}
                    density="portal"
                    locale={locale}
                  />
                  <TextField
                    label={t("gov14.rep")}
                    name="repertoire"
                    value={row.repertoire}
                    mono
                    onChange={(repertoire) => change(row.key, { repertoire })}
                    {...errorOf("repertoire_key", index)}
                    density="portal"
                    locale={locale}
                  />
                  <Combobox
                    label={t("gov14.prov")}
                    name="territory"
                    options={provinceOptions}
                    {...(row.territory !== "" ? { value: row.territory } : {})}
                    placeholder={t("gov14.provPh")}
                    onChange={(territory) => change(row.key, { territory: typeof territory === "string" ? territory : "" })}
                    {...errorOf("territory_code", index)}
                    density="portal"
                    locale={locale}
                  />
                </FieldRow>
              ))}
            </FieldRows>
            <Columns layout="halves" single={phone}>
              <DateField
                range
                label={t("gov14.period")}
                name="period"
                helper={t("gov14.periodHelp")}
                {...(initial.from !== null ? { value: initial.from } : {})}
                {...(initial.to !== null ? { to: initial.to } : {})}
                fromLabel={t("gov14.from")}
                toLabel={t("gov14.to")}
                toPlaceholder={t("gov14.openEnded")}
                required
                {...periodError}
                density="portal"
                locale={locale}
              />
            </Columns>
          </div>
          <Divider />
          <Controls
            canSubmit={evidence !== null}
            onSubmit={() => setConfirming("by-person")}
            onSave={() => send("save")}
            confirming={confirming}
            onConfirm={() => send("submit")}
            onCancel={() => setConfirming(null)}
            dialogText={t("gov14.dlgText", { org: organisation.shortName })}
            dialogRows={rows.map((row, index) => ({
              key: row.key,
              title: row.territory !== "" ? provinceName(row.territory, register) : t("gov14.rowTitle", { n: index + 1 }),
              detail: t("gov14.scopeDetail", {
                right: row.rightType !== "" ? rightLabel(row.rightType, t) : "–",
                repertoire: repertoireLabel(row.repertoire, t),
              }),
            }))}
            phone={phone}
            t={t}
            locale={locale}
          />
          {savedAt !== null ? (
            <Text size="sm" tone="secondary">
              {t("gov14.saved", { time: moment(savedAt, locale) })}
            </Text>
          ) : null}
        </Panel>
      </form>
    </>
  );
}

/**
 * Submit for approval and Save draft, and the confirmation. Inside the form, so both show the act in flight while
 * the server answers.
 */
function Controls({
  canSubmit,
  onSubmit,
  onSave,
  confirming,
  onConfirm,
  onCancel,
  dialogText,
  dialogRows,
  phone,
  t,
  locale,
}: {
  canSubmit: boolean;
  onSubmit: () => void;
  onSave: () => void;
  confirming: Confirming;
  onConfirm: () => void;
  onCancel: () => void;
  dialogText: string;
  dialogRows: readonly { key: string; title: string; detail: string }[];
  phone: boolean;
  t: Translate;
  locale: Locale;
}) {
  const status = useFormStatus();
  const sending = status.pending ? (status.data?.get("intent") === "submit" ? "submit" : "save") : null;
  const submit = (
    <Button
      variant="primary"
      size="md"
      fullWidth={phone}
      disabled={!canSubmit}
      {...(!canSubmit ? { disabledReason: t("gov14.submitWhy") } : {})}
      loading={sending === "submit"}
      onClick={onSubmit}
      locale={locale}
    >
      {t("gov14.submit")}
    </Button>
  );
  const save = (
    <Button variant="quiet" size="md" fullWidth={phone} loading={sending === "save"} onClick={onSave} locale={locale}>
      {t("gov14.save")}
    </Button>
  );
  return (
    <>
      {phone ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {submit}
          {save}
        </div>
      ) : (
        <ButtonRow>
          {submit}
          {save}
        </ButtonRow>
      )}
      {confirming !== null ? (
        <Dialog
          title={t("gov14.dlgTitle")}
          description={dialogText}
          primaryAction={{ label: t("gov14.dlgYes"), loading: sending === "submit", onClick: onConfirm }}
          secondaryAction={{ label: t("gov14.dlgNo"), onClick: onCancel }}
          onClose={onCancel}
          open
          placement={confirming === "on-arrival" ? "overlay" : "viewport"}
          density="portal"
          locale={locale}
        >
          <ItemList items={[...dialogRows]} density="portal" label={t("gov14.rights")} locale={locale} />
        </Dialog>
      ) : null}
    </>
  );
}
