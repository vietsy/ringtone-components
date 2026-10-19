import type { LoadOutcome } from "@rightone/ui";
import type { ChangeCause, PremisesClass, PublishedFact, SourceName, Written } from "@/lib/api/premises";

/*
 * The premises register's data, from the premises canvas's PTY boards (SCR-PTY-06 to 10, 14 to 16) and the Figma
 * frames drawn from them, joined to the premises the other families of this world already name: every premises is
 * the PRM- record the party register gives it, with the ward the status records console shows (CER), else the
 * inspector's or the venue's, and the street the inspector's answers print (VER). Where the boards disagree with the
 * world (a board's national counts, a premises another family numbers differently) the world wins and the report says
 * so; where no family gives a value (a ward, a street) it is left out rather than made up.
 */

// ---------------------------------------------------------------- review views

/** The states a reviewer draws with `?view=`: the reads' outage, and the refusals and empty answers the boards draw. */
export const PREMISES_VIEWS = ["loading", "error", "not-found", "route-unknown", "no-provenance", "no-population"] as const;
export type PremisesView = Exclude<(typeof PREMISES_VIEWS)[number], "loading">;

/** The trace each screen's broken state prints, as its board draws it. */
export const PREMISES_TRACES = {
  "06": "4b7e2d91c06a5f38",
  "07": "7f3a1c9e2d0b5864",
  "08": "91d4b6e2f07a3c58",
  "09": "2e8b5f0c7a3d9146",
  "10": "c3a90f6e1b4d7285",
  "14": "7a3c91e04f5d2b86",
  "15": "e2b70c4d9a1f5836",
  "16": "4d09b6e2c7a18f53",
} as const;

/**
 * A failure a reviewer asked for. `route-unknown` is the register refusing to answer without its limitation, naming
 * the entry that records no provenance (SCR-PTY-06); `no-provenance` is that entry's provenance read refused
 * (SCR-PTY-08); `no-population` is the register before CFG-242 has a value (the P1 frame).
 */
export function mockPremisesFailure(view: PremisesView, trace: string): LoadOutcome<never> {
  switch (view) {
    case "error":
      return { data: null, failure: { code: "INTERNAL_ERROR", traceId: trace, retryable: true } };
    case "not-found":
      return { data: null, failure: { code: "PREMISES_NOT_FOUND", traceId: null, retryable: false } };
    case "route-unknown":
      return { data: null, failure: { code: "POPULATION_ROUTE_UNKNOWN", traceId: null, retryable: false } };
    case "no-provenance":
      return { data: null, failure: { code: "NO_PROVENANCE", traceId: null, retryable: false } };
    case "no-population":
      return { data: null, failure: { code: "NO_POPULATION_DEFINED", traceId: null, retryable: false } };
  }
}

/** The entry SCR-PTY-06 and 08 name when a review asks for the register's missing provenance. */
export const UNNAMED_ENTRY = { record: "PRM-9VB5HJ2E", name: "Then Cửa Tea House – Khu đô thị Sala, đường Mai Chí Thọ" } as const;

// ---------------------------------------------------------------- configuration

/** CFG-243: thirty days, the default in force while no interval is approved (Q-PTY-04). */
export const RECONCILIATION_INTERVAL_DAYS = 30;
/** CFG-247's scheme version the register classifies under, and the geography version its areas belong to. */
export const SCHEME_VERSION = "VSIC 2018";
export const GEOGRAPHY_VERSION = "2025-07";
/** The geography versions the service holds; a version outside them is GEOGRAPHY_VERSION_UNKNOWN. */
export const GEOGRAPHY_VERSIONS = ["2024-12", "2025-07"] as const;
/**
 * The successor table the national geography source published with each version (FR-PTY-040), by the version it leads
 * from: each area of the earlier version this world's premises still carry, mapped to its successor, or to null where
 * the area was withdrawn with no single successor - Phường 25, quận Bình Thạnh, which SCR-PTY-15 draws split between
 * two wards. An area the table does not name kept its name.
 */
