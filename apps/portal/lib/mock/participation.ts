import type { LoadOutcome } from "@rightone/ui";
import type {
  AmendmentStep,
  ApplicationFields,
  ApplicationForm,
  MyParticipation,
  NotifiedDecision,
  ObjectionRecord,
  ObjectionStep,
  ParticipationPage,
  PendingAmendment,
  ScopeGap,
  ScopeKey,
  ScopeRow,
  ScopeView,
  Territory,
} from "@/lib/api/participation";
import type { Locale } from "@/lib/i18n/translate";

/*
 * The participation boards' data (main canvas, page CAT: SCR-CAT-01, 02, 03, 25), word for word. The boards'
 * today is Wednesday 30 September 2026. Three rights organisations are drawn as the portal's own: Lam Hồng
 * participates under PTC-2026-0107 with amendment AMD-2026-0044 awaiting approval (SCR-CAT-02, 03); Dây Đàn
 * has a draft application saved at 10:12 on 30 September (SCR-CAT-01); Hạc Bạch appears only on the
 * governance boards, so the catalogue holds nothing of its own beyond its legal name. Đĩa Than Mộc, Bến Sậy
 * and Sông Cầu are drawn only as other states of SCR-CAT-02 and SCR-CAT-25, for design review.
 *
 * Two uses: each `mockX(view)` answers the state a board drew (`?view=`); `participationSeed()` is the
 * session's starting state in the mock backend (`backend/participation.ts`).
 */

export const CAT01_VIEWS = ["populated", "missing", "loading", "error", "refused"] as const;
export type Cat01View = (typeof CAT01_VIEWS)[number];

export const CAT02_VIEWS = ["populated", "refused", "loading", "error"] as const;
export type Cat02View = (typeof CAT02_VIEWS)[number];
/** SCR-CAT-02's participation-state axis, `?state=`. */
export const CAT02_STATES = ["active", "approved", "suspended", "withdrawn"] as const;
export type Cat02State = (typeof CAT02_STATES)[number];
/** SCR-CAT-02's and SCR-CAT-03's reader axis, `?reader=`. */
export const CAT02_READERS = ["organisation", "legal"] as const;
export type Cat02Reader = (typeof CAT02_READERS)[number];

export const CAT03_VIEWS = ["populated", "draft", "past-date", "confirm", "loading", "error", "refused"] as const;
export type Cat03View = (typeof CAT03_VIEWS)[number];
export const CAT03_READERS = CAT02_READERS;
export type Cat03Reader = Cat02Reader;

export const CAT25_VIEWS = ["populated", "confirm", "already-open", "decided", "refused", "loading", "error"] as const;
export type Cat25View = (typeof CAT25_VIEWS)[number];

/** The boards' today: every review state is read as at it. */
export const BOARD_TODAY = "2026-09-30";

/** The legal approver the boards draw reading SCR-CAT-02 and 03 from the approvals surface. */
const LEGAL_READER = "Nguyễn Hạnh Dung";

const failure = (code: string, traceId: string | null, retryable: boolean) => ({ data: null, failure: { code, traceId, retryable } });

// ---------------------------------------------------------------- the canvas's organisations

/** What the catalogue holds of one organisation of the portal when a session starts. */
export interface OrganisationSeed {
  legalName: string;
  shortName: string;
  partyRecord: string | null;
  partyKind: "organisation" | null;
  draft: { savedAt: string; fields: ApplicationFields } | null;
  participation: MyParticipation | null;
  decisions: readonly NotifiedDecision[];
  objections: readonly ObjectionRecord[];
}

/** AMD-2026-0044, which SCR-CAT-02 lists and SCR-CAT-03 draws awaiting approval. */
const AMD_0044: PendingAmendment = {
  reference: "AMD-2026-0044",
  additions: [{ right: "mech", repertoire: "dom", territory: "hp" }],
  removals: [],
  effectiveFrom: "2026-11-01",
  preparedBy: "La Bảo Trân",
  preparedAt: "2026-09-29T16:40:00+07:00",
};

const row = (right: ScopeRow["right"], territory: Territory, claimedSubjects: number, from = "2026-07-01"): ScopeRow => ({
  right,
  repertoire: "dom",
  territory,
  from,
  to: null,
  claimedSubjects,
});

