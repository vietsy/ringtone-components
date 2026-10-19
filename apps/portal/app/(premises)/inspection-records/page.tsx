import { PremisesRecords } from "@/features/inspection/PremisesRecords";
import { requirePrincipal } from "@/lib/api/session";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/** SCR-VER-13 Inspection records of your premises: one premises' records, the newest opened. */
export default async function InspectionRecordsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Signed in as the premises principal, or sent to sign in; every read is scoped to the party they act for.
  const principal = await requirePrincipal();
  const params = await searchParams;
  const premises = typeof params.premises === "string" && params.premises !== "" ? params.premises : null;
  return (
    <PremisesRecords
      principal={principal}
      premises={premises}
      record={null}
      frame={await getFrame(params)}
      loading={reviewView(params, ["loading"] as const) === "loading"}
    />
  );
}
