import type { LoadOutcome } from "@rightone/ui";
import type {
  CancelPage,
  ClaimRecord,
  ExchangeChannel,
  OrgReader,
  SubmitFormPage,
  Submission,
  SubmissionOutcome,
  SubmissionPage,
} from "@/lib/api/submissions";

/*
 * The catalogue's submissions and claims as the CAT boards draw them (SCR-CAT-04, 05, 07, 24), word for word.
 * Every board draws Lam Hồng (Hội Quyền tác giả Âm nhạc Lam Hồng, participation PTC-2026-0107) and its
 * administrator La Bảo Trân: SUB-2026-09-27-0731, received 27 September 2026 and completed with 2,318 outcomes;
 * SUB-2026-09-30-0268, received 30 September 2026 and not yet processed; the claim CLM-2026-017734 recorded from
 * record 00406 of the first. Only SCR-CAT-04's suspended view draws another organisation, Bến Sậy Publishing.
 *
 * Two uses: each `mockX(view)` answers the state a board drew, for design review (`?view=`); the seeds below are
 * the session's starting state in the mock backend (`backend/submissions.ts`). Nothing is drawn for Hạc Bạch's or
 * Dây Đàn's submissions or claims, so they have none.
 */

// ---------------------------------------------------------------- the view states each board drew

export const CAT04_VIEWS = ["populated", "submitting", "too-large", "channel-refused", "suspended", "loading", "error"] as const;
export type Cat04View = (typeof CAT04_VIEWS)[number];

export const CAT05_VIEWS = ["populated", "confirm", "acknowledged", "received", "processing", "empty", "loading", "error", "refused"] as const;
export type Cat05View = (typeof CAT05_VIEWS)[number];

export const CAT24_VIEWS = ["populated", "confirm", "processing-began", "refused", "loading", "error"] as const;
export type Cat24View = (typeof CAT24_VIEWS)[number];

/**
 * SCR-CAT-07's portal reader: its view states, with its completeness outcomes as views of their own (the board
 * draws them under a second tweak; "populated" is its default outcome, rule-absent). The board's catalogue-officer
 * reader and its confirm view draw the operations console's validation, which is not this portal's screen.
 */
export const CAT07_VIEWS = [
  "populated",
  "complete",
  "short",
  "over",
  "beneficiary-partial",
  "not-stated",
  "absent",
  "whole",
  "loading",
  "error",
  "refused",
] as const;
export type Cat07View = (typeof CAT07_VIEWS)[number];

// ---------------------------------------------------------------- the canvas's world

/** The organisation every CAT board draws. */
export const BOARD_ORGANISATION = "lamhong";

const LAM_HONG = "Hội Quyền tác giả Âm nhạc Lam Hồng";

const LAM_HONG_READER: OrgReader = {
  organisationName: LAM_HONG,
  account: "La Bảo Trân",
  participation: { reference: "PTC-2026-0107", state: "ACTIVE" },
};

/**
 * The channels SCR-CAT-04 offers: CFG-31's register, the direct API and the CSV profile (approved 24 September
 * 2026), and the CWR file the board offers as not agreed. The format each register entry carries is its profile.
 */
export const CHANNELS: readonly ExchangeChannel[] = [
  { code: "api", format: "json", agreed: true },
  { code: "csv", format: "csv", agreed: true },
  { code: "cwr", format: null, agreed: false },
];

/** NFR-12 and the API's payload ceiling: 50,000 records per submission. */
export const RECORD_CEILING = 50_000;

