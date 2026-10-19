"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { LangToggle } from "./LangToggle";
import { Tooltip } from "./Tooltip";
import { cx, focusEl, lang, useUid } from "./lib/helpers";
import { Mark, SkipLink, navTarget, signOutControl, useShellTheme } from "./lib/shells";
import { tx } from "./lib/strings";
import type { Locale, Theme } from "./lib/types";

export type PortalShellProps = {
  /** the wordmark; default RightOne. RightOne ID for the identity pages */ brand?: string | undefined;
  /** false hides the language switch, for a product in one language */ langSwitch?: boolean | undefined;
  /** the shell takes the whole window height */ fill?: boolean | undefined;
  nav?:
    | {
        label: string;
        href?: string | undefined;
        onClick?: (() => void) | undefined;
        icon?: string | undefined;
        current?: boolean | undefined;
        disabled?: boolean | undefined;
        reason?: string | undefined;
        hidden?: boolean | undefined;
      }[]
    | undefined;
  account?: string | undefined;
  /** the way out of the session, at the end of the bar beside the account; on a phone the icon alone */ signOut?:
    | {
        label?: string | undefined;
        href?: string | undefined;
        onClick?: (() => void) | undefined;
      }
    | undefined;
  context?: { premises: string; period?: string | undefined; label?: string | undefined } | undefined;
  surfaceLabel?: string | undefined;
  layout?: "desktop" | "phone" | undefined;
  /** draws the phone overflow list (More) open */ moreOpen?: boolean | undefined;
  locale?: Locale | undefined;
  onLocale?: ((l: Locale) => void) | undefined;
  theme?: Theme | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  children?: React.ReactNode | undefined;
};

type PortalNavItem = NonNullable<PortalShellProps["nav"]>[number];