export const GEOGRAPHY_SUCCESSORS: Readonly<Record<string, { to: string; areas: Readonly<Record<string, string | null>> }>> = {
  "2024-12": {
    to: "2025-07",
    areas: {
      "Phường 22, quận Bình Thạnh": "Phường Thạnh Mỹ Tây",
      "Phường 25, quận Bình Thạnh": null,
    },
  },
};
/** How long a run started on the console takes before the sweep records its completion. */
export const RUN_DURATION_MS = 20_000;

const HCM = "TP. Hồ Chí Minh";

/**
 * The wards of geography version 2025-07 the world's premises lie in, and the one the venue family gives Khách sạn
 * Nắng Xiên's spa (Đà Nẵng), which lies outside the population CFG-242 defines: the wards of TP. Hồ Chí Minh.
 */
export const WARDS: readonly { ward: string; city: string }[] = [
  { ward: "Phường An Khánh", city: HCM },
  { ward: "Phường Bàn Cờ", city: HCM },
  { ward: "Phường Bến Thành", city: HCM },
  { ward: "Phường Cầu Ông Lãnh", city: HCM },
  { ward: "Phường Sài Gòn", city: HCM },
  { ward: "Phường Tân Định", city: HCM },
  { ward: "Phường Thạnh Mỹ Tây", city: HCM },
  { ward: "Phường Xuân Hoà", city: HCM },
  { ward: "Phường Hội An", city: "TP. Đà Nẵng" },
];

/** CFG-242 as this world has it: the wards of TP. Hồ Chí Minh, every class of the scheme. */
export const POPULATION = { defined: true, city: HCM } as const;

/**
 * The ids the other families of this world give the register's entries (REG's `pasteur`, `pxl`, ...; VEN's and PLR's,
 * which follow REG's; the console queue's `ap-mai-bar`), so PTY answers them by the register's record. Two families
 * name Áp Mái Bar – Thảo Điền and The Lintel Coffee – Nguyễn Trãi differently, so each has two. A premises another
 * family names that the register does not hold (The Lintel Coffee – Bàn Cờ, Nắng Xiên's spa in Đà Nẵng) has no id
 * here, and PTY answers it as a premises it does not know.
 */
export const PREMISES_IDS: Readonly<Record<string, string>> = {
  pasteur: "PRM-5PSR9VJA",
  nh: "PRM-3NHZ6PKW",
  hbt: "PRM-2HWT8MCY",
  pxl: "PRM-7PXK4TDM",
  sala: "PRM-9VB5HJ2E",
  ltt: "PRM-8RTN5QZD",
  dakao: "PRM-4DKX7WNP",
  buivien: "PRM-6BVK3RQT",
  "ap-mai-bar": "PRM-7KD2WQ9M",
  "ap-mai-thao-dien": "PRM-7KD2WQ9M",
  "may-song-tdt": "PRM-4MSG8TDX",
  "nang-xien": "PRM-6HNX2QWD",
  "lintel-ly-tu-trong": "PRM-5JZT3HQV",
  "lintel-thao-dien": "PRM-2MX6PC8T",
  "lintel-nguyen-trai": "PRM-9NTR4KBE",
  "hat-me-sala": "PRM-3RT8XN4C",
  "hem-214": "PRM-8QNH6WZT",
};

// ---------------------------------------------------------------- the seed's shapes

export interface SeedEntry {
  record: string;
  name: string;
  /** How the trading name reached the register: the source, or Lam Hồng's licence list where the source had none. */
  nameRoute: { source: SourceName; at: string };
  address: string | null;
  /** The class the source states; null where the boards do not say what it stated before an override. */
  classification: PremisesClass | null;
  /** A data owner's override of the class, with the authority it rests on. */
  classOverride: { value: PremisesClass; authority: string; at: string; by: string } | null;
  area: string | null;
  /** The geography version the area belongs to: 2025-07, or 2024-12 where the source still gave the earlier ward. */
  areaVersion: string;
  admittedAt: string;
  /** The run that admitted it; null for one admitted by the first load. */
  admittedBy: "FIRST_LOAD" | "RUN_OF_1_OCTOBER";
  /** A derivation that lags its status record's last change: the register has not checked since (STALE). */
  derivedAt: string | null;
}

export interface SeedRun {
  id: string;
  startedAt: string;
  dueAt: string | null;
  state: "COMPLETED" | "INCOMPLETE";
  completedAt: string | null;
  stoppedAt: string | null;
  /** The last record the run reached, in record order; null for one that reached every record. */
  stoppedPoint: string | null;
  firstLoad: boolean;
}

