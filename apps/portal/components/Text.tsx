import type { ReactNode } from "react";

/** The type styles a screen sets running text in; each is a class the theme emits from the tokens. */
type Size = "sm" | "base" | "lg";

/** The design system's inks for text: the surface's own, secondary for a supporting line, muted for the least. */
const TONE = {
  primary: "var(--on-surface)",
  secondary: "var(--on-surface-secondary)",
  muted: "var(--on-surface-muted)",
} as const;

const WEIGHT = { medium: "var(--weight-medium)", semibold: "var(--weight-semibold)" } as const;

/** A comfortable line length for a paragraph that would otherwise run the width of a wide panel. */
const MEASURE = { xl: "var(--container-xl)", "2xl": "var(--container-2xl)" } as const;

export interface TextProps {
  /** A paragraph by default; a heading where the canvas sets a heading in running text. */
  as?: "p" | "h2" | "h3" | "span";
  /** Left out, the text takes the type of what it sits in: a banner's body, a result's body. */
  size?: Size;
  tone?: keyof typeof TONE;
  weight?: keyof typeof WEIGHT;
  measure?: keyof typeof MEASURE;
  /** For a heading a section is labelled by. */
  id?: string;
  children: ReactNode;
}

/**
 * Running text between design system components: a page's lead, a supporting line under a form, the body of
 * a banner. The design system R1 has no text component and its canvases write these as bare paragraphs with a
 * type class and an ink; this is that one pattern, so every screen sets text the same way and a change to it
 * is made once. Sizes, inks, weights and measures are tokens; nothing else about the text can be set here.
 */
export function Text({ as: Element = "p", size, tone, weight, measure, id, children }: TextProps) {
  return (
    <Element
      {...(id !== undefined ? { id } : {})}
      {...(size !== undefined ? { className: `text-${size}` } : {})}
      style={{
        margin: 0,
        ...(tone !== undefined ? { color: TONE[tone] } : {}),
        ...(weight !== undefined ? { fontWeight: WEIGHT[weight] } : {}),
        ...(measure !== undefined ? { maxWidth: MEASURE[measure] } : {}),
      }}
    >
      {children}
    </Element>
  );
}
