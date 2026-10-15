import { currentInspector } from "@/lib/api/session";
import { usesMockData } from "@/lib/api/source";
import type { Frame } from "@/lib/view/frame";

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/**
 * The canvas draws every public page at 1280 ("page"), 390 and 320. A phone takes the narrow layout:
 * tighter gaps, smaller panel insets and full-width buttons; a tablet reads the page layout.
 */
export function publicLayout(frame: Frame) {
  const narrow = frame === "phone";
  return {
    narrow,
    gap: narrow ? "var(--space-4)" : "var(--space-6)",
    inset: narrow ? ("sm" as const) : ("md" as const),
  };
}

/**
 * Who reads a verification page. An inspector is not admitted to the help journey, so the help and
 * correction routes are not offered to them. An inspector signed in reads the inspector's page; with mock
 * data `?reader=inspector` shows it to a reviewer too, as the canvas's Reader tweak does.
 */
export type Reader = "public" | "inspector";

export async function readerOf(searchParams: SearchParams): Promise<Reader> {
  if (usesMockData() && searchParams.reader === "inspector") return "inspector";
  return (await currentInspector()) !== null ? "inspector" : "public";
}
