"use client";

import { useTransition, type ComponentProps } from "react";
import { Table } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Columns = ComponentProps<typeof Table>["columns"];
type Empty = ComponentProps<typeof Table>["empty"];

export interface ActRow {
  key: string;
  /** The row's cells, as a server page builds them. */
  cells: Record<string, unknown>;
  act: { label: string; ariaLabel: string; icon: string; disabledReason?: string };
}

interface Props {
  columns: Columns;
  rows: readonly ActRow[];
  /** The server action each row's button sends, with the row's key. */
  action: (key: string) => Promise<void>;
  caption: string;
  loading: number | false;
  empty?: Empty;
  locale: Locale;
}

/**
 * A table whose rows each carry one act, sent at once to a server action with the row's key: SCR-VER-01's
 * Upload now and SCR-VER-04's Attach. Neither asks first (design/03 convention 8); the page reads again with
 * the row moved, or with its refusal on the row.
 */
export function RowActTable({ columns, rows, action, caption, loading, empty, locale }: Props) {
  const [pending, start] = useTransition();

  return (
    <Table
      columns={columns}
      rows={rows.map((row) => ({
        ...row.cells,
        _key: row.key,
        ...(pending ? { _busy: true } : {}),
        act: [
          {
            label: row.act.label,
            ariaLabel: row.act.ariaLabel,
            variant: "secondary",
            icon: row.act.icon,
            ...(row.act.disabledReason !== undefined
              ? { disabled: true, disabledReason: row.act.disabledReason }
              : { onClick: () => start(() => action(row.key)) }),
          },
        ],
      }))}
      loading={loading}
      layout="cards"
      density="portal"
      caption={caption}
      {...(empty !== undefined ? { empty } : {})}
      locale={locale}
    />
  );
}
