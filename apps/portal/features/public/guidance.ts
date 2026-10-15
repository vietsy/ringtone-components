import { R1_FORMAT } from "@rightone/formatting";
import type { AssumedPremises, ClassificationPath, ExemptionTested, SizeBand } from "@/lib/api/public";
import type { Locale, Translate } from "@/lib/i18n/translate";

/**
 * The sentences of a guidance answer (SCR-PUB-02, SCR-PUB-03), written from the answer's data: the facts it
 * was worked out from, how the tariff classified them, and the exemptions it tested. Each is the canvas's
 * sentence for its example; another answer fills the same sentence with its own values.
 */

const count = (value: number, locale: Locale) => R1_FORMAT.formatCount(value, locale) ?? "-";

/** "Theo khai báo của bạn": the facts in one line, each question left unanswered said as such. */
export function assumedLine(assumed: AssumedPremises, t: Translate, locale: Locale): string {
  return t("pub.assumed", {
    premisesClass: assumed.premisesClass !== null ? t(`pub.class.${assumed.premisesClass}`) : t("pub.classNone"),
    area: assumed.adminArea !== null ? t(`pub.area.${assumed.adminArea}`) : t("pub.areaNone"),
    floor: t("pub.floorValue", { floor: count(assumed.floorAreaM2, locale) }),
    seats: assumed.seats !== null ? t("pub.seatsValue", { seats: count(assumed.seats, locale) }) : t("pub.seatsNone"),
  });
}

/**
 * A floor-area band in words. `prefix` is the catalogue's set: "pub.band" reads "from 50 to under 200 m²" in a
 * sentence (SCR-PUB-02), "pub03.band" reads "50 to under 200 m²" in a breakdown line (SCR-PUB-03).
 */
export function bandWords(band: SizeBand, prefix: "pub.band" | "pub03.band", t: Translate, locale: Locale): string {
  if (band.toM2 === null) return t(`${prefix}.over`, { from: count(band.fromM2, locale) });
  if (band.fromM2 === 0) return t(`${prefix}.under`, { to: count(band.toM2, locale) });
  return t(`${prefix}.between`, { from: count(band.fromM2, locale), to: count(band.toM2, locale) });
}

/**
 * "Căn cứ" of an answer. In scope: the class, the area's locality class and the floor-area band. Not
 * determined: each class kind the tariff could not classify, named, which is what decided it.
 */
export function basisLine(basis: ClassificationPath, tariffVersion: string | null, t: Translate, locale: Locale): string {
  if (basis.unclassified.length === 0 && basis.premisesClass !== null && basis.adminArea !== null && basis.localityClass !== null) {
    return t("pub02.basis", {
      premisesClass: t(`pub.class.${basis.premisesClass}`),
      area: t(`pub.area.${basis.adminArea}`),
      class: count(basis.localityClass, locale),
      band: bandWords(basis.band, "pub.band", t, locale),
    });
  }
  const reasons = basis.unclassified.map((kind) =>
    kind === "PREMISES_CLASS"
      ? t("pub02.noClass")
      : basis.adminArea === null
        ? t("pub02.noArea")
        : t("pub02.areaUnclassed", { area: t(`pub.area.${basis.adminArea}`), version: tariffVersion ?? "-" }),
  );
  return reasons.length === 2 ? t("pub02.reasons", { first: reasons[0] ?? "", second: reasons[1] ?? "" }) : (reasons[0] ?? "-");
}

/** "Quán cà phê, khu vực 1, 50 đến dưới 200 m²": the basis of a component line of the breakdown. */
export function componentBasis(basis: ClassificationPath, t: Translate, locale: Locale): string {
  return t("pub03.basisLine", {
    premisesClass: basis.premisesClass !== null ? t(`pub03.class.${basis.premisesClass}`) : t("pub.classNone"),
    class: basis.localityClass !== null ? count(basis.localityClass, locale) : "-",
    band: bandWords(basis.band, "pub03.band", t, locale),
  });
}

/**
 * "Miễn đã xét": whether each exemption applies, and why. Not applied, the first criterion not met is the
 * reason; a seating capacity left unanswered cannot meet its criterion.
 */
export function exemptionLines(exemptions: readonly ExemptionTested[], t: Translate, locale: Locale): string {
  return exemptions
    .map((exemption) => {
      const floor = exemption.criteria.find((c) => c.fact === "FLOOR_AREA_M2");
      const seats = exemption.criteria.find((c) => c.fact === "SEATING_CAPACITY");
      if (exemption.applied) {
        return t("pub.exemptApplied", { floor: count(floor?.atMost ?? 0, locale), seats: count(seats?.atMost ?? 0, locale) });
      }
      if (floor !== undefined && !floor.met) return t("pub.exempt", { limit: count(floor.atMost, locale) });
      if (seats !== undefined && seats.value === null) return t("pub.exemptNoSeats");
      return t("pub.exemptSeats", { limit: count(seats?.atMost ?? 0, locale) });
    })
    .join(" ");
}
