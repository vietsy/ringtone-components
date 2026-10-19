import type { LoadOutcome } from "@rightone/ui";
import type { CaseText, Classification, Credits, EnforcementKind, EntitlementStatus, HistoryRow, ScheduleStatus, ScopeDetail, ScopeFamily } from "@/lib/api/venue";

/*
 * RightOne Player's sample data for the premises portal, word for word from the boards: the main canvas's VEN and PLR
 * boards and the IAM canvas's SCR-IAM-06, with the Figma file F81QTgaSLoFETn43vQYHdO. One world, the same Then Cửa
 * Việt premises the registration family holds (its ids: pasteur, nh, hbt, pxl, sala, ltt, dakao, buivien), so a
 * service, a device and a decision of one premises are the same premises everywhere.
 *
 * Two roles, as in every family: the seed each backend (`backend/venue.ts`, `backend/player.ts`) starts a world
 * from, and the states a reviewer draws with `?view=` that no act of the journey reaches (loading, an outage, a
 * read refused).
 */

// ---------------------------------------------------------------- review states

export const VEN01_VIEWS = ["empty", "loading", "error"] as const;
export const VEN02_VIEWS = ["not-authorised", "loading", "error"] as const;
export const VEN03_VIEWS = ["empty", "loading", "error"] as const;
export const VEN04_VIEWS = ["not-found", "not-authorised", "loading", "error"] as const;
export const VEN05_VIEWS = ["not-authorised", "loading", "error"] as const;
export const VEN06_VIEWS = ["not-authorised", "loading", "error"] as const;
export const VEN07_VIEWS = ["not-found", "not-authorised", "loading", "error"] as const;
export const VEN08_VIEWS = ["not-authorised", "loading", "error"] as const;
export const VEN09_VIEWS = ["empty", "not-authorised", "loading", "error"] as const;
export const VEN10_VIEWS = ["not-found", "not-authorised", "loading", "error"] as const;
export const VEN11_VIEWS = ["not-authorised", "loading", "error"] as const;
export const DEVICES_VIEWS = ["empty", "loading", "error"] as const;
export const PLR04_VIEWS = ["refused", "loading", "error"] as const;
export const PLR06_VIEWS = ["paused", "loading", "error"] as const;
export const IAM06_VIEWS = ["empty", "refused", "loading", "error"] as const;
export const VEN12_VIEWS = ["empty", "loading", "error"] as const;
export const VEN13_VIEWS = ["not-found", "loading", "error"] as const;
export const VEN14_VIEWS = ["not-found", "loading", "error"] as const;
export const VEN15_VIEWS = ["not-found", "loading", "error"] as const;
export const VEN16_VIEWS = ["not-found", "loading", "error"] as const;
export const VEN17_VIEWS = ["empty", "loading", "error"] as const;
export const VEN18_VIEWS = ["not-found", "loading", "error"] as const;

export type VenueView =
  | (typeof VEN01_VIEWS)[number]
  | (typeof VEN04_VIEWS)[number]
  | (typeof VEN09_VIEWS)[number]
  | (typeof PLR04_VIEWS)[number]
  | (typeof PLR06_VIEWS)[number]
  | (typeof IAM06_VIEWS)[number];

/** The trace id each board's error state quotes; any of them reads the same to the person. */
const TRACE = "7c3e19a2b40d5f86";

/**
 * The failure a review state draws: our outage with its trace id, or a read refused with the family's code. Views
 * that draw data (an empty list, a paused display) are answered by the seam; anything else here is null.
 */
export function reviewOutcome<T>(view: VenueView, refusals: Partial<Record<"not-found" | "not-authorised" | "refused", string>> = {}): LoadOutcome<T> | null {
  if (view === "error") return { data: null, failure: { code: "INTERNAL_ERROR", traceId: TRACE, retryable: true } };
  if (view === "not-found" || view === "not-authorised" || view === "refused") {
    const code = refusals[view];
    return code === undefined ? null : { data: null, failure: { code, traceId: null, retryable: false } };
  }
  return null;
}

// ---------------------------------------------------------------- the world's data

const at = (day: string, time: string) => `${day}T${time}:00+07:00`;
const text = (vi: string, en: string): CaseText => ({ vi, en });

/**
 * What PTY answers about each premises at enrolment (DR-250): the party it belongs to, the ward the register
 * gives (SCR-VEN-01 draws five), and the premises class read against the direct-licence scope. SCR-VEN-01 draws Bùi
 * Viện out of scope (a karaoke) and Sala with no class in the register; the others are inside the scope. The class is
 * the one its name and SCR-VEN-12 give it. Whether the party operates a premises is not kept here: VEN, PLR and IAM ask
 * PTY's register (`premisesRelationshipAt`), which has Then Cửa Việt operating Đa Kao since 9 September (SCR-PTY-02),
 * where SCR-VEN-01 drew it not operated; a closure or change of operator recorded on SCR-PTY-09 is what ends one now.
 *
 * SCR-VEN-12's register also lists services of three other parties (The Lintel, Quán Nướng Hẻm 214, Khách sạn Nắng
 * Xiên). Their premises carry the ids the registration family's world gives them where it holds them, and the name
 * the register draws, because that world names only Then Cửa Việt's premises to a reader of another party.
 */
export interface SeedPremises {
  id: string;
  party: string;
  /** The name for a premises the registration family's world does not name; null where it does (Then Cửa Việt's). */
  name: string | null;
  area: string | null;
  classInScope: boolean | null;
  classification: Classification | null;
}

const PARTY = "tcv";

export const PREMISES: readonly SeedPremises[] = [
  { id: "pasteur", party: PARTY, name: null, area: "Phường Xuân Hoà", classInScope: true, classification: "cafe" },
  { id: "nh", party: PARTY, name: null, area: "Phường Sài Gòn", classInScope: true, classification: "cafe" },
  { id: "hbt", party: PARTY, name: null, area: null, classInScope: true, classification: "bakery" },
  { id: "pxl", party: PARTY, name: null, area: null, classInScope: true, classification: "restaurant" },
  { id: "sala", party: PARTY, name: null, area: "Phường An Khánh", classInScope: null, classification: "tea" },
  { id: "ltt", party: PARTY, name: null, area: "Phường Sài Gòn", classInScope: true, classification: "cafe" },
  { id: "dakao", party: PARTY, name: null, area: "Phường Tân Định", classInScope: true, classification: "bakery" },
  { id: "buivien", party: PARTY, name: null, area: "Phường Bến Thành", classInScope: false, classification: "karaoke" },
  { id: "lintel-ly-tu-trong", party: "lintel", name: "The Lintel Coffee – Lý Tự Trọng", area: "Phường Bến Thành", classInScope: true, classification: "cafe" },
  { id: "lintel-thao-dien", party: "lintel", name: "The Lintel Coffee – Thảo Điền", area: "Phường An Khánh", classInScope: true, classification: "cafe" },
  { id: "lintel-ban-co", party: "lintel", name: "The Lintel Coffee – Bàn Cờ", area: "Phường Bàn Cờ", classInScope: true, classification: "cafe" },
  { id: "hem-214", party: "qnh", name: "Quán Nướng Hẻm 214", area: "Phường Cầu Ông Lãnh", classInScope: true, classification: "restaurant" },
  { id: "nang-xien-spa", party: "nang-xien", name: "Khách sạn Nắng Xiên – Spa tầng ba", area: "Phường Hội An", classInScope: true, classification: "spa" },
];

