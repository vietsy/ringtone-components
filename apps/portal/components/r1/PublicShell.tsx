"use client";

import type * as React from "react";
import { useRef } from "react";
import { Icon } from "./Icon";
import { LangToggle } from "./LangToggle";
import { StatusIcon } from "./StatusIcon";
import { formatDate, formatTimestamp } from "./lib/formatting";
import { cx, lang, useUid } from "./lib/helpers";
import { Mark, SkipLink, useShellTheme } from "./lib/shells";
import { tx } from "./lib/strings";
import type { Strings } from "./lib/strings";
import type { Family, Locale, Theme } from "./lib/types";

const PUBLIC_LINKS = { help: "/help", privacy: "/privacy", contact: "/contact", legal: "/legal" };

// variant 'field': the inspector's field app on a phone (390 and 320). Under the bar a status strip says whether the
// phone is online and the state of the verification key it checks codes with: network ('online' | 'offline') and
// verificationKey ({state: 'valid' | 'expiring' | 'missing', until}). The strip is a polite status region, so a change
// is said once; drawn with the page it is read in order. Every target in the field frame is at least 44 px
// (target-premises), and the footer keeps the one contact link, as on the verification routes.
const FIELD_KEY_FAMILY: Record<"valid" | "expiring" | "missing", Family> = {
  valid: "positive",
  expiring: "attention",
  missing: "danger",
};

function fieldStrip(p: PublicShellProps, t: Strings) {
  const net = p.network === "offline" ? "offline" : p.network === "online" ? "online" : null;
  const key = p.verificationKey || null;
  const ks = key && FIELD_KEY_FAMILY[key.state] ? key.state : null;
  if (!net && !ks) return null;
  const until =
    key && key.until
      ? ks === "expiring"
        ? formatTimestamp(key.until, p.locale)
        : formatDate(key.until, p.locale)
      : null;
  const keyText =
    ks === "valid"
      ? until
        ? t.shell.keyValid.replace("{date}", until)
        : null
      : ks === "expiring"
        ? until
          ? t.shell.keyExpiring.replace("{date}", until)
          : null
        : ks === "missing"
          ? t.shell.keyMissing + ". " + t.shell.keyMissingDo
          : null;
  return (
    <div className="r1-public__field" role="status" aria-label={t.shell.fieldStatus}>
      {net ? (
        <p className={"r1-public__fielditem r1-public__fielditem--" + (net === "online" ? "positive" : "info")}>
          <Icon name={net === "online" ? "wifi" : "wifi-off"} size={20} className="r1-public__fieldicon" />
          <span>{t.shell[net]}</span>
        </p>
      ) : null}
      {ks && keyText ? (
        <p className={"r1-public__fielditem r1-public__fielditem--" + FIELD_KEY_FAMILY[ks]}>
          <StatusIcon family={FIELD_KEY_FAMILY[ks]} size={20} cutout="surface" />
          <span>{keyText}</span>
        </p>
      ) : null}
    </div>
  );
}

export type PublicShellProps = {
  /** the wordmark; default RightOne. RightOne ID for the identity pages */ brand?: string | undefined;
  /** false hides the language switch, for a product in one language */ langSwitch?: boolean | undefined;
  /** the shell takes the whole window height */ fill?: boolean | undefined;
  /** field: the inspector's field app at 390 and 320, a status strip under the bar, 44 px targets, the one contact link */ variant?:
    "standard" | "verification" | "field" | undefined;
  /** field: the phone's network */ network?: "online" | "offline" | undefined;
  /** field: the verification key the app checks codes with; until is an ISO date (valid) or timestamp (expiring) */ verificationKey?:
    | {
        state: "valid" | "expiring" | "missing";
        until?: string | undefined;
      }
    | undefined;
  maxWidth?: number | string | undefined;
  /** the sign-in page's address; given, the bar carries a sign-in link beside the language switch */ signIn?: string | undefined;
  links?:
    | {
        help?: string | undefined;
        privacy?: string | undefined;
        contact?: string | undefined;
        legal?: string | undefined;
      }
    | undefined;
  locale?: Locale | undefined;
  onLocale?: ((l: Locale) => void) | undefined;
  theme?: Theme | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function PublicShell(p: PublicShellProps) {
  const t = tx(p.locale);
  const mainId = useUid("r1-main");
  const field = p.variant === "field";
  const verification = p.variant === "verification" || field;
  const links = Object.assign({}, PUBLIC_LINKS, p.links || {});
  const foot: Array<keyof typeof PUBLIC_LINKS> = verification ? ["contact"] : ["help", "privacy", "contact", "legal"];
  const rootRef = useRef<HTMLDivElement>(null);
  const theme = useShellTheme(p, rootRef);
  return (
    <div
      ref={rootRef}
      className={cx("r1-shell r1-shell--public", field && "r1-shell--field", p.fill && "r1-shell--fill", p.className)}
      style={p.style}
      lang={lang(p.locale)}
      data-theme={theme.attr}
    >
      <SkipLink to={mainId} locale={p.locale} />
      <header className="r1-public__bar">
        <Mark name={p.brand} />
        {p.langSwitch === false && !p.signIn ? null : (
          <span className="r1-shell__switches">
            {p.signIn ? (
              <a className="r1-link r1-link--touch" href={p.signIn}>
                {t.shell.signIn}
              </a>
            ) : null}
            {p.langSwitch === false ? null : <LangToggle locale={p.locale} onChange={p.onLocale} />}
          </span>
        )}
      </header>
      {field ? fieldStrip(p, t) : null}
      <main
        id={mainId}
        tabIndex={-1}
        className="r1-public__main"
        style={p.maxWidth ? { maxWidth: p.maxWidth } : undefined}
      >
        {p.children}
      </main>
      {
        // A product with none of these pages passes them empty: no footer is drawn rather than an empty strip.
        (function () {
          const shown = foot.filter(function (k) {
            return links[k];
          });
          return shown.length ? (
            <footer className="r1-public__foot">
              {shown.map(function (k) {
                return (
                  <a key={k} className="r1-link" href={links[k]}>
                    {t.shell[k]}
                  </a>
                );
              })}
            </footer>
          ) : null;
        })()
      }
    </div>
  );
}
