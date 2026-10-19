"use client";

import { useState, type ComponentProps } from "react";
import { Button, ButtonRow, Columns, DateField, FileUpload, Select, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { useHydrated } from "./ShortcutButton";

type Options = ComponentProps<typeof Select>["options"];

/** A document chosen in the browser: only its name and size are sent, as there is no document store yet. */
interface Chosen {
  name: string;
  size: string;
}

function sizeOf(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${String(Math.round((bytes / (1024 * 1024)) * 10) / 10)} MB` : `${String(Math.max(1, Math.round(bytes / 1024)))} KB`;
}

/** The document field of both forms, with the chosen file carried to the action in hidden fields. */
function DocumentField({ label, initial, locale }: { label: string; initial: Chosen | null; locale: Locale }) {
  const [chosen, setChosen] = useState<Chosen | null>(initial);
  const choose = (files: FileList) => {
    const file = files[0];
    if (file !== undefined) setChosen({ name: file.name, size: sizeOf(file.size) });
  };
  return (
    <>
      <input type="hidden" name="document_name" value={chosen?.name ?? ""} />
      <input type="hidden" name="document_size" value={chosen?.size ?? ""} />
      <FileUpload
        label={label}
        required
        accept=".pdf"
        {...(chosen !== null ? { fileName: chosen.name, fileSize: chosen.size } : {})}
        onFiles={choose}
        onReplace={choose}
        onRemove={() => setChosen(null)}
        density="console"
        locale={locale}
      />
    </>
  );
}

/** Record for approval and Close, the row every form of the operations console ends with. */
function Controls({ record, close, closeHref, barred, locale }: { record: string; close: string; closeHref: string; barred: string | null; locale: Locale }) {
  const hydrated = useHydrated();
  return (
    <ButtonRow>
      <Button
        type="submit"
        variant="primary"
        size="sm"
        icon="check"
        {...(hydrated ? { shortcut: "Alt+R" } : {})}
        {...(barred !== null ? { disabled: true, disabledReason: barred } : {})}
        locale={locale}
      >
        {record}
      </Button>
      <Button variant="quiet" size="sm" href={closeHref} locale={locale}>
        {close}
      </Button>
    </ButtonRow>
  );
}

const span = (columns: number) => ({ gridColumn: `span ${String(columns)}`, minWidth: 0 });

export interface DesignationFields {
  code: string;
  name: string;
  level: string;
  legalBasis: string;
  document: Chosen | null;
  geography: string;
  areas: string;
  from: string;
  to: string;
  predecessor: string;
}

/**
 * SCR-VER-09 Record a designation: code, name and level, the legal basis and its document, the geography version
 * and the areas typed or pasted from TRN's published list, the period and the designation it succeeds. A refusal
 * comes back with the form as sent and the sentence beside the field it names.
 */
/*
 * The period's DateField is not marked required: R1 asks for both ends of a range when it is, and a designation or an
 * appointment may run with no end date. The start is checked by the server, which sends the form back as it was.
 */
export function DesignationForm({
  action,
  initial,
  options,
  errors,
  words,
  closeHref,
  barred,
  locale,
}: {
  action: (form: FormData) => Promise<void>;
  initial: DesignationFields;
  options: { levels: Options; geographies: Options; predecessors: Options };
  errors: Partial<Record<"code" | "areas" | "predecessor", string>>;
  words: Record<
    "code" | "name" | "level" | "basis" | "document" | "geography" | "areas" | "areasHelp" | "period" | "from" | "to" | "noEnd" | "succeeds" | "none" | "record" | "close",
    string
  >;
  closeHref: string;
  barred: string | null;
  locale: Locale;
}) {
  const field = { density: "console" as const, locale };
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <Columns layout="thirds" gap={4}>
        <TextField label={words.code} name="authority_code" mono value={initial.code} required maxLength={40} {...(errors.code !== undefined ? { error: errors.code } : {})} {...field} />
        <TextField label={words.name} name="name" value={initial.name} required maxLength={200} {...field} />
        <Select label={words.level} name="level" options={options.levels} {...(initial.level !== "" ? { value: initial.level } : {})} required {...field} />
        <TextField label={words.basis} name="legal_basis_ref" value={initial.legalBasis} required maxLength={200} {...field} />
        <div style={span(2)}>
          <DocumentField label={words.document} initial={initial.document} locale={locale} />
        </div>
        <Select label={words.geography} name="geography_version" options={options.geographies} value={initial.geography} required {...field} />
        <div style={span(2)}>
          <TextField
            label={words.areas}
            name="areas"
            helper={words.areasHelp}
            value={initial.areas}
            multiline
            rows={2}
            required
            {...(errors.areas !== undefined ? { error: errors.areas } : {})}
            {...field}
          />
        </div>
        <DateField
          label={words.period}
          name="effective"
          range
          {...(initial.from !== "" ? { value: initial.from } : {})}
          {...(initial.to !== "" ? { to: initial.to } : {})}
          fromLabel={words.from}
          toLabel={words.to}
          toPlaceholder={words.noEnd}
          {...field}
        />
        <Select
          label={words.succeeds}
          name="predecessor_id"
          options={[{ value: "", label: words.none }, ...options.predecessors]}
          value={initial.predecessor}
          {...(errors.predecessor !== undefined ? { error: errors.predecessor } : {})}
          {...field}
        />
      </Columns>
      <Controls record={words.record} close={words.close} closeHref={closeHref} barred={barred} locale={locale} />
    </form>
  );
}

export interface AppointmentFields {
  authority: string;
  person: string;
  name: string;
  card: string;
  instrument: string;
  document: Chosen | null;
  from: string;
  to: string;
}

/**
 * SCR-VER-11 Record an appointment: the authority among the designations in force, the person reference the
 * appointee's own RightOne account shows (never a search by name), the name and card as the instrument gives
 * them, the instrument and its document, and the period.
 */
export function AppointmentForm({
  action,
  initial,
  authorities,
  errors,
  words,
  closeHref,
  barred,
  locale,
}: {
  action: (form: FormData) => Promise<void>;
  initial: AppointmentFields;
  authorities: Options;
  errors: Partial<Record<"authority" | "person", string>>;
  words: Record<"authority" | "person" | "personHelp" | "name" | "card" | "instrument" | "document" | "period" | "from" | "to" | "noEnd" | "record" | "close", string>;
  closeHref: string;
  barred: string | null;
  locale: Locale;
}) {
  const field = { density: "console" as const, locale };
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <Columns layout="thirds" gap={4}>
        <Select
          label={words.authority}
          name="authority_id"
          options={authorities}
          {...(initial.authority !== "" ? { value: initial.authority } : {})}
          required
          {...(errors.authority !== undefined ? { error: errors.authority } : {})}
          {...field}
        />
        <TextField
          label={words.person}
          name="person_id"
          mono
          helper={words.personHelp}
          value={initial.person}
          required
          {...(errors.person !== undefined ? { error: errors.person } : {})}
          {...field}
        />
        <TextField label={words.name} name="person_display_name" value={initial.name} required maxLength={200} {...field} />
        <TextField label={words.card} name="card_number" mono value={initial.card} maxLength={40} {...field} />
        <TextField label={words.instrument} name="instrument_ref" value={initial.instrument} required maxLength={200} {...field} />
        <DateField
          label={words.period}
          name="effective"
          range
          {...(initial.from !== "" ? { value: initial.from } : {})}
          {...(initial.to !== "" ? { to: initial.to } : {})}
          fromLabel={words.from}
          toLabel={words.to}
          toPlaceholder={words.noEnd}
          {...field}
        />
        <div style={span(3)}>
          <DocumentField label={words.document} initial={initial.document} locale={locale} />
        </div>
      </Columns>
      <Controls record={words.record} close={words.close} closeHref={closeHref} barred={barred} locale={locale} />
    </form>
  );
}