/**
 * CAT's read of a track: who performs it, its four credit roles where a board gives them, and its eligibility under
 * the direct licence over time (`ICatalogueReader.EntitlementsFor` at an instant), so a past period is resolved with
 * the eligibility it had then. `eligibleUntil` is the instant eligibility ended; null while the track is eligible.
 */
export interface SeedTrack {
  id: string;
  title: string;
  by: string;
  credits: Credits;
  eligibleUntil: string | null;
}

const NO_CREDITS: Credits = { composer: null, lyricist: null, performer: null, producer: null };

export const TRACKS: readonly SeedTrack[] = [
  { id: "TRK-VEDI-VYSA", title: "Về đi, trời mưa rồi", by: "Vy Sa", credits: { ...NO_CREDITS, performer: "Vy Sa" }, eligibleUntil: null },
  {
    id: "TRK-DEANH-DUYKHE",
    title: "Để anh nói nốt (Acoustic)",
    by: "Duy Khê",
    credits: { composer: "Võ Duy Khê", lyricist: "Võ Duy Khê, Vy Sa", performer: "Duy Khê", producer: "Lầu 3 Studio" },
    eligibleUntil: null,
  },
  // No longer eligible under the direct licence since CAT revoked it (the change COM's track-change run of
  // 25 September 2026 notified, `lib/mock/notices.ts`): SCR-VEN-07's revision 4 of Chill tối is refused on it.
  { id: "TRK-CNL-LAU3", title: "Chủ nhật lười", by: "Lầu 3 Studio", credits: { ...NO_CREDITS, performer: "Lầu 3 Studio" }, eligibleUntil: at("2026-09-25", "09:10") },
  { id: "TRK-CNL-ACOUSTIC", title: "Chủ nhật lười (Acoustic)", by: "Ngân Mộc", credits: { ...NO_CREDITS, performer: "Ngân Mộc" }, eligibleUntil: null },
  { id: "TRK-CNL-LOFI", title: "Chủ nhật lười (Lofi ver.)", by: "Mèo Mái Tôn", credits: { ...NO_CREDITS, performer: "Mèo Mái Tôn" }, eligibleUntil: null },
  { id: "TRK-VEDI-INSTR", title: "Về đi, trời mưa rồi (Instrumental)", by: "Lầu 3 Studio", credits: { ...NO_CREDITS, performer: "Lầu 3 Studio" }, eligibleUntil: null },
  // SCR-VEN-17 and 18 draw it in a shared mood.
  { id: "TRK-DEANH-LOFI", title: "Để anh nói nốt (Lofi ver.)", by: "Mèo Mái Tôn", credits: { ...NO_CREDITS, performer: "Mèo Mái Tôn" }, eligibleUntil: null },
  {
    id: "TRK-VEDI-NGANMOC",
    title: "Về đi, trời mưa rồi",
    by: "Ngân Mộc",
    credits: { composer: "Âu Thiện Khang", lyricist: "Tạ Bảo Ngân", performer: "Ngân Mộc", producer: "Lầu 3 Studio" },
    eligibleUntil: null,
  },
];

/*
 * The shared moods SCR-VEN-17 lists and SCR-VEN-18 opens, with their versions (SM-236): Tối thư thả in effect at
 * version 3 with version 4 drafted from 15 October, Khách sớm in effect at version 2, Chiều trở mưa drafted, Giờ trưa
 * đông khách withdrawn and Hè 2026 retired. Version 4's tracks are SCR-VEN-18's; the boards list no tracks for the
 * others, so each holds tracks the boards draw elsewhere. A version holds a stored state (DRAFT, APPROVED or
 * WITHDRAWN) and its dates; whether an approved one is in effect or superseded is read from the dates on the day.
 * The boards draw Quan Ngọc Trâm preparing and Phan Gia Lượng approving, so every seeded version is theirs.
 */
export interface SeedMood {
  id: string;
  name: string;
  /** The BRD §5.5 role that owns it. */
  owner: "SERVICE_OWNER";
  retiredAt: string | null;
}

export interface SeedMoodTrack {
  track: string;
  admittedAt: string;
  droppedAt: string | null;
}

export interface SeedMoodVersion {
  id: string;
  mood: string;
  no: number;
  stored: "DRAFT" | "APPROVED" | "WITHDRAWN";
  effectiveFrom: string;
  /** The last day it is in effect; null while open. */
  effectiveTo: string | null;
  preparedBy: string;
  preparedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  withdrawnReason: CaseText | null;
  tracks: readonly SeedMoodTrack[];
}

export const MOODS: readonly SeedMood[] = [
  { id: "MOD-TOI-THU-THA", name: "Tối thư thả", owner: "SERVICE_OWNER", retiredAt: null },
  { id: "MOD-KHACH-SOM", name: "Khách sớm", owner: "SERVICE_OWNER", retiredAt: null },
  { id: "MOD-CHIEU-MUA", name: "Chiều trở mưa", owner: "SERVICE_OWNER", retiredAt: null },
  { id: "MOD-GIO-TRUA", name: "Giờ trưa đông khách", owner: "SERVICE_OWNER", retiredAt: null },
  { id: "MOD-HE-2026", name: "Hè 2026", owner: "SERVICE_OWNER", retiredAt: at("2026-09-01", "00:00") },
];

const TRAM = "Quan Ngọc Trâm";
const LUONG = "Phan Gia Lượng";
const admitted = (day: string, ...tracks: string[]): SeedMoodTrack[] => tracks.map((id) => ({ track: id, admittedAt: at(day, "10:00"), droppedAt: null }));

