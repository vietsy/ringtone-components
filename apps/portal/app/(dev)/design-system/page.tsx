import { notFound } from "next/navigation";
import { Gallery } from "@/components/r1/Gallery";
import { usesMockData } from "@/lib/api/source";
import { getLocale } from "@/lib/i18n/locale";
import { translator } from "@/lib/i18n/translate";
import en from "@/messages/screens/ds.en.json";
import vi from "@/messages/screens/ds.vi.json";

const GROUPS = ["Actions", "Forms", "Values", "Status", "Feedback", "Data", "Page", "Flows", "Shells", "Legal", "Operations", "Media", "Player", "Icons"];

/**
 * The design system R1 as the portal renders it: every component, in the states its specimen draws. A
 * developer and review page, served only while the portal runs on mock data.
 */
export default async function DesignSystemPage() {
  if (!usesMockData()) notFound();
  const locale = await getLocale();
  const t = translator({ vi, en }, locale);

  return (
    <Gallery
      locale={locale}
      labels={{
        title: t("title"),
        meta: t("meta"),
        jump: t("jump"),
        failed: t("failed"),
        groups: Object.fromEntries(GROUPS.map((group) => [group, t(`group.${group}`)])),
      }}
    />
  );
}
