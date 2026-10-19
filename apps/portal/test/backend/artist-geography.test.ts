import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadArtistGeography, type GeographyAnswer, type GeographyAsk, type GeographyTerms } from "@/lib/api/artist-geography";
import { artistGeography, artistGeographyReleases, decideGeography, geographyTermsInForce, type GeographyQuestion } from "@/lib/mock/backend/data-governance";
import { GEOGRAPHY_AREAS, GEOGRAPHY_PERIODS, geographyUse } from "@/lib/mock/artist-geography";
import { MOCK_ARTIST } from "@/lib/mock/session";
import { PEOPLE, signIn } from "./harness";

/*
 * DAT's artist-facing geography read (`GET /reporting/artist-geography`, `DR-92`, `ALG-66`), played by the mock
 * backend for the artist portal: the policy in force is version 1 of SCR-DAT-16's board (province only, a minimum of
 * ten venues, differencing across periods), and every answer is written to the artist's release log. The rows a
 * finer level needs (a basis, a ward breakdown) are asked of the rule itself, because the policy in force permits no
 * level finer than the province (`DEC-23` is open).
 */

const NOW = "2026-10-17T09:00:00+07:00";
const ARTIST = { email: MOCK_ARTIST.email, name: MOCK_ARTIST.name };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const ask = (area: string, period = "2026-Q3", extra: Partial<GeographyAsk> = {}): GeographyAsk => ({ area, level: "province", period, identify: false, ...extra });

function answered(key: string, asked: GeographyAsk): GeographyAnswer {
  const answer = artistGeography(key, ARTIST, asked);
  if (answer.data === null) throw new Error(`no answer: ${JSON.stringify(answer.failure)}`);
  return answer.data;
}

const log = (key: string) => artistGeographyReleases(key, ARTIST).data ?? [];