export interface SeedDifference {
  id: string;
  run: string;
  premises: string;
  field: "classification" | "party";
}

export interface SeedChange {
  id: string;
  premises: string;
  cause: ChangeCause;
  effectiveOn: string;
  outgoing: string;
  incoming: string | null;
  recordedAt: string;
  recordedBy: string;
  basis: Written | null;
  /** When the change sweep applied it; null while it waits for its date. */
  appliedAt: string | null;
}

export interface SeedDisposition {
  id: string;
  change: string;
  kind: "STATUS_RECORD" | "OBLIGATION_DECISION" | "FEE";
  reference: string | null;
  period: { from: string; to: string } | null;
  amountMinor: number | null;
  issuedTo: string;
  state: "RAISED" | "AWAITING_APPROVAL" | "LEFT_IN_PLACE";
  proposal: { outcome: "TRANSFER"; receiving: string; ground: Written; by: string; role: string; at: string } | null;
  decision: { outcome: "LEAVE_IN_PLACE"; by: string; role: string; at: string; ground: Written } | null;
}

export interface SeedException {
  id: string;
  kind: "RECONCILIATION_OVERDUE" | "DERIVATION_MISSING";
  premises: string | null;
  raisedAt: string;
  acknowledged: { by: string; at: string } | null;
  resolved: { by: string; at: string; resolution: string | null } | null;
}

/** Something recorded against a premises that no family of this world holds a record of. */
export interface SeedEvent {
  premises: string;
  at: string;
  what: Written;
}

export interface PremisesSeed {
  entries: readonly SeedEntry[];
  /** What the national source states where it differs from the register: the party operating Chay Hạt Mè – Sala. */
  sourceParties: Readonly<Record<string, { party: string; from: string }>>;
  runs: readonly SeedRun[];
  differences: readonly SeedDifference[];
  changes: readonly SeedChange[];
  dispositions: readonly SeedDisposition[];
  exceptions: readonly SeedException[];
  published: readonly PublishedFact[];
  events: readonly SeedEvent[];
  /** What prompted a change the officer is about to record, by premises. */
  prompts: Readonly<Record<string, Written>>;
}

// ---------------------------------------------------------------- the data sheet

const at = (day: string, time: string) => `${day}T${time}:00+07:00`;

const FIRST_LOAD = at("2026-08-31", "02:40");
const UYEN = "Nguyễn Hoàng Phương Uyên";
const QUY = "Lê Đăng Quý";
const KHAI = "Thạch Minh Khải";

const AP_MAI = "PTY-131958";
const LINTEL = "PTY-127730";
const MAY_SONG = "PTY-142273";

const source = { source: "NATIONAL_REGISTER" as const, at: FIRST_LOAD };

const entry = (
  record: string,
  name: string,
  classification: PremisesClass | null,
  area: string | null,
  address: string | null,
  more: Partial<Omit<SeedEntry, "record" | "name" | "classification" | "area" | "address">> = {},
): SeedEntry => ({
  record,
  name,
  nameRoute: source,
  address,
  classification,
  classOverride: null,
  area,
  areaVersion: GEOGRAPHY_VERSION,
  admittedAt: FIRST_LOAD,
  admittedBy: "FIRST_LOAD",
  derivedAt: null,
  ...more,
});

/**
 * Every premises of the world, in record order. Then Cửa Việt's eight and The Lintel's, Áp Mái's, Mây Sông's, Chay
 * Hạt Mè's and Nắng Xiên's are the party register's; Quán Nướng Hẻm 214 is the inspector's (never operated, as the
 * register's P1 frame draws it), and The Lintel Coffee – Thủ Thiêm the one the run of 1 October admitted (SCR-PTY-06,
 * 07, 10). Mây Sông's name came by the alternative route and its class was overridden to Hotel under MEMO-2026-0117
 * where the source says short-stay accommodation (SCR-PTY-07, 08); Áp Mái Bar's was overridden to Bar under
 * MEMO-2026-0122 (SCR-PTY-10). Chay Hạt Mè's licensing status was last derived on 5 September and its record changed
 * on 12 September, so it reads STALE (SCR-PTY-06). The Lintel Coffee – Lý Tự Trọng is PRM-5JZT3HQV as the party
 * register and the authorisation route number it; the inspector's world numbers the same premises PRM-3LTX7KQV.
 * Cà phê Mái Hiên Xanh and Karaoke Gốc Sấu, never operated, are two premises the first load admitted with the wards the
 * source still gave under geography version 2024-12, which the register has not re-pointed yet (FR-PTY-040): Phường
 * 22 has a successor, and Phường 25 is the area SCR-PTY-15 draws with none. The board counts twelve premises there and
 * names none; this world holds one. No family gives either a street, so neither has an address.
 */
