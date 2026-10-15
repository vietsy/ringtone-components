"use client";

import { useTransition } from "react";
import { ItemList, Table, type ActionSpec, type Family } from "@/components/r1";
import type { ChosenFile } from "@/lib/api/registration";
import type { Locale } from "@/lib/i18n/translate";

/** One document of a list: its state, and the Add a document control while it can still take one. */
export interface UploadEntry {
  key: string;
  title: string;
  family: Family;
  detail: string;
  message: { severity: "error" | "warning" | "info"; text: string } | null;
  /** Add a document, when the entry takes one; `target` names the slot the file is recorded against. */
  add: { target: string; label: string; variant: "primary" | "secondary"; disabledReason: string | null } | null;
  /** Further controls a drawn state shows (Stop the upload), with nothing behind them. */
  more: readonly ActionSpec[];
  /** The phone card's shorter words for the state. */
  card: { label: string; detail: string | null };
  /** An upload in flight: its card is drawn busy. */
  busy: boolean;
}

/**
 * The documents of SCR-REG-04 and SCR-REG-07, with Add a document behind each one still needed. Adding opens
 * the browser's file chooser; the file's name, type and size go to the server, which records them against
 * the slot. The mock keeps no file: there is no document store to hand it to yet.
 *
 * On a phone a document and its control do not fit on one line, so each becomes a card with its state and the
 * control at its foot.
 */
export function UploadList({
  entries,
  upload,
  layout,
  numbered = false,
  label,
  columns,
  locale,
}: {
  entries: readonly UploadEntry[];
  upload: (target: string, file: ChosenFile) => Promise<void>;
  layout: "list" | "cards";
  numbered?: boolean;
  label: string;
  /** The card table's column names. */
  columns: { doc: string; state: string; act?: string };
  locale: Locale;
}) {
  const [, startSending] = useTransition();
  // The chooser is the browser's own: an input made for the one choice, never drawn.
  const choose = (target: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file === undefined) return;
      startSending(() => upload(target, { name: file.name, type: file.type, sizeBytes: file.size }));
    });
    input.click();
  };
  const actionsOf = (entry: UploadEntry): ActionSpec[] => [
    ...(entry.add !== null
      ? [
          {
            label: entry.add.label,
            icon: "upload",
            variant: entry.add.variant,
            ...(entry.add.disabledReason !== null
              ? { disabled: true, disabledReason: entry.add.disabledReason }
              : { onClick: () => choose(entry.add?.target ?? "") }),
          },
        ]
      : []),
    ...entry.more,
  ];

  if (layout === "cards") {
    return (
      <Table
        columns={[
          { key: "doc", label: columns.doc, kind: "strong" },
          { key: "state", label: columns.state, kind: "status" },
          { key: "act", ...(columns.act !== undefined ? { label: columns.act } : {}), kind: "actions" },
        ]}
        rows={entries.map((entry) => {
          const actions = actionsOf(entry);
          return {
            _key: entry.key,
            ...(entry.message !== null ? { _message: entry.message } : {}),
            ...(entry.busy ? { _busy: true } : {}),
            doc: entry.title,
            state: { family: entry.family, label: entry.card.label, plain: true, ...(entry.card.detail !== null ? { detail: entry.card.detail } : {}) },
            act: actions.length > 0 ? actions : null,
          };
        })}
        layout="cards"
        caption={label}
        density="portal"
        locale={locale}
      />
    );
  }
  return (
    <ItemList
      items={entries.map((entry) => {
        const actions = actionsOf(entry);
        return {
          key: entry.key,
          title: entry.title,
          family: entry.family,
          detail: entry.detail,
          ...(actions.length > 0 ? { actions } : {}),
          ...(entry.message !== null ? { message: entry.message } : {}),
        };
      })}
      numbered={numbered}
      label={label}
      density="portal"
      locale={locale}
    />
  );
}
