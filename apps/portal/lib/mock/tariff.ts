import type { LoadOutcome } from "@rightone/ui";
import type { AdminArea } from "@/lib/api/public";
import type { FactAnswers } from "@/lib/api/registration";
import type { TransitionRule } from "@/lib/api/tariff";
import { TARIFF_VERSIONS } from "./public";

/**
 * TAR's sample data. No board draws a tariff screen: SCR-TAR-08, 09, 12, 13 and 14 are built from the family's
 * `03-screen-specifications.md` and `02-wireframes.md`, and their data is what the other families already hold. A
 * calculation answers each obligation decision REG holds and the Sala draft's review (SCR-REG-05), with the amounts
 * those record; the content a new calculation is worked out under is the one the public pages state (`public.ts`,
 * `TARIFF_VERSIONS`), so the public guidance and a premises' fee come from one tariff.
 *
 * The canvas's decisions keep the amounts the canvas drew. They are not the product of TV-2026.1's base amount, shares
 * and factors (a café of that size comes to 4,554,000 VND there), so a calculation read from one of them records each
 * layer's amount and treatment, and no share or factor that would claim to produce it. A fee worked out in the world
 * (a review, a submission, an officer's outcome) is the calculator's, with every share and factor it applied.
 */

/** The version every canvas decision names, and what of its content the public pages write. */
const TV_2026_1 = TARIFF_VERSIONS.find((version) => version.version === "TV-2026.1")?.content ?? null;
if (TV_2026_1 === null) throw new Error("TV-2026.1's content is written on the public pages");

/**
 * The province an administrative area lies in, by the area key the content assigns a locality class to. REG's register
 * writes an area as "Phường An Khánh, TP. Hồ Chí Minh", the public form as the key itself.
 */
export const PROVINCE_KEYS: readonly { name: string; key: AdminArea }[] = [
  { name: "TP. Hồ Chí Minh", key: "hcm" },
  { name: "Hà Nội", key: "hn" },
  { name: "Đà Nẵng", key: "dn" },
  { name: "Cần Thơ", key: "ct" },
  { name: "Huế", key: "hue" },
];

/** The area key of an administrative area as REG's register or the public form writes it; null when it names no province. */
export function areaKeyOf(area: string): AdminArea | null {
  const named = PROVINCE_KEYS.find((province) => province.key === area || area === province.name || area.endsWith(`, ${province.name}`));
  return named?.key ?? null;
}

export const TARIFF = {
  version: "2026.1",
  capMinor: TV_2026_1.capMinor,
  roundingUnitMinor: TV_2026_1.roundingUnitMinor,
  /** The locality class TV-2026.1 gives an area: Hồ Chí Minh City is class 1 (SCR-PUB-02), and it writes no other. */
  localityClass: (area: string): number | null => {
    const key = areaKeyOf(area);
    return key !== null ? (TV_2026_1.localityOf[key] ?? null) : null;
  },
} as const;

/**
 * The version a REG decision of the canvas names, as the public pages name it: REG writes "2026.1" where SCR-PUB-11
 * writes TV-2026.1, the same approved version.
 */
export const versionNamed = (name: string): string => (name.startsWith("TV-") ? name : `TV-${name}`);

/**
 * Each version's transition rule (`DEC-04`, `transition_rule`): TV-2026.1 takes a change from the first day of the
 * next month, as SCR-PUB-03 states for the period an indicative amount covers.
 */
export const TRANSITION_RULES: Readonly<Record<string, TransitionRule>> = { "TV-2026.1": "FROM_NEXT_MONTH" };

/**
 * `TAR-CHANGE-REPORT-PERIOD` (`CFG-360`): no version is approved, so the tested default of thirty calendar days from
 * the day the change occurred applies (`Q-TAR-03`). A version approved later is added here with its effective date.
 */
export const CHANGE_REPORT_PERIODS: readonly { id: string; from: string; days: number }[] = [];
export const CHANGE_REPORT_DEFAULT_DAYS = 30;

/**
 * The Sala draft's review on SCR-REG-05, worked out at 10:14 on 1 October 2026 for the answers SCR-REG-03 draws: the
 * year from 1 October, producers' rights still charged while the non-use claim is reviewed.
 */
export const SALA_REVIEW_CALCULATION = {
  application: "REG-P5TJ4BXC7M",
  premisesId: "sala",
  workedOutAt: "2026-10-01T10:14:00+07:00",
  decisionDate: "2026-10-01",
  answers: { premisesClass: null, customerArea: 64, daysOpen: 7, musicMethod: "speakers", useBeganOn: "2026-08-03" } satisfies FactAnswers,
  lines: { AUTHORS: 742000, PERFORMERS: 322000, PRODUCERS: 322000 },
  claimPendingOn: "PRODUCERS",
} as const;

/** The review states the specification names that the live data never reaches: our outage, by screen. */
export const TAR_VIEWS = ["loading", "error"] as const;
export type TarView = (typeof TAR_VIEWS)[number];

/** Each tariff screen's outage, with a trace identifier of its own. */
export function mockTariffFailure(screen: "tar08" | "tar09" | "tar12" | "tar13" | "tar14"): LoadOutcome<never> {
  const trace = { tar08: "7a3c5e91d02b64f8", tar09: "c41e8b07f95a2d36", tar12: "2f9d64a1e07c8b53", tar13: "b8e20c4f5d17a963", tar14: "6d05f3a9c28e71b4" }[screen];
  return { data: null, failure: { code: "INTERNAL_ERROR", traceId: trace, retryable: true } };
}
