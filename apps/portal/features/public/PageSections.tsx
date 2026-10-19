import { Panel } from "@/components/r1";
import { Text } from "@/components/Text";
import type { LegalSection } from "@/lib/api/public";
import type { Locale } from "@/lib/i18n/translate";

/**
 * A section's heading as a reader is shown it: the words after its key where the author wrote both
 * ("ONE_LAWFUL_ROUTE - Một con đường hợp pháp", `ALG-462`), the page's own word for a heading that is only its key,
 * or the heading as written.
 */
export function sectionHeading(heading: string, words: Readonly<Record<string, string>>): string {
  const [key = "", ...rest] = heading.split(" - ");
  if (rest.length > 0) return rest.join(" - ").trim();
  return words[key.trim().toUpperCase().replace(/\s+/g, "_")] ?? heading;
}

/**
 * The sections of a public page's edition as the policy console published it (SCR-PUB-01, 11, 12), each a panel with its
 * heading and its text, a paragraph for each block the author separated with a blank line. The text is the approved
 * edition's own, never the catalogue's.
 */
export function PageSections({
  sections,
  words = {},
  inset,
  locale,
}: {
  sections: readonly LegalSection[];
  /** The page's word for a heading written only as its section key. */
  words?: Readonly<Record<string, string>>;
  inset: "sm" | "md";
  locale: Locale;
}) {
  return (
    <>
      {sections.map((section) => (
        <Panel key={section.id} title={sectionHeading(section.heading[locale], words)} level={2} gap="sm" inset={inset} density="portal" locale={locale}>
          {section.body[locale]
            .split(/\n{2,}/)
            .filter((paragraph) => paragraph.trim() !== "")
            .map((paragraph, index) => (
              <Text key={index} size="base">
                {paragraph.trim()}
              </Text>
            ))}
        </Panel>
      ))}
    </>
  );
}
