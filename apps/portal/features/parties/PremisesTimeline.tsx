import type { Route } from "next";
import { Button, DateField, Panel, StatusLine, Table, ViewState } from "@/components/r1";
import { Text } from "@/components/Text";
import type { PremisesTimeline as Timeline, RelationshipAtView, RelationshipRow } from "@/lib/api/premises";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { causeWords, count, day, moment, premisesRefusal } from "./premises-copy";

/**
 * A premises' relationships and changes (GET /premises/{id}/relationships and /changes), as the console and the
 * premises portal read them: each party with the period it operated the premises and what ended it, and each change
 * with its cause, its date, who recorded it and whether it has been applied. On the console, `ask` adds the question
 * GET /premises/{id}/relationship-at answers: who operated the premises at a moment (FR-PTY-045).
 */
export function PremisesTimeline({
  timeline,
  ask,
  density,
  t,
  locale,
}: {
  timeline: Timeline;
  ask: { action: Route; at: string | null; refused: string | null } | null;
  density: "console" | "portal";
  t: Translate;
  locale: Locale;
}) {
  const compact = density === "console";
  return (
    <>
      <Panel title={t("ptyTl.relTitle")} level={2} {...(compact ? { compact: true } : { inset: "md" as const })} density={density} locale={locale}>
        {timeline.relationships.length === 0 ? (
          <Text size="sm" tone="secondary">
            {t("ptyTl.relNone")}
          </Text>
        ) : (
          <Table
            columns={[
              { key: "party", label: t("ptyTl.cParty"), kind: "strong" },
              { key: "period", label: t("ptyTl.cPeriod"), kind: "text" },
              { key: "state", label: t("ptyTl.cState"), kind: "status" },
              { key: "recorded", label: t("ptyTl.cRecorded"), kind: "text" },
            ]}
            rows={timeline.relationships.map((row, index) => ({
              _key: `${row.party.record}-${String(index)}`,
              party: row.party.legalName,
              period: periodWords(row, t, locale),
              state: relationshipStatus(row, t),
              recorded: row.recorded !== null ? t("ptyTl.recordedBy", { name: row.recorded.by, ts: moment(row.recorded.at, locale) }) : t("ptyTl.fromSource"),
            }))}
            density={density}
            caption={t("ptyTl.relTitle")}
            locale={locale}
          />
        )}
      </Panel>
      <Panel title={t("ptyTl.chgTitle")} level={2} {...(compact ? { compact: true } : { inset: "md" as const })} density={density} locale={locale}>
        {timeline.changes.length === 0 ? (
          <Text size="sm" tone="secondary">
            {t("ptyTl.chgNone")}
          </Text>
        ) : (
          <Table
            columns={[
              { key: "cause", label: t("ptyTl.cCause"), kind: "strong" },
              { key: "effective", label: t("ptyTl.cEffective"), kind: "text" },
              { key: "by", label: t("ptyTl.cBy"), kind: "text" },
              { key: "applied", label: t("ptyTl.cApplied"), kind: "status" },
            ]}
            rows={timeline.changes.map((change) => ({
              _key: change.id,
              cause: change.incoming !== null ? t("ptyTl.causeTo", { cause: causeWords(change.cause, t), party: change.incoming.legalName }) : causeWords(change.cause, t),
              effective: change.contradicted.length > 0 ? t("ptyTl.effectiveContradicted", { d: day(change.effectiveOn, locale), n: count(change.contradicted.length, locale) }) : day(change.effectiveOn, locale),
              by: t("ptyTl.recordedBy", { name: change.recordedBy, ts: moment(change.recordedAt, locale) }),
              applied: change.applied ? { family: "neutral", label: t("ptyTl.applied"), plain: true } : { family: "attention", label: t("ptyTl.pending"), plain: true },
            }))}
            density={density}
            caption={t("ptyTl.chgTitle")}
            locale={locale}
          />
        )}
      </Panel>
      {ask !== null ? <Ask ask={ask} answer={timeline.asked} t={t} locale={locale} /> : null}
    </>
  );
}

function periodWords(row: RelationshipRow, t: Translate, locale: Locale): string {
  if (row.from === null && row.to === null) return t("ptyTl.periodOpen");
  if (row.from === null) return t("ptyTl.periodUntil", { to: day(row.to ?? "", locale) });
  if (row.to === null) return t("ptyTl.periodFrom", { from: day(row.from, locale) });
  return t("ptyTl.periodSpan", { from: day(row.from, locale), to: day(row.to, locale) });
}

function relationshipStatus(row: RelationshipRow, t: Translate) {
  if (row.inForce) return { family: "positive" as const, label: t("ptyTl.inForce"), plain: true };
  if (row.to === null) return { family: "neutral" as const, label: t("ptyTl.notYet"), plain: true };
  return { family: "neutral" as const, label: t(`ptyTl.ended.${row.endCause ?? "NONE"}`), plain: true };
}

/** The relationship question: a moment typed, and the register's answer in words, or the refusal with both moments. */
function Ask({ ask, answer, t, locale }: { ask: { action: Route; at: string | null; refused: string | null }; answer: RelationshipAtView | null; t: Translate; locale: Locale }) {
  return (
    <Panel title={t("ptyTl.askTitle")} level={2} compact density="console" locale={locale}>
      <form method="get" action={ask.action} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "var(--space-4)" }}>
        <DateField label={t("ptyTl.fAt")} name="at" withTime {...(ask.at !== null ? { value: ask.at.slice(0, 10), time: ask.at.slice(11, 16) } : {})} density="console" width="var(--space-96)" locale={locale} />
        <Button variant="secondary" size="sm" type="submit" locale={locale}>
          {t("ptyTl.ask")}
        </Button>
      </form>
      {ask.refused !== null ? (
        <ViewState
          view="refused"
          refusal={{ ...premisesRefusal(t, ask.refused), family: "attention", ...(ask.refused === "INSTANT_IN_FUTURE" && ask.at !== null ? { title: t("ptyTl.future", { at: moment(ask.at, locale), now: moment(new Date().toISOString(), locale) }) } : {}) }}
          density="console"
          locale={locale}
        />
      ) : answer !== null ? (
        <StatusLine family={answer.answer === "AUTHORITY_EFFECTIVE" ? "positive" : "neutral"} text={answerWords(answer, t, locale)} cutout="surface" locale={locale} />
      ) : null}
    </Panel>
  );
}

function answerWords(answer: RelationshipAtView, t: Translate, locale: Locale): string {
  const at = moment(answer.at, locale);
  switch (answer.answer) {
    case "AUTHORITY_EFFECTIVE":
      return t("ptyTl.ans.AUTHORITY_EFFECTIVE", { party: answer.party?.legalName ?? "", ts: at });
    case "RELATIONSHIP_ENDED":
      return t("ptyTl.ans.RELATIONSHIP_ENDED", { party: answer.party?.legalName ?? "", ts: at, d: day(answer.endedOn ?? "", locale) });
    case "NO_RELATIONSHIP":
      return answer.startsOn !== null ? t("ptyTl.ans.NO_RELATIONSHIP_LATER", { ts: at, d: day(answer.startsOn, locale) }) : t("ptyTl.ans.NO_RELATIONSHIP", { ts: at });
  }
}
