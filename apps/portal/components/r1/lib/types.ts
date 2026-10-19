// The props types the design system R1 publishes for its components.
import type * as React from "react";

export type Family = "positive" | "attention" | "danger" | "neutral" | "info";

export type Locale = "vi" | "en";

/** A shell's theme when the app fixes it; without it the shell follows the page (dark). There is no reader switch: light is for paper. */
export type Theme = "dark" | "light";

export interface StatusValue {
  family: Family;
  label: string;
  variant?: "seal" | undefined;
  quiet?: boolean | undefined;
  /** in a Table status cell: a sentence under the badge (or under the word with plain) */ detail?: string | undefined;
  plain?: boolean | undefined;
  /** in a Table status cell: a state running now; the spinner takes the place of the shape, as StatusBadge working */ working?:
    boolean | undefined;
  /** an Icon name in place of the family's shape, as StatusBadge icon; drawn wherever a badge draws the status (a Table status or entries cell, FactList, PageHeader, Panel, SidePanel, Timeline, QueueList, ItemList). PrintableRecord keeps the family's shape on paper */ icon?:
    string | undefined;
  /** in a Table status cell: the reference the state points to, an Identifier under the badge, after identifierLabel */ identifier?:
    string | undefined;
  identifierLabel?: string | undefined;
}

export interface IconProps {
  name: string;
  size?: number | undefined;
  label?: string | undefined;
  spin?: boolean | undefined;
  strokeWidth?: number | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
}

/** alternative-route: taken from a route other than the authoritative source (detail names the route); manual-override: an authorised person overrode the value (detail names the authority) */
export type Provenance =
  | "registry-sourced"
  | "declared"
  | "evidenced"
  | "corrected"
  | "derived"
  | "alternative-route"
  | "manual-override"
  | /** the DAT classes, 7 October 2026, with declared and derived */ "authoritative"
  | "estimated"
  | "imputed"
  | "illustrative";

/** density: console 32 px; portal, premises and org 48 px (org is the organisation portal, which takes the portal height). A disabledReason is shown and linked only while disabled. */
export interface FieldBase {
  label: string;
  helper?: string | undefined;
  required?: boolean | undefined;
  error?: string | undefined;
  warning?: string | undefined;
  acknowledged?: boolean | undefined;
  onAcknowledge?: (() => void) | undefined;
  info?: string | undefined;
  readOnly?: boolean | undefined;
  provenance?: Provenance | undefined;
  provenanceDetail?: string | undefined;
  /** plain: the chip's words for a premises portal */ provenanceWords?: "plain" | "default" | undefined;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
  density?: "console" | "portal" | "premises" | "org" | undefined;
  width?: number | string | undefined;
  name?: string | undefined;
  onBlur?: ((e: unknown) => void) | undefined;
  locale?: Locale | undefined;
}

/** Every value-bearing input reports the value first and the event second. */
export type OnValue<T> = (value: T, e?: unknown) => void;

export type CellKind =
  | "text"
  | "strong"
  | "muted"
  | "mono"
  | "id"
  | "status"
  | "money"
  | "count"
  | "percent"
  | "date"
  | "datetime"
  | "stamp"
  | "period"
  | "deadline"
  | "person"
  | "link"
  | "unavailable"
  | "stack"
  | "entries"
  | "actions"
  | "menu";

export interface ActionSpec {
  label: string;
  variant?: "primary" | "secondary" | "quiet" | "danger" | undefined;
  icon?: string | undefined;
  href?: string | undefined;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
  onClick?: (() => void) | undefined;
}

/** An item of a Table actions cell: Button props as data. ariaLabel is the button's accessible name when the visible label needs the row's reference ("Resolve CFU-8WN3KT6QPA"); it starts with the visible label. */
export interface TableActionItem extends ActionSpec {
  ariaLabel?: string | undefined;
}