const ENTRIES: readonly SeedEntry[] = [
  entry("PRM-2HWT8MCY", "Then Cửa Bakery – Hai Bà Trưng", "BAKERY", null, null),
  entry("PRM-2MX6PC8T", "The Lintel Coffee – Thảo Điền", "CAFE", "Phường An Khánh", null),
  entry("PRM-3NHZ6PKW", "Then Cửa Coffee & Tea – Nguyễn Huệ", "CAFE", "Phường Sài Gòn", "41 Nguyễn Huệ"),
  entry("PRM-3RT8XN4C", "Nhà hàng Chay Hạt Mè – Chi nhánh Khu đô thị Sala", "RESTAURANT", "Phường An Khánh", null, { derivedAt: at("2026-09-05", "08:47") }),
  entry("PRM-4DKX7WNP", "Then Cửa Bakery – Đa Kao", "BAKERY", "Phường Tân Định", "9 Đinh Tiên Hoàng"),
  entry("PRM-4MSG8TDX", "Khách sạn Mây Sông – Chi nhánh Tôn Đức Thắng", "SHORT_STAY", "Phường Sài Gòn", "8 Tôn Đức Thắng", {
    nameRoute: { source: "LAMHONG_LIST", at: at("2026-08-31", "02:31") },
    classOverride: { value: "HOTEL", authority: "MEMO-2026-0117", at: at("2026-09-03", "11:02"), by: UYEN },
  }),
  entry("PRM-5JZT3HQV", "The Lintel Coffee – Lý Tự Trọng", "CAFE", "Phường Bến Thành", "61 Lý Tự Trọng"),
  entry("PRM-5MHX2TQB", "Cà phê Mái Hiên Xanh", "CAFE", "Phường 25, quận Bình Thạnh", null, { areaVersion: "2024-12" }),
  entry("PRM-5PSR9VJA", "Then Cửa Coffee & Tea – Pasteur", "CAFE", "Phường Sài Gòn", "212 Pasteur"),
  entry("PRM-6BVK3RQT", "Then Cửa Lounge & Karaoke – Bùi Viện", "KARAOKE", "Phường Bến Thành", "186 Bùi Viện"),
  entry("PRM-6HNX2QWD", "Khách sạn Nắng Xiên", "HOTEL", null, null),
  entry("PRM-6TTH2YWQ", "The Lintel Coffee – Thủ Thiêm", "CAFE", "Phường An Khánh", null, { admittedAt: at("2026-10-01", "02:47"), admittedBy: "RUN_OF_1_OCTOBER" }),
  entry("PRM-7KD2WQ9M", "Áp Mái Bar – Thảo Điền", null, "Phường An Khánh", null, {
    classOverride: { value: "BAR", authority: "MEMO-2026-0122", at: at("2026-09-04", "11:20"), by: UYEN },
  }),
  entry("PRM-7PXK4TDM", "Then Cửa Kitchen – Phan Xích Long", "RESTAURANT", null, null),
  entry("PRM-8GSK4VNR", "Karaoke Gốc Sấu", "KARAOKE", "Phường 22, quận Bình Thạnh", null, { areaVersion: "2024-12" }),
  entry("PRM-8QNH6WZT", "Quán Nướng Hẻm 214", "RESTAURANT", "Phường Cầu Ông Lãnh", "Hẻm 214 Cô Giang"),
  entry("PRM-8RTN5QZD", "Then Cửa Coffee & Tea – Lê Thánh Tôn", "CAFE", "Phường Bến Thành", "74 Lê Thánh Tôn"),
  entry("PRM-9NTR4KBE", "The Lintel Coffee – Nguyễn Trãi", "CAFE", "Phường Bến Thành", "238 Nguyễn Trãi"),
  entry("PRM-9VB5HJ2E", "Then Cửa Tea House – Khu đô thị Sala, đường Mai Chí Thọ", "CAFE", "Phường An Khánh", null),
];

