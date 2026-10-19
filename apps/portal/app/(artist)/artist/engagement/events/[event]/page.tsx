import { EventScreen } from "@/features/engagement/EventScreen";
import { artistPortal } from "@/features/engagement/participant";
import { requireArtist } from "@/lib/api/session";

type SearchParams = Record<string, string | string[] | undefined>;

/** SCR-ENG-04 One ledger event, the artist's own: the screen both participant portals draw. */
export default async function ArtistLedgerEventPage({ params, searchParams }: { params: Promise<{ event: string }>; searchParams: Promise<SearchParams> }) {
  const artist = await requireArtist();
  const [{ event }, query] = await Promise.all([params, searchParams]);
  return <EventScreen portal={artistPortal(artist)} id={event} params={query} />;
}
