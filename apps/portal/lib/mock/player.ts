import type { LoadOutcome } from "@rightone/ui";
import type { CertificationStatus, CredentialState, DecisionKind, DeviceStatus, Officer, OutcomeKind, SessionState as ReportedState } from "@/lib/api/player";
import type { CaseText } from "@/lib/api/venue";
import { DEVICES as VENUE_DEVICES } from "./venue";

/*
 * The Player devices on the consoles, word for word from the main canvas's PLR boards (SCR-PLR-01 to 03, 07, 10, 11,
 * 13, 15, 16) and the IAM canvas's SCR-IAM-07 and 08, with the Figma file F81QTgaSLoFETn43vQYHdO. One world with the
 * premises portal: the four devices the premises boards draw (`DEVICES` in `./venue`) keep what they last reported,
 * and the estate adds the devices the console boards draw at the premises they name.
 *
 * Where two boards place one device at two premises, the estate (SCR-PLR-01, PLR's own record) decides the premises
 * and the IAM boards give the credential's state and the name the premises gave the device. A device identity, a
 * date or a count no board gives for a device is the smallest value that keeps the record whole; the report lists
 * each one.
 */

// ---------------------------------------------------------------- review states

export const PLR01_VIEWS = ["empty", "loading", "error"] as const;
export const PLR02_VIEWS = ["not-found", "loading", "error"] as const;
export const PLR03_VIEWS = ["loading", "error"] as const;
export const PLR07_VIEWS = ["loading", "error"] as const;
export const PLR10_VIEWS = ["empty", "loading", "error"] as const;
export const PLR11_VIEWS = ["loading", "error"] as const;
export const PLR13_VIEWS = ["loading", "error"] as const;
export const PLR15_VIEWS = ["loading", "error"] as const;
/** The evidence console's halves of SCR-PLR-11 (drafting and approving the policy) and of SCR-PLR-15 (the rule set). */
export const PLR11_CONSOLE_VIEWS = ["loading", "error"] as const;
export const PLR15_RULES_VIEWS = ["loading", "error"] as const;
/** SCR-PLR-19 reads SCR-PLR-06's answer (`loadNowPlaying`); stopped, offline and not paired come from the data. */
export const PLR19_VIEWS = ["loading", "error"] as const;
export const IAM07_VIEWS = ["empty", "loading", "error"] as const;
export const IAM08_VIEWS = ["not-found", "loading", "error"] as const;

export type PlayerView = (typeof PLR01_VIEWS)[number] | (typeof PLR02_VIEWS)[number];

/** The trace id the boards' error states quote. */
const TRACE = "0af76519c3d24e8b";

/** The failure a review state draws: our outage with its trace id, or a record the address does not lead to. */
export function reviewFailure<T>(view: PlayerView): LoadOutcome<T> | null {
  if (view === "error") return { data: null, failure: { code: "INTERNAL_ERROR", traceId: TRACE, retryable: true } };
  if (view === "not-found") return { data: null, failure: { code: "NOT_FOUND", traceId: null, retryable: false } };
  return null;
}

// ---------------------------------------------------------------- the world's data

const at = (day: string, time: string) => `${day}T${time}:00+07:00`;
const text = (vi: string, en: string): CaseText => ({ vi, en });

/**
 * The premises of the other operators the console boards draw devices at, as PTY's register names them. Then Cửa
 * Việt's premises are the registration family's and are named from there; these carry the ids the registration
 * queue and the inspection boards already give them, and the ward the boards write.
 */
export const OTHER_PREMISES: readonly { id: string; name: string; party: string; area: string | null }[] = [
  { id: "ap-mai-thao-dien", name: "Áp Mái Bar – Thảo Điền", party: "ap-mai", area: null },
  { id: "nang-xien", name: "Khách sạn Nắng Xiên", party: "nang-xien", area: "Phường Hội An, TP. Đà Nẵng" },
  { id: "lintel-ly-tu-trong", name: "The Lintel Coffee – Lý Tự Trọng", party: "lintel", area: "Phường Bến Thành, TP. Hồ Chí Minh" },
  { id: "lintel-nguyen-trai", name: "The Lintel Coffee – Nguyễn Trãi", party: "lintel", area: "Phường Bến Thành, TP. Hồ Chí Minh" },
  { id: "hem-214", name: "Quán Nướng Hẻm 214", party: "qnh", area: "Phường Cầu Ông Lãnh, TP. Hồ Chí Minh" },
];

// ---------------------------------------------------------------- SM-202 and the device-assurance policy

export interface SeedCertification {
  id: string;
  supplier: string;
  /** The criteria version the application was lodged against. */
  version: number;
  status: CertificationStatus;
  lodgedOn: string;
  decidedOn: string | null;
  validTo: string | null;
  /** The criterion a refusal names. */
  criterion: string | null;
}

