import {
  BACKDROP,
  BREAKPOINT,
  DURATION,
  EASING,
  FONT_FAMILY,
  FONT_SIZE,
  FONT_WEIGHT,
  LETTER_SPACING,
  LINE_HEIGHT,
  OPACITY,
  PRIMITIVE,
  RADIUS,
  SCALE,
  SHADOW,
  SIZE,
  SPACE,
  THEMES,
  TYPE_STYLES,
  Z_INDEX,
  type ThemeName,
} from "@rightone/tokens";

/**
 * Every design token as a CSS custom property, under the names the design system R1 gives them, so the R1
 * components' stylesheet resolves against this and a hex value exists in exactly one place
 * (`@rightone/tokens`). A colour written directly into a stylesheet is copied within a week, and the
 * divergence is then permanent - which is the reason the token layer exists at all.
 *
 * The layout follows R1's own tokens.css: the dark theme on `:root` (there is no theme switch: dark is every
 * console, portal and public page), light for paper under `[data-theme="light"]`, the Player device and the
 * guest display under `[data-theme="player"]`, then every scale on `:root` and the type styles as classes.
 * `test/theme.test.ts` holds this to R1's tokens.css, value by value.
 */
export function themeCss(): string {
  return [
    block(':root, [data-theme="dark"]', ["color-scheme: dark", ...properties(PRIMITIVE), ...theme("dark"), ...properties(BACKDROP)]),
    block('[data-theme="light"]', ["color-scheme: light", ...theme("light")]),
    block('[data-theme="player"]', ["color-scheme: dark", ...theme("player")]),
    block(":root", [
      ...properties(SPACE),
      ...properties(RADIUS),
      ...properties(FONT_SIZE),
      ...properties(LINE_HEIGHT),
      ...properties(FONT_WEIGHT),
      ...properties(LETTER_SPACING),
      ...properties(SIZE),
      ...properties(DURATION),
      ...properties(EASING),
      ...properties(BREAKPOINT),
      ...properties(Z_INDEX),
      ...properties(OPACITY),
      ...properties(SCALE),
      ...Object.entries(FONT_FAMILY).map(([name, value]) => `--font-${name}: ${value}`),
    ]),
    ...typeStyles(),
  ].join("\n");
}

function theme(name: ThemeName): string[] {
  return [
    ...Object.entries(THEMES[name]).map(([token, value]) => `--${kebab(token)}: ${value}`),
    ...properties(SHADOW[name]),
  ];
}

function properties(scale: Readonly<Record<string, string>>): string[] {
  return Object.entries(scale).map(([name, value]) => `--${name}: ${value}`);
}

function typeStyles(): string[] {
  return Object.values(TYPE_STYLES).flatMap(({ family, styles }) =>
    Object.entries(styles as Readonly<Record<string, TypeStyle>>).map(
      ([name, style]) =>
        `.${name} { font-family: var(--font-${family}); font-size: ${style.fontSize}; line-height: ${style.lineHeight}; font-weight: ${style.fontWeight}; }`,
    ),
  );
}

interface TypeStyle {
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
}

function block(selector: string, declarations: string[]): string {
  return `${selector} {\n${declarations.map((declaration) => `  ${declaration};`).join("\n")}\n}`;
}

/** R1's names fold to camelCase in the token package; turning one back gives the R1 variable name. */
function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