export const MOOD_VERSIONS: readonly SeedMoodVersion[] = [
  {
    id: "SMV-4TQK7MX2WA", mood: "MOD-TOI-THU-THA", no: 4, stored: "DRAFT", effectiveFrom: "2026-10-15", effectiveTo: null,
    preparedBy: TRAM, preparedAt: at("2026-09-25", "16:20"), approvedBy: null, approvedAt: null, withdrawnReason: null,
    tracks: [
      { track: "TRK-VEDI-VYSA", admittedAt: at("2026-09-25", "16:20"), droppedAt: null },
      { track: "TRK-DEANH-DUYKHE", admittedAt: at("2026-09-25", "16:20"), droppedAt: null },
      { track: "TRK-CNL-LAU3", admittedAt: at("2026-09-25", "16:20"), droppedAt: at("2026-09-27", "00:00") },
      { track: "TRK-CNL-ACOUSTIC", admittedAt: at("2026-09-25", "16:20"), droppedAt: null },
      { track: "TRK-DEANH-LOFI", admittedAt: at("2026-09-25", "16:20"), droppedAt: null },
    ],
  },
  {
    id: "SMV-3TQK5HN8RD", mood: "MOD-TOI-THU-THA", no: 3, stored: "APPROVED", effectiveFrom: "2026-09-01", effectiveTo: null,
    preparedBy: TRAM, preparedAt: at("2026-08-20", "15:10"), approvedBy: LUONG, approvedAt: at("2026-08-22", "09:30"), withdrawnReason: null,
    tracks: admitted("2026-08-20", "TRK-VEDI-VYSA", "TRK-DEANH-DUYKHE", "TRK-CNL-ACOUSTIC"),
  },
  {
    id: "SMV-2TQK9WC4PF", mood: "MOD-TOI-THU-THA", no: 2, stored: "APPROVED", effectiveFrom: "2026-07-01", effectiveTo: "2026-08-31",
    preparedBy: TRAM, preparedAt: at("2026-06-18", "14:00"), approvedBy: LUONG, approvedAt: at("2026-06-19", "10:15"), withdrawnReason: null,
    tracks: admitted("2026-06-18", "TRK-VEDI-VYSA", "TRK-DEANH-DUYKHE"),
  },
  {
    id: "SMV-1TQK3RZ6VB", mood: "MOD-TOI-THU-THA", no: 1, stored: "WITHDRAWN", effectiveFrom: "2026-07-01", effectiveTo: null,
    preparedBy: TRAM, preparedAt: at("2026-06-12", "11:40"), approvedBy: null, approvedAt: null,
    withdrawnReason: text("Soạn lại thành phiên bản 2 trước khi duyệt.", "Prepared again as version 2 before it was approved."),
    tracks: admitted("2026-06-12", "TRK-VEDI-VYSA"),
  },
  {
    id: "SMV-2KSM6TD9QH", mood: "MOD-KHACH-SOM", no: 2, stored: "APPROVED", effectiveFrom: "2026-08-15", effectiveTo: null,
    preparedBy: TRAM, preparedAt: at("2026-08-05", "16:45"), approvedBy: LUONG, approvedAt: at("2026-08-07", "08:50"), withdrawnReason: null,
    tracks: admitted("2026-08-05", "TRK-VEDI-NGANMOC", "TRK-CNL-LOFI"),
  },
  {
    id: "SMV-1KSM4PW7XC", mood: "MOD-KHACH-SOM", no: 1, stored: "APPROVED", effectiveFrom: "2026-07-01", effectiveTo: "2026-08-14",
    preparedBy: TRAM, preparedAt: at("2026-06-15", "10:20"), approvedBy: LUONG, approvedAt: at("2026-06-16", "14:05"), withdrawnReason: null,
    tracks: admitted("2026-06-15", "TRK-VEDI-NGANMOC"),
  },
  {
    id: "SMV-1CMA8NX3TK", mood: "MOD-CHIEU-MUA", no: 1, stored: "DRAFT", effectiveFrom: "2026-10-15", effectiveTo: null,
    preparedBy: TRAM, preparedAt: at("2026-09-29", "15:30"), approvedBy: null, approvedAt: null, withdrawnReason: null,
    tracks: admitted("2026-09-29", "TRK-VEDI-VYSA", "TRK-VEDI-INSTR", "TRK-VEDI-NGANMOC"),
  },
  {
    id: "SMV-1GTR5KQ2MW", mood: "MOD-GIO-TRUA", no: 1, stored: "WITHDRAWN", effectiveFrom: "2026-09-21", effectiveTo: null,
    preparedBy: TRAM, preparedAt: at("2026-09-10", "13:20"), approvedBy: null, approvedAt: null,
    withdrawnReason: text("Không còn bài hợp lệ.", "No track was eligible."),
    tracks: [{ track: "TRK-CNL-LAU3", admittedAt: at("2026-09-10", "13:20"), droppedAt: at("2026-09-27", "00:00") }],
  },
  {
    id: "SMV-1HEA9WM4ZR", mood: "MOD-HE-2026", no: 1, stored: "APPROVED", effectiveFrom: "2026-06-01", effectiveTo: "2026-08-31",
    preparedBy: TRAM, preparedAt: at("2026-05-20", "09:00"), approvedBy: LUONG, approvedAt: at("2026-05-21", "11:30"), withdrawnReason: null,
    tracks: admitted("2026-05-20", "TRK-CNL-LOFI", "TRK-VEDI-INSTR"),
  },
];

export interface SeedItem {
  kind: "TRACK" | "SHARED_MOOD";
  ref: string;
}

const track = (ref: string): SeedItem => ({ kind: "TRACK", ref });
const mood = (ref: string): SeedItem => ({ kind: "SHARED_MOOD", ref });

export interface SeedPlaylist {
  id: string;
  service: string;
  name: string;
  revision: number;
  items: readonly SeedItem[];
  archivedAt: string | null;
}

/** The boards' service codes. */
export const PASTEUR = "RPS-7K2MQXB4TD";
const NGUYEN_HUE = "RPS-W5LQ3ZK7NA";
const HAI_BA_TRUNG = "RPS-Q4NDT7WZ2K";
const PHAN_XICH_LONG = "RPS-M3TZ5QWD7A";
const SALA = "RPS-B2XR6MJH5P";

/** SCR-VEN-03's order of Then Cửa Việt's services; the rest of the world's follow, the register sorting its own. */
export const VEN03_ORDER: readonly string[] = [PASTEUR, NGUYEN_HUE, HAI_BA_TRUNG, PHAN_XICH_LONG, SALA];

/*
 * The playlists SCR-VEN-06 draws, at the revisions it gives. Chill tối's items are SCR-VEN-07's; the boards list no
 * items for the others, so each holds tracks the boards draw elsewhere, in the state the board gives the list:
 * Acoustic cuối tuần and the two Hai Bà Trưng lists hold only the track no longer eligible, so they have no eligible
 * track; Trung thu 2026 is archived with SCR-VEN-07's two archived items.
 */
