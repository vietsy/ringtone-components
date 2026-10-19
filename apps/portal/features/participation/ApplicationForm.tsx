"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Button,
  ButtonRow,
  ChoiceList,
  Columns,
  DateField,
  Divider,
  FieldRow,
  FieldRows,
  FileList,
  FileUpload,
  Panel,
  Select,
  TextField,
} from "@/components/r1";
import { Text } from "@/components/Text";
import type { ApplicationContact, ApplicationFields, EvidenceFile } from "@/lib/api/participation";
import type { Locale } from "@/lib/i18n/translate";
import type { Registers } from "./comparison";
import { fieldMissing, partTranslator, sizeLabel } from "./copy";
import { every, readDate, text } from "./fields";
import { sameReading, useFormReading } from "./useFormReading";

/** The two fields the board's reason names; the reason stands while either is empty. */
const NAMED = ["authority_evidence_ref", "territory"];

/** Which required fields are empty now, in the form's order; a contact's field carries its row. */
function missingNow(data: FormData): string[] {
  const names = every(data, "contact_name");
  const roles = every(data, "contact_role");
  const addresses = every(data, "contact_address");
  return [
    ...(text(data, "applying_as") === "" ? ["applying_as"] : []),
    ...(text(data, "authority_evidence_ref") === "" ? ["authority_evidence_ref"] : []),
    ...names.flatMap((name, index) => [
      ...(name === "" ? [`contact_name.${String(index)}`] : []),
      ...((roles[index] ?? "") === "" ? [`contact_role.${String(index)}`] : []),
      ...((addresses[index] ?? "") === "" ? [`contact_address.${String(index)}`] : []),
    ]),
    ...(every(data, "rights_layer").length === 0 ? ["rights_layer"] : []),
    ...(every(data, "repertoire").length === 0 ? ["repertoire"] : []),
    ...(every(data, "territory").length === 0 ? ["territory"] : []),
    ...(readDate(text(data, "period-from")) === null ? ["period"] : []),
  ];
}

/** The same reading from the values the page was given, for the first paint. */
function missingIn(fields: ApplicationFields): string[] {
  return [
    ...(fields.applyingAs === null ? ["applying_as"] : []),
    ...(fields.evidenceRef === "" ? ["authority_evidence_ref"] : []),
    ...fields.contacts.flatMap((contact, index) => [
      ...(contact.name === "" ? [`contact_name.${String(index)}`] : []),
      ...(contact.role === null ? [`contact_role.${String(index)}`] : []),
      ...(contact.address === "" ? [`contact_address.${String(index)}`] : []),
    ]),
    ...(fields.layers.length === 0 ? ["rights_layer"] : []),
    ...(fields.repertoires.length === 0 ? ["repertoire"] : []),
    ...(fields.territories.length === 0 ? ["territory"] : []),
    ...(fields.periodFrom === null ? ["period"] : []),
  ];
}

/** An ISO date as R1's date field writes it in its box, day/month/year; empty for none. */
const typed = (iso: string | null) => (iso === null ? "" : `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`);

const fileKind = (type: string): EvidenceFile["kind"] => (type === "application/pdf" ? "pdf" : type.startsWith("image/") ? "image" : "other");

/**
 * SCR-CAT-01's form: organisation, authority evidence, contacts, the scope asked for, then Submit application
 * and Save draft. Submit waits for every mandatory field (SCR-CAT-01 Actions), saying why beside it in the
 * board's words; a field the saved draft or a refused submission left empty carries its FIELD_MISSING sentence
 * until it is filled, as the board's missing state draws it. Save draft sends what is there, whatever is missing.
 *
 * Contacts are rows the person adds and removes. A document chosen is listed by name, kind and size, and
 * recorded with the draft; the file itself is not kept.
 */
