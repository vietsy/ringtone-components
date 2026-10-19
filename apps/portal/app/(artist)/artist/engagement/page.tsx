import { artistPortal } from "@/features/engagement/participant";
import { TakePartScreen } from "@/features/engagement/TakePartScreen";
import { requireArtist } from "@/lib/api/session";

type SearchParams = Record<string, string | string[] | undefined>;

/** SCR-ENG-01 Take part in engagement, for the artist: the screen both participant portals draw. */
export default async function ArtistTakePartPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const artist = await requireArtist();
  return <TakePartScreen portal={artistPortal(artist)} params={await searchParams} />;
}
