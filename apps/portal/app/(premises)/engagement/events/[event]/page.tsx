import { EventScreen } from "@/features/engagement/EventScreen";
import { premisesPortal } from "@/features/engagement/participant";
import { requirePrincipal } from "@/lib/api/session";

type SearchParams = Record<string, string | string[] | undefined>;

/** SCR-ENG-04 One ledger event, the premises principal's own: the screen both participant portals draw. */
export default async function LedgerEventPage({ params, searchParams }: { params: Promise<{ event: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ event }, query] = await Promise.all([params, searchParams]);
  return <EventScreen portal={premisesPortal(principal)} id={event} params={query} />;
}
