import { artistPortal } from "@/features/engagement/participant";
import { ReferralScreen } from "@/features/engagement/ReferralScreen";
import { requireArtist } from "@/lib/api/session";

type SearchParams = Record<string, string | string[] | undefined>;

/** SCR-ENG-05 Referral reference, the artist's alone. */
export default async function ArtistReferralPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const artist = await requireArtist();
  return <ReferralScreen portal={artistPortal(artist)} artist={artist} params={await searchParams} />;
}
