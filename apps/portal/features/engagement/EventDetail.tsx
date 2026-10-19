import type { Route } from "next";
import { Button, ButtonRow, FactList, Panel } from "@/components/r1";
import { Text } from "@/components/Text";
import type { LedgerEventView } from "@/lib/api/engagement";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { actionNote, actionWords, actorName, day, moment, signed } from "./copy";

/**
 * SCR-ENG-04's body, for the participant and for an operations officer under a support read alike: the seven elements
 * `FR-ENG-011` requires, the points signed in words as well as in figures, and the correcting event where one exists.
 * The participant is named by the display profile the event is attributed to; the account behind it never is.
 */
export function EventDetail({
  event,
  eventHref,
  back,
  density,
  t,
  locale,
}: {
  event: LedgerEventView;
  /** Where another event of the same ledger opens: this screen again, for that event. */
  eventHref: (id: string) => Route;
  back: { href: Route; label: string };
  density: "portal" | "console";
  t: Translate;
  locale: Locale;
}) {
  const size = density === "console" ? "sm" : "md";
  const facts = [
    { label: t("eng04.fParticipant"), value: event.participant.name },
    { label: t("eng04.fProfile"), value: event.displayProfile.name, note: event.displayProfile.ref },
    event.action !== null
      ? {
          label: t("eng04.fAction"),
          value: t("eng04.actionValue", { action: actionWords(event.action.code, t), ts: moment(event.action.occurredAt, locale) }),
          ...(actionNote(event.action.code, t) !== null ? { note: event.action.code } : {}),
        }
      : { label: t("eng04.fCorrects"), value: event.corrects !== null ? t("eng04.correctsValue", { event: event.corrects.id, ground: t(`eng.ground.${event.corrects.ground}`) }) : "" },
    { label: t("eng04.fVersion"), value: t("eng04.versionValue", { n: event.governing.no, d: moment(event.governing.effectiveFrom, locale) }) },
    { label: t("eng04.fPoints"), value: t(event.points < 0 ? "eng04.pointsMinus" : "eng04.pointsPlus", { n: signed(event.points, locale) }) },
    { label: t("eng04.fRecorded"), value: t("eng04.recordedValue", { ts: moment(event.recordedAt, locale), by: actorName(event.recordedBy, t) }) },
    { label: t("eng04.fId"), value: event.id, kind: "id" as const },
  ];
  return (
    <>
      <Panel title={t("eng04.factsTitle")} level={2} density={density} locale={locale}>
        <FactList items={facts} density={density} locale={locale} />
      </Panel>
      {event.correctedBy !== null ? (
        <Panel title={t("eng04.correctedTitle")} level={2} family="neutral" density={density} locale={locale}>
          <Text>{t("eng04.correctedText", { d: day(event.correctedBy.recordedAt, locale), event: event.correctedBy.id, ground: t(`eng.ground.${event.correctedBy.ground}`) })}</Text>
        </Panel>
      ) : null}
      <ButtonRow>
        <Button variant="secondary" size={size} icon="arrow-left" href={back.href} locale={locale}>
          {back.label}
        </Button>
        {event.correctedBy !== null ? (
          <Button variant="primary" size={size} href={eventHref(event.correctedBy.id)} locale={locale}>
            {t("eng04.openCorrecting")}
          </Button>
        ) : null}
        {event.corrects !== null ? (
          <Button variant="secondary" size={size} href={eventHref(event.corrects.id)} locale={locale}>
            {t("eng04.openCorrected")}
          </Button>
        ) : null}
      </ButtonRow>
    </>
  );
}
