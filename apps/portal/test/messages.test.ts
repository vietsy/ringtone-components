import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { presentError } from "../lib/errors/messages.js";

const here = dirname(fileURLToPath(import.meta.url));
const load = (locale: string) =>
  JSON.parse(readFileSync(resolve(here, `../messages/${locale}.json`), "utf8")) as Record<string, string>;

const vi = load("vi");
const en = load("en");

describe("the message catalogue", () => {
  it("has the same keys in both locales", () => {
    // A key present in one locale and missing in the other is a screen that reads correctly for
    // half the users and shows a raw key to the rest.
    expect(Object.keys(vi).sort()).toEqual(Object.keys(en).sort());
  });

  it("has no empty string, which would render as a blank where an explanation belongs", () => {
    for (const [key, value] of Object.entries({ ...vi, ...en })) {
      expect(value.trim().length, `empty message for ${key}`).toBeGreaterThan(0);
    }
  });

  it("carries a message for every error code the client can receive from the contract", () => {
    const codes = [
      "VERIFICATION_REFERENCE_NOT_FOUND",
      "RATE_LIMITED",
      "INTERNAL_ERROR",
      "FORBIDDEN",
      "UNAUTHENTICATED",
    ];
    for (const code of codes) {
      expect(vi[`error.${code}`], `missing vi message for ${code}`).toBeTruthy();
      expect(en[`error.${code}`], `missing en message for ${code}`).toBeTruthy();
    }
  });
});

describe("rendering an error from its code (R23.8)", () => {
  it("uses the catalogue, not the server's sentence", () => {
    expect(presentError("VERIFICATION_REFERENCE_NOT_FOUND", null).message).toBe(
      vi["error.VERIFICATION_REFERENCE_NOT_FOUND"],
    );
  });

  it("falls back to a usable message rather than showing a raw code", () => {
    expect(presentError("A_CODE_WE_HAVE_NOT_SEEN", null).message).toBe(vi["error.UNKNOWN"]);
  });

  it("offers a retry only where retrying can work", () => {
    expect(presentError("RATE_LIMITED", null).retryable).toBe(true);
    expect(presentError("INTERNAL_ERROR", null).retryable).toBe(true);
    // Offering a retry on a refusal wastes the user's time and teaches them to ignore the button.
    expect(presentError("FORBIDDEN", null).retryable).toBe(false);
    expect(presentError("VERIFICATION_REFERENCE_NOT_FOUND", null).retryable).toBe(false);
  });

  it("carries the trace identifier through so a user can quote it", () => {
    expect(presentError("INTERNAL_ERROR", "trace-abc").traceId).toBe("trace-abc");
  });
});

describe("the explanation on a governed empty state", () => {
  it("exists, because 'No results' alone is a dead end", () => {
    expect(vi["empty.verification.governed"]!.length).toBeGreaterThan(20);
  });
});

describe("the screen catalogues in messages/screens", () => {
  const dir = resolve(here, "../messages/screens");
  const files = readdirSync(dir).filter((name) => name.endsWith(".json"));
  const areas = [...new Set(files.map((name) => name.replace(/\.(vi|en)\.json$/, "")))];
  const read = (name: string) => JSON.parse(readFileSync(resolve(dir, name), "utf8")) as Record<string, string>;

  it("comes in pairs, one per locale", () => {
    for (const area of areas) {
      expect(files, `${area} needs both locales`).toEqual(expect.arrayContaining([`${area}.vi.json`, `${area}.en.json`]));
    }
  });

  it.each(areas)("%s has the same keys in both locales and no empty message", (area) => {
    const viArea = read(`${area}.vi.json`);
    const enArea = read(`${area}.en.json`);
    expect(Object.keys(viArea).sort()).toEqual(Object.keys(enArea).sort());
    for (const [key, value] of Object.entries({ ...viArea, ...enArea })) {
      expect(value.trim().length, `empty message for ${area} ${key}`).toBeGreaterThan(0);
    }
  });
});
