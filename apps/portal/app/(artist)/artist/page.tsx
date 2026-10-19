import { redirect } from "next/navigation";
import { requireArtist } from "@/lib/api/session";
import { routes } from "@/lib/routes";

/**
 * The artist portal's landing, where an artist arrives signed in. Of the portal's screens only the artist's engagement
 * (SCR-ENG-01 to 05) and the location view DAT answers are specified, so the portal opens on the first item of its nav.
 */
export default async function ArtistPage(): Promise<never> {
  await requireArtist();
  redirect(routes.artistEngagement());
}