/** The seven records of SUB-2026-09-27-0731 that were not accepted, as SCR-CAT-05 lists them. */
const OUTCOMES_0731: readonly SubmissionOutcome[] = [
  {
    index: 42,
    subject: { title: "Hẹn thứ Bảy", right: "mechanical", territory: "Hải Phòng", claim: null },
    outcome: "REJECTED",
    reason: { code: "TERRITORY_NOT_REPRESENTED" },
    route: { kind: "scope-amendment" },
  },
  {
    index: 117,
    subject: { title: "Chín giờ tan ca", right: null, territory: null, claim: null },
    outcome: "REJECTED",
    reason: { code: "IDENTIFIER_FORMAT", scheme: "ISWC" },
    route: { kind: "correct-identifier", scheme: "ISWC" },
  },
  {
    index: 233,
    subject: { title: "Khẽ thôi, phố ngủ rồi", right: null, territory: null, claim: null },
    outcome: "CONFLICT",
    reason: { code: "CLAIM_CONFLICT" },
    route: { kind: "conflict-handling" },
  },
  {
    index: 318,
    subject: { title: "Để anh nói nốt", right: null, territory: null, claim: null },
    outcome: "DUPLICATE",
    reason: { code: "RECORD_DUPLICATE", heldAs: "WRK-418270" },
    route: { kind: "none-duplicate" },
  },
  {
    index: 406,
    subject: { title: "Để anh nói nốt", right: null, territory: null, claim: "CLM-2026-017734" },
    outcome: "WARNING",
    reason: { code: "COMPLETENESS_RULE_ABSENT" },
    route: { kind: "none-activation" },
  },
  {
    index: 1152,
    subject: { title: "Về đi, trời mưa rồi", right: null, territory: null, claim: null },
    outcome: "WARNING",
    reason: { code: "CREDIT_KIND_UNRECOGNISED", credit: "arrangement" },
    route: { kind: "supplement-credit" },
  },
  {
    index: 1877,
    subject: { title: "Chín giờ tan ca", right: null, territory: null, claim: null },
    outcome: "WARNING",
    reason: { code: "ROLE_MISSING", role: "lyricist" },
    route: { kind: "supplement-role", role: "lyricist" },
  },
];

/** SUB-2026-09-27-0731 as SCR-CAT-05 draws it by default: completed, not yet acknowledged. */
const SUB_0731: Submission = {
  reference: "SUB-2026-09-27-0731",
  state: "COMPLETED",
  channel: "api",
  format: "json",
  records: 2318,
  file: null,
  receivedAt: "2026-09-27T09:14:00+07:00",
  submittedBy: "La Bảo Trân",
  processing: null,
  completedAt: "2026-09-27T11:52:00+07:00",
  counts: { ACCEPTED: 2311, WARNING: 3, REJECTED: 2, DUPLICATE: 1, CONFLICT: 1 },
  outcomes: OUTCOMES_0731,
  acknowledged: null,
  cancelled: null,
};

/** SUB-2026-09-30-0268 as SCR-CAT-24 draws it: received, no record classified. The board names no submitter. */
const SUB_0268: Submission = {
  reference: "SUB-2026-09-30-0268",
  state: "RECEIVED",
  channel: "api",
  format: "json",
  records: 42760,
  file: null,
  receivedAt: "2026-09-30T10:14:22+07:00",
  submittedBy: null,
  processing: null,
  completedAt: null,
  counts: null,
  outcomes: [],
  acknowledged: null,
  cancelled: null,
};

/** Each organisation's submissions when a session starts. */
export const SUBMISSIONS_SEED: readonly { organisation: string; submission: Submission }[] = [
  { organisation: BOARD_ORGANISATION, submission: SUB_0731 },
  { organisation: BOARD_ORGANISATION, submission: SUB_0268 },
];

/** CLM-2026-017734 as SCR-CAT-07 draws it: declared, two ownership shares from 1 September 2026, no beneficiary. */
const CLM_017734: ClaimRecord = {
  reference: "CLM-2026-017734",
  state: "DECLARED",
  claimant: LAM_HONG,
  subject: { kind: "work", title: "Để anh nói nốt", id: "WRK-418270" },
  layer: "work",
  territory: "Hà Nội",
  basis: "assignment-from-member",
  effectiveFrom: "2026-09-01",
  recordedOn: "2026-09-27",
  source: { submission: "SUB-2026-09-27-0731", record: 406 },
  wholeInterest: false,
  shares: [
    { kind: "ownership", party: "Võ Duy Khê", forParty: null, percent: 60, from: "2026-09-01", to: null },
    { kind: "ownership", party: "Vy Sa", forParty: null, percent: 40, from: "2026-09-01", to: null },
  ],
};

