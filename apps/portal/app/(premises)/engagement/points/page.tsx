import { premisesPortal } from "@/features/engagement/participant";
import { PointsScreen } from "@/features/engagement/PointsScreen";
import { requirePrincipal } from "@/lib/api/session";

type SearchParams = Record<string, string | string[] | undefined>;

/** SCR-ENG-03 What these points are, for the premises principal: the screen both participant portals draw. */
export default async function PointsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  return <PointsScreen portal={premisesPortal(principal)} params={await searchParams} />;
}
