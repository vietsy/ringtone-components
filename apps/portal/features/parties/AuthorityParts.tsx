import { FactList, Panel, StatusLine, Table } from "@/components/r1";
import { Text } from "@/components/Text";
import type { AuthorityDetail, PropagationPoint, VersionView } from "@/lib/api/parties";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { actsWords, day, moment, shortDay, wordsOf } from "./copy";

/*
 * The parts of SCR-PTY-13 both of its readers see: the principal on the premises portal and the security admin on
 * the security console, read only. Each part takes the reader's density; what differs between the two pages is the
 * layout and the revocation form, which only the principal has.
 */

type Density = "console" | "portal";

/** The authority's facts, with who granted it ("By you" for the principal who did). */
export function AuthorityFacts({ authority, reader, density, t, locale }: { authority: AuthorityDetail; reader: "principal" | "security"; density: Density; t: Translate; locale: Locale }) {
  const granted = authority.granted;
  return (
    <FactList
      items={[
        { label: t("pty13.fRef"), value: authority.reference, kind: "id" },
        { label: t("pty13.fPerson"), value: authority.person },
        { label: t("pty13.fScope"), value: authority.premises?.name ?? t("pty11.partyWide") },
        { label: t("pty13.fMay"), value: actsWords(authority.acts, t) },
        { label: t("pty13.fPeriod"), value: authority.to !== null ? { from: authority.from, to: authority.to } : authority.from, kind: authority.to !== null ? "period" : "date" },
        ...(authority.basis !== null ? [{ label: t("pty13.fBasis"), value: wordsOf(authority.basis, "basis", t) }] : []),
        ...(authority.evidence !== null ? [{ label: t("pty13.fEvidence"), value: authority.evidence, kind: "id" as const }] : []),
        ...(granted !== null
          ? [{ label: t("pty13.fGranted"), value: granted.at, kind: "datetime" as const, note: reader === "principal" && authority.grantedByReader ? t("pty13.byYou") : t("pty13.byName", { name: granted.by }) }]
          : []),
      ]}
      {...(density === "portal" ? { density: "portal" as const } : {})}
      locale={locale}
    />
  );
}

const ROLE_FAMILY = { CURRENT: "positive", SUPERSEDED: "neutral", LAST: "neutral", NOT_STARTED: "neutral", ENDED: "neutral" } as const;

/** Every version with the period it covered and what it allowed, newest first. On a phone a card is named by its start. */
export function VersionsTable({ versions, density, phone, t, locale }: { versions: readonly VersionView[]; density: Density; phone: boolean; t: Translate; locale: Locale }) {
  return (
    <Table
      columns={[
        { key: "vname", label: t("pty13.cVName"), kind: "strong", hidden: !phone },
        { key: "period", label: t("pty13.cVPeriod"), kind: "period", short: true },
        { key: "may", label: t("pty13.cVMay"), kind: "text" },
        { key: "vstate", label: t("pty13.cVState"), kind: "status" },
      ]}
      rows={versions.map((version) => ({
        _key: String(version.number),
        vname: t("pty13.vSince", { d: shortDay(version.from, locale) }),
        period: version.to !== null ? { from: version.from, to: version.to } : { from: version.from, to: version.from },
        may: actsWords(version.acts, t),
        vstate: { family: ROLE_FAMILY[version.role], label: t(`pty13.vRole.${version.role}`), plain: true },
      }))}
      density={density}
      layout={phone ? "cards" : "table"}
      caption={t("pty13.versionsTitle")}
      locale={locale}
    />
  );
}

