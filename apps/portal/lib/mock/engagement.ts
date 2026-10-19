import type { LoadOutcome } from "@rightone/ui";
import type { MetricCode, Party, RuleAction } from "@/lib/api/engagement";
import type { StaffRole } from "./backend/store";
import { MOCK_ARTIST } from "./session";

/**
 * ENG's sample data. No board and no Figma frame draws an engagement screen: SCR-ENG-01 to 04 and 06 to 13 are built
 * from the family's `03-screen-specifications.md` and `02-wireframes.md`, and the seed is what the family's migrations
 * load and nothing more, because the capability has never been released (`SM-52` starts at `WITHHELD`): award rule
 * version 1 with the three values `BR-ENG-04` settles (`MIG-ENG-04`), disclosure version 1 and the two metric
 * definitions (`MIG-ENG-03`). No participation, ledger event, correction or snapshot exists until somebody acts.
 *
 * The migrations ran on 1 September 2026, in this world's calendar, so version 1 governs an action of today. The
 * wireframes' dates (2027) belong to the gate `CG-ENG` is planned for, not to this world.
 */

/** When `MIG-ENG-03` and `MIG-ENG-04` loaded their rows, and `CFG-65`'s correction treatment took effect. */
export const MIGRATED_AT = "2026-09-01T00:00:00+07:00";

/** The actors a migration row names: the migration itself, never a person. */
export const RULE_MIGRATION = "MIG-ENG-04";
export const DISCLOSURE_MIGRATION = "MIG-ENG-03";

/** `CFG-60`'s safe default: three actions for the artist class, no premises-class action, no referral programme. */
export const VERSION_ONE_ACTIONS: readonly RuleAction[] = [
  { code: "ONBOARDING_COMPLETED", value: 20, participantClass: "artist" },
  { code: "TRACK_PUBLISHED", value: 50, participantClass: "artist" },
  { code: "PROFILE_COMPLETED", value: 10, participantClass: "artist" },
];

/**
 * Disclosure version 1, the interim treatment `BR-ENG-05` fixes, in both languages: the English is SCR-ENG-03's
 * wireframe, word for word; the Vietnamese says the same in one paragraph, as `frd/06` requires of each.
 */
export const DISCLOSURE_ONE = {
  textEn:
    "Your points confer no entitlement. They cannot be exchanged for money, a fee reduction, a right, a licence, a certificate, a status or a compliance outcome. They do not expire. What a point may be worth is reserved to decision DEC-30, which has not been approved.",
  textVi:
    "Điểm của bạn không đem lại quyền lợi nào. Điểm không đổi được thành tiền, khoản giảm phí, quyền, giấy phép, giấy xác nhận, tình trạng hay kết quả tuân thủ nào. Điểm không hết hạn. Giá trị của một điểm, nếu có, được dành cho quyết định DEC-30, quyết định này chưa được phê duyệt.",
  reservingDecision: "DEC-30",
} as const;

/** `CFG-63`'s two definitions, owned by the Reporting owner (`ACT-REP`), as `MIG-ENG-03` loads them. */
export const METRIC_DEFINITIONS: readonly { code: MetricCode; statement: string }[] = [
  { code: "POINTS_AWARDED", statement: "Tổng giá trị các sự kiện trong sổ điểm có thời điểm ghi nằm trong kỳ." },
  { code: "PARTICIPANTS_ENROLLED", statement: "Số người tham gia ở trạng thái đang tham gia tại thời điểm đóng kỳ." },
];

export const METRIC_OWNER_ROLE: StaffRole = "ACT-REP";

/**
 * The parties who may take part, by how RightOne ID knows the person acting: Công ty TNHH Then Cửa Việt, by the
 * organisation its principal acts for in the premises portal, under the party reference PTY's boards give it
 * (PTY-118342), taking part as a premises principal; and Tống Nhã Uyên, by her own account in the artist portal,
 * taking part as an artist, the class version 1's three actions are listed for (`FR-ENG-002`). Each party holds its
 * display profiles (`FR-ART-006`), the first being the one its participation attaches to: the company's own, and the
 * artist's two, her own name and the duo she also publishes as, so an action recorded under the second names it rather
 * than the participation's (`AC-FR-ENG-011-02`). The duo's name is invented, as hers is.
 */
export const PARTICIPANTS: readonly (Party & { organisation: string | null; account: string | null; profiles: readonly { ref: string; name: string }[] })[] = [
  {
    organisation: "tcv",
    account: null,
    ref: "PTY-118342",
    name: "Công ty TNHH Then Cửa Việt",
    participantClass: "premises",
    profiles: [{ ref: "DPF-118342-1", name: "Công ty TNHH Then Cửa Việt" }],
  },
  {
    organisation: null,
    account: MOCK_ARTIST.email,
    ref: MOCK_ARTIST.party,
    name: MOCK_ARTIST.name,
    participantClass: "artist",
    profiles: [
      { ref: "DPF-207415-1", name: MOCK_ARTIST.name },
      { ref: "DPF-207415-2", name: "Uyên và Gió Bấc" },
    ],
  },
];

/** `CFG-61`'s reserving decision: what a point may be worth, exchanged for or expire under is reserved to it. */
export const RESERVING_DECISION = "DEC-30";

/** The review states the specification names that the live data never reaches: loading, and our outage. */
export const ENG_VIEWS = ["loading", "error"] as const;
export type EngView = (typeof ENG_VIEWS)[number];

export type EngagementScreen = "home" | "eng01" | "eng02" | "eng03" | "eng04" | "eng05" | "eng06" | "eng07" | "eng08" | "eng09" | "eng10" | "eng11" | "eng12" | "eng13";

/** Each engagement screen's outage, with a trace identifier of its own. */
export function mockEngagementFailure(screen: EngagementScreen): LoadOutcome<never> {
  const trace: Readonly<Record<EngagementScreen, string>> = {
    home: "e4a1c07b93d25f68",
    eng01: "3b8f2d61a7c04e95",
    eng02: "91c5e3a07f4b2d86",
    eng03: "5d27a9f1c4e08b63",
    eng04: "c0e6b4927a1d3f58",
    eng05: "f3a8c61d0b9e2475",
    eng06: "7f13d58c2e9a40b6",
    eng07: "a2964e0d7b1c53f8",
    eng08: "4e7b1a9c60d2f835",
    eng09: "d85f2c3a91e706b4",
    eng10: "26a0f7d4c8b3e195",
    eng11: "b9d4e81f05a7c362",
    eng12: "0f5c9a2e47b6d813",
    eng13: "68e3b0c5d9f2a714",
  };
  return { data: null, failure: { code: "INTERNAL_ERROR", traceId: trace[screen], retryable: true } };
}
