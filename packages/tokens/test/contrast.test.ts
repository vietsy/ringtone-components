import { describe, expect, it } from "vitest";
import { contrastRatio, GATE, over, SEMANTIC, STATUS_BY_THEME, THEMES, type ThemeName } from "../src/index.js";

/**
 * R1 states a measured ratio in the usage of the colour tokens that carry text or bound a control, and
 * this asserts 48 of them over the three themes, not every one R1 states. Two things are checked, not one: that
 * the pair still passes its gate, and that it still measures what the design system says it measures,
 * because a token edited to a near value would keep passing the gate while quietly making the
 * documentation wrong. Where R1 states no ratio (the player theme's positive, attention and danger tints),
 * the value is the measurement of 7 October 2026, kept so that a change shows; those tests say so in their names.
 */

function ratio(foreground: string, background: string): number {
  return Math.round(contrastRatio(foreground, background) * 100) / 100;
}

const GROUNDS = ["page", "surface", "surfaceRaised", "surfaceSunken"] as const;

describe("dark, the default for consoles, portals and public pages", () => {
  const t = THEMES.dark;

  it("is what SEMANTIC exports, so the portal's root variables are the dark theme", () => {
    expect(SEMANTIC).toBe(THEMES.dark);
  });

  it.each([
    ["on-surface on the card", t.onSurface, t.surface, 13.25, GATE.text],
    ["on-surface on the page", t.onSurface, t.page, 15.93, GATE.text],
    ["on-surface on a raised layer", t.onSurface, t.surfaceRaised, 11.59, GATE.text],
    ["on-surface-secondary on the card", t.onSurfaceSecondary, t.surface, 8.93, GATE.text],
    ["on-surface-secondary on a raised layer", t.onSurfaceSecondary, t.surfaceRaised, 7.82, GATE.text],
    ["on-surface-muted on the card", t.onSurfaceMuted, t.surface, 6.8, GATE.text],
    ["on-surface-muted on the page", t.onSurfaceMuted, t.page, 8.18, GATE.text],
    ["white label on the hovered primary button, the label nearest its gate", t.onButtonPrimary, t.buttonPrimaryHover, 4.66, GATE.text],
    ["accent on a selected row", t.accent, t.accentSurface, 5.32, GATE.text],
    ["on-surface on a selected row", t.onSurface, t.accentSurface, 13.29, GATE.text],
    ["words on the danger fill", t.onDanger, t.dangerFill, 6.36, GATE.text],
    ["on-surface-muted on a raised layer", t.onSurfaceMuted, t.surfaceRaised, 5.95, GATE.text],
    ["accent on the card", t.accent, t.surface, 5.3, GATE.text],
    ["accent on the page", t.accent, t.page, 6.37, GATE.text],
    ["accent on a raised layer, the thinnest text pair", t.accent, t.surfaceRaised, 4.64, GATE.text],
    ["border-control on the card", t.borderControl, t.surface, 5.02, GATE.nonText],
    ["border-control on the page", t.borderControl, t.page, 6.04, GATE.nonText],
    ["border-control on a raised layer", t.borderControl, t.surfaceRaised, 4.4, GATE.nonText],
    ["focus on a raised layer", t.focus, t.surfaceRaised, 4.64, GATE.nonText],
    ["a mark on the accent fill", t.onAccent, t.accent, 6.37, GATE.text],
    ["words on the attention fill", t.onAttention, t.attentionFill, 10.55, GATE.text],
    ["code ink on code paper", t.codeInk, t.codePaper, 17.61, GATE.text],
    ["white label on the primary button", t.onButtonPrimary, t.buttonPrimary, 5.36, GATE.text],
    ["white label on the danger button", t.onButtonDanger, t.buttonDanger, 6.47, GATE.text],
  ])("%s", (_name, foreground, background, documented, gate) => {
    const measured = ratio(foreground, background);
    expect(measured).toBeCloseTo(documented, 1);
    expect(measured).toBeGreaterThanOrEqual(gate);
  });

  it("clears 4.5:1 for every text token on every ground", () => {
    for (const text of ["onSurface", "onSurfaceSecondary", "onSurfaceMuted", "accent"] as const) {
      for (const ground of GROUNDS) {
        expect(ratio(t[text], t[ground])).toBeGreaterThanOrEqual(GATE.text);
      }
    }
  });

  it("draws its divider see-through and too faint to bound a control, which is why controls use border-control", () => {
    expect(t.border.startsWith("rgba(")).toBe(true);
    expect(ratio(t.border, t.surface)).toBeLessThan(GATE.nonText);
    expect(ratio(t.borderControl, t.surface)).toBeGreaterThanOrEqual(GATE.nonText);
  });
});