/** PTC-2026-0107, SCR-CAT-02 state active. */
const LAM_HONG: MyParticipation = {
  reference: "PTC-2026-0107",
  organisation: "Hội Quyền tác giả Âm nhạc Lam Hồng",
  shortName: "Lam Hồng",
  kind: "cmo",
  state: "ACTIVE",
  appliedAt: null,
  approvedOn: "2026-06-24",
  effectiveFrom: "2026-07-01",
  lastReviewedOn: "2026-09-20",
  stop: null,
  scope: [row("perf", "hn", 1284), row("perf", "hp", 312), row("perf", "hcm", 906), row("mech", "hn", 1017), row("mech", "hcm", 0)],
  amendments: [AMD_0044],
  // "No decision about this participation has been notified."
  decision: null,
};

/** Dây Đàn's draft as saved: the board's missing state, territory and authority register reference not yet entered. */
const DAY_DAN_DRAFT: ApplicationFields = {
  applyingAs: "intermediary",
  evidenceRef: "",
  evidenceFiles: [{ name: "uy-quyen-day-dan-2026.pdf", kind: "pdf", sizeBytes: 418 * 1024, at: "2026-09-30T10:05:00+07:00", by: "Mạc Thị Lan Chi" }],
  contacts: [{ name: "Mạc Thị Lan Chi", role: "admin", address: "Tầng 4, 27 Trần Quốc Toản, Phường Cửa Nam, Hà Nội" }],
  layers: ["perf", "mech"],
  repertoires: ["dom"],
  territories: [],
  periodFrom: "2026-11-01",
  periodTo: null,
};

/** The draft as the populated board draws it: the reference and the two provinces entered. */
const DAY_DAN_COMPLETE: ApplicationFields = { ...DAY_DAN_DRAFT, evidenceRef: "CV-2026-0472", territories: ["hn", "dn"] };

const DAY_DAN_SAVED_AT = "2026-09-30T10:12:00+07:00";

/**
 * The references the canvas draws as already issued. A new reference continues their numbering, so the mock
 * never issues one the canvas uses for another record.
 */
export const CANVAS_REFERENCES: readonly string[] = [
  "PTC-2025-0931",
  "PTC-2026-0107",
  "PTC-2026-0342",
  "PTC-2026-0655",
  "AMD-2026-0044",
  "OBJ-2026-0061",
];

/** Each organisation's starting state, by RightOne ID's id. Rule: only what the canvas draws for it. */
export function participationSeed(): Readonly<Record<string, OrganisationSeed>> {
  return {
    lamhong: {
      legalName: LAM_HONG.organisation,
      shortName: LAM_HONG.shortName,
      partyRecord: null,
      partyKind: null,
      draft: null,
      participation: LAM_HONG,
      decisions: [],
      objections: [],
    },
    // The governance boards name it and its administrator, nothing the catalogue would hold.
    hacbach: {
      legalName: "Trung tâm Quyền biểu diễn Hạc Bạch",
      shortName: "Hạc Bạch",
      partyRecord: null,
      partyKind: null,
      draft: null,
      participation: null,
      decisions: [],
      objections: [],
    },
    dayan: {
      legalName: "Dây Đàn Rights Agency",
      shortName: "Dây Đàn Rights Agency",
      partyRecord: "PTY-331274",
      partyKind: "organisation",
      draft: { savedAt: DAY_DAN_SAVED_AT, fields: DAY_DAN_DRAFT },
      participation: null,
      decisions: [],
      objections: [],
    },
  };
}

// ---------------------------------------------------------------- the scope as at a date

/** The registers' own orders, which the scope table sorts by. */
const RIGHT_ORDER: readonly ScopeKey["right"][] = ["perf", "mech", "sync"];
const TERRITORY_ORDER: readonly Territory[] = ["hn", "dn", "hp", "hue", "hcm"];

const inForce = (row: ScopeRow, asOf: string) => row.from <= asOf && (row.to === null || asOf < row.to);
const covers = (key: ScopeKey, right: ScopeKey["right"], territory: Territory) => key.right === right && key.territory === territory;

/**
 * The scope rows in force on `asOf`, sorted by right then territory (the board's sort note), and the gap
 * sentence's combinations: a right the scope represents in some territory and not in another territory the
 * scope covers (SCR-CAT-02, "The gap sentence is computed, not written"). A gap names the earliest pending
 * amendment that would add it.
 */