// At phone width the bottom bar holds five places. With six sections or more it shows four and Thêm, which opens
// the rest above the bar (Escape or a click outside closes it). The current section always stays in the bar: when it
// is not among the first four it takes the fourth place, and the others keep their order in Thêm. moreOpen draws the
// list open, for a specimen. The language switch sits in
// the bar beside the account.
export function PortalShell(p: PortalShellProps) {
  const t = tx(p.locale);
  const mainId = useUid("r1-main");
  const moreId = useUid("r1-more");
  const more = useState(!!p.moreOpen);
  const moreRef = useRef<HTMLLIElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const theme = useShellTheme(p, shellRef);
  const nav = (p.nav || []).filter(function (n) {
    return !n.hidden;
  });
  const phone = p.layout === "phone";
  const overflow = phone && nav.length > 5;
  const cur = overflow
    ? nav.filter(function (n) {
        return n.current;
      })[0]
    : null;
  const late = cur && nav.indexOf(cur) >= 4;
  const shown = !overflow ? nav : late ? nav.slice(0, 3).concat([cur]) : nav.slice(0, 4);
  const rest = !overflow
    ? []
    : nav.filter(function (n) {
        return shown.indexOf(n) < 0;
      });
  const restCurrent = rest.some(function (n) {
    return n.current;
  });
  const restIcons = rest.some(function (n) {
    return n.icon || n.disabled;
  });
  useEffect(
    function () {
      if (!more[0]) return undefined;
      function onDown(e: MouseEvent | TouchEvent) {
        if (moreRef.current && !moreRef.current.contains(e.target as Node | null)) more[1](false);
      }
      document.addEventListener("mousedown", onDown);
      document.addEventListener("touchstart", onDown);
      return function () {
        document.removeEventListener("mousedown", onDown);
        document.removeEventListener("touchstart", onDown);
      };
    },
    [more[0]],
  );
  // At phone width every place in the bar has a 20 px icon slot, so the labels share one line whether or not an
  // entry has an icon; 20 px leaves a two-line label room in the 64 px bar. A section that cannot be used yet shows
  // the lock: in place of its icon on a phone, before its name on the desktop bar (16 px, as the text is text-sm).
  function content(n: PortalNavItem, withIcon: boolean) {
    const icon = n.disabled ? "lock" : n.icon;
    return [
      withIcon ? (
        icon ? (
          <Icon key="i" name={icon} size={20} />
        ) : (
          <span key="i" className="r1-portal__noicon" aria-hidden="true" />
        )
      ) : n.disabled ? (
        <Icon key="i" name="lock" size={16} />
      ) : null,
      <span key="t">{n.label}</span>,
    ];
  }
  const items = shown.map(function (n, i) {
    // A section the premises cannot use yet stays in the nav, reachable, and says why on pointer over and focus.
    return (
      <li key={i}>
        {n.disabled ? (
          <Tooltip label={n.reason!} placement={phone ? "top" : "bottom"}>
            <span className="r1-portal__link r1-portal__link--disabled" aria-disabled="true" tabIndex={0}>
              {content(n, phone)}
            </span>
          </Tooltip>
        ) : (
          navTarget(n, "r1-portal__link", content(n, phone))
        )}
      </li>
    );
  });
  if (overflow) {
    items.push(
      <li
        key="more"
        ref={moreRef}
        className="r1-portal__moreitem"
        onKeyDown={function (e) {
          if (e.key === "Escape" && more[0]) {
            e.stopPropagation();
            more[1](false);
            focusEl(document.getElementById(moreId + "-btn"));
          }
        }}
      >
        <button
          type="button"
          id={moreId + "-btn"}
          className={cx("r1-portal__link", restCurrent && "r1-portal__link--within")}
          aria-expanded={more[0] ? "true" : "false"}
          aria-controls={moreId}
          onClick={function () {
            more[1](!more[0]);
          }}
        >
          <Icon name="ellipsis" size={20} />
          <span>{t.shell.more}</span>
        </button>
        {more[0] ? (
          <ul
            id={moreId}
            className="r1-portal__more"
            aria-label={t.layout.moreNav}
            onClick={function (e) {
              if ((e.target as Element).closest && (e.target as Element).closest("a, button")) more[1](false);
            }}
          >
            {rest.map(function (n, i) {
              // When any entry here has an icon (a closed one has the lock), an entry without one keeps the slot, so the names line up.
              const inner = [
                n.disabled ? (
                  <Icon key="i" name="lock" size={20} />
                ) : n.icon ? (
                  <Icon key="i" name={n.icon} size={20} />
                ) : restIcons ? (
                  <span key="i" className="r1-portal__moreslot" aria-hidden="true" />
                ) : null,
                <span key="t" className="r1-portal__moretext">
                  <span>{n.label}</span>
                  {n.disabled && n.reason ? <span className="r1-portal__morewhy">{n.reason}</span> : null}
                </span>,
              ];
              return (
                <li key={i}>
                  {n.disabled ? (
                    <span
                      className="r1-portal__morelink r1-portal__morelink--disabled"
                      aria-disabled="true"
                      tabIndex={0}
                    >
                      {inner}
                    </span>
                  ) : (
                    navTarget(n, "r1-portal__morelink", inner)
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </li>,
    );
  }
  // No sections, no navigation landmark: a page with only the account (RightOne ID's account pages put their own list beside the content).
  const navEl = nav.length ? (
    <nav className={phone ? "r1-portal__bottom" : "r1-portal__nav"} aria-label={t.shell.menu}>
      <ul>{items}</ul>
    </nav>
  ) : null;
  return (
    <div
      ref={shellRef}
      className={cx(
        "r1-shell r1-shell--portal",
        phone && "r1-shell--phone",
        // More sections than the bar holds at 1280: below 1536 the navigation takes a row of its own (r1.css).
        !phone && nav.length > 6 && "r1-shell--longnav",
        p.fill && "r1-shell--fill",
        p.className,
      )}
      style={p.style}
      lang={lang(p.locale)}
      data-theme={theme.attr}
    >
      <SkipLink to={mainId} locale={p.locale} />
      <header className="r1-portal__bar">
        <Mark name={p.brand} suffix={p.surfaceLabel} />
        {phone ? null : navEl}
        <div className="r1-portal__account">
          <span className="r1-shell__switches">
            {p.langSwitch === false ? null : <LangToggle locale={p.locale} onChange={p.onLocale} />}
          </span>
          {p.account ? (
            <span className="r1-portal__acct">
              <Icon name="user" size={16} />
              <span className="r1-portal__acctname">{p.account}</span>
            </span>
          ) : null}
          {signOutControl(p, phone ? "phone" : "md")}
        </div>
      </header>
      {p.context ? (
        <div className="r1-portal__context" role="region" aria-label={p.context.label || t.layout.context}>
          <Icon name="building-2" size={16} />
          <span className="r1-portal__ctx-name">{p.context.premises}</span>
          {p.context.period ? <span className="r1-portal__ctx-period">{p.context.period}</span> : null}
        </div>
      ) : null}
      <main id={mainId} tabIndex={-1} className="r1-portal__main">
        {p.children}
      </main>
      {phone ? navEl : null}
    </div>
  );
}
