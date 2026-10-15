import { usesMockData } from "@/lib/api/source";
import { RID01_PROVIDER_SETS, type ProviderSet } from "@/lib/mock/identity";
import type { Frame } from "@/lib/view/frame";

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;

/** The RightOne ID pages are one narrow column; on a phone the panel's inset tightens, as the canvas draws it. */
export function panelInset(frame: Frame): "sm" | "md" {
  return frame === "phone" ? "sm" : "md";
}

/**
 * The application the reader is signing in to. In the demonstration it is always RightOne; with mock data
 * `?client=none` shows RightOne ID's own sign-in, opened with no application in the address, as the
 * canvas's Client tweak does.
 */
export type Client = "rightone" | "none";

export function clientOf(searchParams: SearchParams): Client {
  return usesMockData() && searchParams.client === "none" ? "none" : "rightone";
}

/** The external providers RightOne ID offers: Google, as the canvas draws it; `?providers=all|none` with mock data. */
export function providersOf(searchParams: SearchParams): readonly string[] {
  const asked = searchParams.providers;
  const set: ProviderSet = usesMockData() && (asked === "all" || asked === "none") ? asked : "google";
  return RID01_PROVIDER_SETS[set];
}

