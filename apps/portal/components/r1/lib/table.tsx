"use client";

import type * as React from "react";
import { Avatar } from "../Avatar";
import type { AvatarProps } from "../Avatar";
import { Button } from "../Button";
import { CountValue } from "../CountValue";
import { DateValue } from "../DateValue";
import type { DateValueProps } from "../DateValue";
import { DeadlineClock } from "../DeadlineClock";
import type { DeadlineClockProps } from "../DeadlineClock";
import { Icon } from "../Icon";
import { Identifier } from "../Identifier";
import type { IdentifierProps } from "../Identifier";
import { Menu } from "../Menu";
import type { MenuProps } from "../Menu";
import { MoneyValue } from "../MoneyValue";
import type { MoneyValueProps } from "../MoneyValue";
import { StatusBadge } from "../StatusBadge";
import type { StatusBadgeProps } from "../StatusBadge";
import { StatusIcon } from "../StatusIcon";
import { keepRefs } from "./button";
import { formatPercent } from "./formatting";
import { cx, isNil } from "./helpers";
import { ICONS } from "./icons";
import { workingWords } from "./status-badge";
import { tx } from "./strings";
import type { CellKind, Locale, StatusValue, TableActionItem, TableActionsCell, TableStackCell } from "./types";

/** What a cell reads from its column: a Table column, or a FactList item drawn by the same cells. */
export type CellColumn = {
  kind?: CellKind | undefined;
  missing?: string | undefined;
  decimals?: number | undefined;
  short?: boolean | undefined;
  detailSize?: "xs" | "sm" | undefined;
  size?: "sm" | "lg" | undefined;
  unit?: string | undefined;
};

/** The row height a cell's buttons follow; touch is a card's actions on the portal. */
export type CellDensity = "console" | "org" | "portal" | "touch";

// The value of a cell, by its column's kind. A row's values are not typed (Record<string, unknown>), so each kind reads
// its value as the shape below.
/** Any cell that has no value and says why: { missing: "Chưa cấp" }. */
type MissingCell = { missing?: string | undefined };
type MenuCell = MenuProps["items"];
type PeriodCell = { from: DateValueProps["value"]; to?: DateValueProps["to"] };
/** A person cell: a name, or the name with a picture, its kind and a line under it. */
type PersonCell = { name: string; src?: string | undefined; kind?: AvatarProps["kind"]; detail?: string | undefined };
type ActionsObject = Exclude<TableActionsCell, TableActionItem[]>;
/** An entries cell: several short records, one per line, each a code, a state and a note. */
type EntriesCell = { code?: string | undefined; status?: StatusValue | undefined; text?: string | undefined }[];
type StackObject = Exclude<TableStackCell, string>;
/** A money cell: the amount in minor units, or the amount with its currency. */
type MoneyObject = { amountMinor: MoneyValueProps["amountMinor"]; currency?: string | undefined };
type UnavailableCell = { unavailable?: boolean | undefined; word?: string | undefined; detail?: string | undefined };
type LinkCell = { href?: string | undefined; label: React.ReactNode };

// A value missing from a cell: the dash for the eye, words for a screen reader (the cell's or the column's
// missing text, else the shared "no value").
function nullCell(col: CellColumn, locale: Locale | undefined, text?: string): React.ReactElement {
  return (
    <span className="r1-null">
      <span aria-hidden="true">–</span>
      <span className="r1-sr">{text || (col && col.missing) || tx(locale).noValue}</span>
    </span>
  );
}