/** SCR-PLR-10's seven applications. A decided one carries its decision date as its lodging date: no board gives both. */
export const CERTIFICATIONS: readonly SeedCertification[] = [
  { id: "CRT-HA7M2KQX4T", supplier: "Hạt Âm Devices", version: 2, status: "CERTIFIED", lodgedOn: "2026-04-01", decidedOn: "2026-04-01", validTo: "2027-03-31", criterion: null },
  { id: "CRT-SC3W8NPV6R", supplier: "Sóng Chín Audio", version: 2, status: "CERTIFIED", lodgedOn: "2026-07-01", decidedOn: "2026-07-01", validTo: "2027-06-30", criterion: null },
  { id: "CRT-AT5K2HZQ9M", supplier: "Dải Tần Gia Định", version: 2, status: "UNDER_REVIEW", lodgedOn: "2026-09-02", decidedOn: null, validTo: null, criterion: null },
  { id: "CRT-LP8D4TXW2C", supplier: "Loa Phố Hội An", version: 2, status: "UNDER_REVIEW", lodgedOn: "2026-09-09", decidedOn: null, validTo: null, criterion: null },
  { id: "CRT-MH2Q7VKA5N", supplier: "Mái Hiên Sound", version: 2, status: "APPLIED", lodgedOn: "2026-09-25", decidedOn: null, validTo: null, criterion: null },
  { id: "CRT-PG6Z3MRT8E", supplier: "Phím Gỗ Audio", version: 2, status: "REFUSED", lodgedOn: "2026-08-12", decidedOn: "2026-08-12", validTo: null, criterion: "4.2" },
  { id: "CRT-HM4N9XDC3W", supplier: "Hạt Mưa Audio", version: 1, status: "EXPIRED", lodgedOn: "2026-03-01", decidedOn: "2026-03-01", validTo: "2026-08-31", criterion: null },
];

export interface PolicySection {
  id: string;
  heading: CaseText;
  body: readonly CaseText[];
}

export interface SeedAssuranceVersion {
  no: number;
  effectiveFrom: string;
  /** The day the next version took effect; null while it is in effect. */
  effectiveTo: string | null;
  publishedOn: string | null;
  validityMonths: number;
  criteria: CaseText;
  authority: CaseText;
  withdrawal: CaseText;
  sections: readonly PolicySection[];
}

/** SCR-PLR-11's version 2 text, the criteria a refusal names by its number. */
const SECTIONS: readonly PolicySection[] = [
  { id: "scope", heading: text("1. Phạm vi", "1. Scope"), body: [text("Áp dụng cho mọi thiết bị hoặc ứng dụng muốn minh chứng phát nhạc của mình được chấp nhận.", "Applies to every device or application whose playback evidence is to be accepted.")] },
  { id: "identity", heading: text("2. Định danh", "2. Identity"), body: [text("2.1 Mỗi thiết bị có một định danh thiết bị, và mọi sự kiện gửi về đều mang định danh đó.", "2.1 Each device holds one device identity, and every event it sends carries it.")] },
  { id: "clock", heading: text("3. Đồng hồ", "3. Clock"), body: [text("3.1 Đồng hồ thiết bị lệch không quá 60 giây so với nguồn giờ tin cậy.", "3.1 The device clock stays within 60 seconds of the trusted time source.")] },
  {
    id: "storage",
    heading: text("4. Lưu trữ", "4. Storage"),
    body: [
      text("4.1 Minh chứng được giữ trên thiết bị cho tới khi RightOne chấp nhận.", "4.1 Evidence stays on the device until RightOne has accepted it."),
      text("4.2 Minh chứng lưu trên thiết bị không sửa được mà không để lại dấu vết.", "4.2 Evidence stored on the device cannot be changed without leaving a trace."),
    ],
  },
  { id: "reporting", heading: text("5. Báo cáo", "5. Reporting"), body: [text("5.1 Thiết bị báo về mọi lượt phát, kèm đủ các trường mà chính sách minh chứng yêu cầu.", "5.1 The device reports every play with the fields the evidence policy requires.")] },
  {
    id: "withdrawal",
    heading: text("6. Căn cứ thu hồi", "6. Withdrawal grounds"),
    body: [
      text(
        "Chứng nhận của nhà cung cấp bị thu hồi từ ngày quyết định nếu thiết bị không đạt kiểm tra lại, hoặc không còn đạt một tiêu chí khi phiên bản mới có hiệu lực.",
        "A supplier’s certification is withdrawn from the date of the decision if its device fails a re-test, or no longer meets a criterion once a new version takes effect.",
      ),
    ],
  },
];