export const PLAYLISTS: readonly SeedPlaylist[] = [
  { id: "PLS-4MQXT7KD2B", service: PASTEUR, name: "Sáng mở cửa", revision: 4, items: [track("TRK-VEDI-NGANMOC"), mood("MOD-KHACH-SOM")], archivedAt: null },
  { id: "PLS-7TRW2NVA5H", service: PASTEUR, name: "Trưa văn phòng", revision: 2, items: [track("TRK-DEANH-DUYKHE"), track("TRK-CNL-ACOUSTIC")], archivedAt: null },
  {
    id: "PLS-3CHZ8KTX6M",
    service: PASTEUR,
    name: "Chill tối",
    revision: 3,
    items: [track("TRK-VEDI-VYSA"), mood("MOD-TOI-THU-THA"), track("TRK-DEANH-DUYKHE"), track("TRK-CNL-LAU3")],
    archivedAt: null,
  },
  { id: "PLS-9ACW5QJR2D", service: PASTEUR, name: "Acoustic cuối tuần", revision: 1, items: [track("TRK-CNL-LAU3")], archivedAt: null },
  { id: "PLS-6TTH3MZW8P", service: PASTEUR, name: "Trung thu 2026", revision: 2, items: [track("TRK-VEDI-INSTR"), track("TRK-CNL-LOFI")], archivedAt: at("2026-09-27", "09:30") },
  { id: "PLS-2BNM7HQA4K", service: HAI_BA_TRUNG, name: "Bánh nóng buổi sáng", revision: 1, items: [track("TRK-CNL-LAU3")], archivedAt: null },
  { id: "PLS-5CNG8TWE3R", service: HAI_BA_TRUNG, name: "Chiều ngọt", revision: 1, items: [track("TRK-CNL-LAU3")], archivedAt: null },
  { id: "PLS-8MCK4RZT6N", service: NGUYEN_HUE, name: "Mở cửa", revision: 3, items: [track("TRK-VEDI-NGANMOC")], archivedAt: null },
  { id: "PLS-3DCS9WHM5Q", service: NGUYEN_HUE, name: "Đầu ca sáng", revision: 5, items: [track("TRK-DEANH-DUYKHE")], archivedAt: null },
  { id: "PLS-7TCT2PXK9A", service: NGUYEN_HUE, name: "Tối cuối tuần", revision: 2, items: [track("TRK-CNL-LAU3")], archivedAt: null },
];

export interface SeedSchedule {
  id: string;
  service: string;
  playlist: string;
  days: readonly number[];
  start: string;
  end: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  status: ScheduleStatus;
  withdrawnAt: string | null;
  supersedes: string | null;
}

/** SCR-VEN-08's five schedules of Pasteur: three in force, one withdrawn, one replaced. */
export const SCHEDULES: readonly SeedSchedule[] = [
  {
    id: "SCH-5HVK2TQM8W", service: PASTEUR, playlist: "PLS-3CHZ8KTX6M", days: [1, 2, 3, 4, 5], start: "18:00", end: "22:00",
    effectiveFrom: "2026-09-21", effectiveTo: null, createdAt: at("2026-09-20", "22:05"), status: "ACTIVE", withdrawnAt: null, supersedes: "SCH-2CTE7WNA4K",
  },
  {
    id: "SCH-8TRW4MQZ3N", service: PASTEUR, playlist: "PLS-7TRW2NVA5H", days: [1, 2, 3, 4, 5], start: "11:00", end: "13:30",
    effectiveFrom: "2026-09-07", effectiveTo: null, createdAt: at("2026-09-06", "20:10"), status: "ACTIVE", withdrawnAt: null, supersedes: null,
  },
  {
    id: "SCH-6ACW9KTH2R", service: PASTEUR, playlist: "PLS-9ACW5QJR2D", days: [5, 6, 7], start: "20:00", end: "23:00",
    effectiveFrom: "2026-09-15", effectiveTo: null, createdAt: at("2026-09-14", "21:05"), status: "ACTIVE", withdrawnAt: null, supersedes: null,
  },
  {
    id: "SCH-3TRS7HXQ5M", service: PASTEUR, playlist: "PLS-7TRW2NVA5H", days: [6, 7], start: "11:00", end: "14:00",
    effectiveFrom: "2026-09-07", effectiveTo: null, createdAt: at("2026-09-06", "20:12"), status: "WITHDRAWN", withdrawnAt: at("2026-09-20", "21:58"), supersedes: null,
  },
  {
    id: "SCH-2CTE7WNA4K", service: PASTEUR, playlist: "PLS-3CHZ8KTX6M", days: [1, 2, 3, 4, 5, 6, 7], start: "19:00", end: "22:00",
    effectiveFrom: "2026-09-02", effectiveTo: null, createdAt: at("2026-09-02", "09:40"), status: "SUPERSEDED", withdrawnAt: null, supersedes: null,
  },
];

/*
 * SCR-VEN-09's periods are not seeded. The eligibility sweep (`Venue.ReevaluateEligibility`) records them in the
 * backend from the resolution itself, as the job would have since the baseline took effect: Pasteur's weekend
 * schedule of Acoustic cuối tuần falls back from Friday 25 September 2026, when CAT revoked its only track.
 */

/**
 * The approved `VEN-ENFORCEMENT` rule version the enforcement boards draw (CFG-290): "Player enforcement policy,
 * version 1", in force from 15 September 2026, with SCR-VEN-14's three grounds. SCR-VEN-14 draws a restriction
 * refused for the device ground, so that ground permits suspension and revocation; the board states no more, so the
 * other two grounds read the same way, the ticketed event adding the restriction the policy keeps for it. A ground
 * whose notice the policy states lets the officer leave the notice blank, and RightOne raises it (F-3); for the
 * ticketed event the officer names a notice already sent.
 */
export interface SeedGround {
  code: string;
  words: CaseText;
  actions: readonly EnforcementKind[];
  /** The policy states the notice for this ground (DR-252 row 6). */
  notice: boolean;
}

