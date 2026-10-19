"use client";

import { useState } from "react";
import { FactList, Panel, Select, TextField } from "@/components/r1";
import type { PremisesAttempt, ProvenanceRow } from "@/lib/api/premises";
import { OVERRIDABLE_FIELDS, REGISTER_FIELDS, type RegisterField } from "@/lib/api/premises-terms";
import type { Locale } from "@/lib/i18n/translate";
import { ConfirmSubmit } from "./ConfirmSubmit";
import { classWords, premisesRefusal, premisesTranslator, valueWords } from "./premises-copy";

const FORM = "pty08-override";
const one = (value: string | readonly string[] | undefined): string => (typeof value === "string" ? value : "");
const overridable = (field: string) => (OVERRIDABLE_FIELDS as readonly string[]).includes(field);

/**
 * SCR-PTY-08's override form, for the data owner: a field, its new value, and the authority acted under. A field the
 * override cannot reach is said at once, in the catalogue's sentence; Apply override stays unavailable, with its
 * reason, until a field it can reach, a value and an authority are given, and asks first, naming the value now, the
 * new value and the authority. The server checks all of it again.
 */
export function OverrideForm({
  name,
  rows,
  options,
  action,
  attempt,
  locale,
}: {
  name: string;
  rows: readonly ProvenanceRow[];
  options: { classes: readonly string[]; areas: readonly { ward: string; city: string }[] };
  action: (formData: FormData) => Promise<void>;
  attempt: PremisesAttempt | null;
  locale: Locale;
}) {
  const t = premisesTranslator(locale);
  const failed = attempt?.refusal ?? null;
  const values = failed !== null ? (attempt?.values ?? {}) : {};
  const [field, setField] = useState(one(values.field_name));
  const [value, setValue] = useState(one(values.field_value));
  const [authority, setAuthority] = useState(one(values.override_authority_ref));
  const row = rows.find((entry) => entry.field === field) ?? null;
  const reachable = field !== "" && overridable(field);
  const fieldError = field !== "" && !reachable ? premisesRefusal(t, "FIELD_NOT_OVERRIDABLE").text : failed?.field === "field_name" ? premisesRefusal(t, failed.code).text : null;
  const authorityError = failed?.code === "OVERRIDE_AUTHORITY_REQUIRED" && authority.trim() === "" ? premisesRefusal(t, failed.code).text : null;
  const valueError = failed?.field === "field_value" && value === one(values.field_value) ? premisesRefusal(t, failed.code, failed.values).text : null;
  const why =
    field === "" && value.trim() === "" && authority.trim() === ""
      ? t("pty08.whyReset")
      : !reachable
        ? t("pty08.whyField")
        : value.trim() === ""
          ? t("pty08.whyValue")
          : authority.trim() === ""
            ? t("pty08.whyAuth")
            : null;
  const now = row !== null ? valueWords(row.value, t) : "";
  const routeLower = row !== null ? t(`prm.routeLower.${row.route === "RECORDED" || row.route === "DERIVED" ? "MANUAL_ADMISSION" : row.route}`) : "";
  const helper = row === null ? undefined : row.route === "DERIVED" ? t("pty08.valueHelpDerived", { v: now }) : t("pty08.valueHelp", { v: now, r: routeLower });
  // The dialog says where the value now came from, as the frame does: "Theo tuyến thay thế: danh sách cấp phép của Lam Hồng."
  const sourceLower = row !== null && row.source !== null ? t(`prm.sourceLower.${row.source}`) : null;
  const via =
    row === null
      ? undefined
      : row.route === "DERIVED"
        ? t("pty08.valueHelpDerived", { v: now })
        : sourceLower !== null && row.route === "AUTHORITATIVE_SOURCE"
          ? t("pty08.dVia", { r: sourceLower })
          : sourceLower !== null
            ? t("pty08.dViaSource", { r: routeLower, s: sourceLower })
            : t("pty08.dVia", { r: routeLower });
  const newWords = field === "classification" ? classWords(value, t) : value;
  const fieldLower = field !== "" ? t(`prm.fieldLower.${field}`) : "";

  return (
    <form id={FORM} action={action} noValidate>
      <div style={{ maxWidth: "var(--container-3xl)" }}>
        <Panel title={t("pty08.formTitle")} description={t("pty08.formDesc")} level={2} gap="lg" compact locale={locale}>
          <Select
            label={t("pty08.fieldL")}
            name="field_name"
            options={REGISTER_FIELDS.map((entry: RegisterField) => ({ value: entry, label: t(`prm.field.${entry}`) }))}
            value={field}
            placeholder={t("pty08.choose")}
            onChange={(next) => {
              setField(next);
              setValue("");
            }}
            {...(fieldError !== null ? { error: fieldError } : {})}
            required
            density="console"
            width="var(--space-64)"
            locale={locale}
          />
          {field === "classification" || field === "administrative_area" ? (
            <Select
              label={t("pty08.valueL")}
              name="field_value"
              options={
                field === "classification"
                  ? options.classes.map((code) => ({ value: code, label: classWords(code, t) }))
                  : options.areas.map((area) => ({ value: area.ward, label: `${area.ward}, ${area.city}` }))
              }
              value={value}
              placeholder={t("pty08.choosePh")}
              onChange={setValue}
              {...(helper !== undefined ? { helper } : {})}
              {...(valueError !== null ? { error: valueError } : {})}
              required
              density="console"
              width="var(--container-md)"
              locale={locale}
            />
          ) : (
            <TextField
              label={t("pty08.valueL")}
              name="field_value"
              value={value}
              onChange={setValue}
              {...(helper !== undefined ? { helper } : {})}
              {...(valueError !== null ? { error: valueError } : {})}
              {...(field !== "" && !reachable ? { disabled: true } : {})}
              required
              wrap
              density="console"
              width="100%"
              locale={locale}
            />
          )}
          <TextField
            label={t("pty08.authL")}
            name="override_authority_ref"
            value={authority}
            onChange={setAuthority}
            helper={t("pty08.authHelp")}
            {...(authorityError !== null ? { error: authorityError } : {})}
            required
            mono
            density="console"
            width="var(--space-80)"
            locale={locale}
          />
          <div>
            <ConfirmSubmit
              formId={FORM}
              label={t("pty08.apply")}
              disabledReason={why}
              dialog={{
                title: t("pty08.dlgTitle", { f: fieldLower, p: name }),
                description: t("pty08.dlgText", { f: fieldLower, a: authority.trim(), r: routeLower }),
                confirm: t("pty08.dlgPrimary", { f: fieldLower }),
                back: t("prm.cancel"),
              }}
              density="console"
              locale={locale}
            >
              <FactList
                items={[
                  { label: t("pty08.dNow"), value: now, ...(via !== undefined ? { note: via } : {}) },
                  { label: t("pty08.dNew"), value: newWords },
                  { label: t("pty08.dAuth"), value: authority.trim(), kind: "id" },
                ]}
                density="console"
                locale={locale}
              />
            </ConfirmSubmit>
          </div>
        </Panel>
      </div>
    </form>
  );
}
