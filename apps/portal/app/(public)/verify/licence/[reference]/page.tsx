import { DirectRecordVerification } from "@/features/public/DirectRecordVerification";

/** SCR-PUB-07 for a direct licence of a track, by the licence's public reference. */
export default async function LicenceVerificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ reference }, query] = await Promise.all([params, searchParams]);
  return <DirectRecordVerification route="licence" reference={reference} query={query} />;
}
