"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { formatDate } from "./lib/formatting";
import { cx, lang, textOf, useLatest } from "./lib/helpers";
import { tx } from "./lib/strings";
import { keepTogether } from "./lib/value-atoms";
import type { Locale } from "./lib/types";

export type LegalTextViewerProps = {
  title: string;
  version?: string | undefined;
  effective?: string | undefined;
  sections: { id: string; heading: string; body: string | string[] }[];
  progress?: number | undefined;
  showProgress?: boolean | undefined;
  height?: number | undefined;
  onReachEnd?: (() => void) | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Progress is measured from the reader's scrolling and never goes back; onReachEnd fires once, when the
// end of the text has been on screen. Text that fits without scrolling counts as read to the end.
export function LegalTextViewer(p: LegalTextViewerProps) {
  const t = tx(p.locale);
  const sections = p.sections || [];
  const pr = useState(Math.max(0, Math.min(100, p.progress || 0)));
  const progress = pr[0];
  const boxRef = useRef<HTMLDivElement>(null);
  const ended = useRef(false);
  const latest = useLatest(p);
  const showProgress = p.showProgress !== false;
  function measure() {
    const el = boxRef.current;
    if (!el) return;
    const room = el.scrollHeight - el.clientHeight;
    const pct = room <= 1 || el.scrollTop >= room - 4 ? 100 : Math.round((el.scrollTop / room) * 100);
    pr[1](function (v) {
      return Math.max(v, pct);
    });
    if (pct >= 100 && !ended.current) {
      ended.current = true;
      if (latest.current.onReachEnd) latest.current.onReachEnd();
    }
  }
  useEffect(measure, []);
  return (
    <article className={cx("r1-legal", p.className)} style={p.style}>
      <header className="r1-legal__head">
        <h2 className="r1-legal__title">{p.title}</h2>
        <p className="r1-legal__meta">
          {[
            p.version ? t.legal.version + " " + p.version : null,
            p.effective
              ? t.legal.effective.charAt(0).toLowerCase() +
                t.legal.effective.slice(1) +
                " " +
                keepTogether(formatDate(p.effective, p.locale) || String(p.effective))
              : null,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
        {showProgress ? (
          <div
            className="r1-meter"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t.legal.read}
          >
            <span className="r1-meter__fill" style={{ width: progress + "%" }} />
          </div>
        ) : null}
        {showProgress ? (
          <p className="r1-legal__meta">
            {t.legal.read + " " + progress + (lang(p.locale) === "en" ? "%" : "\u00a0%")}
          </p>
        ) : null}
      </header>
      <div className="r1-legal__cols">
        <nav className="r1-legal__toc" aria-label={t.legal.contents}>
          <p className="r1-legal__toc-title">{t.legal.contents}</p>
          <ol>
            {sections.map(function (s, i) {
              return (
                <li key={i}>
                  <a className="r1-link" href={"#" + s.id}>
                    {s.heading}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
        <div
          ref={boxRef}
          className={cx("r1-legal__text", p.height && "r1-legal__text--scroll")}
          role="region"
          aria-label={textOf(p.title)}
          tabIndex={0}
          onScroll={measure}
          style={p.height ? { maxHeight: p.height } : undefined}
        >
          {sections.map(function (s, i) {
            return (
              <section key={i} id={s.id}>
                <h3>{s.heading}</h3>
                {(Array.isArray(s.body) ? s.body : [s.body]).map(function (b, j) {
                  return <p key={j}>{b}</p>;
                })}
              </section>
            );
          })}
        </div>
      </div>
    </article>
  );
}
