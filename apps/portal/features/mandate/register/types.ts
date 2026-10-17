import type { LoadOutcome } from "@rightone/ui";
import type { MandateRegisterSnapshot } from "@/lib/api/mandate-register";
import type { Locale } from "@/lib/i18n/translate";
import type { Frame } from "@/lib/view/frame";
import type { StatusValue } from "@/components/r1";

export type RegisterSearchParams = Readonly<Record<string, string | string[] | undefined>>;

export interface MandateRegisterPageProps {
  searchParams: Promise<RegisterSearchParams>;
}

export interface MandateRegisterClientProps {
  outcome: LoadOutcome<MandateRegisterSnapshot> | null;
  locale: Locale;
  frame: Frame;
}

/** R1 link cells consume label/href; text/href is the separate stack-cell contract. */
export interface MandateRegisterRow extends Record<string, unknown> {
  _key: string;
  grantee: { label: string; href: string };
  kind: string;
  status: StatusValue;
  scopeCount: number | { missing: string };
  effectiveFrom: string;
  effectiveTo: string;
  authority: string;
}