export function scopeAsAt(participation: MyParticipation, asOf: string): ScopeView {
  const rows = participation.scope
    .filter((row) => inForce(row, asOf))
    .sort(
      (a, b) =>
        RIGHT_ORDER.indexOf(a.right) - RIGHT_ORDER.indexOf(b.right) || TERRITORY_ORDER.indexOf(a.territory) - TERRITORY_ORDER.indexOf(b.territory),
    );
  const territories = TERRITORY_ORDER.filter((territory) => rows.some((row) => row.territory === territory));
  const rights = RIGHT_ORDER.filter((right) => rows.some((row) => row.right === right));
  const gaps: ScopeGap[] = [];
  for (const right of rights) {
    for (const territory of territories) {
      if (rows.some((row) => covers(row, right, territory))) continue;
      const adding = participation.amendments
        .filter((amendment) => amendment.effectiveFrom > asOf && amendment.additions.some((key) => covers(key, right, territory)))
        .map((amendment) => amendment.effectiveFrom)
        .sort();
      gaps.push({ right, territory, addedFrom: adding[0] ?? null });
    }
  }
  return { asOf, rows, gaps };
}

// ---------------------------------------------------------------- SCR-CAT-01

export function mockApplicationForm(view: Exclude<Cat01View, "loading">): LoadOutcome<ApplicationForm> {
  if (view === "error") return failure("INTERNAL_ERROR", "af7775d5b61e2cb3", true);
  if (view === "refused") return failure("ROLE_OUT_OF_SCOPE", null, false);
  const missing = view === "missing";
  return {
    data: {
      organisation: { legalName: "Dây Đàn Rights Agency", partyRecord: "PTY-331274", partyKind: "organisation" },
      savedAt: DAY_DAN_SAVED_AT,
      fields: missing ? DAY_DAN_DRAFT : DAY_DAN_COMPLETE,
      missing: missing ? ["authority_evidence_ref", "territory"] : [],
    },
    failure: null,
  };
}

// ---------------------------------------------------------------- SCR-CAT-02

/** The states only design review draws, each for its own organisation, with the board's own words for its reasons. */
function otherStates(locale: Locale): Readonly<Record<"approved" | "suspended" | "withdrawn", MyParticipation>> {
  const vi = locale === "vi";
  return {
    approved: {
      reference: "PTC-2026-0655",
      organisation: "Đĩa Than Mộc Records",
      shortName: "Đĩa Than Mộc Records",
      kind: null,
      state: "APPROVED",
      appliedAt: null,
      approvedOn: "2026-09-30",
      effectiveFrom: "2026-11-01",
      lastReviewedOn: null,
      stop: null,
      scope: [],
      amendments: [],
      decision: null,
    },
    suspended: {
      reference: "PTC-2026-0342",
      organisation: "Bến Sậy Publishing",
      shortName: "Bến Sậy Publishing",
      kind: "publisher",
      state: "SUSPENDED",
      appliedAt: null,
      approvedOn: null,
      effectiveFrom: "2026-08-01",
      lastReviewedOn: null,
      stop: {
        kind: "suspension",
        effectiveFrom: "2026-09-23",
        reason: vi
          ? "Hồ sơ chứng minh thẩm quyền ghi một đầu mối đã rời tổ chức từ tháng 8, và tổ chức chưa gửi người thay thế."
          : "The authority evidence names a contact who left the organisation in August, and no replacement was filed.",
        decidedBy: "Đặng Minh Khoa",
        decidedOn: "2026-09-22",
        claimsKept: null,
      },
      scope: [row("perf", "hn", 642, "2026-08-01"), row("perf", "hcm", 218, "2026-08-01"), row("mech", "hn", 405, "2026-08-01")],
      amendments: [],
      decision: "PTC-2026-0342",
    },
    withdrawn: {
      reference: "PTC-2025-0931",
      organisation: "Hội Nghệ sĩ Biểu diễn Sông Cầu",
      shortName: "Hội Nghệ sĩ Biểu diễn Sông Cầu",
      kind: null,
      state: "WITHDRAWN",
      appliedAt: null,
      approvedOn: null,
      effectiveFrom: "2025-11-01",
      lastReviewedOn: null,
      stop: {
        kind: "withdrawal",
        effectiveFrom: "2026-09-30",
        reason: vi ? "Uỷ quyền hết hạn ngày 31 tháng 7, 2026 và không được gia hạn." : "The mandate expired on 31 July 2026 and was not renewed.",
        decidedBy: "Nguyễn Hạnh Dung",
        decidedOn: "2026-09-30",
        claimsKept: 367,
      },
      // The board draws no row: the three closed at the withdrawal are kept, and none is in force.
      scope: [],
      amendments: [],
      decision: null,
    },
  };
}

/**
 * SCR-CAT-02 as the board drew it for a state. `asOf` undefined reads the board's date; null is a cleared date.
 * The suspended board draws no gap sentence, although its rows leave mechanical rights in Hồ Chí Minh City
 * unrepresented; review shows it as drawn (reported to the BA).
 */