describe("light, paper only: the printed record and a document sheet", () => {
  const t = THEMES.light;

  it.each([
    ["on-surface on white", t.onSurface, t.surface, 14.64, GATE.text],
    ["on-surface on the page tint", t.onSurface, t.page, 13.25, GATE.text],
    ["a mark on the accent fill", t.onAccent, t.accent, 5.36, GATE.text],
    ["words on the attention fill", t.onAttention, t.attentionFill, 8.77, GATE.text],
    ["code ink on code paper", t.codeInk, t.codePaper, 14.64, GATE.text],
    ["border-control on the page tint", t.borderControl, t.page, 4.34, GATE.nonText],
    ["white label on the danger button", t.onButtonDanger, t.buttonDanger, 4.83, GATE.text],
    ["white label on the hovered primary button", t.onButtonPrimary, t.buttonPrimaryHover, 7.65, GATE.text],
    ["words on the danger fill", t.onDanger, t.dangerFill, 4.83, GATE.text],
    ["info text on the page tint", t.infoText, t.page, 7.75, GATE.text],
    ["on-surface-secondary on white", t.onSurfaceSecondary, t.surface, 6.08, GATE.text],
    ["on-surface-secondary on the page tint", t.onSurfaceSecondary, t.page, 5.5, GATE.text],
    ["on-surface-muted on white", t.onSurfaceMuted, t.surface, 4.79, GATE.text],
    ["accent on white", t.accent, t.surface, 5.36, GATE.text],
    ["accent on the page tint", t.accent, t.page, 4.85, GATE.text],
    ["border-control on white", t.borderControl, t.surface, 4.79, GATE.nonText],
    ["focus on white", t.focus, t.surface, 3.67, GATE.nonText],
  ])("%s", (_name, foreground, background, documented, gate) => {
    const measured = ratio(foreground, background);
    expect(measured).toBeCloseTo(documented, 1);
    expect(measured).toBeGreaterThanOrEqual(gate);
  });

  it("keeps muted text on white: on the page tint it measures 4.34 and fails 4.5", () => {
    // The pair that fails first on paper. It is the reason muted text on a light region sits on a
    // white card and never directly on the tinted page or a sunken panel.
    const measured = ratio(t.onSurfaceMuted, t.page);
    expect(measured).toBeCloseTo(4.34, 1);
    expect(measured).toBeLessThan(GATE.text);
  });

  it("shows why a fill is not text on paper: the amber fill on white", () => {
    expect(ratio(t.attentionFill, t.surface)).toBeLessThan(GATE.text);
    expect(t.attentionText).not.toBe(t.attentionFill);
  });
});

describe("player, the device and the guest display", () => {
  const t = THEMES.player;

  it.each([
    ["on-surface-secondary on its lightest ground", t.onSurfaceSecondary, t.surfaceRaised, 11.34, GATE.text],
    ["on-surface-muted on its lightest ground", t.onSurfaceMuted, t.surfaceRaised, 8.93, GATE.text],
    ["white label on the primary button", t.onButtonPrimary, t.buttonPrimary, 7.65, GATE.text],
    ["accent on the page", t.accent, t.page, 9.7, GATE.text],
    ["a mark on the accent fill", t.onAccent, t.accent, 8.86, GATE.text],
    ["white label on the danger button", t.onButtonDanger, t.buttonDanger, 8.31, GATE.text],
  ])("%s", (_name, foreground, background, documented, gate) => {
    const measured = ratio(foreground, background);
    expect(measured).toBeCloseTo(documented, 1);
    expect(measured).toBeGreaterThanOrEqual(gate);
  });
});

describe("every theme defines every themed colour", () => {
  it("names the same tokens on dark, light and player, each a colour value", () => {
    const names = Object.keys(THEMES.dark).sort();
    for (const theme of ["light", "player"] as const) {
      expect(Object.keys(THEMES[theme]).sort()).toEqual(names);
    }
    for (const theme of ["dark", "light", "player"] as const) {
      for (const value of Object.values(THEMES[theme])) {
        expect(value).toMatch(/^(#[0-9a-f]{6}|rgba\()/i);
      }
    }
  });
});

describe("every status family is legible as text on its own tint, laid over the card", () => {
  // Dark and light, and the player's neutral and info: the ratios R1 states. The player's positive,
  // attention and danger tints have no stated ratio in R1; those three are the measurements of
  // 7 October 2026, so that a change to one of them shows here.
  const expected: Record<ThemeName, Record<"positive" | "attention" | "danger" | "neutral" | "info", number>> = {
    dark: { positive: 6.45, attention: 7.98, danger: 6.6, neutral: 5.27, info: 6.96 },
    light: { positive: 4.79, attention: 4.84, danger: 5.91, neutral: 4.71, info: 7.64 },
    player: { positive: 8.55, attention: 10.39, danger: 8.51, neutral: 5.27, info: 11.43 },
  };
  const measuredOnly = new Set(["player:positive", "player:attention", "player:danger"]);

  for (const theme of ["dark", "light", "player"] as const) {
    // The test name says where the expected value comes from, so a failure says it too.
    const rows = Object.entries(expected[theme]).map(
      ([family, value]) => [`${family} (${measuredOnly.has(`${theme}:${family}`) ? "measured 7 Oct 2026" : "R1 states"})`, family, value] as const,
    );
    it.each(rows)(`${theme}: %s`, (_label, family, value) => {
      const status = STATUS_BY_THEME[theme][family as keyof (typeof STATUS_BY_THEME)["dark"]];
      const tint = status.tint.startsWith("rgba(") ? over(status.tint, THEMES[theme].surface) : status.tint;
      const measured = ratio(status.text, tint);
      expect(measured).toBeCloseTo(value, 1);
      expect(measured).toBeGreaterThanOrEqual(GATE.text);
    });
  }
});