/** The numbered criteria of a version: what a refusal can name. */
export const CRITERIA: readonly string[] = ["2.1", "3.1", "4.1", "4.2", "5.1"];

const AUTHORITY = text("Chủ sở hữu minh chứng của RightOne", "The RightOne evidence owner");
const CRITERIA_SUMMARY = text("Bốn nhóm: định danh, đồng hồ, lưu trữ, báo cáo; toàn văn ở dưới", "Four groups: identity, clock, storage, reporting; the full text is below");
const WITHDRAWAL = text(
  "Không đạt kiểm tra lại, hoặc không còn đạt một tiêu chí khi phiên bản mới có hiệu lực",
  "A failed re-test, or a criterion no longer met once a new version takes effect",
);

/**
 * SCR-PLR-11's two versions. The board gives version 1 only its period and its six-month validity; it carries
 * version 2's criteria, which no board says changed.
 */
export const ASSURANCE_VERSIONS: readonly SeedAssuranceVersion[] = [
  { no: 1, effectiveFrom: "2026-01-01", effectiveTo: "2026-04-01", publishedOn: null, validityMonths: 6, criteria: CRITERIA_SUMMARY, authority: AUTHORITY, withdrawal: WITHDRAWAL, sections: SECTIONS },
  { no: 2, effectiveFrom: "2026-04-01", effectiveTo: null, publishedOn: "2026-03-20", validityMonths: 12, criteria: CRITERIA_SUMMARY, authority: AUTHORITY, withdrawal: WITHDRAWAL, sections: SECTIONS },
];

// ---------------------------------------------------------------- SM-200, the devices

/** What the device last reported of its playback session; a stop for want of a service in force is worked out on reading. */
export type SessionState = Exclude<ReportedState, "STOPPED">;

export interface SeedCondition {
  status: DeviceStatus;
  effectiveFrom: string;
  recordedAt: string;
  /** Null when RightOne recorded it, as a device becoming active does. */
  recordedBy: Officer | null;
  cause: CaseText | null;
  reportedBy: Officer | null;
}

export interface SeedSession {
  state: SessionState;
  asOf: string;
  waiting: number;
  oldest: string | null;
  lastContact: string;
  lastSynced: string | null;
  stopsAt: string | null;
  reachedAt: string | null;
  playing: string | null;
}

export interface SeedPlrDevice {
  id: string;
  identity: string;
  supplier: string;
  premisesId: string;
  name: string | null;
  enrolledAt: string;
  enrolledBy: Officer;
  /** Oldest first; the last is in force. */
  conditions: readonly SeedCondition[];
  /** The device's last report; null for a device that has none or no longer reports. */
  session: SeedSession | null;
  /** The last contact of a device that no longer reports, which the estate still shows. */
  lastContact: string | null;
  /** Events held out of distribution input, and the disposition that holds them. */
  held: number;
  disposition: string | null;
  /** Accepted evidence periods, which SCR-IAM-08 counts. */
  accepted: number;
}

const OPS = (name: string): Officer => ({ name, role: "operations" });
const CUONG = OPS("Lê Văn Cường");
const enrolled = (when: string): SeedCondition => ({ status: "ENROLLED", effectiveFrom: when, recordedAt: when, recordedBy: CUONG, cause: null, reportedBy: null });
const activated = (when: string): SeedCondition => ({ status: "ACTIVE", effectiveFrom: when, recordedAt: when, recordedBy: null, cause: null, reportedBy: null });

/** The premises boards' report of a device, as SCR-PLR-04 and 05 read it. */
function reported(id: string): SeedSession {
  const device = VENUE_DEVICES.find((candidate) => candidate.id === id);
  if (device === undefined) throw new Error(`${id} is not a device the premises boards draw`);
  const state: SessionState = device.condition === "ONLINE" ? "PLAYING" : device.condition;
  return {
    state,
    asOf: device.asOf,
    waiting: device.waiting,
    oldest: device.oldest,
    lastContact: device.lastContact,
    lastSynced: device.lastSynced,
    stopsAt: device.stopsAt,
    reachedAt: device.reachedAt,
    playing: device.playing,
  };
}

const AS_OF = at("2026-09-30", "12:36");
const quiet = (state: SessionState, lastContact: string, waiting: number, more: Partial<SeedSession> = {}): SeedSession => ({
  state,
  asOf: AS_OF,
  waiting,
  oldest: null,
  lastContact,
  lastSynced: null,
  stopsAt: null,
  reachedAt: null,
  playing: null,
  ...more,
});

