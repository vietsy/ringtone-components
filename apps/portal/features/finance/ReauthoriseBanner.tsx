"use client";

import { Banner, Button } from "@/components/r1";
import type { Locale } from "@/lib/i18n/translate";
import { authorisePayment } from "./actions";

/**
 * The expired instruction's banner and its one act, authorise again (SCR-FIN-01). It is a client component
 * because its action is a form bound to a server action: handed from a server page to the banner as a
 * prop, that element reaches the server render as a lazy reference the banner does not recognise as an
 * element, so the server drew an empty button where the browser drew the form. The words come from the
 * page, already in the reader's language.
 */
export function ReauthoriseBanner({
  decision,
  title,
  text,
  label,
  fullWidth,
  locale,
}: {
  decision: string;
  title: string;
  text: string;
  label: string;
  fullWidth: boolean;
  locale: Locale;
}) {
  return (
    <Banner
      family="attention"
      title={title}
      actions={
        <form action={authorisePayment.bind(null, decision)}>
          <Button variant="primary" size="md" type="submit" fullWidth={fullWidth} locale={locale}>
            {label}
          </Button>
        </form>
      }
      density="portal"
      locale={locale}
    >
      {text}
    </Banner>
  );
}
