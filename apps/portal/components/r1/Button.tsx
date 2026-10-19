"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { keepRefs } from "./lib/button";
import { announce, cx, isTyping, textOf, useLatest, useUid, warnOnce } from "./lib/helpers";
import { bindableShortcut, holdAlt, keyTaken, singleKeyOff, takeKey, useSingleKeys } from "./lib/keyboard-rules";
import { shortcutAria, shortcutHit, shortcutText } from "./lib/search-and-pick";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type ButtonProps = {
  variant?: "primary" | "secondary" | "quiet" | "danger" | undefined;
  size?: "sm" | "md" | "lg" | "xl" | undefined;
  icon?: string | undefined;
  iconRight?: string | undefined;
  iconOnly?: boolean | undefined;
  "aria-label"?: string | undefined;
  ariaLabel?: string | undefined;
  loading?: boolean | undefined;
  loadingLabel?: string | undefined;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
  href?: string | undefined;
  target?: string | undefined;
  rel?: string | undefined;
  download?: string | boolean | undefined;
  type?: "button" | "submit" | undefined;
  fullWidth?: boolean | undefined;
  onClick?: ((e: unknown) => void) | undefined;
  onKeyDown?: ((e: unknown) => void) | undefined;
  id?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-keyshortcuts"?: string | undefined;
  "aria-haspopup"?: React.AriaAttributes["aria-haspopup"] | undefined;
  "aria-expanded"?: React.AriaAttributes["aria-expanded"] | undefined;
  "aria-controls"?: string | undefined;
  "aria-pressed"?: React.AriaAttributes["aria-pressed"] | undefined;
  /** one key ("N", "⌘S" with a modifier, "Alt+R" with Alt) that presses the button from anywhere in its shell; Alt is drawn "⌥R" on Apple platforms and "Alt+R" elsewhere. Alt+D and Alt+F are refused (the browser's); a single character is off while the reader or ConsoleShell singleKeys turns single-character keys off */ shortcut?:
    string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  children?: React.ReactNode | undefined;
};