/**
 * SCR-PLR-01's ten rows, with the premises boards' PLY-0035 at Đa Kao, in the estate's order; and PLY-0045, paired
 * through the Android app but waiting on its supplier's certification, so DR-215 can make it ACTIVE when the evidence
 * console certifies Loa Phố Hội An (SCR-PLR-10). The device's own screens are not the portal's, so no device pairs
 * in the mock, and a device enrolled here stays ENROLLED.
 */
export const PLR_DEVICES: readonly SeedPlrDevice[] = [
  {
    id: "PLY-0017", identity: "dev-7d40-17", supplier: "Hạt Mưa Audio", premisesId: "ap-mai-thao-dien", name: "Quầy bar",
    enrolledAt: at("2026-09-01", "16:05"), enrolledBy: CUONG,
    conditions: [enrolled(at("2026-09-01", "16:05")), activated(at("2026-09-02", "10:40"))],
    // SCR-IAM-07 holds the credential from 28 September; the device has not reported since.
    session: quiet("PLAYING", at("2026-09-28", "12:20"), 0, { asOf: at("2026-09-28", "12:20") }), lastContact: null,
    held: 0, disposition: null, accepted: 236,
  },
  {
    id: "PLY-0046", identity: "dev-3c07-91", supplier: "Phím Gỗ Audio", premisesId: "nang-xien", name: null,
    enrolledAt: at("2026-09-30", "10:12"), enrolledBy: CUONG,
    conditions: [enrolled(at("2026-09-30", "10:12"))],
    session: null, lastContact: null, held: 0, disposition: null, accepted: 0,
  },
  {
    id: "PLY-0045", identity: "dev-6a1d-45", supplier: "Loa Phố Hội An", premisesId: "nang-xien", name: null,
    enrolledAt: at("2026-09-26", "15:30"), enrolledBy: CUONG,
    conditions: [enrolled(at("2026-09-26", "15:30"))],
    session: null, lastContact: at("2026-09-27", "09:12"), held: 0, disposition: null, accepted: 0,
  },
  {
    id: "PLY-0023", identity: "dev-4a9c-23", supplier: "Hạt Âm Devices", premisesId: "pasteur", name: "Quầy pha chế",
    enrolledAt: at("2026-09-14", "14:30"), enrolledBy: CUONG,
    conditions: [enrolled(at("2026-09-14", "14:30")), activated(at("2026-09-14", "15:20"))],
    session: reported("PLY-0023"), lastContact: null, held: 4, disposition: "DSP-0103", accepted: 412,
  },
  {
    id: "PLY-0031", identity: "dev-6b2e-31", supplier: "Hạt Âm Devices", premisesId: "ltt", name: null,
    enrolledAt: at("2026-08-20", "09:40"), enrolledBy: CUONG,
    conditions: [enrolled(at("2026-08-20", "09:40")), activated(at("2026-08-21", "08:15"))],
    session: reported("PLY-0031"), lastContact: null, held: 6, disposition: null, accepted: 318,
  },
  {
    id: "PLY-0009", identity: "dev-8f21-44", supplier: "Hạt Âm Devices", premisesId: "buivien", name: "Quầy thu ngân",
    enrolledAt: at("2026-01-28", "15:10"), enrolledBy: CUONG,
    conditions: [
      enrolled(at("2026-01-28", "15:10")),
      activated(at("2026-02-01", "09:00")),
      {
        status: "LOST",
        effectiveFrom: at("2026-09-10", "14:00"),
        recordedAt: at("2026-09-12", "09:20"),
        recordedBy: CUONG,
        cause: text("Chủ cơ sở báo thiết bị bị lấy cắp", "Reported stolen by the premises principal"),
        reportedBy: { name: "Đỗ Thu Trang", role: "principal" },
      },
    ],
    session: null, lastContact: at("2026-09-12", "09:19"), held: 214, disposition: "DSP-0098", accepted: 1286,
  },
  {
    id: "PLY-0038", identity: "dev-9e15-38", supplier: "Hạt Âm Devices", premisesId: "buivien", name: null,
    enrolledAt: at("2026-07-06", "10:00"), enrolledBy: CUONG,
    conditions: [enrolled(at("2026-07-06", "10:00")), activated(at("2026-07-07", "09:30"))],
    session: reported("PLY-0038"), lastContact: null, held: 0, disposition: null, accepted: 904,
  },
  {
    id: "PLY-0044", identity: "dev-2c88-44", supplier: "Sóng Chín Audio", premisesId: "nang-xien", name: null,
    enrolledAt: at("2026-07-15", "13:20"), enrolledBy: CUONG,
    conditions: [enrolled(at("2026-07-15", "13:20")), activated(at("2026-07-16", "08:45"))],
    session: quiet("FAULT", at("2026-09-30", "12:09"), 0), lastContact: null, held: 0, disposition: null, accepted: 702,
  },
  {
    id: "PLY-0027", identity: "dev-5e93-17", supplier: "Sóng Chín Audio", premisesId: "lintel-ly-tu-trong", name: "Quầy chính",
    enrolledAt: at("2026-03-02", "14:30"), enrolledBy: CUONG,
    conditions: [enrolled(at("2026-03-02", "14:30")), activated(at("2026-03-04", "09:00"))],
    session: quiet("OFFLINE", at("2026-09-30", "01:40"), 87, { oldest: at("2026-09-30", "01:42"), stopsAt: at("2026-10-03", "01:40") }),
    lastContact: null, held: 0, disposition: null, accepted: 2210,
  },
  {
    id: "PLY-0020", identity: "dev-3f61-20", supplier: "Sóng Chín Audio", premisesId: "hem-214", name: null,
    enrolledAt: at("2026-07-02", "15:00"), enrolledBy: CUONG,
    conditions: [enrolled(at("2026-07-02", "15:00")), activated(at("2026-07-03", "09:15"))],
    session: quiet("SYNCING", at("2026-09-30", "12:30"), 52), lastContact: null, held: 0, disposition: null, accepted: 1105,
  },
  {
    id: "PLY-0035", identity: "dev-0d47-35", supplier: "Hạt Âm Devices", premisesId: "dakao", name: null,
    enrolledAt: at("2026-06-10", "11:00"), enrolledBy: CUONG,
    conditions: [enrolled(at("2026-06-10", "11:00")), activated(at("2026-06-11", "08:30"))],
    session: reported("PLY-0035"), lastContact: null, held: 0, disposition: null, accepted: 1530,
  },
  {
    id: "PLY-0005", identity: "dev-1c5a-05", supplier: "Hạt Âm Devices", premisesId: "pasteur", name: null,
    enrolledAt: at("2026-01-12", "10:00"), enrolledBy: CUONG,
    conditions: [
      enrolled(at("2026-01-12", "10:00")),
      activated(at("2026-01-15", "09:00")),
      {
        status: "RETIRED",
        effectiveFrom: at("2026-08-01", "00:00"),
        recordedAt: at("2026-08-01", "09:00"),
        recordedBy: CUONG,
        cause: text("Thiết bị hỏng, nhà cung cấp nhận lại", "Broken, taken back by the supplier"),
        reportedBy: null,
      },
    ],
    session: null, lastContact: at("2026-07-31", "22:05"), held: 0, disposition: null, accepted: 980,
  },
];

