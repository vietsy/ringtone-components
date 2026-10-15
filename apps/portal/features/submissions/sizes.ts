import { R1_FORMAT } from "@rightone/formatting";
import type { Locale } from "@/lib/i18n/translate";

/**
 * A file's size as the boards write it: megabytes to one decimal ("3.8 MB", "3,8 MB"), kilobytes for a file
 * under a tenth of a megabyte, so a small file never reads "0 MB". Decimal units, as a file manager shows them.
 * The unit's words are the catalogue's; this gives the figure and which unit to use.
 */
export function sizeParts(bytes: number, locale: Locale): { value: string; unit: "MB" | "KB" } {
  if (bytes >= 100_000) return { value: R1_FORMAT.nf(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes / 1_000_000), unit: "MB" };
  return { value: R1_FORMAT.nf(locale, { maximumFractionDigits: 0 }).format(Math.max(1, Math.ceil(bytes / 1000))), unit: "KB" };
}

/** A catalogue template with its placeholders filled, for the client components handed templates. */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);
}
