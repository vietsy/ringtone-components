"use client";

import type * as React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { LangToggle } from "./LangToggle";
import { Switch } from "./Switch";
import { formatCount, formatTime, offsetLabel, toDate } from "./lib/formatting";
import { cx, focusEl, isNil, isTyping, lang, textOf, useLatest, useSynced, useUid, warnOnce } from "./lib/helpers";
import { SINGLE_KEY_STORE, keyTaken, singleKeys, takeKey, useSingleKeys } from "./lib/keyboard-rules";
import { parseShortcut } from "./lib/search-and-pick";
import { Mark, SkipLink, navTarget, signOutControl, useShellTheme } from "./lib/shells";
import { tx } from "./lib/strings";
import { formatDuration } from "./lib/time-limits";
import type { Locale, Theme } from "./lib/types";

function setSingleKeys(on: boolean) {
  singleKeys.on = !!on;
  try {
    window.localStorage.setItem(SINGLE_KEY_STORE, on ? "on" : "off");
  } catch {
    /* storage refused: the choice lasts for this page */
  }
  singleKeys.subs.slice().forEach(function (f) {
    f(singleKeys.on);
  });
}

// One spelling per key, for comparing a key list with what the page binds: "\u2318K" and "Ctrl+K" are mod+k, "\u2193" is arrowdown.
const KEY_NAMES: Record<string, string> = {
  "\u2191": "arrowup",
  "\u2193": "arrowdown",
  "\u2190": "arrowleft",
  "\u2192": "arrowright",
  esc: "escape",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  spacebar: "space",
  return: "enter",
  pgup: "pageup",
  pgdn: "pagedown",
};

function keyId(raw: string | null | undefined): string | null {
  const s = String(raw || "").trim();
  if (s === " " || /^space$/i.test(s)) return "space";
  const sc = parseShortcut(s);
  if (!sc) return null;
  return (sc.mod ? "mod+" : "") + (sc.alt ? "alt+" : "") + (KEY_NAMES[sc.key] || sc.key);
}

// Keys the browser and every component handle without a binding of their own: never reported as unbound.
const NATIVE_KEYS: Record<string, number> = { tab: 1, escape: 1, space: 1 };

// The rail collapses to its icons and back from the button at its foot (aria-expanded). The choice is kept:
// the page's collapsed prop wins, and without it the rail remembers the last choice in this browser.
// Collapsed, each entry shows its name and count beside it on pointer over and keyboard focus; Escape hides it.
// keyMap ({keys, label} per line) gives the console its list of shortcuts: "?" opens it from anywhere in the shell
// (the key is handled on the shell's own element), and so does any control inside it that declares
// aria-keyshortcuts="?", such as a screen's Keys button. keysOpen draws it open.
const RAIL_KEY = "r1-console-rail";

// A mode the reader must not forget, across the top of the console and sticky with its bar: acting as another person,
// a maintenance window. It says what the mode is, when it ends and how long is left, and offers the way out.
type ShellNoticeProps = NonNullable<ConsoleShellProps["notice"]> & {
  locale?: Locale | undefined;
  innerRef?: React.Ref<HTMLDivElement> | undefined;
};

function ShellNotice(p: ShellNoticeProps) {
  const t = tx(p.locale);
  const family = p.family === "danger" ? "danger" : "attention";
  const until = p.until ? toDate(p.until) : null;
  const now = p.now ? toDate(p.now) : new Date();
  const at = until ? formatTime(until) + " (" + offsetLabel(until) + ")" : null;
  const when = until
    ? Number(until) - Number(now) > 0
      ? t.notice.until.replace("{at}", at!).replace("{left}", formatDuration(Number(until) - Number(now), p.locale))
      : t.notice.ended.replace("{at}", at!)
    : null;
  const a = p.action;
  return (
    <div ref={p.innerRef} className={cx("r1-shell-notice", "r1-shell-notice--" + family)} role="status">
      <Icon name={p.icon || "eye"} size={16} />
      <p className="r1-shell-notice__text">
        {p.title ? <strong>{p.title}</strong> : null}
        {p.title && p.text ? " " : null}
        {p.text || null}
      </p>
      {when ? <span className="r1-shell-notice__when r1-num">{when}</span> : null}
      {a ? (
        <Button variant="secondary" size="sm" icon={a.icon} href={a.href} onClick={a.onClick} locale={p.locale}>
          {a.label}
        </Button>
      ) : null}
    </div>
  );
}