describe("GET /artist-geography under geography policy version 1", () => {
  it("@AC-FR-DAT-012-01 answers at the approved default level, with no premises identity and no premises count", () => {
    const key = signIn(PEOPLE.artist);
    const answer = answered(key, ask("hcm"));
    expect(answer).toMatchObject({ outcome: "RELEASE", reason: "DEFAULT_LEVEL", level: "province", basis: null, terms: { version: 1, defaultLevel: "province", minimum: 10 } });
    expect(answer.plays).toBe(geographyUse("hcm", "2026-Q3").plays);
    expect(JSON.stringify(answer)).not.toMatch(/hcm-\d{3}|212/);
  });

  it("@AC-FR-DAT-012-03 refuses the identity of a venue, records the attempt with the artist and the instant, and keeps the view at the province", async () => {
    vi.stubEnv("RIGHTONE_DATA", "mock");
    const key = signIn(PEOPLE.artist);
    const page = await loadArtistGeography({ sessionId: key, account: MOCK_ARTIST.name, email: MOCK_ARTIST.email }, ask("hn", "2026-Q3", { identify: true }), null);
    expect(page.data?.identityRefused).toEqual({ at: new Date(NOW).toISOString() });
    expect(page.data?.answer).toMatchObject({ outcome: "RELEASE", reason: "DEFAULT_LEVEL", level: "province" });
    expect(JSON.stringify(page.data)).not.toMatch(/hn-\d{3}/);
    expect(log(key).at(-1)).toMatchObject({ outcome: "REFUSE", reason: "PREMISES_IDENTITY_NOT_DISCLOSABLE", by: MOCK_ARTIST.name, recordedAt: new Date(NOW).toISOString() });
  });

  it("@AC-FR-DAT-012-07 refuses the ward level with LEVEL_NOT_PERMITTED, returning no figure and naming the approved levels, and records it", () => {
    const key = signIn(PEOPLE.artist);
    const answer = answered(key, ask("hcm", "2026-Q3", { level: "ward" }));
    expect(answer).toMatchObject({ outcome: "REFUSE", reason: "LEVEL_NOT_PERMITTED", plays: null, level: null, children: [], terms: { permittedLevels: ["province"] } });
    expect(log(key)[0]).toMatchObject({ requestedLevel: "ward", reason: "LEVEL_NOT_PERMITTED", recordedAt: new Date(NOW).toISOString() });
  });

  it("@AC-FR-DAT-037-01 releases a province holding more venues than the minimum, stating the level it is aggregated to", () => {
    const key = signIn(PEOPLE.artist);
    expect(answered(key, ask("hn"))).toMatchObject({ outcome: "RELEASE", reason: "DEFAULT_LEVEL", level: "province" });
  });

  it("@AC-FR-DAT-037-02 releases a scope holding exactly the minimum, the boundary inclusive", () => {
    const key = signIn(PEOPLE.artist);
    expect(geographyUse("hn", "2026-09").premises.size).toBe(10);
    const answer = answered(key, ask("hn", "2026-09"));
    expect(answer).toMatchObject({ outcome: "RELEASE", reason: "AT_MINIMUM_INCLUSIVE", level: "province" });
    expect(answer.plays).toBeGreaterThan(0);
  });

  it("@AC-FR-DAT-037-03 suppresses a province of four venues as suppressed, never as zero, however it is asked again", () => {
    const key = signIn(PEOPLE.artist);
    for (const period of ["2026-Q3", "2026-09", "2026-Q3"]) {
      expect(answered(key, ask("dn", period))).toMatchObject({ outcome: "SUPPRESS", reason: "GEOGRAPHY_BELOW_MINIMUM", plays: null });
    }
    expect(log(key).map((row) => row.outcome)).toEqual(["SUPPRESS", "SUPPRESS", "SUPPRESS"]);
  });

  it("@AC-FR-DAT-037-04 shows the suppressed province as suppressed and adds its figure to no neighbour", () => {
    const key = signIn(PEOPLE.artist);
    expect(answered(key, ask("dn")).outcome).toBe("SUPPRESS");
    const city = answered(key, ask("hcm"));
    expect(city.plays).toBe(geographyUse("hcm", "2026-Q3").plays);
    expect(city.plays).not.toBe(geographyUse("hcm", "2026-Q3").plays + geographyUse("dn", "2026-Q3").plays);
  });

  it("@AC-FR-DAT-038-01 releases two answers for one province whose difference covers exactly the minimum", () => {
    const key = signIn(PEOPLE.artist);
    expect(answered(key, ask("hn", "2026-Q3")).outcome).toBe("RELEASE");
    expect(answered(key, ask("hn", "2026-08")).outcome).toBe("RELEASE");
  });

  it("@AC-FR-DAT-038-03 refuses the month that, beside the quarter already released, would disclose one venue, naming the quarter", () => {
    const key = signIn(PEOPLE.artist);
    expect(answered(key, ask("ct", "2026-Q3"))).toMatchObject({ outcome: "RELEASE", reason: "DEFAULT_LEVEL" });
    const month = answered(key, ask("ct", "2026-09"));
    expect(month).toMatchObject({ outcome: "REFUSE", reason: "DIFFERENCING_WOULD_DISCLOSE", plays: null, compared: { area: { code: "ct" }, period: { code: "2026-Q3" } } });
    expect(log(key)[0]).toMatchObject({ reason: "DIFFERENCING_WOULD_DISCLOSE", period: { code: "2026-09" }, compared: { period: { code: "2026-Q3" } }, recordedAt: new Date(NOW).toISOString() });
  });

  it("tests a request only against answers released, so a refused one leaves nothing to compare", () => {
    const key = signIn(PEOPLE.artist);
    expect(answered(key, ask("ct", "2026-07", { level: "ward" })).outcome).toBe("REFUSE");
    expect(answered(key, ask("ct", "2026-Q3")).outcome).toBe("RELEASE");
  });

  it("answers only an artist, and only for an area and a period it holds", () => {
    const key = signIn(PEOPLE.artist);
    expect(artistGeography(key, { email: "trang.do@thencuaviet.vn", name: "Đỗ Thu Trang" }, ask("hcm")).failure?.code).toBe("NOT_AUTHORISED");
    expect(artistGeography(key, ARTIST, ask("ben-thanh")).failure?.code).toBe("FIELD_MISSING");
    expect(artistGeography(key, ARTIST, ask("hcm", "2026-Q4")).failure?.code).toBe("FIELD_MISSING");
    expect(log(key)).toEqual([]);
  });
});

