import { BalanceScreen } from "@/features/engagement/BalanceScreen";
import { premisesPortal } from "@/features/engagement/participant";
import { requirePrincipal } from "@/lib/api/session";

type SearchParams = Record<string, string | string[] | undefined>;

/** SCR-ENG-02 Balance and history, for the premises principal: the screen both participant portals draw. */
export default async function BalancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  return <BalanceScreen portal={premisesPortal(principal)} params={await searchParams} />;
}
