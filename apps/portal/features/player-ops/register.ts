import type { CertificationRegisterView, CertificationRow, RegisterFilter } from "@/lib/api/player";
import type { Locale, Translate } from "@/lib/i18n/translate";
import type { Route } from "next";
import { certificationStatus, count, day } from "./copy";

/**
 * SCR-PLR-10's register as both its surfaces draw it, the public page and the evidence console: the columns, a row
 * per application with what its outcome rests on, and the segments that show one part of it.
 */
export function registerColumns(t: Translate) {
  return [
    { key: "sup", label: t("plr10.cSupplier"), kind: "strong" as const },
    { key: "v", label: t("plr10.cCriteria"), nowrap: true },
    { key: "s", label: t("plr10.cOutcome"), kind: "status" as const },
    { key: "d", label: t("plr10.cValidity") },
  ];
}

/** What the outcome rests on: the end of a certification, the day it was lodged, the criterion a refusal names. */
function ground(row: CertificationRow, months: number, t: Translate, locale: Locale): string {
  switch (row.status) {
    case "CERTIFIED":
      return t("plr10.until", { d: day(row.validTo ?? "", locale) });
    case "REFUSED":
      return t("plr10.refused", { c: row.criterion ?? "", d: day(row.decidedOn ?? "", locale) });
    case "EXPIRED":
      return t("plr10.expired", { d: day(row.validTo ?? "", locale), m: count(months, locale), v: row.version });
    case "WITHDRAWN":
      return t("plr10.withdrawn", { d: day(row.decidedOn ?? "", locale) });
    default:
      return t("plr10.lodged", { d: day(row.lodgedOn, locale) });
  }
}

export function registerRow(row: CertificationRow, validity: Readonly<Record<number, number>>, t: Translate, locale: Locale): Record<string, unknown> {
  return {
    _key: row.id,
    sup: row.supplier,
    v: t("plr10.version", { n: row.version }),
    s: certificationStatus(row.status, t),
    d: ground(row, validity[row.version] ?? 0, t, locale),
  };
}

export function registerSegments(data: CertificationRegisterView, hrefFor: (segment: RegisterFilter) => Route, t: Translate) {
  const filters: readonly RegisterFilter[] = ["all", "certified", "open", "closed"];
  return filters.map((filter) => ({ value: filter, label: t(`plr10.seg.${filter}`), count: data.counts[filter], href: hrefFor(filter) }));
}
