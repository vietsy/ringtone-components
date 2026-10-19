"use client";

import { useTransition, type ComponentProps } from "react";
import { Table } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";

type Columns = ComponentProps<typeof Table>["columns"];
type Empty = ComponentProps<typeof Table>["empty"];

export interface RowAct {
  key: string;
  /** The row's cells, as a server page builds them (`_href`, `_selected` included). */
  cells: Record<string, unknown>;
  /** The row's one act, or null where the row offers none (a published snapshot). */
  act: { label: string; ariaLabel: string; icon: string; variant: "secondary" | "quiet" | "danger"; disabledReason?: string } | null;
}

/**
 * A console table whose rows each carry one act sent at once to a server action with the row's key: SCR-ENG-07's
 * Remove and SCR-ENG-11's Publish. Neither confirms (design/03 convention 9); the page reads again with the row
 * changed, or with the refusal drawn where the act was. A disabled act says why beside it.
 */
export function RowActs({
  columns,
  rows,
  action,
  caption,
  empty,
  footer,
  locale,
}: {
  columns: Columns;
  rows: readonly RowAct[];
  action: (key: string) => Promise<void>;
  caption: string;
  empty?: Empty;
  footer?: string;
  locale: Locale;
}) {
  const [pending, start] = useTransition();
  return (
    <Table
      columns={columns}
      rows={rows.map((row) => ({
        ...row.cells,
        _key: row.key,
        ...(pending ? { _busy: true } : {}),
        act:
          row.act === null
            ? []
            : [
                {
                  label: row.act.label,
                  ariaLabel: row.act.ariaLabel,
                  variant: row.act.variant,
                  icon: row.act.icon,
                  ...(row.act.disabledReason !== undefined ? { disabled: true, disabledReason: row.act.disabledReason } : { onClick: () => start(() => action(row.key)) }),
                },
              ],
      }))}
      density="console"
      caption={caption}
      {...(empty !== undefined ? { empty } : {})}
      {...(footer !== undefined ? { footer } : {})}
      locale={locale}
    />
  );
}
