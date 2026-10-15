/**
 * WCAG 2.x relative luminance and contrast ratio.
 *
 * Implemented here rather than taken from a library because it is a dozen lines and it is the thing
 * the token tests are built on: a dependency that changes its rounding would quietly change what
 * the gate means.
 *
 * R1's dark theme draws its dividers and status tints as see-through layers (white at 10 %, green-400
 * at 12 %), so a colour may be `rgba()`. A see-through colour has no contrast of its own: it is laid
 * over the ground it sits on first, which is what `over` does and what `contrastRatio` does for a
 * see-through foreground.
 */
export function relativeLuminance(colour: string): number {
  const { rgb, alpha } = parseColour(colour);
  if (alpha < 1) throw new TypeError(`A see-through colour has no luminance until it is laid over a ground: ${colour}`);
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** The opaque colour a see-through `colour` shows over an opaque `ground`. */
export function over(colour: string, ground: string): string {
  const top = parseColour(colour);
  const under = parseColour(ground);
  if (under.alpha < 1) throw new TypeError(`The ground must be opaque: ${ground}`);
  const mixed = top.rgb.map((channel, i) => Math.round(channel * top.alpha + under.rgb[i]! * (1 - top.alpha)));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function contrastRatio(foreground: string, background: string): number {
  const front = parseColour(foreground).alpha < 1 ? over(foreground, background) : foreground;
  const a = relativeLuminance(front);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseColour(colour: string): { rgb: [number, number, number]; alpha: number } {
  const value = colour.trim();
  const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
  if (hex !== null) {
    const [, digits = "", alphaDigits] = hex;
    const n = parseInt(digits, 16);
    const alpha = alphaDigits === undefined ? 1 : parseInt(alphaDigits, 16) / 255;
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha };
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value);
  if (rgba !== null) {
    const [, r = "0", g = "0", b = "0", a] = rgba;
    return { rgb: [Number(r), Number(g), Number(b)], alpha: a === undefined ? 1 : Number(a) };
  }
  throw new TypeError(`Not a hex or rgba() colour: ${colour}`);
}

/** The two gates the frontend standard makes blocking. */
export const GATE = {
  /** Body text, and any text below 18.66 px bold or 24 px regular. */
  text: 4.5,
  /** Interactive boundaries, focus indicators, and meaningful non-text graphics. */
  nonText: 3,
} as const;
