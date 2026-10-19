"use client";

import type * as React from "react";
import { StatusBadge } from "./StatusBadge";
import { keepRefs } from "./lib/button";
import { cx, textOf } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale, StatusValue } from "./lib/types";

export type PageHeaderProps = {
  crumbs?: { label: string; href?: string | undefined }[] | undefined;
  eyebrow?: string | undefined;
  title: React.ReactNode;
  status?: StatusValue | undefined;
  meta?: React.ReactNode | undefined;
  size?: "public" | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// Crumbs are a nav with an ordered list; the page itself closes the list for screen readers, marked current,
// since the title below already shows it.
export function PageHeader(p: PageHeaderProps) {
  const t = tx(p.locale);
  const crumbs = p.crumbs || [];
  const here = textOf(p.title);
  return (
    <header className={cx("r1-pagehead", p.className)} style={p.style}>
      {crumbs.length || p.eyebrow ? (
        <div className="r1-pagehead__eyebrow">
          {crumbs.length ? (
            <nav className="r1-pagehead__crumbs" aria-label={t.layout.crumbs}>
              <ol>
                {crumbs.map(function (c, i) {
                  const last = i === crumbs.length - 1 && !p.eyebrow;
                  return (
                    <li key={i}>
                      {c.href ? (
                        <a className="r1-link" href={c.href}>
                          {c.label}
                        </a>
                      ) : (
                        <span>{c.label}</span>
                      )}
                      {last ? null : (
                        <span className="r1-pagehead__sep" aria-hidden="true">
                          /
                        </span>
                      )}
                    </li>
                  );
                })}
                {here ? (
                  <li className="r1-sr" aria-current="page">
                    {here}
                  </li>
                ) : null}
              </ol>
            </nav>
          ) : null}
          {p.eyebrow ? <p className="r1-pagehead__kicker">{p.eyebrow}</p> : null}
        </div>
      ) : null}
      <div className="r1-pagehead__row">
        <div className="r1-pagehead__titles">
          <div className="r1-pagehead__titleline">
            <h1 className={cx("r1-pagehead__title", p.size === "public" && "r1-pagehead__title--public")}>
              {keepRefs(p.title)}
            </h1>
            {p.status ? (
              <StatusBadge
                family={p.status.family}
                label={p.status.label}
                icon={p.status.icon}
                variant={p.status.variant}
                working={p.status.working}
                size="md"
                locale={p.locale}
              />
            ) : null}
          </div>
          {p.meta ? <p className="r1-pagehead__meta">{p.meta}</p> : null}
        </div>
        {p.children ? <div className="r1-pagehead__actions">{p.children}</div> : null}
      </div>
    </header>
  );
}