/**
 * The causes an officer chooses from when recording a condition (NO_CAUSE asks for one from the list). The boards
 * draw the loss's and the transfer's; the others are the shortest cause of each condition.
 */
export const CAUSES: Readonly<Record<Exclude<DeviceStatus, "ENROLLED">, readonly { id: string; text: CaseText }[]>> = {
  ACTIVE: [{ id: "checked", text: text("Đã kiểm tra xong, thiết bị vẫn ở cơ sở", "Checked; the device is still at the premises") }],
  SUSPENDED: [{ id: "moved", text: text("Đang kiểm tra tin báo thiết bị bị chuyển sang nơi khác", "Held while a report that the device was moved elsewhere is checked") }],
  LOST: [
    { id: "stolen", text: text("Chủ cơ sở báo thiết bị bị lấy cắp", "Reported stolen by the premises principal") },
    { id: "missing", text: text("Chủ cơ sở báo thiết bị bị thất lạc", "Reported missing by the premises principal") },
  ],
  COMPROMISED: [{ id: "copied", text: text("Định danh thiết bị bị sao chép sang một máy khác", "The device identity was copied to another machine") }],
  TRANSFERRED: [{ id: "branch", text: text("Chuyển sang chi nhánh khác của cùng đơn vị vận hành", "Moved to another branch of the same operator") }],
  RETIRED: [{ id: "broken", text: text("Thiết bị hỏng, nhà cung cấp nhận lại", "Broken, taken back by the supplier") }],
};

// ---------------------------------------------------------------- IAM's device credentials (SM-152)

export interface SeedCredential {
  id: string;
  device: string;
  premisesId: string;
  pairedAt: string;
  state: CredentialState;
  since: string;
  lastUsedAt: string | null;
  /** The reason of the suspension or reinstatement in force. */
  reason: CaseText | null;
  /** By whom; null when RightOne revoked it on a recorded event. */
  revocation: { cause: CaseText; effectiveAt: string; by: string | null } | null;
}

