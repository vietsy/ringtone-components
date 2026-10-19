import { FactList, Panel } from "@/components/r1";
import type { LedgerEventView } from "@/lib/api/engagement";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { actionNote, actionWords, actorName, count, moment, signed } from "./copy";

/**
 * SCR-ENG-09's event block, before and after a proposal: the event being corrected with its date, action, value and
 * participant, so the operator is not working from an identifier alone, who recorded it (the person `DR-64` row 7
 * keeps from authorising its correction) and the participant's balance.
 */
export function EventBlock({ data, t, locale }: { data: { event: LedgerEventView; balance: number }; t: Translate; locale: Locale }) {
  const { event } = data;
  return (
    <Panel title={t("eng09.eventTitle", { event: event.id })} level={2} density="console" locale={locale}>
      <FactList
        columns={2}
        density="console"
        locale={locale}
        items={[
          { label: t("eng09.fRecorded"), value: moment(event.recordedAt, locale) },
          { label: t("eng09.fAction"), value: event.action !== null ? actionWords(event.action.code, t) : t("eng.correction"), ...(event.action !== null && actionNote(event.action.code, t) !== null ? { note: event.action.code } : {}) },
          ...(event.action !== null ? [{ label: t("eng09.fOccurred"), value: moment(event.action.occurredAt, locale) }] : []),
          { label: t("eng09.fPoints"), value: t(event.points < 0 ? "eng04.pointsMinus" : "eng04.pointsPlus", { n: signed(event.points, locale) }) },
          { label: t("eng09.fRecordedBy"), value: actorName(event.recordedBy, t) },
          { label: t("eng09.fParticipant"), value: event.participant.name, note: event.participant.ref },
          { label: t("eng09.fBalance"), value: t("eng09.balanceValue", { n: count(data.balance, locale) }) },
        ]}
      />
    </Panel>
  );
}