/**
 * SCR-PTY-14's runs: the first load of 31 August, which completed at 02:40, and the run due on 30 September that
 * started on 1 October at 02:00 and stopped at 03:12 when the source stopped answering, after record PRM-6TTH2YWQ.
 * Its two differences are the ones SCR-PTY-07 and 09 draw: Mây Sông's class against the source, which contests a
 * manual override, and Chay Hạt Mè – Sala's operator, which the source names as Chái Bếp Quê from 20 September.
 */
const RUNS: readonly SeedRun[] = [
  { id: "RUN-2026-0831", startedAt: at("2026-08-31", "02:00"), dueAt: null, state: "COMPLETED", completedAt: FIRST_LOAD, stoppedAt: null, stoppedPoint: null, firstLoad: true },
  {
    id: "RUN-2026-1001",
    startedAt: at("2026-10-01", "02:00"),
    dueAt: at("2026-09-30", "02:40"),
    state: "INCOMPLETE",
    completedAt: null,
    stoppedAt: at("2026-10-01", "03:12"),
    stoppedPoint: "PRM-6TTH2YWQ",
    firstLoad: false,
  },
];

const DIFFERENCES: readonly SeedDifference[] = [
  { id: "DIF-4MSG8TDX-1001", run: "RUN-2026-1001", premises: "PRM-4MSG8TDX", field: "classification" },
  { id: "DIF-3RT8XN4C-1001", run: "RUN-2026-1001", premises: "PRM-3RT8XN4C", field: "party" },
];

/**
 * The two changes the boards draw: Áp Mái Bar – Thảo Điền's operator change to The Lintel, recorded on 18 September
 * by Lê Đăng Quý for 1 October and applied by the change sweep at midnight; and Mây Sông's closure from 1 November,
 * recorded on 30 September on the hotel's letter IN-5528 and pending until then (SCR-PTY-07, 10, 16).
 */
export const CHANGE_AP_MAI = "CHG-7KD2QAPM4T";
const CHANGES: readonly SeedChange[] = [
  {
    id: CHANGE_AP_MAI,
    premises: "PRM-7KD2WQ9M",
    cause: "OPERATOR_CHANGE",
    effectiveOn: "2026-10-01",
    outgoing: AP_MAI,
    incoming: LINTEL,
    recordedAt: at("2026-09-18", "15:32"),
    recordedBy: QUY,
    basis: null,
    appliedAt: at("2026-10-01", "00:00"),
  },
  {
    id: "CHG-4MSG8TDXCL",
    premises: "PRM-4MSG8TDX",
    cause: "CLOSURE",
    effectiveOn: "2026-11-01",
    outgoing: MAY_SONG,
    incoming: null,
    recordedAt: at("2026-09-30", "14:05"),
    recordedBy: QUY,
    basis: { code: "HOTEL_LETTER", values: { reference: "IN-5528", on: "2026-09-29" } },
    appliedAt: null,
  },
];

/**
 * What Áp Mái Bar's change left with Công ty TNHH Áp Mái (SCR-PTY-16): the status record, whose transfer to The
 * Lintel Lê Đăng Quý proposed at 08:40 on 1 October; the obligation decision, with nothing proposed; and the fee for
 * 2 to 30 September, which Thạch Minh Khải left in place at 09:51.
 */
