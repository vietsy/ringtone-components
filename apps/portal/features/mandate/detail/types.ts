import type { LoadOutcome } from "@rightone/ui";
import type { MandateDetailRecord } from "@/lib/api/mandate-detail";
import type { Locale } from "@/lib/i18n/translate";
import type { Frame } from "@/lib/view/frame";

export type MandateDetailSearchParams = Readonly<Record<string, string | string[] | undefined>>;

export interface MandateDetailPageProps {
  params: Promise<{ mandateId: string }>;
  searchParams: Promise<MandateDetailSearchParams>;
}

export interface MandateDetailClientProps {
  account: string;
  mock?: boolean;
  outcome: LoadOutcome<MandateDetailRecord>;
  loading: boolean;
  registerHref: string;
  locale: Locale;
  frame: Frame;
}
