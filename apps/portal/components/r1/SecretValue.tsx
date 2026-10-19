"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { StatusLine } from "./StatusLine";
import { formatCount } from "./lib/formatting";
import { announce, cx, isNil, useUid } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

export type SecretValueProps = {
  label?: string | undefined;
  value?: string | undefined;
  values?: string[] | undefined;
  copyLabel?: string | undefined;
  note?: string | undefined;
  /** false drops the not-shown-again sentence */ once?: boolean | undefined;
  density?: "console" | "portal" | undefined;
  /** lg: the value at text-xl, for a code read aloud or typed from the screen */ size?: "md" | "lg" | undefined;
  /** the value in groups that never break inside, and spoken character by character */ spell?: boolean | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// A secret shown once: a personal token, an agent's credential, recovery codes, a client secret, a short-lived token.
// The value in full and wrapping, in monospace; one copy control; and the sentence that it will not be shown again.
// values (a list, such as recovery codes) draws them in two columns with one control that copies them all.
export function SecretValue(p: SecretValueProps) {
  const t = tx(p.locale);
  const st = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    boxRef = useRef<HTMLElement>(null);
  const labelId = useUid("r1-secret");
  useEffect(function () {
    return function () {
      clearTimeout(timer.current);
    };
  }, []);
  const values = (p.values || (isNil(p.value) ? [] : [p.value])).map(String);
  const many = values.length > 1;
  const spell = !!p.spell;
  function show(next: "copied" | "failed") {
    st[1](next);
    clearTimeout(timer.current);
    timer.current = setTimeout(
      function () {
        st[1]("idle");
      },
      next === "failed" ? 6000 : 1600,
    );
  }
  function copied() {
    show("copied");
    announce(t.secret.copied);
  }
  function selectValue() {
    try {
      const r = document.createRange();
      r.selectNodeContents(boxRef.current!);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(r);
      return sel;
    } catch {
      return null;
    }
  }
  function legacyCopy() {
    // A spelled value carries its spoken form in the box, so the fallback copies the value from a field off screen.
    if (spell) {
      const ta = document.createElement("textarea");
      let done = false;
      ta.value = values.join("\n");
      ta.setAttribute("readonly", "");
      ta.className = "r1-sr";
      document.body.appendChild(ta);
      try {
        ta.select();
        done = document.execCommand("copy");
      } catch {
        done = false;
      }
      document.body.removeChild(ta);
      return done;
    }
    const sel = selectValue();
    let ok = false;
    try {
      ok = !!sel && document.execCommand("copy");
    } catch {
      ok = false;
    }
    if (ok && sel) sel.removeAllRanges();
    return ok;
  }
  // A copy the browser refuses is said, and the value is left selected for the reader to copy.
  function failed() {
    selectValue();
    show("failed");
    announce(t.copyFailed);
  }
  function onCopy() {
    const c = typeof navigator !== "undefined" ? navigator.clipboard : null;
    if (c && c.writeText) {
      try {
        c.writeText(values.join("\n")).then(copied, function () {
          if (legacyCopy()) copied();
          else failed();
        });
        return;
      } catch {
        /* fall through */
      }
    }
    if (legacyCopy()) copied();
    else failed();
  }
  const label =
    st[0] === "copied"
      ? t.secret.copied
      : many
        ? t.secret.copyAll.replace("{n}", formatCount(values.length, p.locale)!)
        : p.copyLabel || t.secret.copy;
  // spell: a code read aloud or typed from the screen (a recovery code, a pairing code). The value is drawn in groups
  // (at its own separators, else every four characters) and a line breaks only between two groups; a screen reader
  // hears the characters one by one, a pause between groups. The copy and the selection are the value as it is.
  function spelled(v: string, i: number) {
    // A value with its own separators keeps them as the gap between groups; one without is cut every four
    // characters, and the groups stand space-2 apart.
    const own = /[\s\-./_:]/.test(v);
    const groups = own ? v.match(/[^\s\-./_:]+[\s\-./_:]*/g) || [v] : v.match(/.{1,4}/g) || [v];
    const said = groups
      .map(function (g) {
        return g
          .replace(/[\s\-./_:]+$/, "")
          .split("")
          .join(" ");
      })
      .join(", ");
    const parts: React.ReactNode[] = [];
    groups.forEach(function (g, k) {
      if (k) parts.push(<wbr key={"w" + k} />);
      parts.push(
        <span key={"g" + k} className={cx("r1-secret__group", !own && "r1-secret__group--gap")}>
          {g}
        </span>,
      );
    });
    return [
      <span key={"v" + i} className="r1-secret__spell" aria-hidden="true">
        {parts}
      </span>,
      <span key={"s" + i} className="r1-sr r1-secret__said">
        {said}
      </span>,
    ];
  }
  return (
    <div
      className={cx("r1-secret", p.size === "lg" && "r1-secret--lg", spell && "r1-secret--spell", p.className)}
      style={p.style}
    >
      {p.label ? (
        <p id={labelId} className="r1-secret__label">
          {p.label}
        </p>
      ) : null}
      <div className="r1-secret__box">
        {many ? (
          <ol
            ref={boxRef as React.Ref<HTMLOListElement>}
            className="r1-secret__list"
            aria-labelledby={p.label ? labelId : undefined}
          >
            {values.map(function (v, i) {
              return <li key={i}>{spell ? spelled(v, i) : v}</li>;
            })}
          </ol>
        ) : (
          <code ref={boxRef} className="r1-secret__value" tabIndex={0} aria-labelledby={p.label ? labelId : undefined}>
            {spell ? spelled(values[0] || "", 0) : values[0] || ""}
          </code>
        )}
        <Button
          variant="secondary"
          size={p.density === "console" ? "sm" : undefined}
          icon={st[0] === "copied" ? "check" : "copy"}
          onClick={onCopy}
          locale={p.locale}
        >
          {label}
        </Button>
      </div>
      {st[0] === "failed" ? <p className="r1-secret__msg">{t.copyFailedShort}</p> : null}
      {p.once === false ? null : (
        <StatusLine family="attention" text={p.note || t.secret.once} live={false} locale={p.locale} />
      )}
    </div>
  );
}
