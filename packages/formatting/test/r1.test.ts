import { describe, expect, it } from "vitest";
import { formatCount, formatDate, formatMoney, formatPeriod, formatTimestamp, NO_VALUE } from "../src/index.js";
import { R1_FORMAT } from "../src/index.js";

const NBSP = " ";
const MINUS = "−";

describe("R1 money", () => {
  it("writes the dong with its code after the amount, in both languages", () => {
    expect(R1_FORMAT.formatMoney(1_250_000, "VND", "vi")).toBe(`1.250.000${NBSP}VND`);
    expect(R1_FORMAT.formatMoney(1_250_000, "VND", "en")).toBe(`1,250,000${NBSP}VND`);
  });

  it("takes the minus sign U+2212 for a negative amount, never the hyphen", () => {
    expect(R1_FORMAT.formatMoney(-450_000, "VND", "vi")).toBe(`${MINUS}450.000${NBSP}VND`);
  });

  it("gives the digits alone for a column that names its currency", () => {
    expect(R1_FORMAT.formatMoney(1_250_000, "VND", "vi", true)).toBe("1.250.000");
  });

  it("returns null for an unknown amount, so the component draws its own dash", () => {
    expect(R1_FORMAT.formatMoney(null, "VND", "vi")).toBeNull();
    expect(R1_FORMAT.formatMoney(undefined, "VND", "vi")).toBeNull();
  });

  it("is the rule the package's own formatMoney follows", () => {
    expect(formatMoney({ amountMinor: 1_250_000, currency: "VND" })).toBe(`1.250.000${NBSP}VND`);
    expect(formatMoney(null)).toBe(NO_VALUE);
  });
});

describe("R1 counts and percentages", () => {
  it("renders a zero count as 0 and a negative one with U+2212", () => {
    expect(R1_FORMAT.formatCount(0, "vi")).toBe("0");
    expect(R1_FORMAT.formatCount(-3, "vi")).toBe(`${MINUS}3`);
    expect(formatCount(1_234)).toBe("1.234");
  });

  it("puts a no-break space before the percent sign in Vietnamese only", () => {
    expect(R1_FORMAT.formatPercent(96.42, "vi")).toBe(`96,4${NBSP}%`);
    expect(R1_FORMAT.formatPercent(96.42, "en")).toBe("96.4%");
  });

  it("fixes the decimals when asked", () => {
    expect(R1_FORMAT.formatPercent(14, "vi", { decimals: 2 })).toBe(`14,00${NBSP}%`);
  });

  it("returns null for a percentage it cannot read", () => {
    expect(R1_FORMAT.formatPercent(null, "vi")).toBeNull();
    expect(R1_FORMAT.formatPercent("", "vi")).toBeNull();
    expect(R1_FORMAT.formatPercent("abc", "vi")).toBeNull();
  });
});

describe("R1 dates", () => {
  const instant = "2026-09-17T01:15:00.000Z"; // 08:15 in Ho Chi Minh

  it("writes September's short month as Sep, like every other month", () => {
    expect(R1_FORMAT.formatDateShort(instant, "en")).toBe("17 Sep 2026");
    expect(R1_FORMAT.formatTimestamp(instant, "en")).toBe("17 Sep 2026, 08:15 (GMT+7)");
  });

  it("reads the time in the premises zone, whatever the second argument", () => {
    expect(R1_FORMAT.formatTime(instant)).toBe("08:15");
  });

  it("writes a period inside one month with its first day once", () => {
    expect(R1_FORMAT.formatPeriod("2026-09-01T00:00:00+07:00", "2026-09-30T00:00:00+07:00", "en")).toBe("1–30 September 2026");
  });

  it("spells both ends of a period that crosses a month", () => {
    expect(R1_FORMAT.formatPeriod("2026-09-18", "2027-09-17", "en")).toBe("18 September 2026 – 17 September 2027");
  });

  it("returns null for a date it cannot read", () => {
    expect(R1_FORMAT.formatDate("not a date", "vi")).toBeNull();
    expect(R1_FORMAT.formatPeriod(null, "2026-09-30", "vi")).toBeNull();
  });

  it("is the rule the package's own date functions follow in the premises zone", () => {
    const date = new Date(instant);
    expect(formatDate(date, "vi")).toBe(R1_FORMAT.formatDate(date, "vi"));
    expect(formatTimestamp(date, "en")).toBe(R1_FORMAT.formatTimestamp(date, "en"));
    expect(formatPeriod(new Date("2026-09-01T00:00:00+07:00"), new Date("2026-09-30T00:00:00+07:00"), "vi")).toBe(
      R1_FORMAT.formatPeriod("2026-09-01T00:00:00+07:00", "2026-09-30T00:00:00+07:00", "vi"),
    );
  });
});
