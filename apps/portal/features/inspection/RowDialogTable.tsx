"use client";

import { R1_FORMAT } from "@rightone/formatting";
import { useRef, useState, type ComponentProps } from "react";
import { Banner, DateField, Dialog, FactList, Table, TextField } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type TableProps = ComponentProps<typeof Table>;

/** The dialog a row's act opens: what it names, the fields it asks for, and the refusal its last send got. */
export interface RowDialog {
  /** With "{d}" where the end date chosen goes; it follows the date field as the person changes it. */
  title: string;
  description: string;
  primary: { label: string; variant: "primary" | "danger" };
  facts?: { label: string; value: string; kind?: "id" }[];
  date?: { name: string; label: string; value: string; error?: string };
  reason?: { name: string; label: string; value: string; error?: string };
  refusal?: { title: string; text: string; code: string };
  /** The fields the act sends besides what is typed: the row's id, the act. */
  hidden: Readonly<Record<string, string>>;
}

export interface RowAct {
  /** Names the act among the row's, so a refused one opens again. */
  id: string;
  label: string;
  ariaLabel: string;
  variant: "primary" | "secondary" | "quiet" | "danger";
  /** A link to the screen the act opens, or the dialog that confirms it. */
  href?: string;
  dialog?: RowDialog;
  disabledReason?: string;
}

export interface DialogRow {
  key: string;
  cells: Record<string, unknown>;
  acts: readonly RowAct[];
}

interface Props {
  columns: TableProps["columns"];
  rows: readonly DialogRow[];
  /** The server action every dialog of the table sends. */
  action: (form: FormData) => Promise<void>;
  cancelLabel: string;
  /** The row and act whose dialog opens on arrival: a refused act, drawn again with what was typed. */
  open: { row: string; act: string } | null;
  caption: string;
  sortNote?: string;
  empty?: TableProps["empty"];
  loading?: number | false;
  rowFocus?: boolean;
  density: "console" | "portal";
  locale: Locale;
}

/**
 * A table whose rows each carry their acts: a link to the screen an act opens, or an act confirmed in a dialog
 * that names its object and consequence and asks for what it needs (an end date, a reason). SCR-VER-09 End and
 * Withdraw, SCR-VER-11 Suspend and End, SCR-VER-12 Reinstate, SCR-VER-18 Close the inspection (design/03
 * convention 8). The dialog's form sends to the page's server action, which reads the page again with the row
 * changed, or with the dialog open again and its refusal.
 */
export function RowDialogTable({ columns, rows, action, cancelLabel, open, caption, sortNote, empty, loading, rowFocus, density, locale }: Props) {
  const [opened, setOpened] = useState(open);
  const form = useRef<HTMLFormElement>(null);
  const row = rows.find((candidate) => candidate.key === opened?.row);
  const act = row?.acts.find((candidate) => candidate.id === opened?.act);
  const dialog = act?.dialog;
  const [day, setDay] = useState<string | null>(dialog?.date?.value ?? null);

  const choose = (rowKey: string, chosen: RowAct) => {
    setDay(chosen.dialog?.date?.value ?? null);
    setOpened({ row: rowKey, act: chosen.id });
  };

  return (
    <>
      <Table
        columns={columns}
        rows={rows.map((entry) => ({
          ...entry.cells,
          _key: entry.key,
          act: entry.acts.map((item) => ({
            label: item.label,
            ariaLabel: item.ariaLabel,
            variant: item.variant,
            ...(item.disabledReason !== undefined
              ? { disabled: true, disabledReason: item.disabledReason }
              : item.href !== undefined
                ? { href: item.href }
                : { onClick: () => choose(entry.key, item) }),
          })),
        }))}
        density={density}
        caption={caption}
        {...(sortNote !== undefined ? { sortNote } : {})}
        {...(empty !== undefined ? { empty } : {})}
        {...(loading !== undefined ? { loading } : {})}
        {...(rowFocus === true ? { rowFocus: true } : {})}
        locale={locale}
      />
      {/* display: contents keeps the form out of the page's layout; it only carries the dialog's fields. */}
      <form ref={form} action={action} style={{ display: "contents" }}>
        {dialog !== undefined && (
          <Dialog
            title={dialog.title.replace("{d}", day !== null ? (R1_FORMAT.formatDate(day, locale) ?? day) : "…")}
            description={dialog.description}
            primaryAction={{ label: dialog.primary.label, variant: dialog.primary.variant, onClick: () => form.current?.requestSubmit() }}
            secondaryAction={{ label: cancelLabel, onClick: () => setOpened(null) }}
            onClose={() => setOpened(null)}
            open
            placement="overlay"
            align="start"
            density={density}
            locale={locale}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {Object.entries(dialog.hidden).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              {dialog.facts !== undefined && <FactList items={dialog.facts} density={density} locale={locale} />}
              {dialog.refusal !== undefined && (
                <Banner family="attention" title={dialog.refusal.title} code={dialog.refusal.code} density={density} locale={locale}>
                  {dialog.refusal.text}
                </Banner>
              )}
              {dialog.date !== undefined && (
                <DateField
                  label={dialog.date.label}
                  name={dialog.date.name}
                  value={dialog.date.value}
                  onChange={(value) => setDay(typeof value === "string" ? value : null)}
                  {...(dialog.date.error !== undefined ? { error: dialog.date.error } : {})}
                  required
                  density={density}
                  locale={locale}
                />
              )}
              {dialog.reason !== undefined && (
                <TextField
                  label={dialog.reason.label}
                  name={dialog.reason.name}
                  value={dialog.reason.value}
                  {...(dialog.reason.error !== undefined ? { error: dialog.reason.error } : {})}
                  multiline
                  rows={3}
                  required
                  maxLength={1000}
                  density={density}
                  locale={locale}
                />
              )}
            </div>
          </Dialog>
        )}
      </form>
    </>
  );
}