export const ENFORCEMENT_POLICY: { code: "VEN-ENFORCEMENT"; version: string; effectiveFrom: string; title: CaseText; name: CaseText; grounds: readonly SeedGround[] } = {
  code: "VEN-ENFORCEMENT",
  version: "1",
  effectiveFrom: "2026-09-15",
  name: text("Chính sách xử lý vi phạm dịch vụ Player", "Player enforcement policy"),
  title: text("Chính sách xử lý vi phạm dịch vụ Player, phiên bản 1", "Player enforcement policy, version 1"),
  grounds: [
    { code: "DEVICE_OUTSIDE_PREMISES", words: text("Thiết bị Player được dùng ngoài cơ sở đã đăng ký", "Player device used outside the enrolled premises"), actions: ["SUSPEND", "REVOKE"], notice: true },
    { code: "EVIDENCE_TAMPERED", words: text("Can thiệp vào minh chứng phát nhạc", "Playback evidence tampered with"), actions: ["SUSPEND", "REVOKE"], notice: true },
    { code: "TICKETED_EVENT", words: text("Phát nhạc Player trong sự kiện có bán vé", "Player music played at a ticketed event"), actions: ["SUSPEND", "RESTRICT", "REVOKE"], notice: false },
  ],
};

/** A recorded enforcement action (`player.enforcement_actions`). */
export interface SeedAction {
  id: string;
  action: EnforcementKind;
  ground: string;
  policyVersion: string;
  /** The accountable officer, by name. */
  decidedBy: string;
  effectiveAt: string;
  /** The notice COM issued for it; null when none could be raised (EXC-VEN-06). */
  notice: string | null;
  remedy: CaseText;
  conditions: readonly { code: string; text: CaseText }[];
  recordedAt: string;
}

/** A reinstatement (`player.reinstatements`): the action it lifts and each condition's evidence. */
export interface SeedReinstatement {
  id: string;
  action: string;
  conditionsMet: readonly { code: string; evidence: string }[];
  by: string;
  effectiveAt: string;
  recordedAt: string;
}

/** An ending (`player.entitlement_endings`): the premises' request, or a scope exit with its causing event. */
export interface SeedEnding {
  id: string;
  cause: "PREMISES_REQUEST" | "SCOPE_EXIT";
  effectiveAt: string;
  requestedBy: string | null;
  requestedAt: string | null;
  applied: boolean;
  scopeExit: { family: ScopeFamily; event: ScopeDetail; reference: string; evidence: string } | null;
  /** The scope exit that replaced this pending request (DR-254 row 5). */
  supersededBy: string | null;
}

export interface SeedEntitlement {
  code: string;
  premisesId: string;
  status: EntitlementStatus;
  enrolledAt: string;
  activatedAt: string | null;
  endedAt: string | null;
  /**
   * The acceptance, with the party acted for and the digest of the text shown. Null digest: the text of version 3,
   * which this world holds and digests (`TERMS`); the boards draw only the first twelve characters of an older one.
   */
  terms: { version: string; acceptedAt: string; acceptedBy: string; actingFor: string; digest: string | null } | null;
  actions: readonly SeedAction[];
  reinstatements: readonly SeedReinstatement[];
  endings: readonly SeedEnding[];
  history: readonly HistoryRow[];
  defaultPlaylist: string | null;
  document: string | null;
}

const person = (name: string, operations = false) => ({ kind: "PERSON" as const, name, operations });
const row = (
  when: string,
  from: EntitlementStatus | null,
  to: EntitlementStatus,
  cause: HistoryRow["cause"],
  recordedBy: HistoryRow["recordedBy"],
  more: { termsVersion?: string; endingFrom?: string } = {},
): HistoryRow => ({ at: when, from, to, cause, recordedBy, termsVersion: more.termsVersion ?? null, endingFrom: more.endingFrom ?? null });

const TRANG = "Đỗ Thu Trang";
const CUONG = "Lê Văn Cường";
const THEN_CUA_VIET = "Công ty TNHH Then Cửa Việt";
/** SCR-VEN-13's digest of the version-2 text, the only part of an older digest a board draws. */
const OLDER_DIGEST = "3f9a1c07b2e4";

/** The device ground's two conditions, as SCR-VEN-13 and 15 draw them for Nguyễn Huệ's device PLY-0038. */
const deviceConditions = (device: string, premises: string) => [
  { code: "DEVICE_RETURNED", text: text(`RightOne xác nhận thiết bị ${device} đã ở lại cơ sở ${premises}.`, `RightOne confirms that device ${device} is back at ${premises}.`) },
  {
    code: "WRITTEN_UNDERTAKING",
    text: text("Chủ cơ sở gửi văn bản cam kết giữ thiết bị tại cơ sở.", "The premises principal sends a written undertaking to keep the device on the premises."),
  },
];

const enrolled = (when: string, by: string) => row(when, null, "PENDING_TERMS", "ENROLMENT", person(by));
const accepted = (when: string, by: string, version: string) => row(when, "PENDING_TERMS", "ACTIVE", "TERMS_ACCEPTED", person(by), { termsVersion: version });

/**
 * The ten services SCR-VEN-12 lists, latest enrolment first. Then Cửa Việt's five are SCR-VEN-03's, each as
 * SCR-VEN-04 draws it; Nguyễn Huệ's suspension and Phan Xích Long's scope exit as SCR-VEN-13 draws them. The other
 * parties' five carry the state, class and dates the register draws; their actions, on grounds of the policy above,
 * are recorded the way SCR-VEN-13 records Nguyễn Huệ's.
 */
