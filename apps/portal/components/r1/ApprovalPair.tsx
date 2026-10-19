"use client";

import type * as React from "react";
import { Banner } from "./Banner";
import { DateValue } from "./DateValue";
import { StatusIcon } from "./StatusIcon";
import { cx } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Family, Locale, Person } from "./lib/types";

// The decision is written in words beside its status shape; the approver's comment follows it in the approver's card.
// While nobody has approved, awaiting names who acts next. The same person in both places is refused in a Banner:
// sameActor={ code, text, family } carries the code the service returned, the family catalogue's sentence and the
// family the rule deserves; sameActor={true} keeps SOD_PREPARER_IS_APPROVER, the built-in sentence and danger.
// sameActor.title: a refusal of two sentences is split as a Banner splits it, the first as the title with the code
// on its line, the second as the text under it.
// declined: the approver considered the proposal and left things as they were (an entitlement left in place), an
// ordinary outcome in the neutral family, never danger. preparerLabel and approverLabel rename the two roles for a
// family that says "Người đề xuất" / "Proposer"; with approverLabel the comment is headed "Nhận xét" / "Comment".
const APPROVAL_FAMILY: Record<string, Family> = {
  approved: "positive",
  rejected: "danger",
  returned: "attention",
  declined: "neutral",
};

export type ApprovalPairProps = {
  preparer: Person;
  approver: Person | null;
  /** approver null: who acts next, in words, instead of "Chưa có người duyệt" */ awaiting?: string | undefined;
  /** the approver's decision, in words with its status shape; declined is left unchanged, neutral */ decision?:
    "approved" | "rejected" | "returned" | "declined" | undefined;
  /** the names of the two roles; default Người lập / Preparer and Người duyệt / Approver. With approverLabel the comment is headed Nhận xét / Comment */ preparerLabel?:
    string | undefined;
  approverLabel?: string | undefined;
  /** the approver's comment, under the decision */ comment?: string | undefined;
  /** true: SOD_PREPARER_IS_APPROVER, the built-in sentence, danger; or the refusal the family catalogue gives. title (opt-in): a two-sentence refusal split as a Banner splits it, the first sentence as the title with the code on its line, the second as text; level is the title's heading level, 3 by default */ sameActor?:
    | boolean
    | {
        code?: string | undefined;
        title?: string | undefined;
        text?: string | undefined;
        family?: Family | undefined;
        level?: 2 | 3 | 4 | 5 | 6 | undefined;
      }
    | undefined;
  /** the refusal code for sameActor={true}; default SOD_PREPARER_IS_APPROVER */ code?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

export function ApprovalPair(p: ApprovalPairProps) {
  const t = tx(p.locale);
  function card(role: string, person: Person | null, empty: string, extra?: React.ReactNode) {
    return (
      <div className="r1-approval__card">
        <p className="r1-approval__role">{role}</p>
        {person ? (
          <>
            <p className="r1-strong">{person.name}</p>
            {person.role ? <p className="r1-muted">{person.role}</p> : null}
            {person.at ? (
              <p className="r1-muted">
                <DateValue value={person.at} mode="timestamp" locale={p.locale} />
              </p>
            ) : null}
            {extra}
          </>
        ) : (
          <p className="r1-muted">{empty}</p>
        )}
      </div>
    );
  }
  const family = p.approver && APPROVAL_FAMILY[String(p.decision)];
  const decided = family ? (
    <>
      <p className={"r1-approval__decision r1-approval__decision--" + p.decision}>
        <StatusIcon family={family} size={16} cutout="surface" />
        <span>{t.approval.decision[p.decision!]}</span>
      </p>
      {p.comment ? (
        <div className="r1-approval__comment">
          <p className="r1-approval__role">{p.approverLabel ? t.approval.commentShort : t.approval.comment}</p>
          <p>{p.comment}</p>
        </div>
      ) : null}
    </>
  ) : null;
  const same = p.sameActor && typeof p.sameActor === "object" ? p.sameActor : {};
  return (
    <div className={cx("r1-approval", p.className)} style={p.style}>
      <div className="r1-approval__pair">
        {card(p.preparerLabel || t.approval.preparer, p.preparer, t.approval.noPreparer)}
        {card(p.approverLabel || t.approval.approver, p.approver, p.awaiting || t.approval.awaiting, decided)}
      </div>
      {p.sameActor ? (
        <Banner
          family={same.family || "danger"}
          compact={true}
          code={same.code || p.code || "SOD_PREPARER_IS_APPROVER"}
          locale={p.locale}
          title={same.title || undefined}
          level={same.title ? same.level || 3 : undefined}
        >
          {same.title && !same.text ? null : same.text || t.approval.same}
        </Banner>
      ) : null}
    </div>
  );
}
