"use client";

import { Icon } from "./Icon";
import { cx } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale, Provenance } from "./lib/types";

// words="plain": the words a premises reads about its own facts ("Bạn khai", "Theo sổ đăng ký"), in place of the
// officer's terms ("Tự khai", "Từ sổ đăng ký").
// alternative-route: taken from a route other than the authoritative source (a licence list); detail names the route.
// manual-override: an authorised person overrode the value; detail names the authority (MEMO-2026-0131).
// The six DAT data classes (7 October 2026): authoritative, declared, derived, estimated, imputed and illustrative, each
// with its own word and shape. declared and derived are the kinds above; the chip stays neutral for every class, since
// a class says where a figure comes from, never whether it is good or bad.
const PROV_ICON = {
  "registry-sourced": "database",
  declared: "user",
  evidenced: "file-check",
  corrected: "history",
  derived: "route",
  "alternative-route": "arrow-right-left",
  "manual-override": "scale",
  authoritative: "shield-check",
  estimated: "approximately-equal",
  imputed: "circle-dashed",
  illustrative: "image",
};

export type ProvenanceChipProps = {
  kind: Provenance;
  detail?: string | undefined;
  words?: "default" | "plain" | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
};

export function ProvenanceChip(p: ProvenanceChipProps) {
  const t = tx(p.locale);
  const kind = p.kind || "declared";
  const icon = PROV_ICON[kind] || "user";
  const words = p.words === "plain" ? t.provPlain : t.prov;
  return (
    <span className={cx("r1-prov", "r1-prov--" + kind, p.className)}>
      <Icon name={icon} size={16} />
      <span className="r1-sr">{t.provSource + " "}</span>
      <span className="r1-prov__kind">{words[kind] || t.prov[kind] || kind}</span>
      {p.detail ? <span className="r1-prov__detail">{p.detail}</span> : null}
    </span>
  );
}