export type ConsoleShellProps = {
  /** the wordmark; default RightOne. RightOne ID for the identity pages */ brand?: string | undefined;
  /** false hides the language switch, for a product in one language */ langSwitch?: boolean | undefined;
  /** a mode the reader must not forget, drawn across the top and sticky with the bar: what it is, when it ends (until, now as ISO), and the way out */ notice?:
    | {
        family?: "attention" | "danger" | undefined;
        icon?: string | undefined;
        title?: string | undefined;
        text?: string | undefined;
        until?: string | undefined;
        now?: string | undefined;
        action?:
          | { label: string; href?: string | undefined; onClick?: (() => void) | undefined; icon?: string | undefined }
          | undefined;
      }
    | undefined;
  /** the shell takes the whole window height */ fill?: boolean | undefined;
  area?: string | undefined;
  searchLabel?: string | undefined;
  onSearch?: (() => void) | undefined;
  rail?:
    | {
        label: string;
        icon?: string | undefined;
        href?: string | undefined;
        onClick?: (() => void) | undefined;
        current?: boolean | undefined;
        count?: number | undefined;
      }[]
    | undefined;
  queueCount?: number | undefined;
  queueHref?: string | undefined;
  onQueue?: (() => void) | undefined;
  account?: string | undefined;
  /** the way out of the session, at the end of the bar beside the account */ signOut?:
    | {
        label?: string | undefined;
        href?: string | undefined;
        onClick?: (() => void) | undefined;
      }
    | undefined;
  /** the page's choice; without it the rail keeps the reader's last choice */ collapsed?: boolean | undefined;
  onCollapse?: ((collapsed: boolean) => void) | undefined;
  /** the console's shortcut list, opened by ? or a control with aria-keyshortcuts="?"; every Button and FilterBar with a shortcut joins it; a key no component binds is said once in the console */ keyMap?:
    | {
        keys: string[];
        label: string;
      }[]
    | undefined;
  /** off: the page turns the shell's single-character keys (/, ?, a bare letter on a Button or FilterBar) off for everyone; without it the reader's switch in the key list decides, kept in this browser */ singleKeys?:
    "on" | "off" | undefined;
  keysOpen?: boolean | undefined;
  onKeys?: ((open: boolean) => void) | undefined;
  locale?: Locale | undefined;
  onLocale?: ((l: Locale) => void) | undefined;
  theme?: Theme | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

/** A line of the console's shortcut list. */
type KeyLine = { keys: string[]; label: string };

export function ConsoleShell(p: ConsoleShellProps) {
  const t = tx(p.locale);
  const mainId = useUid("r1-main");
  const railId = useUid("r1-rail");
  const rail = p.rail || [];
  const latest = useLatest(p);
  const searchLabel = p.searchLabel || t.shell.search;
  const fold = useState(function () {
    if (!isNil(p.collapsed)) return !!p.collapsed;
    try {
      return window.localStorage.getItem(RAIL_KEY) === "collapsed";
    } catch {
      return false;
    }
  });
  const quiet = useState(false);
  const keys = useSynced(p.keysOpen, false);
  // singleKeys="off": the page turns the shell's single-character keys off for everyone; otherwise the reader's choice,
  // kept in this browser, decides. "?" is one of them; the list still opens from a control that declares
  // aria-keyshortcuts="?" and, while the keys are off, from the Keys button the bar then shows.
  const singleOn = useSingleKeys();
  const forcedOff = p.singleKeys === "off";
  const keysLive = singleOn && !forcedOff;
  function showKeys(v: boolean) {
    keys[1](v);
    if (p.onKeys) p.onKeys(v);
  }
  function onRootKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!p.keyMap || keys[0] || !keysLive || e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target))
      return;
    e.preventDefault();
    showKeys(true);
  }
  function onRootClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!p.keyMap || keys[0] || !(e.target as Element).closest) return;
    const b = (e.target as Element).closest("[aria-keyshortcuts]");
    if (b && e.currentTarget.contains(b) && /(^|\s)\?(\s|$)/.test(b.getAttribute("aria-keyshortcuts")!)) showKeys(true);
  }
  // Buttons in the shell that carry a shortcut join the list when it opens, named by their label.
  const rootRef = useRef<HTMLDivElement>(null);
  const theme = useShellTheme(p, rootRef);
  const noticeRef = useRef<HTMLDivElement>(null);
  // The bar sticks under the notice: it sits as far down as the notice is tall, whatever its text wraps to.
  useLayoutEffect(function () {
    if (!rootRef.current) return;
    rootRef.current.style.setProperty("--r1-notice-h", (noticeRef.current ? noticeRef.current.offsetHeight : 0) + "px");
  });
  // What the page binds, read from the components inside the shell: shell keys (data-r1-shortcut on a Button, a
  // FilterBar or a SearchField, listed by data-r1-shortcut-label, else the aria-label, else the text) and keys a
  // component handles while it has focus (data-r1-focus-keys).
  function boundKeys(root: Element) {
    const shell: Record<string, boolean> = {},
      focus: Record<string, boolean> = {};
    Array.prototype.forEach.call(root.querySelectorAll("[data-r1-shortcut]"), function (el: Element) {
      const id = keyId(el.getAttribute("data-r1-shortcut"));
      if (id) shell[id] = true;
    });
    Array.prototype.forEach.call(root.querySelectorAll("[data-r1-focus-keys]"), function (el: Element) {
      el.getAttribute("data-r1-focus-keys")!
        .split(/\s+/)
        .forEach(function (k) {
          if (k) focus[k] = true;
        });
    });
    if (p.keyMap) shell["?"] = true;
    shell["mod+k"] = true;
    return { shell: shell, focus: focus };
  }
  const found = useState<{ lines: KeyLine[]; focus: Record<string, boolean> }>({ lines: [], focus: {} });
  useLayoutEffect(
    function () {
      if (!keys[0] || !rootRef.current) return;
      const seen: Record<string, boolean> = {};
      found[1]({
        focus: boundKeys(rootRef.current).focus,
        lines: (
          Array.prototype.map.call(
            rootRef.current.querySelectorAll("[data-r1-shortcut]"),
            function (el: Element): KeyLine {
              return {
                keys: [el.getAttribute("data-r1-shortcut")!],
                label:
                  el.getAttribute("data-r1-shortcut-label") || el.getAttribute("aria-label") || el.textContent.trim(),
              };
            },
          ) as KeyLine[]
        ).filter(function (k) {
          const id = k.keys[0] + "\u0001" + k.label;
          if (seen[id] || !k.label) return false;
          seen[id] = true;
          return true;
        }),
      });
    },
    [keys[0]],
  );
  // A key the list names that nothing on the page binds is said once in the console (OD-18): a listed key must work.
  const warnedKeys = useRef<Record<string, boolean>>({});
  useEffect(function () {
    if (!p.keyMap || !rootRef.current) return;
    const b = boundKeys(rootRef.current);
    p.keyMap.forEach(function (line) {
      (line.keys || []).forEach(function (k) {
        const id = keyId(k);
        if (!id || NATIVE_KEYS[id] || b.shell[id] || b.focus[id] || warnedKeys.current[id]) return;
        warnedKeys.current[id] = true;
        warnOnce(
          'the key list names "' +
            k +
            '" (' +
            textOf(line.label) +
            "), but no component in this ConsoleShell binds it.",
        );
      });
    });
  });
  // While the shell's single-character keys are off, every line whose keys are all single characters and are not a
  // component's focus keys says so: the list still names them, so the reader knows what turning them on gives back.
  function lineOff(line: KeyLine) {
    if (keysLive) return false;
    const ks = (line.keys || []).map(keyId).filter(Boolean) as string[];
    return (
      ks.length > 0 &&
      ks.every(function (id) {
        return id.length === 1 && !found[0].focus[id];
      })
    );
  }
  const keyLines = (p.keyMap || []).concat(
    found[0].lines,
    [{ keys: ["Ctrl+K", "⌘K"], label: t.layout.keySearch }],
    [{ keys: ["?"], label: t.layout.keyHelp }],
  );
  const lastProp = useRef(p.collapsed);
  if (lastProp.current !== p.collapsed) {
    lastProp.current = p.collapsed;
    if (!isNil(p.collapsed) && !!p.collapsed !== fold[0]) fold[1](!!p.collapsed);
  }
  const collapsed = fold[0];
  function toggle() {
    const v = !collapsed;
    fold[1](v);
    if (isNil(p.collapsed)) {
      try {
        window.localStorage.setItem(RAIL_KEY, v ? "collapsed" : "open");
      } catch {
        /* storage refused: the choice lasts for this page */
      }
    }
    if (p.onCollapse) p.onCollapse(v);
  }
  // Ctrl+K and Cmd+K reach the command palette from anywhere in the console, as the key cap beside it says: always
  // bound (7 October 2026), whether or not the page passes onSearch. The key puts focus on the palette button and,
  // with onSearch, opens the palette. A field in the shell that takes the key itself (SearchField shortcut "⌘K")
  // has it first.
  const searchRef = useRef<HTMLButtonElement>(null);
  useEffect(function () {
    function onKey(e: KeyboardEvent) {
      if (
        keyTaken(e) ||
        !(e.ctrlKey || e.metaKey) ||
        e.altKey ||
        !(e.key === "k" || e.key === "K" || e.code === "KeyK")
      )
        return;
      takeKey(e);
      focusEl(searchRef.current);
      if (latest.current.onSearch) latest.current.onSearch();
    }
    document.addEventListener("keydown", onKey);
    return function () {
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  const queue = isNil(p.queueCount)
    ? null
    : [
        <Icon key="i" name="inbox" size={16} />,
        <span key="t">{t.shell.queue}</span>,
        <span key="n" className="r1-console__count r1-num">
          {formatCount(p.queueCount, p.locale)}
        </span>,
      ];
  // Below bp-lg the stylesheet folds the rail whatever the reader chose, so Escape quiets a name shown on focus there too.
  function railFolded() {
    if (collapsed) return true;
    try {
      return window.matchMedia("(max-width: 1023px)").matches;
    } catch {
      return false;
    }
  }
  return (
    <div
      ref={rootRef}
      className={cx(
        "r1-shell r1-shell--console",
        collapsed && "r1-shell--collapsed",
        p.fill && "r1-shell--fill",
        p.notice && "r1-shell--notice",
        p.className,
      )}
      style={p.style}
      lang={lang(p.locale)}
      data-theme={theme.attr}
      data-r1-single-keys={forcedOff ? "off" : undefined}
      onKeyDown={p.keyMap ? onRootKey : undefined}
      onClick={p.keyMap ? onRootClick : undefined}
    >
      <SkipLink to={mainId} locale={p.locale} />
      {p.notice ? <ShellNotice locale={p.locale} {...p.notice} {...{ innerRef: noticeRef }} /> : null}
      <header className="r1-console__bar">
        <Mark name={p.brand} suffix={p.area || "Ops"} />
        <button
          ref={searchRef}
          type="button"
          className="r1-console__search"
          aria-label={searchLabel}
          aria-keyshortcuts="Control+K Meta+K"
          onClick={p.onSearch}
        >
          <Icon name="search" size={16} />
          <span aria-hidden="true">{searchLabel}</span>
          <kbd aria-hidden="true">⌘K</kbd>
        </button>
        <span className="r1-console__spacer" />
        {queue ? (
          p.queueHref ? (
            <a className="r1-console__queue" href={p.queueHref}>
              {queue}
            </a>
          ) : (
            <button type="button" className="r1-console__queue" onClick={p.onQueue}>
              {queue}
            </button>
          )
        ) : null}
        {
          // While the single-character keys are off, "?" no longer opens the key list, so the bar offers it as a button.
          p.keyMap && !keysLive ? (
            <Button
              variant="quiet"
              size="sm"
              icon="keyboard"
              className="r1-console__keysbtn"
              onClick={function () {
                showKeys(true);
              }}
              locale={p.locale}
            >
              {t.layout.keys}
            </Button>
          ) : null
        }
        <span className="r1-shell__switches">
          {p.langSwitch === false ? null : <LangToggle locale={p.locale} onChange={p.onLocale} density="console" />}
        </span>
        {p.account ? (
          <span className="r1-portal__acct">
            <Icon name="user" size={16} />
            <span className="r1-console__acctname">{p.account}</span>
          </span>
        ) : null}
        {signOutControl(p, "sm")}
      </header>
      <p className="r1-console__narrow" role="note">
        <Icon name="triangle-alert" size={16} />
        <span>{t.shell.narrow}</span>
      </p>
      <div className="r1-console__body">
        <nav
          id={railId}
          className={cx("r1-console__rail", quiet[0] && "r1-console__rail--quiet")}
          aria-label={t.shell.menu}
          onKeyDown={function (e) {
            if (e.key === "Escape" && railFolded()) quiet[1](true);
          }}
          onFocus={function () {
            if (quiet[0]) quiet[1](false);
          }}
          onMouseLeave={function () {
            if (quiet[0]) quiet[1](false);
          }}
        >
          <ul>
            {rail.map(function (r, i) {
              return (
                <li key={i}>
                  {navTarget(r, "r1-console__item", [
                    r.icon ? <Icon key="i" name={r.icon} size={16} /> : null,
                    <span key="t" className="r1-console__item-text">
                      <span className="r1-console__item-label">{r.label}</span>
                      {isNil(r.count) ? null : (
                        <span className="r1-console__item-count r1-num">{formatCount(r.count, p.locale)}</span>
                      )}
                    </span>,
                  ])}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="r1-console__fold"
            aria-expanded={collapsed ? "false" : "true"}
            aria-controls={railId}
            aria-label={collapsed ? t.layout.expand : undefined}
            onClick={toggle}
          >
            <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={16} />
            {collapsed ? null : <span>{t.shell.collapse}</span>}
          </button>
        </nav>
        <main id={mainId} tabIndex={-1} className="r1-console__main">
          {p.children}
        </main>
      </div>
      {p.keyMap && keys[0] ? (
        <Dialog
          title={t.layout.keys}
          placement="overlay"
          width="var(--container-md)"
          density="console"
          secondaryAction={{ label: t.close }}
          onClose={function () {
            showKeys(false);
          }}
          locale={p.locale}
        >
          <dl className="r1-keys">
            {keyLines.map(function (k, i) {
              const off = lineOff(k);
              return (
                <div key={i} className={cx("r1-keys__row", off && "r1-keys__row--off")}>
                  <dt className="r1-keys__keys">
                    {(k.keys || []).map(function (x, j) {
                      return <kbd key={j}>{x}</kbd>;
                    })}
                  </dt>
                  <dd className="r1-keys__label">
                    {k.label}
                    {off ? <span className="r1-keys__off">{" (" + t.layout.keyOff + ")"}</span> : null}
                  </dd>
                </div>
              );
            })}
          </dl>
          <Switch
            className="r1-keys__switch"
            density="console"
            label={t.layout.singleKeys}
            helper={t.layout.singleKeysHelp}
            checked={keysLive}
            disabled={forcedOff}
            disabledReason={forcedOff ? t.layout.singleKeysForced : undefined}
            onChange={function (v) {
              setSingleKeys(v);
            }}
            locale={p.locale}
          />
        </Dialog>
      ) : null}
    </div>
  );
}
