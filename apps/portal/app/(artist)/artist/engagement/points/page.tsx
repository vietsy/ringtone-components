import { artistPortal } from "@/features/engagement/participant";
import { PointsScreen } from "@/features/engagement/PointsScreen";
import { requireArtist } from "@/lib/api/session";

type SearchParams = Record<string, string | string[] | undefined>;

/** SCR-ENG-03 What these points are, for the artist: the screen both participant portals draw. */
export default async function ArtistPointsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const artist = await requireArtist();
  return <PointsScreen portal={artistPortal(artist)} params={await searchParams} />;
}