export function Button(p: ButtonProps) {
  const t = tx(p.locale);
  const reasonId = useUid("r1-why");
  const variant = p.variant || "secondary";
  const size = p.size || "md";
  const iconSize = size === "sm" ? 16 : 20;
  // Disabled wins over loading: a button that cannot act is drawn disabled, one that is working keeps its look.
  const busy = !!p.loading && !p.disabled;
  const blocked = !!(p.disabled || p.loading);
  // The reason is stated only while the button is disabled; an enabled button carries no reason line.
  const why = p.disabled && p.disabledReason ? p.disabledReason : null;
  const label = busy && p.loadingLabel ? p.loadingLabel : p.children;
  const btnRef = useRef<HTMLElement>(null);
  const sc = p.shortcut
    ? bindableShortcut(p.shortcut, 'the button "' + textOf(p.children || p["aria-label"] || p.ariaLabel) + '"')
    : null;
  const scBound = useState(false);
  const isBlocked = useLatest(blocked);
  const singleOn = useSingleKeys();
  const scOff = useState(false);
  if (sc && p.variant === "danger")
    warnOnce(
      'the destructive button "' +
        textOf(p.children) +
        '" has the shortcut ' +
        p.shortcut +
        ": no key performs an act that cannot be undone (OD-19).",
    );
  useEffect(
    function () {
      const scope = sc && btnRef.current && btnRef.current.closest<HTMLElement>(".r1-shell");
      const off = singleKeyOff(sc, scope, singleOn);
      if (scOff[0] !== off) scOff[1](off);
      scBound[1](!!scope && !off);
      if (!scope || off) return undefined;
      function onKey(e: KeyboardEvent) {
        if (keyTaken(e)) return;
        if (!shortcutHit(e, sc!)) return;
        if (!sc!.mod && !sc!.alt && isTyping(e.target)) return;
        holdAlt(e, sc!);
        const dlg = e.target && (e.target as Element).closest && (e.target as Element).closest('[role="dialog"]');
        if ((dlg && !dlg.contains(btnRef.current)) || isBlocked.current || !btnRef.current) return;
        takeKey(e);
        btnRef.current.click();
      }
      scope.addEventListener("keydown", onKey);
      return function () {
        scope.removeEventListener("keydown", onKey);
      };
    },
    [sc ? (sc.mod ? "mod+" : "") + (sc.alt ? "alt+" : "") + sc.key : "", singleOn],
  );
  const scName = sc && scBound[0] ? shortcutAria(sc) : undefined;
  // Working is said once, when it starts: the label the reader sees, else "Loading".
  const wasBusy = useRef(busy);
  useEffect(
    function () {
      if (busy && !wasBusy.current) announce(textOf(label) || t.loading);
      wasBusy.current = busy;
    },
    [busy],
  );
  // A button is never wider than its container: a label too long for the space wraps onto more lines and the button grows in
  // height (bundle.css, .r1-btn and .r1-btn__label). A label that fits keeps the one-line button.
  const cls = cx(
    "r1-btn",
    "r1-btn--" + variant,
    "r1-btn--" + size,
    p.iconOnly && "r1-btn--icon",
    p.fullWidth && "r1-btn--full",
    p.className,
  );
  // The spinner takes the place of the icon the button has: the leading one, else the trailing one, so the width holds.
  const spinEnd = busy && !p.icon && !!p.iconRight && !p.iconOnly;
  const spinner = busy ? <Icon key={spinEnd ? "r" : "l"} name="loader-circle" size={iconSize} spin={true} /> : null;
  const inner = [
    busy && !spinEnd ? spinner : p.icon ? <Icon key="i" name={p.icon} size={iconSize} /> : null,
    p.iconOnly ? null : (
      <span key="t" className="r1-btn__label">
        {keepRefs(label)}
      </span>
    ),
    spinEnd ? spinner : p.iconRight && !p.iconOnly ? <Icon key="r" name={p.iconRight} size={iconSize} /> : null,
  ];
  const common = {
    className: cls,
    style: p.style,
    "aria-label": (p.iconOnly ? p["aria-label"] || p.ariaLabel || p.children : p["aria-label"] || p.ariaLabel) as
      | string
      | undefined,
    "aria-disabled": blocked ? ("true" as const) : undefined,
    "aria-busy": busy ? ("true" as const) : undefined,
    "aria-describedby": [why ? reasonId : null, p["aria-describedby"]].filter(Boolean).join(" ") || undefined,
    id: p.id,
    "aria-haspopup": p["aria-haspopup"],
    "aria-expanded": p["aria-expanded"],
    "aria-controls": p["aria-controls"],
    "aria-pressed": p["aria-pressed"],
    "aria-keyshortcuts": p["aria-keyshortcuts"] || scName,
    "data-r1-shortcut": sc ? shortcutText(p.shortcut, sc) : undefined,
    "data-r1-shortcut-off": sc && scOff[0] ? "" : undefined,
    onKeyDown: p.onKeyDown,
    ref: btnRef as React.RefObject<(HTMLAnchorElement & HTMLButtonElement) | null>,
  };
  let el;
  if (p.href && !blocked) {
    // A link styled as a button still runs its onClick (a router, an analytics event) before it goes.
    const ext = p.target === "_blank";
    el = (
      <a
        href={p.href}
        onClick={p.onClick}
        target={p.target}
        rel={p.rel || (ext ? "noopener noreferrer" : undefined)}
        download={p.download}
        {...common}
      >
        {inner}
      </a>
    );
  } else {
    el = (
      <button
        type={p.type || "button"}
        onClick={
          blocked
            ? function (e) {
                e.preventDefault();
              }
            : p.onClick
        }
        {...common}
      >
        {inner}
      </button>
    );
  }
  if (!why) return el;
  return (
    <span className={cx("r1-btn-wrap", p.fullWidth && "r1-btn-wrap--full")}>
      {el}
      <span id={reasonId} className="r1-btn__reason">
        <Icon name="info" size={16} />
        <span>{why}</span>
      </span>
    </span>
  );
}