/** SCR-IAM-07's register as this world holds it: every paired device, the suspension and revocation the board draws. */
export const CREDENTIALS: readonly SeedCredential[] = [
  { id: "DCR-4L5PQX8ZRA", device: "PLY-0045", premisesId: "nang-xien", pairedAt: at("2026-09-27", "09:10"), state: "ACTIVE", since: at("2026-09-27", "09:10"), lastUsedAt: at("2026-09-27", "09:12"), reason: null, revocation: null },
  { id: "DCR-7K2MQXB4TA", device: "PLY-0035", premisesId: "dakao", pairedAt: at("2026-06-11", "08:30"), state: "ACTIVE", since: at("2026-06-11", "08:30"), lastUsedAt: at("2026-09-30", "12:36"), reason: null, revocation: null },
  { id: "DCR-3HWT6KQZ9P", device: "PLY-0023", premisesId: "pasteur", pairedAt: at("2026-09-14", "15:20"), state: "ACTIVE", since: at("2026-09-14", "15:20"), lastUsedAt: at("2026-09-30", "12:36"), reason: null, revocation: null },
  { id: "DCR-9E15TQWZ3B", device: "PLY-0038", premisesId: "buivien", pairedAt: at("2026-07-07", "09:30"), state: "ACTIVE", since: at("2026-07-07", "09:30"), lastUsedAt: at("2026-09-27", "08:10"), reason: null, revocation: null },
  { id: "DCR-6B2EKXM8RC", device: "PLY-0031", premisesId: "ltt", pairedAt: at("2026-08-21", "08:15"), state: "ACTIVE", since: at("2026-08-21", "08:15"), lastUsedAt: at("2026-09-28", "06:48"), reason: null, revocation: null },
  { id: "DCR-5E93QZTH7D", device: "PLY-0027", premisesId: "lintel-ly-tu-trong", pairedAt: at("2026-03-04", "09:00"), state: "ACTIVE", since: at("2026-03-04", "09:00"), lastUsedAt: at("2026-09-30", "01:40"), reason: null, revocation: null },
  { id: "DCR-3F61NWKR4E", device: "PLY-0020", premisesId: "hem-214", pairedAt: at("2026-07-03", "09:15"), state: "ACTIVE", since: at("2026-07-03", "09:15"), lastUsedAt: at("2026-09-30", "12:30"), reason: null, revocation: null },
  { id: "DCR-2C88VPTM6F", device: "PLY-0044", premisesId: "nang-xien", pairedAt: at("2026-07-16", "08:45"), state: "ACTIVE", since: at("2026-07-16", "08:45"), lastUsedAt: at("2026-09-30", "12:09"), reason: null, revocation: null },
  {
    id: "DCR-7D40HQXA2G", device: "PLY-0017", premisesId: "ap-mai-thao-dien", pairedAt: at("2026-09-02", "10:40"), state: "SUSPENDED", since: at("2026-09-28", "12:30"),
    lastUsedAt: at("2026-09-28", "12:20"), reason: text("Chứng nhận của nhà cung cấp cho thiết bị này bị rút.", "The supplier’s certification for this device was withdrawn."), revocation: null,
  },
  {
    id: "DCR-8F21MZKT5H", device: "PLY-0009", premisesId: "buivien", pairedAt: at("2026-02-01", "09:00"), state: "REVOKED", since: at("2026-09-12", "09:21"),
    lastUsedAt: at("2026-09-12", "09:19"), reason: null, revocation: { cause: text("Chủ cơ sở báo thiết bị bị lấy cắp", "Reported stolen by the premises principal"), effectiveAt: at("2026-09-12", "09:21"), by: null },
  },
];

// ---------------------------------------------------------------- SCR-PLR-07, evidence batches

export interface SeedBatch {
  id: string;
  device: string;
  receivedAt: string;
  firstSequence: number;
  lastSequence: number;
  policyVersion: number;
  entitlementVersion: number;
  /** The trusted times of the batch's first and last event: the mock holds a batch's span, not each event's time. */
  eventsFrom: string;
  eventsTo: string;
  outcomes: readonly { kind: OutcomeKind; count: number; why: CaseText; code: string | null }[];
  held: readonly { event: string; deviceTime: string; trustedTime: string }[];
  disposition: string | null;
}

/**
 * SCR-PLR-07's batch from PLY-0023, received on 30 September: the board dates it 14 September, before IAM paired
 * the device at 15:20 that day (SCR-IAM-06, 08), so it is the morning batch of 30 September. And one batch from
 * PLY-0017, whose supplier's certification ended on 31 August (SCR-PLR-01), refused as a whole. No board gives the
 * span of a batch's events: each runs from the device's previous report to the last event before it was sent.
 */