const DISPOSITIONS: readonly SeedDisposition[] = [
  {
    id: "DSP-W5HK8TQM",
    change: CHANGE_AP_MAI,
    kind: "STATUS_RECORD",
    reference: "R1-CER-2026-W5HK8TQM",
    period: null,
    amountMinor: null,
    issuedTo: AP_MAI,
    state: "AWAITING_APPROVAL",
    proposal: { outcome: "TRANSFER", receiving: LINTEL, ground: { code: "LETTER_IN_5561" }, by: QUY, role: "OPS", at: at("2026-10-01", "08:40") },
    decision: null,
  },
  {
    id: "DSP-5WRM8KTC",
    change: CHANGE_AP_MAI,
    kind: "OBLIGATION_DECISION",
    reference: "OBD-5WRM8KTC3H",
    period: { from: "2026-09-02", to: "2027-09-01" },
    amountMinor: null,
    issuedTo: AP_MAI,
    state: "RAISED",
    proposal: null,
    decision: null,
  },
  {
    id: "DSP-FEE-2609",
    change: CHANGE_AP_MAI,
    kind: "FEE",
    reference: null,
    period: { from: "2026-09-02", to: "2026-09-30" },
    amountMinor: 1248000,
    issuedTo: AP_MAI,
    state: "LEFT_IN_PLACE",
    proposal: null,
    decision: { outcome: "LEAVE_IN_PLACE", by: KHAI, role: "BIZ_APR", at: at("2026-10-01", "09:51"), ground: { code: "FEE_SEPTEMBER" } },
  },
];

/**
 * SCR-PTY-15's exceptions this world holds: the register overdue since 30 September at 02:40, nobody on it yet; and
 * Chay Hạt Mè's missing derivation of 18 September, which the data owner resolved at 10:22 (the board does not draw
 * what she wrote). The late revocation is the party register's own (Giang Thục Quyên's authority), read from it. The
 * board's NO_SUCCESSOR_AREA (Phường 25, quận Bình Thạnh) is not seeded: it is raised when the data owner re-points
 * the register from 2024-12 and Cà phê Mái Hiên Xanh is still there (FR-PTY-040).
 */
const EXCEPTIONS: readonly SeedException[] = [
  { id: "EXC-OVERDUE-0930", kind: "RECONCILIATION_OVERDUE", premises: null, raisedAt: at("2026-09-30", "02:40"), acknowledged: null, resolved: null },
  {
    id: "EXC-DERIV-3RT8",
    kind: "DERIVATION_MISSING",
    premises: "PRM-3RT8XN4C",
    raisedAt: at("2026-09-18", "03:00"),
    acknowledged: null,
    resolved: { by: UYEN, at: at("2026-09-18", "10:22"), resolution: null },
  },
];

/** The published facts a backdated change can contradict (SCR-PTY-09): the public premises list and a coverage report. */
const PUBLISHED: readonly PublishedFact[] = [
  { key: "list-2026-09-22", kind: "PUBLIC_PREMISES_LIST", area: null, month: null, publishedAt: "2026-09-22", timed: false },
  { key: "coverage-an-khanh-2026-09", kind: "COVERAGE_REPORT", area: "Phường An Khánh", month: "2026-09", publishedAt: at("2026-10-01", "06:00"), timed: true },
];

/** What SCR-PTY-10 draws against Áp Mái Bar that no family of this world records: its obligation decision and change application. */
const EVENTS: readonly SeedEvent[] = [
  { premises: "PRM-7KD2WQ9M", at: at("2026-09-02", "16:20"), what: { code: "OBD_ISSUED", values: { reference: "OBD-5WRM8KTC3H" } } },
  { premises: "PRM-7KD2WQ9M", at: at("2026-09-08", "08:12"), what: { code: "CHANGE_APPLICATION_COMPLETE", values: { reference: "REG-Z2HY5MTE7K" } } },
];

const PROMPTS: Readonly<Record<string, Written>> = {
  "PRM-3RT8XN4C": { code: "PROMPT_RUN", values: { run: "2026-10-01", party: "Công ty TNHH Nhà hàng Chái Bếp Quê", from: "2026-09-20", application: "REG-V4QS6LDC9T", sent: "2026-09-30" } },
  "PRM-7KD2WQ9M": { code: "PROMPT_LETTER_IN_5561", values: { on: "2026-09-30" } },
};

/** The premises register as every world starts it. */
export function premisesSeed(): PremisesSeed {
  return {
    entries: ENTRIES,
    sourceParties: { "PRM-3RT8XN4C": { party: "PTY-139861", from: "2026-09-20" } },
    runs: RUNS,
    differences: DIFFERENCES,
    changes: CHANGES,
    dispositions: DISPOSITIONS,
    exceptions: EXCEPTIONS,
    published: PUBLISHED,
    events: EVENTS,
    prompts: PROMPTS,
  };
}