export const CLAIMS_SEED: readonly { organisation: string; claim: ClaimRecord }[] = [{ organisation: BOARD_ORGANISATION, claim: CLM_017734 }];

/** A version of CFG-29, the completeness rule: the total each share kind must reach, from a date. */
export interface CompletenessRule {
  /** Null where no start is drawn: the version is in force at every date read. */
  from: string | null;
  requiredTotal: number;
}

/**
 * The rule versions in force in the canvas's world: none. SCR-CAT-07 draws CLM-2026-017734 on 30 September 2026
 * with no completeness rule in force (its default outcome), and SCR-CAT-05 gives record 00406 the same reason.
 */
export const COMPLETENESS_RULES: readonly CompletenessRule[] = [];

/**
 * The rule SCR-CAT-07's other outcomes are drawn under: shares must total the whole interest (CFG-29). The board
 * reads it on 31 August 2026 as well as on 30 September and draws no date it is in force from, so none is set.
 */
const CFG_29: readonly CompletenessRule[] = [{ from: null, requiredTotal: 100 }];

// ---------------------------------------------------------------- the boards' states

const failure = (code: string, retryable: boolean, traceId: string | null = null) => ({ data: null, failure: { code, traceId, retryable } });
const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });

/** SCR-CAT-04's states: the form with the canvas's file, part-way up, too large, an unagreed channel, suspended. */
export function mockSubmitForm(view: Exclude<Cat04View, "loading">): LoadOutcome<SubmitFormPage> {
  const file = { name: "lam-hong-tac-pham-2026-09-30.json", type: "application/json", sizeBytes: 3_800_000, records: 1286, upload: null };
  const page = (entered: SubmitFormPage["entered"], sending: SubmitFormPage["sending"] = null): SubmitFormPage => ({
    reader: LAM_HONG_READER,
    channels: CHANNELS,
    ceiling: RECORD_CEILING,
    entered,
    sending,
  });
  switch (view) {
    case "populated":
      return ok(page({ channel: "api", format: "json", file, refusal: null }));
    case "submitting":
      return ok(page({ channel: "api", format: "json", file, refusal: null }, { sentBytes: 2_400_000 }));
    case "too-large":
      return ok(
        page({
          channel: "api",
          format: "json",
          file: { name: "lam-hong-toan-bo-2026-09.json", type: "application/json", sizeBytes: 18_600_000, records: 61402, upload: null },
          refusal: { code: "PAYLOAD_TOO_LARGE", field: "file" },
        }),
      );
    case "channel-refused":
      return ok(page({ channel: "cwr", format: "json", file, refusal: { code: "CHANNEL_NOT_AGREED", field: "channel" } }));
    case "suspended":
      return ok({
        ...page(null),
        reader: { organisationName: "Bến Sậy Publishing", account: "Tôn Nữ Bích Vân", participation: { reference: "PTC-2026-0342", state: "SUSPENDED" } },
      });
    case "error":
      return failure("INTERNAL_ERROR", true, "cdcdda841d45db59");
  }
}