/** The acts performed under the authority, each with the version it was performed under; they stay valid after it ends. */
export function ActsPanel({ authority, density, phone, tablet, inset, t, locale }: { authority: AuthorityDetail; density: Density; phone: boolean; tablet: boolean; inset: "sm" | "md"; t: Translate; locale: Locale }) {
  const columns = [
    { key: "when", label: t("pty13.cWhen"), kind: "datetime" as const, ...(!phone && !tablet ? { minWidth: "var(--space-40)" } : {}) },
    { key: "act", label: t("pty13.cAct"), kind: "stack" as const },
    { key: "version", label: t("pty13.cVersion"), kind: "stack" as const, ...(tablet ? { priority: "low" as const } : {}) },
  ];
  const ordered = phone ? [columns[1], columns[0], columns[2]].filter((column) => column !== undefined) : columns;
  const ended = authority.state === "EXPIRED" || authority.state === "REVOKED" || authority.state === "LAPSED";
  const empty =
    authority.state === "PENDING_START"
      ? t("pty13.noActsPending", { d: day(authority.from, locale) })
      : ended && (authority.revocation !== null || authority.to !== null)
        ? t("pty13.noActsPeriod", { from: day(authority.from, locale), to: day(authority.revocation?.at ?? authority.to ?? "", locale) })
        : t("pty13.noActsLive");
  return (
    <Panel title={t("pty13.actsTitle")} level={2} {...(density === "portal" ? { inset, density: "portal" as const } : {})} locale={locale}>
      {authority.performed.length > 0 && (authority.state === "REVOKED" || authority.state === "EXPIRED" || authority.state === "LAPSED" || density === "console") ? (
        <Text size={density === "console" ? "sm" : "base"} measure="2xl">
          {t("pty13.actsStay")}
        </Text>
      ) : null}
      <Table
        columns={ordered}
        rows={authority.performed.map((act, index) => ({
          _key: `${act.at}-${String(index)}`,
          when: act.at,
          act: { text: t(`pty13.act.${act.kind}`), detail: act.subject },
          version: { text: actsWords(act.version.acts, t), detail: t("pty13.vSince", { d: shortDay(act.version.from, locale) }) },
        }))}
        empty={{ variant: "governed", title: t("pty13.noActsTitle"), text: empty, action: false }}
        density={density}
        layout={phone ? "cards" : "table"}
        caption={t("pty13.actsTitle")}
        locale={locale}
      />
    </Panel>
  );
}

/** Where a revocation reached: each point that checks the authority, when it stopped granting, against 60 seconds. */
export function PropagationTable({ points, density, phone, tablet, t, locale }: { points: readonly PropagationPoint[]; density: Density; phone: boolean; tablet: boolean; t: Translate; locale: Locale }) {
  return (
    <Table
      columns={[
        { key: "point", label: t("pty13.cPoint"), kind: "strong" },
        { key: "at", label: t("pty13.cStopped"), kind: "stack" },
        { key: "took", label: t("pty13.cTook"), kind: "text", nowrap: !phone, missing: t("pty13.playerNone"), ...(tablet ? { priority: "low" as const } : {}) },
        { key: "pstate", label: t("pty13.cPState"), kind: "status" },
      ]}
      rows={points.map((point) => ({
        _key: point.point,
        ...(density === "console" && point.exception !== null
          ? { _message: { severity: "warning", text: t("pty13.secPlayer", { raised: moment(point.exception.raisedAt, locale), name: point.exception.acknowledgedBy, acknowledged: moment(point.exception.acknowledgedAt, locale) }) } }
          : {}),
        point: t(`pty13.point.${point.point}`),
        at: point.stoppedAt !== null ? { text: moment(point.stoppedAt, locale) } : { text: t("pty13.playerNone"), muted: true },
        took: point.afterSeconds !== null ? t("pty13.seconds", { n: String(point.afterSeconds) }) : null,
        pstate:
          point.stoppedAt !== null
            ? { family: "positive", label: t("pty13.stopped"), plain: density === "portal" }
            : {
                family: "attention",
                label: t("pty13.notConfirmed"),
                plain: density === "portal",
                ...(density === "portal" && point.exception !== null
                  ? { detail: t("pty13.playerPortal", { raised: moment(point.exception.raisedAt, locale), acknowledged: moment(point.exception.acknowledgedAt, locale) }) }
                  : {}),
              },
      }))}
      density={density}
      layout={phone ? "cards" : "table"}
      caption={t("pty13.propTitle")}
      locale={locale}
    />
  );
}

/** The line an authority that ended on its own, or has not started, carries in place of the revocation form. */
export function StateLine({ authority, t, locale }: { authority: AuthorityDetail; t: Translate; locale: Locale }) {
  if (authority.state === "EXPIRED" && authority.to !== null) return <StatusLine family="neutral" text={t("pty13.endedLine", { d: day(authority.to, locale) })} cutout="surface" locale={locale} />;
  if (authority.state === "LAPSED") return <StatusLine family="neutral" text={t("pty13.lapsedLine")} cutout="surface" locale={locale} />;
  if (authority.state === "PENDING_START") return <StatusLine family="neutral" text={t("pty13.pendingLine", { d: day(authority.from, locale) })} cutout="surface" locale={locale} />;
  return null;
}
