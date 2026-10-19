import type { Metadata } from "next";
import "@/components/r1/r1.css";
import { MockDataNote } from "@/components/MockDataNote";
import { usesMockData } from "@/lib/api/source";
import { getLocale } from "@/lib/i18n/locale";
import { themeCss } from "@/lib/theme/css-variables";

export const metadata: Metadata = {
  title: "RightOne",
  description: "RightOne platform portal",
};

/**
 * Vietnamese is the product language; English is the second locale. `lang` follows the reader's locale
 * because a screen reader announcing Vietnamese text with an English voice is unintelligible, and that is
 * a WCAG failure rather than a polish item.
 *
 * The design tokens are emitted here as CSS custom properties, so a hex value exists in exactly one place;
 * R1's component stylesheet reads them.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      </head>
      <body>
        {children}
        {usesMockData() && <MockDataNote locale={locale} />}
      </body>
    </html>
  );
}