/** SCR-CAT-05's states, all of SUB-2026-09-27-0731. */
export function mockSubmission(view: Exclude<Cat05View, "loading">): LoadOutcome<SubmissionPage> {
  const page = (submission: Submission): SubmissionPage => ({ reader: LAM_HONG_READER, submission, refusal: null });
  const inFlight: Submission = { ...SUB_0731, state: "RECEIVED", completedAt: null, counts: null, outcomes: [] };
  switch (view) {
    case "populated":
    case "confirm":
      return ok(page(SUB_0731));
    case "acknowledged":
      return ok(page({ ...SUB_0731, state: "ACKNOWLEDGED", acknowledged: { by: "La Bảo Trân", at: "2026-09-27T14:05:00+07:00" } }));
    case "received":
      return ok(page(inFlight));
    case "processing":
      return ok(page({ ...inFlight, state: "PROCESSING", processing: { classified: 1904 } }));
    case "empty":
      return ok(page({ ...SUB_0731, counts: { ACCEPTED: 2318, WARNING: 0, REJECTED: 0, DUPLICATE: 0, CONFLICT: 0 }, outcomes: [] }));
    case "refused":
      return failure("NOT_YOUR_SUBMISSION", false);
    case "error":
      return failure("INTERNAL_ERROR", true, "95b6d744c5da327a");
  }
}

/** SCR-CAT-24's states, all of SUB-2026-09-30-0268; the board types the reason in its form. */
export function mockCancellation(view: Exclude<Cat24View, "loading">): LoadOutcome<CancelPage> {
  const page = (submission: Submission): CancelPage => ({ reader: LAM_HONG_READER, submission, entered: null });
  switch (view) {
    case "populated":
    case "confirm":
      return ok(page(SUB_0268));
    case "processing-began":
      return ok(page({ ...SUB_0268, state: "PROCESSING", processing: { classified: 0 } }));
    case "refused":
      return failure("NOT_YOUR_SUBMISSION", false);
    case "error":
      return failure("INTERNAL_ERROR", true, "8c54f4c2f076f873");
  }
}

/** SCR-CAT-07's states: the claim, the date its shares are read at, and the rule versions in force. */
export function mockClaim(
  view: Exclude<Cat07View, "loading">,
): LoadOutcome<{ reader: OrgReader; claim: ClaimRecord; asOf: string; rules: readonly CompletenessRule[] }> {
  const at = (claim: ClaimRecord, rules: readonly CompletenessRule[], asOf = "2026-09-30") => ok({ reader: LAM_HONG_READER, claim, asOf, rules });
  const owners = (vy: number, extra: number | null = null): ClaimRecord["shares"] => [
    { kind: "ownership", party: "Võ Duy Khê", forParty: null, percent: 60, from: "2026-09-01", to: null },
    { kind: "ownership", party: "Vy Sa", forParty: null, percent: vy, from: "2026-09-01", to: null },
    ...(extra !== null ? [{ kind: "ownership" as const, party: "Vy Sa", forParty: null, percent: extra, from: "2026-09-01", to: null }] : []),
  ];
  switch (view) {
    case "populated":
      return at(CLM_017734, COMPLETENESS_RULES);
    case "complete":
      return at(CLM_017734, CFG_29);
    case "short":
      return at({ ...CLM_017734, shares: owners(30) }, CFG_29);
    case "over":
      return at({ ...CLM_017734, shares: owners(40, 10) }, CFG_29);
    case "beneficiary-partial":
      return at(
        { ...CLM_017734, shares: [...owners(40), { kind: "beneficiary", party: "Bến Sậy Publishing", forParty: null, percent: 30, from: "2026-09-01", to: null }] },
        CFG_29,
      );
    case "not-stated":
      return at(
        { ...CLM_017734, shares: [{ kind: "ownership", party: "Lam Hồng", forParty: "Võ Duy Khê", percent: null, from: "2026-09-01", to: null }] },
        CFG_29,
      );
    case "absent":
      return at(CLM_017734, CFG_29, "2026-08-31");
    case "whole":
      return at({ ...CLM_017734, wholeInterest: true, shares: [] }, CFG_29);
    case "refused":
      return failure("ROLE_OUT_OF_SCOPE", false);
    case "error":
      return failure("INTERNAL_ERROR", true, "6ec849214ed19eb4");
  }
}