export const ENTITLEMENTS: readonly SeedEntitlement[] = [
  {
    code: HAI_BA_TRUNG, premisesId: "hbt", status: "PENDING_TERMS",
    enrolledAt: at("2026-09-28", "10:02"), activatedAt: null, endedAt: null, terms: null, actions: [], reinstatements: [], endings: [],
    history: [enrolled(at("2026-09-28", "10:02"), TRANG)],
    defaultPlaylist: null, document: null,
  },
  {
    code: PHAN_XICH_LONG, premisesId: "pxl", status: "ENDED_OUT_OF_SCOPE",
    enrolledAt: at("2026-09-05", "11:15"), activatedAt: at("2026-09-06", "08:50"), endedAt: at("2026-09-27", "00:00"),
    terms: { version: "3", acceptedAt: at("2026-09-06", "08:50"), acceptedBy: TRANG, actingFor: THEN_CUA_VIET, digest: null },
    actions: [], reinstatements: [],
    // The board cites REG-DEC-2026-004417; the registration family's re-decided obligation of Phan Xích Long is
    // OBD-9MZB3QFT4X (no payable obligation, out of scope), so the ending names that decision.
    endings: [
      {
        id: "END-9MZB3QFT4X", cause: "SCOPE_EXIT", effectiveAt: at("2026-09-27", "00:00"), requestedBy: CUONG, requestedAt: at("2026-09-27", "09:40"), applied: true,
        scopeExit: { family: "REGISTRATION", event: "OBLIGATION_REDECIDED", reference: "OBD-9MZB3QFT4X", evidence: "Thư quyết định OBD-9MZB3QFT4X, bản quét ngày 27/9/2026" },
        supersededBy: null,
      },
    ],
    history: [
      row(at("2026-09-27", "00:00"), "ACTIVE", "ENDED_OUT_OF_SCOPE", "SCOPE_EXIT", person(CUONG, true)),
      accepted(at("2026-09-06", "08:50"), TRANG, "3"),
      enrolled(at("2026-09-05", "11:15"), TRANG),
    ],
    defaultPlaylist: null, document: null,
  },
  {
    code: PASTEUR, premisesId: "pasteur", status: "ACTIVE",
    enrolledAt: at("2026-09-01", "16:40"), activatedAt: at("2026-09-02", "09:14"), endedAt: null,
    terms: { version: "3", acceptedAt: at("2026-09-02", "09:14"), acceptedBy: TRANG, actingFor: THEN_CUA_VIET, digest: null },
    actions: [], reinstatements: [], endings: [],
    history: [accepted(at("2026-09-02", "09:14"), TRANG, "3"), enrolled(at("2026-09-01", "16:40"), "Khúc Minh Nhật")],
    defaultPlaylist: "PLS-4MQXT7KD2B", document: "K3VQ7M2XRDZ5PWN4TB6HCJYLAE",
  },
  {
    code: "RPS-H6PK2VN4XR", premisesId: "lintel-ly-tu-trong", status: "ACTIVE",
    enrolledAt: at("2026-08-20", "15:30"), activatedAt: at("2026-08-21", "08:30"), endedAt: null,
    terms: { version: "2", acceptedAt: at("2026-08-21", "08:30"), acceptedBy: "Công ty TNHH The Lintel", actingFor: "Công ty TNHH The Lintel", digest: OLDER_DIGEST },
    actions: [], reinstatements: [], endings: [],
    history: [accepted(at("2026-08-21", "08:30"), "Công ty TNHH The Lintel", "2"), enrolled(at("2026-08-20", "15:30"), "Công ty TNHH The Lintel")],
    defaultPlaylist: null, document: null,
  },
  {
    code: "RPS-D7KQ2XN8VP", premisesId: "hem-214", status: "RESTRICTED",
    enrolledAt: at("2026-08-18", "19:05"), activatedAt: at("2026-08-19", "10:40"), endedAt: null,
    terms: { version: "2", acceptedAt: at("2026-08-19", "10:40"), acceptedBy: TRANG, actingFor: "Hộ kinh doanh Quán Nướng Hẻm 214", digest: OLDER_DIGEST },
    actions: [
      {
        id: "ENF-4QNH8TWK2D", action: "RESTRICT", ground: "TICKETED_EVENT", policyVersion: "1", decidedBy: CUONG, effectiveAt: at("2026-09-20", "18:00"),
        notice: "COM-NTF-2026-018307", recordedAt: at("2026-09-19", "16:10"),
        remedy: text("Không phát nhạc Player trong các buổi có bán vé tại quán.", "Do not play Player music at ticketed nights at the premises."),
        conditions: [
          { code: "EVENTS_SEPARATED", text: text("Chủ cơ sở gửi lịch các buổi có bán vé và cam kết không dùng Player trong các buổi đó.", "The premises principal sends the dates of its ticketed nights and undertakes not to use the Player at them.") },
        ],
      },
    ],
    reinstatements: [], endings: [],
    history: [
      row(at("2026-09-20", "18:00"), "ACTIVE", "RESTRICTED", "ENFORCEMENT", person(CUONG, true)),
      accepted(at("2026-08-19", "10:40"), TRANG, "2"),
      enrolled(at("2026-08-18", "19:05"), TRANG),
    ],
    defaultPlaylist: null, document: null,
  },
  {
    code: "RPS-J8TR4KC2WM", premisesId: "lintel-thao-dien", status: "SUSPENDED",
    enrolledAt: at("2026-08-16", "09:20"), activatedAt: at("2026-08-17", "08:00"), endedAt: null,
    terms: { version: "2", acceptedAt: at("2026-08-17", "08:00"), acceptedBy: "Công ty TNHH The Lintel", actingFor: "Công ty TNHH The Lintel", digest: OLDER_DIGEST },
    actions: [
      {
        id: "ENF-8JTR3MQX5B", action: "SUSPEND", ground: "EVIDENCE_TAMPERED", policyVersion: "1", decidedBy: CUONG, effectiveAt: at("2026-09-24", "12:00"),
        notice: "COM-NTF-2026-018519", recordedAt: at("2026-09-24", "11:20"),
        remedy: text("Để RightOne kiểm tra lại thiết bị và gửi lại minh chứng phát nhạc còn thiếu.", "Let RightOne check the device again and send the playback evidence that is missing."),
        conditions: [
          { code: "DEVICE_INSPECTED", text: text("RightOne kiểm tra thiết bị và xác nhận phần mềm không bị thay đổi.", "RightOne checks the device and confirms its software is unchanged.") },
          { code: "EVIDENCE_RESENT", text: text("Thiết bị gửi lại toàn bộ minh chứng phát nhạc từ ngày 20 tháng 9.", "The device sends again all playback evidence from 20 September.") },
        ],
      },
    ],
    reinstatements: [], endings: [],
    history: [
      row(at("2026-09-24", "12:00"), "ACTIVE", "SUSPENDED", "ENFORCEMENT", person(CUONG, true)),
      accepted(at("2026-08-17", "08:00"), "Công ty TNHH The Lintel", "2"),
      enrolled(at("2026-08-16", "09:20"), "Công ty TNHH The Lintel"),
    ],
    defaultPlaylist: null, document: null,
  },
  {
    code: NGUYEN_HUE, premisesId: "nh", status: "SUSPENDED",
    enrolledAt: at("2026-08-12", "14:20"), activatedAt: at("2026-08-13", "09:05"), endedAt: null,
    terms: { version: "2", acceptedAt: at("2026-08-13", "09:05"), acceptedBy: TRANG, actingFor: THEN_CUA_VIET, digest: OLDER_DIGEST },
    actions: [
      {
        id: "ENF-7KD2QW9M4T", action: "SUSPEND", ground: "DEVICE_OUTSIDE_PREMISES", policyVersion: "1", decidedBy: CUONG, effectiveAt: at("2026-09-26", "18:00"),
        notice: "COM-NTF-2026-018842", recordedAt: at("2026-09-26", "17:30"),
        remedy: text("Đưa thiết bị PLY-0038 về lại cơ sở và giữ thiết bị tại đó.", "Bring device PLY-0038 back to the premises and keep it there."),
        conditions: deviceConditions("PLY-0038", "Then Cửa Coffee & Tea – Nguyễn Huệ"),
      },
    ],
    reinstatements: [], endings: [],
    history: [
      row(at("2026-09-26", "18:00"), "ACTIVE", "SUSPENDED", "ENFORCEMENT", person(CUONG, true)),
      accepted(at("2026-08-13", "09:05"), TRANG, "2"),
      enrolled(at("2026-08-12", "14:20"), TRANG),
    ],
    defaultPlaylist: "PLS-8MCK4RZT6N", document: null,
  },
  {
    code: "RPS-T4HN9WB3QE", premisesId: "lintel-ban-co", status: "REVOKED",
    enrolledAt: at("2026-07-30", "10:10"), activatedAt: at("2026-07-31", "08:30"), endedAt: at("2026-09-15", "12:00"),
    terms: { version: "1", acceptedAt: at("2026-07-31", "08:30"), acceptedBy: "Công ty TNHH The Lintel", actingFor: "Công ty TNHH The Lintel", digest: OLDER_DIGEST },
    actions: [
      {
        id: "ENF-3BCN7KZT9R", action: "REVOKE", ground: "DEVICE_OUTSIDE_PREMISES", policyVersion: "1", decidedBy: CUONG, effectiveAt: at("2026-09-15", "12:00"),
        notice: "COM-NTF-2026-017764", recordedAt: at("2026-09-15", "10:45"),
        remedy: text("Cơ sở có thể đăng ký lại dịch vụ Player từ đầu và ghép thiết bị mới tại cơ sở.", "The premises may enrol in the Player service again and pair a new device at the premises."),
        conditions: [],
      },
    ],
    reinstatements: [], endings: [],
    history: [
      row(at("2026-09-15", "12:00"), "ACTIVE", "REVOKED", "ENFORCEMENT", person(CUONG, true)),
      accepted(at("2026-07-31", "08:30"), "Công ty TNHH The Lintel", "1"),
      enrolled(at("2026-07-30", "10:10"), "Công ty TNHH The Lintel"),
    ],
    defaultPlaylist: null, document: null,
  },
  {
    code: "RPS-N3VX7QD5HB", premisesId: "nang-xien-spa", status: "ACTIVE",
    enrolledAt: at("2026-07-29", "14:00"), activatedAt: at("2026-07-30", "09:15"), endedAt: null,
    terms: { version: "1", acceptedAt: at("2026-07-30", "09:15"), acceptedBy: "Công ty TNHH Khách sạn Nắng Xiên", actingFor: "Công ty TNHH Khách sạn Nắng Xiên", digest: OLDER_DIGEST },
    actions: [], reinstatements: [], endings: [],
    history: [accepted(at("2026-07-30", "09:15"), "Công ty TNHH Khách sạn Nắng Xiên", "1"), enrolled(at("2026-07-29", "14:00"), "Công ty TNHH Khách sạn Nắng Xiên")],
    defaultPlaylist: null, document: null,
  },
  {
    code: SALA, premisesId: "sala", status: "ENDED_AT_REQUEST",
    enrolledAt: at("2026-06-02", "17:05"), activatedAt: at("2026-06-03", "10:30"), endedAt: at("2026-08-31", "00:00"),
    terms: { version: "1", acceptedAt: at("2026-06-03", "10:30"), acceptedBy: TRANG, actingFor: THEN_CUA_VIET, digest: OLDER_DIGEST },
    actions: [], reinstatements: [],
    endings: [
      { id: "END-2XR6MJH5PQ", cause: "PREMISES_REQUEST", effectiveAt: at("2026-08-31", "00:00"), requestedBy: TRANG, requestedAt: at("2026-08-02", "15:20"), applied: true, scopeExit: null, supersededBy: null },
    ],
    history: [
      row(at("2026-08-31", "00:00"), "ACTIVE", "ENDED_AT_REQUEST", "ENDING", { kind: "SYSTEM" }),
      row(at("2026-08-02", "15:20"), null, "ACTIVE", "ENDING_REQUESTED", person(TRANG), { endingFrom: "2026-08-31" }),
      accepted(at("2026-06-03", "10:30"), TRANG, "1"),
      enrolled(at("2026-06-02", "17:05"), TRANG),
    ],
    defaultPlaylist: null, document: null,
  },
];

