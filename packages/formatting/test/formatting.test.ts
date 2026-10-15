import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatDate,
  formatIdentifier,
  formatMoney,
  formatPercentage,
  formatPeriod,
  formatTimestamp,
  isUnknown,
  isZero,
  NO_VALUE,
} from "../src/index.js";

describe("money", () => {
  it("renders the dong with grouped digits and no invented decimals", () => {
    const rendered = formatMoney({ amountMinor: 1_250_000, currency: "VND" });
    expect(rendered).toContain("1.250.000");
    expect(rendered).not.toContain(",00");
  });

  it("always carries the currency", () => {
    expect(formatMoney({ amountMinor: 1_250_000, currency: "VND" })).toMatch(/[₫]|VND/);
  });

  it("renders an unknown amount as a dash, never as zero and never as blank", () => {
    // A blank where an amount belongs reads as zero. In every finance screen here, zero means
    // "calculated, and it came to nothing" while unknown means "not calculated".
    expect(formatMoney(null)).toBe(NO_VALUE);
    expect(formatMoney(null)).not.toBe("");
    expect(formatMoney(null)).not.toContain("0");
  });

  it("renders a real zero as zero, because that is a different fact", () => {
    expect(formatMoney({ amountMinor: 0, currency: "VND" })).toContain("0");
  });

  it("lets code tell zero and unknown apart without parsing the rendered string", () => {
    expect(isZero({ amountMinor: 0, currency: "VND" })).toBe(true);
    expect(isZero(null)).toBe(false);
    expect(isUnknown(null)).toBe(true);
  });

  it("keeps two decimals for a currency that has them", () => {
    expect(formatMoney({ amountMinor: 123_45, currency: "USD" }, "en")).toContain("123.45");
  });
});

describe("dates", () => {
  const instant = new Date("2026-09-17T01:15:00.000Z"); // 08:15 in Ho Chi Minh

  it("never renders a date numeric-only", () => {
    const rendered = formatDate(instant, "en");
    expect(rendered).toContain("September");
    expect(rendered).not.toMatch(/^\d+\/\d+\/\d+$/);
  });

  it("evaluates in the premises time zone, not the reader's", () => {
    expect(formatDate(new Date("2026-09-17T18:00:00.000Z"), "en")).toContain("18");
  });

  it("carries the offset on a timestamp, in a form that survives a photocopy", () => {
    const rendered = formatTimestamp(instant, "en");
    expect(rendered).toContain("08:15");
    expect(rendered).toContain("GMT+7");
  });

  it("states a period as an explicit range so the last day is not in doubt", () => {
    const rendered = formatPeriod(new Date("2026-09-01T00:00:00+07:00"), new Date("2026-09-30T00:00:00+07:00"), "en");
    expect(rendered).toContain("1");
    expect(rendered).toContain("30 September 2026");
  });

  it("spells both ends when a period crosses a month", () => {
    const rendered = formatPeriod(new Date("2026-09-15T00:00:00+07:00"), new Date("2026-10-14T00:00:00+07:00"), "en");
    expect(rendered).toContain("September");
    expect(rendered).toContain("October");
  });
});

describe("percentages, identifiers and counts", () => {
  it("states the basis when one is given", () => {
    expect(formatPercentage(62.5, "of qualifying playbacks")).toBe("62.5% of qualifying playbacks");
  });

  it("renders an unknown percentage as a dash", () => {
    expect(formatPercentage(null)).toBe(NO_VALUE);
  });

  it("leaves an identifier exactly as the certificate spells it", () => {
    expect(formatIdentifier(" R1-CER-2026-J7K2M4QP ")).toBe("R1-CER-2026-J7K2M4QP");
    expect(formatIdentifier("r1-cer-2026")).toBe("r1-cer-2026");
  });

  it("renders a missing identifier as a dash rather than an empty cell", () => {
    expect(formatIdentifier(null)).toBe(NO_VALUE);
    expect(formatIdentifier("   ")).toBe(NO_VALUE);
  });

  it("renders a zero count as 0, which is the opposite of the money rule and deliberately so", () => {
    // "None, and we counted" is what the reader needs from a count.
    expect(formatCount(0)).toBe("0");
    expect(formatCount(null)).toBe(NO_VALUE);
  });
});