export function ApplicationForm({
  action,
  organisation,
  fields,
  flagged,
  periodError,
  registers,
  phone,
  locale,
}: {
  action: (formData: FormData) => Promise<void>;
  organisation: { legalName: string; partyRecord: string | null; partyKind: "organisation" | null };
  fields: ApplicationFields;
  /** Fields whose FIELD_MISSING sentence shows while they are empty: the saved draft's, or a refusal's. */
  flagged: readonly string[];
  /** RANGE_OVERLAP or PERIOD_INVALID, under the period. */
  periodError: string | null;
  registers: Registers;
  phone: boolean;
  locale: Locale;
}) {
  const t = partTranslator(locale);
  // The period as the page draws it (R1's date field writes day/month/year), so a refusal of the period
  // stands only until the period changes.
  const drawnPeriod = `${typed(fields.periodFrom)}|${typed(fields.periodTo)}`;
  const [form, reading] = useFormReading(
    (data) => ({ missing: missingNow(data), period: `${text(data, "period-from")}|${text(data, "period-to")}` }),
    { missing: missingIn(fields), period: drawnPeriod },
    sameReading,
  );
  const { missing } = reading;
  const periodRefused = periodError !== null && reading.period === drawnPeriod;
  const intent = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<readonly EvidenceFile[]>(fields.evidenceFiles);
  const nextKey = useRef(fields.contacts.length);
  const [contacts, setContacts] = useState<readonly (ApplicationContact & { key: number })[]>(
    (fields.contacts.length > 0 ? fields.contacts : [{ name: "", role: null, address: "" }]).map((contact, key) => ({ ...contact, key })),
  );

  const errorOf = (name: string, label: string) => (flagged.includes(name) && missing.includes(name) ? { error: fieldMissing(label, t) } : {});
  const labelOf = (name: string): string => {
    const field = name.split(".")[0] ?? name;
    const labels: Readonly<Record<string, string>> = {
      applying_as: t("part01.asLegend"),
      authority_evidence_ref: t("part01.evRef"),
      contact_name: t("part01.cName"),
      contact_role: t("part01.cRole"),
      contact_address: t("part01.cAddress"),
      rights_layer: t("part01.layer"),
      repertoire: t("part01.repertoire"),
      territory: t("part01.territory"),
      period: t("part01.period"),
    };
    return labels[field] ?? field;
  };
  // The board's reason names the territory and the reference; any other empty field says which, in the
  // family's FIELD_MISSING words.
  const firstMissing = missing[0];
  const reason = missing.some((name) => NAMED.includes(name)) ? t("part01.submitWhy") : firstMissing !== undefined ? fieldMissing(labelOf(firstMissing), t) : null;

  const choose = (chosen: FileList) => {
    const file = chosen[0];
    if (file === undefined) return;
    setFiles((before) => [...before, { name: file.name, kind: fileKind(file.type), sizeBytes: file.size, at: null, by: null }]);
  };
  const mark = (value: "save" | "submit") => () => {
    if (intent.current !== null) intent.current.value = value;
  };

  return (
    <form ref={form} action={action} noValidate>
      {/* Uncontrolled: the pressed button sets it just before the form is sent, and no render may undo that. */}
      <input ref={intent} type="hidden" name="intent" defaultValue="save" />
      <input type="hidden" name="evidence_files" value={JSON.stringify(files)} />
      <Panel gap="xl" inset={phone ? "sm" : "md"} density="portal" locale={locale}>
        <Panel variant="plain" level={2} title={t("part01.orgTitle")} density="portal" locale={locale}>
          <Columns layout="thirds" template="minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)" single={phone}>
            <TextField label={t("part01.legalName")} value={organisation.legalName} readOnly provenance="registry-sourced" name="legal_name" locale={locale} />
            {/* A value the party register does not hold reads as not recorded: R1's dash. */}
            <TextField label={t("part01.partyRecord")} value={organisation.partyRecord ?? ""} readOnly mono name="party_record" locale={locale} />
            <TextField label={t("part01.kind")} value={organisation.partyKind !== null ? t("part01.kindValue") : ""} readOnly name="kind" locale={locale} />
          </Columns>
          <ChoiceList
            legend={t("part01.asLegend")}
            options={[
              { value: "holder", label: t("part01.asHolder") },
              { value: "intermediary", label: t("part01.asIntermediary"), hint: t("part01.asIntermediaryHint") },
            ]}
            {...(fields.applyingAs !== null ? { value: fields.applyingAs } : {})}
            required
            name="applying_as"
            {...errorOf("applying_as", t("part01.asLegend"))}
            density="portal"
            locale={locale}
          />
        </Panel>
        <Divider />
        <Panel variant="plain" level={2} title={t("part01.evTitle")} density="portal" locale={locale}>
          <Columns layout="halves" single={phone}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minWidth: 0 }}>
              <FileList
                items={files.map((file, index) => ({
                  key: `${file.name}-${String(index)}`,
                  name: file.name,
                  type: file.kind,
                  size: sizeLabel(file.sizeBytes, t, locale),
                  ...(file.at !== null ? { at: file.at } : {}),
                  ...(file.by !== null ? { by: file.by } : {}),
                  state: "ready" as const,
                  removable: true,
                  onRemove: () => setFiles((before) => before.filter((_, at) => at !== index)),
                }))}
                label={t("part01.evTitle")}
                density="portal"
                locale={locale}
              />
              {/* With no document listed, the way to add one; the board draws the list with its document. */}
              {files.length === 0 ? <FileUpload onFiles={choose} density="portal" locale={locale} /> : null}
            </div>
            <TextField
              label={t("part01.evRef")}
              helper={t("part01.evRefHelp")}
              value={fields.evidenceRef}
              required
              mono
              name="authority_evidence_ref"
              {...errorOf("authority_evidence_ref", t("part01.evRef"))}
              locale={locale}
            />
          </Columns>
        </Panel>
        <Divider />
        <FieldRows
          legend={t("part01.contactsTitle")}
          helper={t("part01.contactsHelp")}
          required
          addLabel={t("part01.addContact")}
          count={contacts.length}
          onAdd={() => setContacts((before) => [...before, { name: "", role: null, address: "", key: nextKey.current++ }])}
          density="portal"
          locale={locale}
        >
          {contacts.map((contact, index) => (
            <FieldRow
              key={contact.key}
              title={t("part01.contactN", { n: index + 1 })}
              {...(phone ? {} : { columns: 3 as const })}
              removable={contacts.length > 1}
              onRemove={() => setContacts((before) => before.filter((row) => row.key !== contact.key))}
              density="portal"
              locale={locale}
            >
              <TextField
                label={t("part01.cName")}
                value={contact.name}
                required
                name="contact_name"
                {...errorOf(`contact_name.${String(index)}`, t("part01.cName"))}
                locale={locale}
              />
              <Select
                label={t("part01.cRole")}
                options={[
                  { value: "admin", label: t("part01.roleAdmin") },
                  { value: "legal", label: t("part01.roleLegal") },
                ]}
                {...(contact.role !== null ? { value: contact.role } : { placeholder: t("part01.rolePlaceholder") })}
                required
                name="contact_role"
                {...errorOf(`contact_role.${String(index)}`, t("part01.cRole"))}
                locale={locale}
              />
              <TextField
                label={t("part01.cAddress")}
                value={contact.address}
                required
                multiline
                rows={2}
                name="contact_address"
                {...errorOf(`contact_address.${String(index)}`, t("part01.cAddress"))}
                locale={locale}
              />
            </FieldRow>
          ))}
        </FieldRows>
        <Divider />
        <Panel variant="plain" level={2} title={t("part01.scopeTitle")} description={t("part01.scopeDesc")} density="portal" locale={locale}>
          <Columns layout="quarters" template="repeat(3, minmax(0, 1fr)) minmax(0, 1.4fr)" single={phone}>
            <ChoiceList
              legend={t("part01.layer")}
              options={registers.rights.map((value) => ({ value, label: t(`part.right.${value}`) }))}
              value={[...fields.layers]}
              multiple
              required
              name="rights_layer"
              {...errorOf("rights_layer", t("part01.layer"))}
              density="portal"
              locale={locale}
            />
            <ChoiceList
              legend={t("part01.repertoire")}
              options={registers.repertoires.map((value) => ({ value, label: t(`part.rep.${value}`) }))}
              value={[...fields.repertoires]}
              multiple
              required
              name="repertoire"
              {...errorOf("repertoire", t("part01.repertoire"))}
              density="portal"
              locale={locale}
            />
            <ChoiceList
              legend={t("part01.territory")}
              options={registers.territories.map((value) => ({ value, label: t(`part.terr.${value}`) }))}
              value={[...fields.territories]}
              multiple
              required
              name="territory"
              {...errorOf("territory", t("part01.territory"))}
              density="portal"
              locale={locale}
            />
            <DateField
              label={t("part01.period")}
              helper={t("part01.periodHelp")}
              range
              {...(fields.periodFrom !== null ? { value: fields.periodFrom } : {})}
              {...(fields.periodTo !== null ? { to: fields.periodTo } : {})}
              fromLabel={t("part01.from")}
              toLabel={t("part01.to")}
              required
              name="period"
              {...(periodRefused ? { error: periodError } : errorOf("period", t("part01.period")))}
              locale={locale}
            />
          </Columns>
        </Panel>
        <Divider />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <div style={{ maxWidth: "var(--container-3xl)" }}>
            <Text size="base">{t("part01.requested")}</Text>
          </div>
          <Actions
            reason={reason}
            submit={t("part01.submit")}
            save={t("part01.save")}
            onSubmit={mark("submit")}
            onSave={mark("save")}
            phone={phone}
            locale={locale}
          />
        </div>
      </Panel>
    </form>
  );
}

/** Submit application and Save draft, the pressed one working while the form's act runs. */
function Actions({
  reason,
  submit,
  save,
  onSubmit,
  onSave,
  phone,
  locale,
}: {
  reason: string | null;
  submit: string;
  save: string;
  onSubmit: () => void;
  onSave: () => void;
  phone: boolean;
  locale: Locale;
}) {
  const { pending } = useFormStatus();
  const [pressed, setPressed] = useState<"submit" | "save" | null>(null);
  return (
    <ButtonRow>
      <Button
        type="submit"
        variant="primary"
        size="md"
        fullWidth={phone}
        disabled={reason !== null}
        {...(reason !== null ? { disabledReason: reason } : {})}
        loading={pending && pressed === "submit"}
        onClick={() => {
          setPressed("submit");
          onSubmit();
        }}
        locale={locale}
      >
        {submit}
      </Button>
      <Button
        type="submit"
        variant="secondary"
        size="md"
        fullWidth={phone}
        loading={pending && pressed === "save"}
        onClick={() => {
          setPressed("save");
          onSave();
        }}
        locale={locale}
      >
        {save}
      </Button>
    </ButtonRow>
  );
}
