"use client";

import type * as React from "react";
import { Button } from "./Button";
import { Identifier } from "./Identifier";
import { ProvenanceChip } from "./ProvenanceChip";
import { keepRefs } from "./lib/button";
import { cx, isNil, textOf } from "./lib/helpers";
import { tx } from "./lib/strings";
import { renderCell } from "./lib/table";
import { missingValue } from "./lib/value-atoms";
import type { CellKind, Locale, Provenance } from "./lib/types";

export type FactListProps = {
  items: {
    label: string;
    value: unknown;
    kind?: CellKind | undefined;
    /** Size of an identifier, when kind is id. */
    identifierSize?: "sm" | "md" | undefined;
    provenance?: Provenance | undefined;
    provenanceDetail?: string | undefined;
    note?: string | undefined;
    /** words for a missing value */ missing?: string | undefined;
    /** a Change action for this fact; its label defaults to "Sửa" and is read with the fact's label */ action?:
      | {
          label?: string | undefined;
          href?: string | undefined;
          onClick?: (() => void) | undefined;
          disabled?: boolean | undefined;
          disabledReason?: string | undefined;
        }
      | undefined;
  }[];
  columns?: 1 | 2 | undefined;
  /** the Change buttons' height: console 32, portal 48 */ density?: "console" | "portal" | undefined;
  /** passed to each ProvenanceChip: 'plain' on a premises portal */ provenanceWords?: "default" | "plain" | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Facts of one record. A fact the reader may change here carries its own Change action, named for the fact;
// two columns fall back to one on a phone, and a label sits above its value when the row is too narrow for both.
export function FactList(p: FactListProps) {
  const t = tx(p.locale);
  const items = p.items || [];
  const acts = items.some(function (it) {
    return it && it.action;
  });
  return (
    <dl
      className={cx("r1-facts", p.columns === 2 && "r1-facts--2", acts && "r1-facts--actions", p.className)}
      style={p.style}
    >
      {items.map(function (it, i) {
        const v = it.value;
        const none = isNil(v) || v === "" || (Array.isArray(v) && !v.length);
        const value = none ? (
          missingValue(it.missing, t.noValue)
        ) : it.kind === "id" ? (
          <Identifier value={v as string} size={it.identifierSize} locale={p.locale} />
        ) : (
          renderCell(it, v, p.locale)
        );
        const a = it.action;
        return (
          <div key={i} className="r1-facts__row">
            <dt>{it.label}</dt>
            <dd>
              {value}
              {it.provenance ? (
                <ProvenanceChip
                  kind={it.provenance}
                  detail={it.provenanceDetail}
                  words={p.provenanceWords}
                  locale={p.locale}
                />
              ) : null}
              {it.note ? <div className="r1-facts__note">{keepRefs(it.note)}</div> : null}
            </dd>
            {a ? (
              <dd className="r1-facts__action">
                <Button
                  variant="quiet"
                  size={p.density === "portal" ? "md" : "sm"}
                  href={a.href}
                  onClick={a.onClick}
                  disabled={a.disabled}
                  disabledReason={a.disabledReason}
                  locale={p.locale}
                >
                  {a.label || t.facts.change}
                  <span className="r1-sr">{" " + textOf(it.label)}</span>
                </Button>
              </dd>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}
