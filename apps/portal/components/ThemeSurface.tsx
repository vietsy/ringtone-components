import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/translate";

/**
 * A page drawn in another of the design system's themes without a shell to set it: the printout is paper,
 * the light theme, inside a product that is dark everywhere else. The theme's own page colour, ink and type
 * apply under it, from the tokens of `[data-theme="light"]`; nothing else about the surface can be set here.
 */
export function ThemeSurface({ theme, locale, children }: { theme: "light" | "dark"; locale: Locale; children: ReactNode }) {
  return (
    <div
      data-theme={theme}
      lang={locale}
      style={{ minHeight: "100vh", background: "var(--page)", color: "var(--on-surface)", fontFamily: "var(--font-sans)" }}
    >
      {children}
    </div>
  );
}