/** The terms of a policy that permits the ward level beside the province, as the DPO would sign once `DEC-23` lands. */
const FINER: GeographyTerms = { version: 2, permittedLevels: ["province", "ward"], defaultLevel: "province", minimum: 10, differencingAcrossPeriods: true };

const area = (code: string) => {
  const found = GEOGRAPHY_AREAS.find((candidate) => candidate.code === code);
  if (found === undefined) throw new Error(code);
  return found;
};
const period = (code: string) => {
  const found = GEOGRAPHY_PERIODS.find((candidate) => candidate.code === code);
  if (found === undefined) throw new Error(code);
  return found;
};
const scope = (areaCode: string, periodCode = "2026-Q3") => ({ area: area(areaCode), period: period(periodCode), ...geographyUse(areaCode, periodCode) });

function question(overrides: Partial<GeographyQuestion>): GeographyQuestion {
  return { terms: FINER, scope: scope("hcm"), requestedLevel: "ward", identify: false, basis: null, lapsed: null, prior: [], children: ["ben-thanh", "sai-gon", "cho-lon"].map((code) => scope(code)), ...overrides };
}

describe("DR-92's rows for a finer level, asked of the rule", () => {
  it("releases the ward level where an effective basis permits it, stating the basis, and shows a ward of four venues suppressed", () => {
    const decided = decideGeography(question({ basis: { ref: "DSB-2027-004", level: "ward", effectiveTo: null } }));
    expect(decided).toMatchObject({ outcome: "RELEASE", reason: "BASIS_PERMITS_FINER_LEVEL", level: "ward", basis: { ref: "DSB-2027-004" } });
    expect(decided.children.map((child) => [child.area.code, child.suppressed])).toEqual([
      ["ben-thanh", false],
      ["sai-gon", true],
      ["cho-lon", false],
    ]);
    expect(decided.children.find((child) => child.area.code === "sai-gon")?.plays).toBeNull();
  });

  it("falls back to the default level where the basis has lapsed, and says the finer basis is not effective", () => {
    const decided = decideGeography(question({ lapsed: { ref: "DSB-2026-011", level: "ward", effectiveTo: "2026-10-16" } }));
    expect(decided).toMatchObject({ outcome: "RELEASE", reason: "BASIS_NOT_EFFECTIVE", level: "province", basis: null, lapsedBasis: { ref: "DSB-2026-011" }, children: [] });
  });

  it("refuses a month whose difference from the quarter already released would disclose fewer venues than the minimum", () => {
    const decided = decideGeography(question({ scope: scope("ct", "2026-09"), requestedLevel: "province", children: [], prior: [scope("ct", "2026-Q3")] }));
    expect(decided).toMatchObject({ outcome: "REFUSE", reason: "DIFFERENCING_WOULD_DISCLOSE", compared: { period: { code: "2026-Q3" } } });
  });

  it("does not compare periods where the policy says so, and releases the month at the minimum", () => {
    const decided = decideGeography(question({ terms: { ...FINER, differencingAcrossPeriods: false }, scope: scope("ct", "2026-09"), requestedLevel: "province", children: [], prior: [scope("ct", "2026-Q3")] }));
    expect(decided).toMatchObject({ outcome: "RELEASE", reason: "AT_MINIMUM_INCLUSIVE" });
  });

  it("bounds every answer by the policy in force today, version 1 of the board", () => {
    const key = signIn(PEOPLE.artist);
    expect(geographyTermsInForce(key)).toEqual({ version: 1, permittedLevels: ["province"], defaultLevel: "province", minimum: 10, differencingAcrossPeriods: true });
  });
});