/** SCR-VEN-05's document of Pasteur, issued on 30 September while the service was active. */
export const DOCUMENTS: readonly { reference: string; service: string; statusAtIssue: EntitlementStatus; issuedAt: string; format: "pdf" | "html" }[] = [
  { reference: "K3VQ7M2XRDZ5PWN4TB6HCJYLAE", service: PASTEUR, statusAtIssue: "ACTIVE", issuedAt: at("2026-09-30", "10:12"), format: "pdf" },
];

/** STA's figures SCR-VEN-10 draws for Pasteur: the last seven days to 28 September, read at 23:00 that day. */
export const ANALYTICS: readonly { service: string; hours: number; plays: number; period: { from: string; to: string }; asAt: string }[] = [
  { service: PASTEUR, hours: 61, plays: 894, period: { from: "2026-09-22", to: "2026-09-28" }, asAt: at("2026-09-28", "23:00") },
];

/**
 * The RightOne Player premises service terms, a document PUB holds (BR-PUB-09) and publishes on SCR-PUB-10: its
 * identifier (the kind PUB reads it by), its name, and version 3's text as SCR-VEN-02 draws it, in force since
 * 1 September 2026. PUB's seed takes version 3 from here; VEN reads whichever version is effective from PUB
 * (`lib/api/venue.ts`), so a version published later is the one a pending service accepts. The Vietnamese name is
 * SCR-PUB-10's; the board's "tại cơ sở" is the VEN canvas's alone, and the English is SCR-VEN-02's wireframe.
 */
export const TERMS = {
  version: "3",
  documentId: "PREMISES_SERVICE_TERMS",
  effective: "2026-09-01",
  title: text("Điều khoản dịch vụ RightOne Player cho cơ sở", "RightOne Player premises service terms"),
  sections: [
    {
      id: "s1",
      heading: text("1. Dịch vụ", "1. The service"),
      body: text(
        "RightOne cung cấp nhạc nền được cấp phép trực tiếp để phát tại cơ sở đã đăng ký, qua thiết bị Player đã ghép với cơ sở đó.",
        "RightOne supplies directly licensed background music for playing at the enrolled premises, through a Player device paired with that premises.",
      ),
    },
    {
      id: "s2",
      heading: text("2. Nơi phát", "2. Where music plays"),
      body: text("Nhạc chỉ phát cho khách tại cơ sở đã đăng ký. Thiết bị mang sang nơi khác sẽ không phát nhạc.", "Music plays only to guests at the enrolled premises. A device taken elsewhere does not play."),
    },
    {
      id: "s3",
      heading: text("3. Minh chứng phát nhạc", "3. Playback evidence"),
      body: text(
        "Thiết bị ghi lại bài đã phát và gửi về RightOne. Cơ sở không sửa hay xoá minh chứng phát nhạc.",
        "The device records what it played and sends it to RightOne. The premises does not change or delete playback evidence.",
      ),
    },
    {
      id: "s4",
      heading: text("4. Tạm ngừng và kết thúc", "4. Suspension and ending"),
      body: text(
        "RightOne có thể tạm ngừng, hạn chế hoặc thu hồi dịch vụ theo chính sách xử lý vi phạm đang có hiệu lực. Cơ sở có thể yêu cầu kết thúc dịch vụ từ ngày chính sách cho phép.",
        "RightOne may suspend, restrict or revoke the service under the enforcement policy in force. The premises may ask to end the service from the date the policy allows.",
      ),
    },
  ],
} as const;

