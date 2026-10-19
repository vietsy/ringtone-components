"use client";

import type * as React from "react";
import { useLayoutEffect, useState } from "react";
import { Button } from "../Button";
import type { ButtonProps } from "../Button";
import { tx } from "./strings";
import type { Locale, Theme } from "./types";

// A shell follows the theme of the page it sits on (the nearest data-theme above it, else dark) unless the app passes
// `theme`. There is no switch for the reader: every screen is dark; light is for paper (1 Oct 2026).
export function useShellTheme(
  p: { theme?: Theme | undefined },
  rootRef: React.RefObject<HTMLElement | null>,
): { attr: Theme | undefined; value: Theme } {
  const inherited = useState<Theme>("dark");
  useLayoutEffect(function () {
    const el = rootRef.current && rootRef.current.parentElement && rootRef.current.parentElement.closest("[data-theme]");
    const v = el && el.getAttribute("data-theme") === "light" ? "light" : "dark";
    if (v !== inherited[0]) inherited[1](v);
  });
  const own = p.theme === "light" || p.theme === "dark" ? p.theme : null;
  return {
    attr: own || undefined,
    value: own || inherited[0],
  };
}

// The wordmark. RightOne by default; a shell drawn for the identity service (RightOne ID) passes brand.
export function Mark(p: { name?: string | undefined; suffix?: string | undefined }) {
  return (
    <span className="r1-mark">
      {p.name || "RightOne"}
      {p.suffix ? <span className="r1-mark__suffix">{p.suffix}</span> : null}
    </span>
  );
}

export function SkipLink(p: { to: string; locale?: Locale | undefined }) {
  return (
    <a className="r1-skip" href={"#" + p.to}>
      {tx(p.locale).shell.skip}
    </a>
  );
}

// Where a nav entry leads: a link with its address, or a button with its handler. Never a link to "#".
export function navTarget(
  n: { href?: string | undefined; current?: boolean | undefined; onClick?: (() => void) | undefined },
  cls: string,
  content: React.ReactNode,
): React.ReactElement {
  if (n.href)
    return (
      <a className={cls} href={n.href} aria-current={n.current ? "page" : undefined}>
        {content}
      </a>
    );
  return (
    <button type="button" className={cls} aria-current={n.current ? "page" : undefined} onClick={n.onClick}>
      {content}
    </button>
  );
}

// signOut ({label, href, onClick}): the way out of the session, at the end of the bar beside the account. On a phone
// it is the icon alone, named for a screen reader. A shell without it draws none: the product decides where signing out lives.
export function signOutControl(
  p: {
    signOut?:
      | { label?: string | undefined; href?: string | undefined; onClick?: (() => void) | undefined }
      | undefined;
    locale?: Locale | undefined;
  },
  size: "phone" | ButtonProps["size"],
): React.ReactElement | null {
  const s = p.signOut;
  if (!s) return null;
  const label = s.label || tx(p.locale).shell.signOut;
  return size === "phone" ? (
    <Button
      variant="quiet"
      size="md"
      icon="log-out"
      iconOnly={true}
      aria-label={label}
      href={s.href}
      onClick={s.onClick}
      locale={p.locale}
    />
  ) : (
    <Button variant="quiet" size={size} icon="log-out" href={s.href} onClick={s.onClick} locale={p.locale}>
      {label}
    </Button>
  );
}
