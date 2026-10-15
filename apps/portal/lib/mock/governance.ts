import type { LoadOutcome } from "@rightone/ui";
import type { Locale } from "@/lib/i18n/translate";
import type { ChosenFile, Mandate, MandateDraft, MandateRegister, Organisation, OurMandate, RecordedTerms, ScopeRow, TermsPage, TermsVersion } from "@/lib/api/governance";

/** The view states SCR-GOV-14 was drawn in on the design canvas. */
export const GOV14_VIEWS = ["submitted", "empty-draft", "confirm", "insufficient", "suspended", "loading", "error"] as const;
export type Gov14View = (typeof GOV14_VIEWS)[number];

/** The view states SCR-GOV-15 was drawn in on the design canvas. */
export const GOV15_VIEWS = ["empty-not-recorded", "confirm", "recorded", "superseded", "loading", "error"] as const;
export type Gov15View = (typeof GOV15_VIEWS)[number];

const failure = (code: string, retryable: boolean, traceId: string | null = null) => ({ data: null, failure: { code, traceId, retryable } });
const ok = <T>(data: T): LoadOutcome<T> => ({ data, failure: null });

// ---------------------------------------------------------------- registers

/**
 * The authority register as far as the canvas draws it: one granting authority, the copyright office, which every
 * mandate on the GOV boards names (SCR-GOV-14, Hạc Bạch and Trường Xuân).
 */
const COPYRIGHT_OFFICE = { id: "cr", name: { vi: "Cục Bản quyền tác giả", en: "Copyright Office of Viet Nam" } } as const;

/**
 * The right types of `gov.mandate_scopes.right_type` as the canvas writes them. The spec keeps the set closed
 * ("check in set") without listing it. SCR-GOV-14 draws performers' rights (Hạc Bạch) and producers' rights
 * (Trường Xuân), and those are what the form offers; SCR-CAT-02 writes Lam Hồng's represented rights as
 * performing and mechanical, which only Lam Hồng's mandate carries (see the seed below).
 */
export const RIGHT_TYPES = ["performers", "producers", "performing", "mechanical"] as const;

/**
 * The provinces the GOV and CAT boards name, in the order SCR-GOV-14 lists them, as SCR-GOV-14 writes them in both
 * languages. Every row of every drawn mandate and scope falls in these six.
 */
const PROVINCES = [
  { code: "hn", name: "Hà Nội" },
  { code: "hcm", name: "TP. Hồ Chí Minh" },
  { code: "hp", name: "Hải Phòng" },
  { code: "dn", name: "Đà Nẵng" },
  { code: "hue", name: "Huế" },
  { code: "ct", name: "Cần Thơ" },
] as const;

export const MANDATE_REGISTER: MandateRegister = {
  authorities: [COPYRIGHT_OFFICE],
  rightTypes: ["performers", "producers"],
  provinces: PROVINCES,
};

/** The current version of the recorded participation terms: version 3, from 1 July 2026 (SCR-GOV-15). */
export const CURRENT_TERMS: TermsVersion = { version: "3", from: "2026-07-01" };

/** SCR-GOV-15's superseded view: version 4 replaced it on 29 September 2026 while the form was open. */
const LATER_TERMS: TermsVersion = { version: "4", from: "2026-09-29" };

const rows = (rightType: string, repertoire: string, territories: readonly string[]): ScopeRow[] =>
  territories.map((territory) => ({ rightType, repertoire, territory }));

// ---------------------------------------------------------------- the organisations' own records

/**
 * Hạc Bạch's mandate as SCR-GOV-14 draws it: submitted on 18 September 2026 and under the copyright authority's
 * review, performers' rights over the whole repertoire in four provinces, from 1 October 2026 with no end date.
 * The authority's review (SCR-GOV-02) is not built, so it stays submitted (SM-19 forbids SUBMITTED to EFFECTIVE).
 */
const HAC_BACH_MANDATE: Mandate = {
  state: "SUBMITTED",
  submittedOn: "2026-09-18",
  grantingAuthority: COPYRIGHT_OFFICE.id,
  evidence: { kind: "document", title: { vi: "Nghị quyết uỷ quyền của hội viên Hạc Bạch, 2026", en: "Hạc Bạch members’ resolution to mandate, 2026" } },
  scope: rows("performers", "*", ["hn", "hcm", "dn", "ct"]),
  effectiveFrom: "2026-10-01",
  effectiveTo: null,
  stoppedOn: null,
  review: null,
};

/**
 * Lam Hồng's mandate is drawn on no board; its state is derived. Lam Hồng participates (PTC-2026-0107, ACTIVE,
 * SCR-CAT-02), and the governance specification states that every participating organisation holds an approved
 * effective mandate (`BR-GOV-02`, GOV `frd/00-module-overview.md` §3), that a participation is activated only on an
 * approved mandate (`FR-CAT-002`), and that every represented component the gateway acts on names the effective
 * mandate covering it (`FR-GOV-004`). So the mandate is EFFECTIVE and covers at least the five scope rows
 * SCR-CAT-02 draws as approved and in force: performing rights in Hà Nội, Hải Phòng and Hồ Chí Minh City,
 * mechanical rights in Hà Nội and Hồ Chí Minh City, domestic repertoire. Nothing draws its granting authority, its
 * document, its submission or its own period, so those read as not recorded.
 */
const LAM_HONG_MANDATE: Mandate = {
  state: "EFFECTIVE",
  submittedOn: null,
  grantingAuthority: null,
  evidence: null,
  scope: [...rows("performing", "domestic", ["hn", "hp", "hcm"]), ...rows("mechanical", "domestic", ["hn", "hcm"])],
  effectiveFrom: null,
  effectiveTo: null,
  stoppedOn: null,
  review: null,
};