/** The approved VEN-SCHEDULE-RESOLUTION baseline, in force since 1 September 2026 (SCR-VEN-02, 08). */
export const RULES = { version: "VEN-SCHEDULE-RESOLUTION 1", effectiveFrom: "2026-09-01", timezone: "Asia/Ho_Chi_Minh" } as const;

/**
 * GOV's versions of `VEN-FALLBACK-MOOD` (CFG-292), the shared mood a period plays when no usable default does. None
 * is approved, which is the configuration point's tested default (Q-VEN-04): such a period resolves
 * NO_PLAYABLE_SCHEDULE, and activation needs the premises' own usable default.
 */
export const FALLBACK_MOOD_RULE: readonly { version: string; effectiveFrom: string; mood: string }[] = [];

/**
 * The approved `VEN-ENTITLEMENT-WORDING` version (CFG-16) the verification document is issued under. The boards draw
 * a document issued on 30 September 2026 under the wording SCR-VEN-05 shows, so this world holds a version in force
 * from the day the service's terms and baseline took effect; before it, an issue is refused WORDING_NOT_APPROVED.
 */
export const WORDING_RULE = { code: "VEN-ENTITLEMENT-WORDING", version: "1", effectiveFrom: "2026-09-01" } as const;

// ---------------------------------------------------------------- PLR and IAM

export interface SeedDevice {
  id: string;
  premisesId: string;
  /** The name it was paired under, where a board gives one. */
  name: string | null;
  condition: "ONLINE" | "OFFLINE" | "CEILING" | "LIMIT_REACHED";
  /** The moment of the venue view the board draws: the device's last report as PLR holds it. */
  asOf: string;
  waiting: number;
  oldest: string | null;
  lastContact: string;
  lastSynced: string | null;
  /** The offline limit's end, and when it was reached. */
  stopsAt: string | null;
  reachedAt: string | null;
  playing: string | null;
}

/** The ceiling of evidence held on a device (CFG-261) and the offline limit of the approved policy. */
export const EVIDENCE_CEILING = 100000;
export const OFFLINE_LIMIT_HOURS = 72;

/*
 * The four devices the PLR and IAM boards draw. They sit at the premises the boards put them at, which is not
 * always a premises with a Player service on the VEN boards: Lê Thánh Tôn's device is paired before its service
 * is enrolled (SCR-VEN-01 draws Lê Thánh Tôn ready to enrol), and Bùi Viện's karaoke holds the device whose
 * limit ran out (SCR-PLR-05).
 */
export const DEVICES: readonly SeedDevice[] = [
  {
    id: "PLY-0023", premisesId: "pasteur", name: "Quầy pha chế", condition: "ONLINE", asOf: at("2026-09-30", "12:36"),
    waiting: 0, oldest: null, lastContact: at("2026-09-30", "12:36"), lastSynced: at("2026-09-30", "12:28"), stopsAt: null, reachedAt: null, playing: "TRK-DEANH-DUYKHE",
  },
  {
    id: "PLY-0031", premisesId: "ltt", name: null, condition: "OFFLINE", asOf: at("2026-09-30", "12:36"),
    waiting: 614, oldest: at("2026-09-28", "06:52"), lastContact: at("2026-09-28", "06:48"), lastSynced: null, stopsAt: at("2026-10-01", "06:48"), reachedAt: null, playing: "TRK-VEDI-NGANMOC",
  },
  {
    id: "PLY-0035", premisesId: "dakao", name: null, condition: "CEILING", asOf: at("2026-09-30", "12:36"),
    waiting: EVIDENCE_CEILING, oldest: at("2026-09-14", "08:02"), lastContact: at("2026-09-30", "12:36"), lastSynced: null, stopsAt: null, reachedAt: null, playing: null,
  },
  {
    id: "PLY-0038", premisesId: "buivien", name: null, condition: "LIMIT_REACHED", asOf: at("2026-09-30", "12:36"),
    waiting: 932, oldest: null, lastContact: at("2026-09-27", "08:10"), lastSynced: null, stopsAt: at("2026-09-30", "08:10"), reachedAt: at("2026-09-30", "08:10"), playing: null,
  },
];

export interface SeedPairing {
  id: string;
  premisesId: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  device: string | null;
  revokedAt: string | null;
  reason: CaseText | null;
}

/**
 * SCR-IAM-06's four authorisations for Pasteur. The latest was issued at 10:15 on 30 September and lasts fifteen
 * minutes, so a reader after that sees it expired; only a hash of each value is held, so no value is seeded.
 */
export const PAIRINGS: readonly SeedPairing[] = [
  { id: "PAU-7QK48M2PRX", premisesId: "pasteur", issuedAt: at("2026-09-30", "10:15"), expiresAt: at("2026-09-30", "10:30"), consumedAt: null, device: null, revokedAt: null, reason: null },
  { id: "PAU-3HWT6KQZ9N", premisesId: "pasteur", issuedAt: at("2026-09-14", "15:09"), expiresAt: at("2026-09-14", "15:24"), consumedAt: at("2026-09-14", "15:20"), device: "PLY-0023", revokedAt: null, reason: null },
  { id: "PAU-5MXR2TDA8C", premisesId: "pasteur", issuedAt: at("2026-09-14", "14:41"), expiresAt: at("2026-09-14", "14:56"), consumedAt: null, device: null, revokedAt: null, reason: null },
  {
    id: "PAU-9CVN4HKE2W", premisesId: "pasteur", issuedAt: at("2026-09-14", "14:32"), expiresAt: at("2026-09-14", "14:47"), consumedAt: null, device: null,
    revokedAt: at("2026-09-14", "14:35"), reason: text("Cấp khi người lắp đặt chưa tới.", "Issued before the installer arrived."),
  },
];
