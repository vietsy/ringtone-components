import { BalanceScreen } from "@/features/engagement/BalanceScreen";
import { artistPortal } from "@/features/engagement/participant";
import { requireArtist } from "@/lib/api/session";

type SearchParams = Record<string, string | string[] | undefined>;

/** SCR-ENG-02 Balance and history, for the artist, with the way to their referral reference (SCR-ENG-05). */
export default async function ArtistBalancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const artist = await requireArtist();
  return <BalanceScreen portal={artistPortal(artist)} params={await searchParams} />;
}
