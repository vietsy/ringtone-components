import { PremisesRecords } from "@/features/inspection/PremisesRecords";
import { requirePrincipal } from "@/lib/api/session";
import { reviewView } from "@/lib/view/demo-view";
import { getFrame } from "@/lib/view/frame";

type SearchParams = Record<string, string | string[] | undefined>;

/** SCR-VER-13 with one record opened beside its premises' records (Xem, or the notice COM delivers). */
export default async function InspectionRecordPage({ params, searchParams }: { params: Promise<{ record: string }>; searchParams: Promise<SearchParams> }) {
  const principal = await requirePrincipal();
  const [{ record }, query] = await Promise.all([params, searchParams]);
  return (
    <PremisesRecords
      principal={principal}
      premises={null}
      record={record}
      frame={await getFrame(query)}
      loading={reviewView(query, ["loading"] as const) === "loading"}
    />
  );
}
