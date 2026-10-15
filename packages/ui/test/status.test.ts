import { describe, expect, it } from "vitest";
import { familyOf, presentStatus, PRODUCT_SPECIFIC_STATES } from "../src/index.js";

describe("the five mappings the design brief calls out", () => {
  it("offline-but-playing is info, never danger", () => {
    // Offline is normal operation under FR-PLR-013. Red here trains the venue to ignore red, and
    // then it ignores the red that means the entitlement has been revoked.
    expect(familyOf("offline_still_playing")).toBe("info");
    expect(familyOf("offline_still_playing")).not.toBe("danger");
  });

  it("held value is attention, never danger", () => {
    // Money on hold is a governed outcome. Nobody did anything wrong.
    expect(familyOf("held_value")).toBe("attention");
    expect(familyOf("held_value")).not.toBe("danger");
  });

  it("warned or medium-risk is attention, because it may still progress", () => {
    expect(familyOf("warned_medium_risk")).toBe("attention");
  });

  it("overdue remittance is danger, because it is a breach of the baseline", () => {
    expect(familyOf("overdue_remittance")).toBe("danger");
  });

  it("no payable obligation is positive - a correct, complete outcome and not an empty result", () => {
    expect(familyOf("no_payable_obligation")).toBe("positive");
    expect(familyOf("no_payable_obligation")).not.toBe("neutral");
  });

  it("names all five, so a future reviewer knows which mappings are deliberate", () => {
    expect(PRODUCT_SPECIFIC_STATES).toHaveLength(5);
  });
});

describe("the general mapping", () => {
  it.each([
    ["active", "positive"],
    ["accepted", "positive"],
    ["pending", "attention"],
    ["revoked", "danger"],
    ["superseded", "neutral"],
    ["queued", "info"],
  ] as const)("%s is %s", (state, family) => {
    expect(familyOf(state)).toBe(family);
  });
});

describe("never colour alone", () => {
  it("gives every mapped state a label key and an icon shape", () => {
    for (const state of ["active", "held_value", "revoked", "draft", "queued"]) {
      const presentation = presentStatus(state);
      expect(presentation).not.toBeNull();
      expect(presentation?.labelKey).toBe(`status.${state}`);
      expect(presentation?.iconShape).toBeTruthy();
    }
  });

  it("gives each family a distinct icon shape, so deuteranopia and a photocopy both still work", () => {
    const shapes = ["active", "pending", "revoked", "draft", "queued"].map((s) => presentStatus(s)?.iconShape);
    expect(new Set(shapes).size).toBe(5);
  });
});

describe("an unmapped state", () => {
  it("returns null rather than defaulting to neutral", () => {
    // Defaulting would render an unknown state as "historical", which is a claim about the
    // business rather than an admission that nobody mapped it.
    expect(familyOf("some_state_nobody_mapped")).toBeNull();
    expect(presentStatus("some_state_nobody_mapped")).toBeNull();
  });
});