export const BATCHES: readonly SeedBatch[] = [
  {
    id: "BAT-4MQX7KD2TB", device: "PLY-0023", receivedAt: at("2026-09-30", "07:02"), firstSequence: 41211, lastSequence: 41673, policyVersion: 2, entitlementVersion: 11,
    eventsFrom: at("2026-09-29", "07:05"), eventsTo: at("2026-09-30", "06:58"),
    outcomes: [
      { kind: "ACCEPTED", count: 431, why: text("Đạt ngưỡng 30 giây, đủ trường theo chuẩn đầy đủ phiên bản 2", "Reached 30 s and complete under completeness standard version 2"), code: null },
      { kind: "DUPLICATE", count: 26, why: text("Đã được chấp nhận trước đó; không tạo sự kiện thứ hai", "Already accepted earlier; no second event is created"), code: null },
      { kind: "QUARANTINED", count: 4, why: text("Đồng hồ thiết bị lệch 41 phút so với giờ tin cậy, quá dung sai 60 giây", "Device clock 41 minutes off the trusted time, beyond the 60 s tolerance"), code: null },
      { kind: "BELOW_THRESHOLD", count: 2, why: text("Ngắn hơn ngưỡng 30 giây", "Shorter than the 30 s threshold"), code: "BELOW_THRESHOLD" },
    ],
    held: [
      { event: "EV-41262", deviceTime: "2026-09-30T06:21:10+07:00", trustedTime: "2026-09-30T05:40:02+07:00" },
      { event: "EV-41264", deviceTime: "2026-09-30T06:25:40+07:00", trustedTime: "2026-09-30T05:44:31+07:00" },
      { event: "EV-41265", deviceTime: "2026-09-30T06:29:16+07:00", trustedTime: "2026-09-30T05:48:07+07:00" },
      { event: "EV-41267", deviceTime: "2026-09-30T06:33:30+07:00", trustedTime: "2026-09-30T05:52:20+07:00" },
    ],
    disposition: "DSP-0103",
  },
  {
    id: "BAT-7D40RZK3QW", device: "PLY-0017", receivedAt: at("2026-09-27", "23:10"), firstSequence: 8804, lastSequence: 8855, policyVersion: 2, entitlementVersion: 6,
    eventsFrom: at("2026-09-27", "19:42"), eventsTo: at("2026-09-27", "23:06"),
    outcomes: [{ kind: "REFUSED", count: 52, why: text("Chứng nhận của Hạt Mưa Audio đã hết hạn ngày 31 tháng 8, 2026", "Hạt Mưa Audio’s certification expired on 31 August 2026"), code: "DEVICE_NOT_CERTIFIED" }],
    held: [],
    disposition: null,
  },
];

// ---------------------------------------------------------------- SM-203, the snapshots devices hold and receive

export interface SeedSnapshot {
  device: string;
  /** The entitlement version an event the device sends under it names. */
  version: number;
  issuedAt: string;
  tracks: number;
  /** The audio the snapshot needs on the device, and how much of it has arrived. */
  sizeMb: number;
  receivedMb: number;
}

/**
 * What each reporting device holds (SCR-PLR-04, 18): the snapshot it plays from and, where one is arriving, the
 * next. No board draws a transfer's progress; the specification's own example is a synchronisation at 62 per cent
 * (AC-FR-PLR-014-01, 027-01), which Pasteur's device is at, and Lê Thánh Tôn's stopped part-way when it lost its
 * connection on 28 September. Hẻm 214's is the one the estate shows synchronising. The versions continue those
 * SCR-PLR-07's batches name (11 for PLY-0023, 6 for PLY-0017); the sizes are the smallest that keep the record whole.
 */
export const SNAPSHOTS: readonly SeedSnapshot[] = [
  { device: "PLY-0017", version: 6, issuedAt: at("2026-09-27", "19:30"), tracks: 58, sizeMb: 406, receivedMb: 406 },
  { device: "PLY-0023", version: 11, issuedAt: at("2026-09-30", "06:40"), tracks: 64, sizeMb: 448, receivedMb: 448 },
  { device: "PLY-0023", version: 12, issuedAt: at("2026-09-30", "12:30"), tracks: 72, sizeMb: 504, receivedMb: 313 },
  { device: "PLY-0031", version: 9, issuedAt: at("2026-09-27", "20:15"), tracks: 64, sizeMb: 448, receivedMb: 448 },
  { device: "PLY-0031", version: 10, issuedAt: at("2026-09-28", "06:30"), tracks: 70, sizeMb: 490, receivedMb: 196 },
  { device: "PLY-0038", version: 7, issuedAt: at("2026-09-27", "08:00"), tracks: 40, sizeMb: 280, receivedMb: 280 },
  { device: "PLY-0044", version: 4, issuedAt: at("2026-09-30", "11:50"), tracks: 36, sizeMb: 252, receivedMb: 252 },
  { device: "PLY-0027", version: 9, issuedAt: at("2026-09-29", "22:10"), tracks: 48, sizeMb: 336, receivedMb: 336 },
  { device: "PLY-0020", version: 5, issuedAt: at("2026-09-29", "09:15"), tracks: 52, sizeMb: 364, receivedMb: 364 },
  { device: "PLY-0020", version: 6, issuedAt: at("2026-09-30", "12:20"), tracks: 55, sizeMb: 385, receivedMb: 154 },
  { device: "PLY-0035", version: 8, issuedAt: at("2026-09-14", "07:40"), tracks: 44, sizeMb: 308, receivedMb: 308 },
];