/** A Table actions cell: the buttons, or the buttons with the sentence that says why an action is refused and its refusal code, written on the line after it as a Banner does ("Code LAST_SIGNING_KEY"). */
export type TableActionsCell =
  | TableActionItem[]
  | {
      items?: TableActionItem[] | undefined;
      message?: string | undefined;
      severity?: "error" | "warning" | "info" | "neutral" | undefined;
      code?: string | undefined;
    };

/** A Table stack cell: the main text and a detail line. mono sets the main text in the monospace face, for a reference. */
export type TableStackCell =
  | string
  | {
      text: string;
      detail?: string | undefined;
      href?: string | undefined;
      muted?: boolean | undefined;
      plain?: boolean | undefined;
      struck?: boolean | undefined;
      num?: boolean | undefined;
      mono?: boolean | undefined;
      detailSize?: "xs" | "sm" | undefined;
    };

export interface BannerAction {
  label: string;
  href?: string | undefined;
  onClick?: (() => void) | undefined;
  variant?: "primary" | "secondary" | "quiet" | "danger" | undefined;
  icon?: string | undefined;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
}

export interface EmptyAction {
  label: string;
  onClick?: (() => void) | undefined;
  href?: string | undefined;
  icon?: string | undefined;
  variant?: "primary" | "secondary" | "quiet" | undefined;
}

export interface Person {
  name: string;
  role?: string | undefined;
  at?: string | undefined;
}

/** A Player condition; its family comes from the conditions table. PlayerStatusBlock takes the first six. */
export type PlayerCondition =
  | "online"
  | "offline"
  | "limit-reached"
  | "stopped"
  | "cannot-continue"
  | "ceiling"
  | "syncing"
  | "fault"
  | "paused"
  | "unpaired";

/** A string passes through; a Date or a timestamp is written for the locale in Vietnam time; a number is a count. */
export type PlayerValue = string | number | Date;

/** A line with its values apart: { text: 'Đồng bộ lúc {at:time}', at: new Date() }. {key} writes a Date as a stamp and a number as a count; {key:time}, {key:date}, {key:duration} (ms) say how. */
export type PlayerLine = string | ({ text: string } & Record<string, string | number | Date>);

/** The track tones, from the RightOne logo since 1 Oct 2026: teal (Digital Teal) and blue (the logo's blues). Lime and stone are retired. */
export type Tone = "teal" | "blue";

/** condition sets the family and the state word; family alone falls back to neutral when it is not one of the five. size is set by PlayerFrame: sm and md list no shortcuts. meter is in hours; without caption the time left is written in words. */
export type RailProps = {
  premises?: string | undefined;
  place?: string | undefined;
  condition?: PlayerCondition | undefined;
  family?: Family | undefined;
  state?: string | undefined;
  detail?: PlayerLine[] | undefined;
  meter?:
    | {
        value: number;
        max: number;
        family?: Family | undefined;
        caption?: string | undefined;
        sub?: string | undefined;
        note?: string | undefined;
        label?: string | undefined;
      }
    | undefined;
  device?: string | undefined;
  facts?: PlayerLine[] | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  storage?: { value: number; max: number; family?: Family | undefined; label?: string | undefined } | undefined;
  shortcuts?: boolean | "stopped" | { keys: string[]; label: string }[] | undefined;
  onFullscreen?: (() => void) | undefined;
  href?: string | undefined;
  linkLabel?: string | undefined;
  time?: PlayerValue | undefined;
  day?: PlayerValue | undefined;
  locale?: Locale | undefined;
};

export interface ChoiceOption {
  value: string;
  label: string;
  helper?: string | undefined;
  hint?: string | undefined;
  disabled?: boolean | undefined;
  reason?: string | undefined;
  /** a state: its status shape leads the label, and chosen, a card or a chip takes the family's tint */ family?:
    Family | undefined;
}

export type SlotKind = "scheduled" | "default" | "fallback" | "none";
