"use client";

import { useState, useTransition, type ComponentProps } from "react";
import { Dialog, FactList, Table } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { discardResult } from "./actions";

type Columns = ComponentProps<typeof Table>["columns"];
type Facts = ComponentProps<typeof FactList>["items"];

interface Row {
  key: string;
  cells: Record<string, unknown>;
  /** What the dialog names: the result's printout and when it was checked. */
  facts: Facts;
  discardLabel: string;
  discardAriaLabel: string;
}

interface Props {
  columns: Columns;
  rows: readonly Row[];
  caption: string;
  loading: number | false;
  empty: { variant: string; title: string; action: false };
  dialog: { title: string; description: string; discard: string; cancel: string };
  /** The row whose dialog is open on arrival: the review state of the dialog itself. */
  openRow: string | null;
  locale: Locale;
}

/**
 * SCR-VER-01 Could not upload: each row can be discarded, after a dialog that names it (design/03 convention 8).
 * The results live on the phone, so discarding is the field client's own act: the row leaves the phone's store
 * and the page reads again without it.
 */
export function DiscardableResults({ columns, rows, caption, loading, empty, dialog, openRow, locale }: Props) {
  const [open, setOpen] = useState<string | null>(openRow);
  const [pending, start] = useTransition();
  const chosen = rows.find((row) => row.key === open) ?? null;

  return (
    <>
      <Table
        columns={columns}
        rows={rows.map((row) => ({
          ...row.cells,
          _key: row.key,
          act: [
            {
              label: row.discardLabel,
              ariaLabel: row.discardAriaLabel,
              variant: "secondary",
              icon: "trash-2",
              onClick: () => setOpen(row.key),
            },
          ],
        }))}
        loading={loading}
        layout="cards"
        density="portal"
        caption={caption}
        empty={empty}
        locale={locale}
      />
      {chosen !== null && (
        <Dialog
          title={dialog.title}
          description={dialog.description}
          primaryAction={{
            label: dialog.discard,
            variant: "danger",
            loading: pending,
            onClick: () => start(() => discardResult(chosen.key)),
          }}
          secondaryAction={{ label: dialog.cancel, onClick: () => setOpen(null) }}
          onClose={() => setOpen(null)}
          open
          placement="overlay"
          align="start"
          density="portal"
          locale={locale}
        >
          <FactList items={chosen.facts} locale={locale} />
        </Dialog>
      )}
    </>
  );
}
