"use client";

import type * as React from "react";
import { createElement } from "react";
import { FactList } from "./FactList";
import { Icon } from "./Icon";
import { StatusIcon } from "./StatusIcon";
import { keepRefs } from "./lib/button";
import { formatTimestamp } from "./lib/formatting";
import { cx, nounText } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { CellKind, Family, Locale } from "./lib/types";

const VERIFY_FAMILY: Record<string, Family | "seal"> = {
  valid: "seal",
  revoked: "danger",
  expired: "neutral",
  superseded: "attention",
  "not-found": "neutral",
  unavailable: "info",
  checking: "info",
};

// danger (7 October 2026): a service suspended or revoked; attention: a record no longer current.
const ANSWER_FAMILIES: VerificationResultProps["family"][] = ["positive", "attention", "neutral", "danger"];

export type VerificationResultProps = {
  /** checking: the register is being asked; answer: a register's answer that is no verdict on a status record */ result:
    "checking" | "valid" | "revoked" | "expired" | "superseded" | "not-found" | "unavailable" | "answer";
  /** required with answer: the answer itself */ title?: string | undefined;
  /** with answer: the shape and its colour, never the seal; attention for a record no longer current, danger for a service suspended or revoked */ family?:
    "positive" | "attention" | "neutral" | "danger" | undefined;
  /** with answer: when the read was recorded, written after recordedLabel (default Ghi nhận lúc / Recorded at) */ recordedAt?:
    string | undefined;
  recordedLabel?: string | undefined;
  recordId?: string | undefined;
  facts?: { label: string; value: unknown; kind?: CellKind | undefined }[] | undefined;
  checkedAt?: string | undefined;
  /** replaces "Kiểm tra lúc" / "Checked at" before checkedAt */ checkedLabel?: string | undefined;
  /** what the code stands for, put into every default verdict ("Giấy xác nhận hợp lệ…" / "This status record is valid…"); without it the verdict speaks of the code */ recordNoun?:
    string | undefined;
  level?: 1 | 2 | undefined;
  locale?: Locale | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// The verdict words by result, with and without the record's noun; an answer has none of its own.
type VerdictWords = Partial<Record<VerificationResultProps["result"], string>>;

// The answer to "is this record genuine and current?" on the public verification route.
// result 'answer': a register's answer that is no verdict on a status record (an authority to collect, for one
// premises at one moment). family is positive, attention or neutral, never the seal: the seal answers for a premises
// status record only. title is the answer, in the verdict's type; recordedAt is written after recordedLabel, the
// page's own words ("This read has been recorded. Asked at").
export function VerificationResult(p: VerificationResultProps) {
  const t = tx(p.locale).verify;
  const said: VerdictWords = t,
    saidOf: VerdictWords = t.noun;
  const r = p.result || "valid";
  const checking = r === "checking";
  const answer = r === "answer";
  const fam = answer ? (ANSWER_FAMILIES.indexOf(p.family) >= 0 ? p.family : "neutral") : null;
  // recordNoun names what the code stands for in every default verdict ("Giấy xác nhận hợp lệ…"); without it the
  // verdict speaks of the code ("Mã này hợp lệ…"). checkedLabel replaces "Kiểm tra lúc" / "Checked at".
  const noun = p.recordNoun ? String(p.recordNoun) : null;
  const verdict = said[r] ? nounText(said[r], saidOf[r] || said[r], noun) : null;
  const when =
    answer && p.recordedAt ? (
      <p className="r1-verify__checked">
        {(p.recordedLabel || t.recordedAt) + " " + formatTimestamp(p.recordedAt, p.locale)}
      </p>
    ) : p.checkedAt && !checking ? (
      <p className="r1-verify__checked">
        {(p.checkedLabel || t.checkedAt) + " " + formatTimestamp(p.checkedAt, p.locale)}
      </p>
    ) : null;
  // checking: the register is being asked. The verdict line says so and the shape turns; nothing is concluded yet.
  return (
    <section
      className={cx("r1-verify", "r1-verify--" + r, fam && "r1-verify--answer-" + fam, p.className)}
      role="status"
      aria-busy={checking ? "true" : undefined}
      style={p.style}
    >
      <div className="r1-verify__head">
        {checking ? (
          <span className="r1-verify__spin">
            <Icon name="loader-circle" size={32} spin={true} />
          </span>
        ) : (
          <StatusIcon family={fam || VERIFY_FAMILY[r] || "neutral"} size={32} cutout="surface" />
        )}
        <div className="r1-verify__titles">
          {createElement(
            p.level === 1 ? "h1" : "h2",
            { className: "r1-verify__title" },
            answer ? keepRefs(p.title) : p.title || verdict,
          )}
          {p.recordId ? (
            <p className="r1-verify__id">
              <span>{t.code + " "}</span>
              <span className="r1-mono">{p.recordId}</span>
            </p>
          ) : null}
        </div>
      </div>
      {p.children ? <div className="r1-verify__text">{p.children}</div> : null}
      {p.facts && !checking ? <FactList items={p.facts} locale={p.locale} /> : null}
      {when}
    </section>
  );
}
