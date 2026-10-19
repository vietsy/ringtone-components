import { premisesPortal } from "@/features/engagement/participant";
import { TakePartScreen } from "@/features/engagement/TakePartScreen";
import { requirePrincipal } from "@/lib/api/session";

type SearchParams = Record<string, string | string[] | undefined>;

/** SCR-ENG-01 Take part in engagement, for the premises principal: the screen both participant portals draw. */
export default async function TakePartPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  return <TakePartScreen portal={premisesPortal(principal)} params={await searchParams} />;
}