// ---------------------------------------------------------------- SCR-PLR-15, playback decisions

export interface SeedDecisionDay {
  device: string;
  day: string;
  eligibleTracks: number;
  /** Newest first. */
  decisions: readonly { at: string; kind: DecisionKind; title: CaseText; source: CaseText }[];
}

const EVENING = text("Lịch “Buổi tối”", "“Evening” schedule");
const NO_SCHEDULE = text("Không có lịch cho khung giờ này", "No schedule applies");
const same = (value: string): CaseText => ({ vi: value, en: value });

/** SCR-PLR-15's seven decisions on PLY-0023, local day 29 September. */
export const DECISION_DAYS: readonly SeedDecisionDay[] = [
  {
    device: "PLY-0023",
    day: "2026-09-29",
    eligibleTracks: 64,
    decisions: [
      { at: at("2026-09-29", "21:57"), kind: "FROM_DEFAULT_PLAYLIST", title: same("Mở cửa sổ ra"), source: NO_SCHEDULE },
      { at: at("2026-09-29", "21:53"), kind: "FROM_DEFAULT_PLAYLIST", title: same("Sân thượng lúc năm giờ"), source: NO_SCHEDULE },
      { at: at("2026-09-29", "21:49"), kind: "FROM_DEFAULT_PLAYLIST", title: same("Chủ nhật lười"), source: NO_SCHEDULE },
      { at: at("2026-09-29", "21:44"), kind: "FROM_SCHEDULE", title: same("Slow Ferry to Thủ Thiêm (Acoustic)"), source: EVENING },
      {
        at: at("2026-09-29", "21:40"),
        kind: "CYCLE_RESTARTED",
        title: text("Đã phát hết 64 bài nên danh sách không lặp được xoá và vòng mới bắt đầu", "All 64 had played, so the no-repeat set was cleared and a new cycle began"),
        source: text("Quy tắc không lặp", "No-repeat rule"),
      },
      { at: at("2026-09-29", "21:36"), kind: "FROM_SCHEDULE", title: same("Ngày mai tính"), source: EVENING },
      { at: at("2026-09-29", "21:32"), kind: "FROM_SCHEDULE", title: same("Chạy xe một vòng"), source: EVENING },
    ],
  },
];

export interface SeedRuleSetVersion {
  no: number;
  /** The loudness and the transition treatment; null where no board gives the text. */
  loudness: CaseText | null;
  transitions: CaseText | null;
  effectiveFrom: string;
  status: "DRAFT" | "APPROVED";
  preparedBy: string | null;
  preparedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

/**
 * The loudness and transition rule set every decision above was made under (SCR-PLR-15's last panel): version 2, in
 * force from 1 April. The board gives its number and its date only, not its text nor who approved it.
 */
export const RULE_SET_VERSIONS: readonly SeedRuleSetVersion[] = [
  { no: 2, loudness: null, transitions: null, effectiveFrom: "2026-04-01", status: "APPROVED", preparedBy: null, preparedAt: null, approvedBy: null, approvedAt: null },
];

// ---------------------------------------------------------------- SCR-PLR-13, the offline-continuity policy

export interface SeedOfflineVersion {
  no: number;
  maxOfflineHours: number;
  exceeded: "STOP";
  propagation: "NEXT_SYNC";
  graceHours: number;
  effectiveFrom: string;
  /** The day the next approved version took effect; null while open. */
  effectiveTo: string | null;
  status: "DRAFT" | "APPROVED";
  preparedBy: string;
  preparedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

/** SCR-PLR-13's draft 1, which nobody has approved: the interim rule is in force. */
export const OFFLINE_VERSIONS: readonly SeedOfflineVersion[] = [
  {
    no: 1, maxOfflineHours: 72, exceeded: "STOP", propagation: "NEXT_SYNC", graceHours: 0, effectiveFrom: "2026-11-01", effectiveTo: null, status: "DRAFT",
    preparedBy: "Quan Ngọc Trâm", preparedAt: at("2026-09-29", "16:20"), approvedBy: null, approvedAt: null,
  },
];
