import { DirectRecordVerification } from "@/features/public/DirectRecordVerification";

/** SCR-PUB-07 for the proof of an evidence set, by its public reference. */
export default async function ProofVerificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ reference }, query] = await Promise.all([params, searchParams]);
  return <DirectRecordVerification route="proof" reference={reference} query={query} />;
}