export function mockMyParticipation(
  view: Exclude<Cat02View, "loading">,
  state: Cat02State,
  asOf: string | null | undefined,
  locale: Locale,
): LoadOutcome<ParticipationPage> {
  if (view === "error") return failure("INTERNAL_ERROR", "384081b126dffda8", true);
  if (view === "refused") return failure("ROLE_OUT_OF_SCOPE", null, false);
  const participation = state === "active" ? LAM_HONG : otherStates(locale)[state];
  const date = asOf === undefined ? BOARD_TODAY : asOf;
  const computed = date === null ? null : scopeAsAt(participation, date);
  const scope = computed !== null && state !== "active" ? { ...computed, gaps: [] } : computed;
  return { data: { participation, scope, legalReader: LEGAL_READER }, failure: null };
}

// ---------------------------------------------------------------- SCR-CAT-03

export function mockAmendmentStep(view: Exclude<Cat03View, "loading">): LoadOutcome<AmendmentStep> {
  if (view === "error") return failure("INTERNAL_ERROR", "92dae84126ad8b04", true);
  if (view === "refused") return failure("AMENDMENT_NOT_PENDING", null, false);
  const drafting = view === "draft" || view === "past-date";
  return {
    data: {
      participation: { reference: LAM_HONG.reference, organisation: LAM_HONG.organisation, shortName: LAM_HONG.shortName },
      today: BOARD_TODAY,
      current: scopeAsAt(LAM_HONG, BOARD_TODAY).rows,
      amendment: AMD_0044,
      preparer: "La Bảo Trân",
      legalReader: LEGAL_READER,
      draft: drafting
        ? { additions: [{ right: "mech", repertoire: "dom", territory: "hp" }], removals: [], effectiveFrom: view === "past-date" ? "2026-09-15" : "2026-11-01" }
        : null,
    },
    failure: null,
  };
}

// ---------------------------------------------------------------- SCR-CAT-25

/** The objection the board draws open and decided, OBJ-2026-0061 against Bến Sậy's suspension. */
function objection(view: "already-open" | "decided", locale: Locale): ObjectionRecord {
  const vi = locale === "vi";
  return {
    reference: "OBJ-2026-0061",
    decision: "PTC-2026-0342",
    requested: "objection",
    ground: vi
      ? "Quyết định đình chỉ dựa trên một đầu mối liên hệ mà chúng tôi đã thay trong tháng 8, và đã báo cổng ngày 14 tháng 8, 2026 theo mã CT-2026-0331."
      : "The suspension cites a contact we replaced in August, and we told the gateway on 14 August 2026 under reference CT-2026-0331.",
    lodgedAt: "2026-09-29T15:42:00+07:00",
    dueAt: "2026-10-14",
    outcome:
      view === "decided"
        ? {
            outcome: "upheld",
            ground: vi
              ? "Thông báo CT-2026-0331 đã đến cổng ngày 14 tháng 8, 2026 nhưng chưa được ghi vào hồ sơ. Việc đình chỉ được huỷ; tư cách tham gia được khôi phục từ 1 tháng 10, 2026."
              : "Notice CT-2026-0331 reached the gateway on 14 August 2026 and was not filed. The suspension is lifted and the participation is reinstated from 1 October 2026.",
            decidedBy: "Nguyễn Hạnh Dung",
            decidedAt: "2026-09-30T09:40:00+07:00",
          }
        : null,
  };
}

export function mockObjectionStep(view: Exclude<Cat25View, "loading">, locale: Locale): LoadOutcome<ObjectionStep> {
  if (view === "error") return failure("INTERNAL_ERROR", "a399624acec18656", true);
  if (view === "refused") return failure("OBJECTION_UNKNOWN", null, false);
  const suspended = otherStates(locale).suspended;
  const stop = suspended.stop;
  return {
    data: {
      decision: { reference: suspended.reference, kind: "suspension", effectiveFrom: stop?.effectiveFrom ?? "", reason: stop?.reason ?? "" },
      participation: { reference: suspended.reference, organisation: suspended.organisation, state: suspended.state },
      objection: view === "already-open" || view === "decided" ? objection(view, locale) : null,
      // Lodged on the boards' today: ten days for a correction, twenty for an erasure, fifteen for an objection.
      dueBy: { correction: "2026-10-10", erasure: "2026-10-20", objection: "2026-10-15" },
      ground: view === "confirm" ? objection("already-open", locale).ground : "",
    },
    failure: null,
  };
}
