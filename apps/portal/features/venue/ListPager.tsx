import { R1_FORMAT } from "@rightone/formatting";
import type { Route } from "next";
import { Banner, Pagination } from "@/components/r1";
import type { Paging } from "@/lib/api/venue";
import type { Locale, Translate } from "@/lib/i18n/translate";

/**
 * Convention 11 for a VEN list: R1's pager under the rows when the list runs to more than one page - the next page,
 * the previous one and back to the start, never page numbers - and, where the cursor asked with was refused
 * (CURSOR_INVALID), the refusal in its place with a control that reloads the list from the start. A console list
 * shows its pager whatever its length (`always`), as its board draws it; a premises list only once there is more.
 */
export function ListPager({
  paging,
  href,
  density,
  always = false,
  t,
  locale,
}: {
  paging: Paging;
  /** The address of the list at a cursor; an empty cursor is the first page. */
  href: (after: string) => Route;
  density: "console" | "portal";
  always?: boolean;
  t: Translate;
  locale: Locale;
}) {
  if (paging.refused !== null) {
    return (
      <Banner
        family="attention"
        title={t("ven.pager.refusedTitle")}
        code={paging.refused}
        action={{ label: t("ven.pager.restart"), icon: "refresh-cw", variant: "secondary", href: href("") }}
        density={density}
        locale={locale}
      >
        {t(`ven.refusal.${paging.refused}`)}
      </Banner>
    );
  }
  if (paging.to === 0 || (!always && paging.next === null && paging.previous === null)) return null;
  const count = (n: number) => R1_FORMAT.formatCount(n, locale) ?? String(n);
  return (
    <Pagination
      summary={t("ven.pager.rows", { from: count(paging.from), to: count(paging.to) })}
      hasPrev={paging.previous !== null}
      {...(paging.previous !== null ? { prevHref: href(paging.previous), firstHref: href("") } : {})}
      hasNext={paging.next !== null}
      {...(paging.next !== null ? { nextHref: href(paging.next) } : {})}
      endNote={paging.previous === null && paging.next === null ? false : t("ven.pager.end")}
      density={density}
      label={t("ven.pager.label")}
      locale={locale}
    />
  );
}