export interface OrganisationSeed {
  /** The name the boards use in a sentence; null where no board draws one. */
  shortName: string | null;
  mandate: Mandate | null;
  terms: RecordedTerms | null;
}

/**
 * Each organisation's governance records, from the boards that draw that organisation. Hạc Bạch: the mandate
 * above, no terms recorded (SCR-GOV-15's first state). Lam Hồng: the derived mandate; no terms, since nothing
 * draws them and no rule makes a catalogue participation imply them. Dây Đàn: nothing submitted, nothing recorded.
 * The short names are the boards' (Hạc Bạch on the GOV boards, Lam Hồng on SCR-CAT-02); Dây Đàn has none drawn.
 */
export const GOVERNANCE_SEED: Readonly<Record<string, OrganisationSeed>> = {
  hacbach: { shortName: "Hạc Bạch", mandate: HAC_BACH_MANDATE, terms: null },
  lamhong: { shortName: "Lam Hồng", mandate: LAM_HONG_MANDATE, terms: null },
  dayan: { shortName: null, mandate: null, terms: null },
};

// ---------------------------------------------------------------- SCR-GOV-14 review states

const HAC_BACH: Organisation = { name: "Trung tâm Quyền biểu diễn Hạc Bạch", shortName: "Hạc Bạch" };

/** The board's draft: two of the four rows typed, the copyright office chosen, the evidence not yet attached. */
const DRAFT: MandateDraft = {
  authority: COPYRIGHT_OFFICE.id,
  evidence: null,
  rows: rows("performers", "*", ["hn", "hcm"]),
  from: "2026-10-01",
  to: null,
  savedAt: "2026-09-29T09:40:00+07:00",
};

/** The confirm view's file: 1.4 MB, named in each language as the board names it. */
const resolution = (locale: Locale): ChosenFile => ({
  name: locale === "vi" ? "nghi-quyet-uy-quyen-hac-bach-2026.pdf" : "hac-bach-mandate-resolution-2026.pdf",
  type: "application/pdf",
  sizeBytes: 1_400_000,
});

/** The suspended view draws another organisation's mandate: Trường Xuân, producers' rights in six provinces. */
const TRUONG_XUAN: Organisation = { name: "Hiệp hội Nhà sản xuất Bản ghi Trường Xuân", shortName: "Trường Xuân" };

const TRUONG_XUAN_MANDATE: Mandate = {
  state: "SUSPENDED",
  submittedOn: null,
  grantingAuthority: COPYRIGHT_OFFICE.id,
  evidence: { kind: "document", title: { vi: "Nghị quyết uỷ quyền của hội đồng Trường Xuân, 2026", en: "Trường Xuân board resolution to mandate, 2026" } },
  scope: rows("producers", "*", ["hn", "hcm", "hp", "dn", "hue", "ct"]),
  effectiveFrom: "2026-08-01",
  effectiveTo: null,
  stoppedOn: "2026-09-01",
  review: null,
};

/** SCR-GOV-14's answers, per view. */
export function mockOurMandate(view: Exclude<Gov14View, "loading">, locale: Locale): LoadOutcome<OurMandate> {
  const page = (organisation: Organisation, mandate: Mandate | null, draft: MandateDraft | null) =>
    ok<OurMandate>({ organisation, mandate, draft, register: MANDATE_REGISTER });
  switch (view) {
    case "submitted":
      return page(HAC_BACH, HAC_BACH_MANDATE, null);
    case "empty-draft":
      return page(HAC_BACH, null, DRAFT);
    case "confirm":
      return page(HAC_BACH, null, { ...DRAFT, evidence: resolution(locale), rows: rows("performers", "*", ["hn", "hcm", "dn", "ct"]) });
    case "insufficient":
      return page(HAC_BACH, {
        ...HAC_BACH_MANDATE,
        review: {
          reason: {
            vi: "Nghị quyết trong hồ sơ chưa có chữ ký. Gửi bản có chữ ký kèm biên bản cuộc họp đã thông qua nghị quyết.",
            en: "The resolution in the file is unsigned. Send the signed copy with the minutes of the meeting that adopted it.",
          },
        },
      }, null);
    case "suspended":
      return page(TRUONG_XUAN, TRUONG_XUAN_MANDATE, null);
    case "error":
      return failure("INTERNAL_ERROR", true, "1e4b7c05a2f69d83");
  }
}

// ---------------------------------------------------------------- SCR-GOV-15 review states

/** SCR-GOV-15's answers, per view. The form's date is the board's 1 October 2026 wherever the form is drawn. */
export function mockParticipationTerms(view: Exclude<Gov15View, "loading">): LoadOutcome<TermsPage> {
  switch (view) {
    case "empty-not-recorded":
    case "confirm":
      return ok({ organisation: HAC_BACH, current: CURRENT_TERMS, terms: null, entered: "2026-10-01" });
    case "recorded":
      return ok({
        organisation: HAC_BACH,
        current: CURRENT_TERMS,
        terms: { version: CURRENT_TERMS, effectiveFrom: "2026-10-01", recordedAt: "2026-09-29T10:25:00+07:00", state: "EFFECTIVE", directLicensingRetained: true },
        entered: null,
      });
    case "superseded":
      return ok({ organisation: HAC_BACH, current: LATER_TERMS, terms: null, entered: "2026-10-01" });
    case "error":
      return failure("INTERNAL_ERROR", true, "72c0e9d48b3a165e");
  }
}