export function renderCell(
  col: CellColumn,
  v: unknown,
  locale: Locale | undefined,
  density?: CellDensity,
  menuLabel?: string | null,
): React.ReactNode {
  const kind = col.kind || "text";
  if (
    v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    !isNil((v as MissingCell).missing) &&
    Object.keys(v).length === 1
  )
    return nullCell(col, locale, (v as MissingCell).missing);
  if (kind === "menu")
    return isNil(v) || !(v as MenuCell).length ? null : (
      <Menu
        iconOnly={true}
        variant="quiet"
        size="sm"
        align="end"
        label={menuLabel || tx(locale).menu.more}
        items={v as MenuCell}
        locale={locale}
      />
    );
  if (kind === "deadline")
    return isNil(v) ? (
      nullCell(col, locale)
    ) : (
      <DeadlineClock size="sm" locale={locale} {...(typeof v === "object" ? v : { due: v as DeadlineClockProps["due"] })} />
    );
  // decimals: a column of figures stored to a set precision ("14,00 %"); without it at most one decimal.
  if (kind === "percent")
    return isNil(v)
      ? nullCell(col, locale)
      : formatPercent(v as number | string, locale, { decimals: col.decimals }) || nullCell(col, locale);
  if (kind === "period")
    return isNil(v) ? (
      nullCell(col, locale)
    ) : (
      <DateValue
        value={(v as PeriodCell).from}
        to={(v as PeriodCell).to}
        mode="period"
        short={!!col.short}
        locale={locale}
      />
    );
  if (kind === "person") {
    if (isNil(v) || v === "") return nullCell(col, locale);
    const who: PersonCell = typeof v === "object" ? (v as PersonCell) : { name: v as string };
    return (
      <span className="r1-person">
        <Avatar name={who.name} src={who.src} size="sm" kind={who.kind} decorative={true} />
        <span className="r1-stack">
          <span className="r1-person__name">{who.name}</span>
          {who.detail ? <span className="r1-stack__detail">{who.detail}</span> : null}
        </span>
      </span>
    );
  }
  if (kind === "actions") {
    // an array of buttons, or { items, message, severity, code } when the row also explains why an action is refused.
    // ariaLabel: the button's accessible name when the visible label needs the row's reference ("Resolve CFU-8WN3KT6QPA").
    // code: the refusal code, on the line after the message as a Banner without a title writes it ("Code LAST_SIGNING_KEY").
    const items: TableActionItem[] = isNil(v)
      ? []
      : Array.isArray(v)
        ? (v as TableActionItem[])
        : (v as ActionsObject).items || [];
    const msg = v && !Array.isArray(v) ? (v as ActionsObject).message : null;
    if (!items.length && !msg) return null;
    const btns = items.length ? (
      <div className="r1-table__actions">
        {items.map(function (a, i) {
          return (
            <Button
              key={i}
              variant={a.variant || "secondary"}
              size={density === "touch" ? "lg" : density === "portal" ? "md" : "sm"}
              icon={a.icon}
              href={a.href}
              disabled={a.disabled}
              disabledReason={a.disabledReason}
              onClick={a.onClick}
              ariaLabel={a.ariaLabel}
              locale={locale}
            >
              {a.label}
            </Button>
          );
        })}
      </div>
    ) : null;
    return msg ? (
      <div className="r1-table__actcell">
        {btns}
        {rowMsg((v as ActionsObject).severity || "warning", msg, undefined, (v as ActionsObject).code, locale)}
      </div>
    ) : (
      btns
    );
  }
  if (kind === "entries") {
    // several short records in one cell, one per line: a code, a state and a note
    if (isNil(v) || !(v as EntriesCell).length) return nullCell(col, locale);
    return (
      <ul className="r1-entries">
        {(v as EntriesCell).map(function (e, i) {
          return (
            <li key={i} className="r1-entries__item">
              {e.code ? <span className="r1-mono r1-entries__code">{e.code}</span> : null}
              {e.status ? (
                <StatusBadge family={e.status.family} label={e.status.label} icon={e.status.icon} size="sm" />
              ) : null}
              {e.text ? <span className="r1-entries__text">{keepRefs(e.text)}</span> : null}
            </li>
          );
        })}
      </ul>
    );
  }
  if (kind === "stack") {
    if (isNil(v) || v === "") return nullCell(col, locale);
    if (typeof v !== "object") return <span className="r1-strong">{keepRefs(v as string)}</span>;
    const s = v as StackObject;
    const main = s.href ? (
      <a className="r1-link r1-link--standalone" href={s.href}>
        {keepRefs(s.text)}
      </a>
    ) : (
      keepRefs(s.text)
    );
    // mono: the main text is a reference (a printout or a key), in the monospace face.
    return (
      <span
        className={cx(
          "r1-stack",
          s.muted && "r1-stack--muted",
          s.plain && "r1-stack--plain",
          s.struck && "r1-stack--struck",
        )}
      >
        <span className={cx("r1-stack__text", s.mono && "r1-mono")}>{main}</span>
        {s.detail ? (
          <span
            className={cx(
              "r1-stack__detail",
              s.num && "r1-num",
              (col.detailSize || s.detailSize) === "sm" && "r1-stack__detail--sm",
            )}
          >
            {keepRefs(s.detail)}
          </span>
        ) : null}
      </span>
    );
  }
  if (kind === "status") {
    if (isNil(v)) return nullCell(col, locale);
    const s = v as StatusValue;
    if (s.quiet) return <span className="r1-quiet">{s.label}</span>;
    // working: a state running now; the plain word and the badge show the spinner in place of the shape (StatusBadge).
    const going = s.working ? workingWords(s.label, locale) : null;
    if (s.plain)
      return (
        <span className={"r1-stext r1-stext--" + (s.family || "neutral")}>
          <span className="r1-stext__line">
            {s.working ? (
              <Icon name="loader-circle" size={16} spin={true} />
            ) : s.icon && (ICONS as Readonly<Record<string, unknown>>)[s.icon] ? (
              <Icon name={s.icon} size={16} strokeWidth={2.5} className="r1-status-icon" />
            ) : (
              <StatusIcon family={s.family || "neutral"} size={16} cutout="surface" />
            )}
            <span>{s.label}</span>
            {going ? <span className="r1-sr">{going}</span> : null}
          </span>
          {isNil(s.identifier) || s.identifier === "" ? null : (
            <span className="r1-sbadge__id">
              {s.identifierLabel ? <span className="r1-stext__detail">{s.identifierLabel}</span> : null}
              <Identifier value={s.identifier} size="sm" locale={locale} />
            </span>
          )}
          {s.detail ? <span className="r1-stext__detail">{keepRefs(s.detail)}</span> : null}
        </span>
      );
    const badge: StatusBadgeProps = s.working
      ? {
          family: s.family,
          label: s.label,
          size: "sm",
          variant: s.variant,
          icon: s.icon,
          working: true,
          locale: locale,
        }
      : { family: s.family, label: s.label, size: "sm", variant: s.variant, icon: s.icon };
    // identifier: the record the state points to ("Thay bằng REG-W3HN6DRZ2Q"), an Identifier with its copy button under
    // the badge, after identifierLabel when the page gives one; a detail line follows it.
    const ref =
      isNil(s.identifier) || s.identifier === "" ? null : (
        <span className="r1-sbadge__id">
          {s.identifierLabel ? <span className="r1-stext__detail">{s.identifierLabel}</span> : null}
          <Identifier value={s.identifier} size="sm" locale={locale} />
        </span>
      );
    // A badge with a detail: the line under it says what the state means here ("grants nothing until then").
    if (s.detail || ref)
      return (
        <span className="r1-sbadge">
          <StatusBadge {...badge} />
          {ref}
          {s.detail ? <span className="r1-stext__detail">{keepRefs(s.detail)}</span> : null}
        </span>
      );
    return <StatusBadge {...badge} />;
  }
  // size 'lg' on an id column: a reference read aloud over the phone, at text-lg.
  if (kind === "id")
    return <Identifier value={v as IdentifierProps["value"]} size={col.size === "lg" ? "lg" : "sm"} locale={locale} />;
  if (kind === "money")
    return (
      <MoneyValue
        missing={col.missing}
        amountMinor={isNil(v) ? null : typeof v === "object" ? (v as MoneyObject).amountMinor : (v as number)}
        currency={(v && (v as MoneyObject).currency) as MoneyValueProps["currency"]}
        bare={!!col.unit && col.unit === ((v && (v as MoneyObject).currency) || "VND")}
        locale={locale}
      />
    );
  if (kind === "count") return <CountValue missing={col.missing} value={v as number | null} locale={locale} />;
  // an absent date reads as the column's own words when it has them ("never used"), else as "no date"
  if ((kind === "date" || kind === "datetime" || kind === "stamp") && (isNil(v) || v === "") && col.missing)
    return nullCell(col, locale);
  // short: the short month ("24 thg 9, 2026") for a dense console column
  if (kind === "date") return <DateValue value={v as DateValueProps["value"]} short={!!col.short} locale={locale} />;
  if (kind === "datetime") return <DateValue value={v as DateValueProps["value"]} mode="timestamp" locale={locale} />;
  if (kind === "stamp") return <DateValue value={v as DateValueProps["value"]} mode="stamp" locale={locale} />;
  if (kind === "unavailable") {
    const u = v as UnavailableCell | null | undefined;
    return (
      <span className="r1-unavail">
        <Icon name="circle-help" size={16} />
        <span>{(u && u.word) || tx(locale).unavailableWord}</span>
        {u && u.detail ? <span className="r1-unavail__detail">{u.detail}</span> : null}
      </span>
    );
  }
  if (kind === "link")
    return isNil(v) ? (
      nullCell(col, locale)
    ) : (v as LinkCell).href ? (
      <a className="r1-link" href={(v as LinkCell).href}>
        {(v as LinkCell).label}
      </a>
    ) : (
      <span>{(v as LinkCell).label}</span>
    );
  if (isNil(v) || v === "") return nullCell(col, locale);
  if (typeof v === "object" && (v as UnavailableCell).unavailable)
    return renderCell({ kind: "unavailable" }, v, locale);
  if (kind === "strong") return <span className="r1-strong">{keepRefs(v as React.ReactNode)}</span>;
  if (kind === "muted") return <span className="r1-muted">{keepRefs(v as React.ReactNode)}</span>;
  if (kind === "mono") return <span className="r1-mono">{v as React.ReactNode}</span>;
  // A reference in running text (REG-W3HN6DRZ2Q, R1-CER-2026-W5HK8TQM) never breaks at its hyphen.
  return keepRefs(v as React.ReactNode);
}

export const NUMERIC: Readonly<Partial<Record<CellKind, 1>>> = { money: 1, count: 1, percent: 1 };

// A row message without a live role, so the messages already on a table are read with their rows and not
// all at once when it loads. A message that appears later is announced by the table itself.
export function rowMsg(
  severity: NonNullable<ActionsObject["severity"]>,
  text: string,
  id: string | undefined,
  code: string | undefined,
  locale: Locale | undefined,
): React.ReactElement {
  // neutral: a plain fact under the row (the record it was merged into), with no tint and no warning
  const family =
    severity === "error" ? "danger" : severity === "info" ? "info" : severity === "neutral" ? "neutral" : "attention";
  // code: the refusal code on the line after the sentence, small, as a Banner without a title writes it. A row's
  // _message takes it as the actions cell's {items, message, code} does: { severity, text, code }.
  return (
    <div id={id} className={cx("r1-msg", "r1-msg--" + family)}>
      <StatusIcon family={family} size={16} cutout="surface" />
      <div className="r1-msg__body">
        <span>{keepRefs(text)}</span>
        {code ? (
          <span className="r1-msg__code">
            <span className="r1-msg__code-label">{tx(locale).code}</span> <span>{code}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
