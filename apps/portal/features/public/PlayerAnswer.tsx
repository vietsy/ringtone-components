import { VerificationResult } from "@/components/r1";
import { Text } from "@/components/Text";
import type { ServiceEntitlementAnswer, ServiceStatusWord } from "@/lib/api/public";
import type { Locale, Translate } from "@/lib/i18n/translate";

type Fact = { label: string; value: unknown; kind?: "datetime" | "id" | "mono" };

/**
 * How each status word is drawn (`DR-485`): never the certificate's seal or words. Active is positive; suspended and
 * revoked take the danger shape the board draws for a service the premises may not use; restricted and ended are a
 * record no longer fully current; waiting for terms is neutral.
 */
const SHAPES: Readonly<Record<ServiceStatusWord, { result: "answer" | "revoked"; family?: "positive" | "attention" | "neutral" }>> = {
  SERVICE_ACTIVE: { result: "answer", family: "positive" },
  SERVICE_RESTRICTED: { result: "answer", family: "attention" },
  SERVICE_SUSPENDED: { result: "revoked" },
  SERVICE_PENDING_TERMS: { result: "answer", family: "neutral" },
  SERVICE_ENDED_AT_REQUEST: { result: "answer", family: "attention" },
  SERVICE_ENDED_OUT_OF_SCOPE: { result: "answer", family: "attention" },
  SERVICE_REVOKED: { result: "revoked" },
};

/**
 * The Player route's answer, as SCR-PUB-06 draws it: the status word first, then the minimum profile and the instant
 * the source answered. No entitlement matching the printed code is neutral, never red, and asks the reader to check
 * the code; could-not-tell says in words that it is not an absence.
 */
export function PlayerAnswer({ answer, t, locale }: { answer: ServiceEntitlementAnswer; t: Translate; locale: Locale }) {
  const printed: Fact = { label: t("pub06.fCode"), value: answer.printedCode, kind: "mono" };

  if (answer.outcome === "unable") {
    const ended: Fact[] = answer.attemptEndedAt !== null ? [{ label: t("pub.fEnded"), value: answer.attemptEndedAt, kind: "datetime" }] : [];
    return (
      <VerificationResult result="unavailable" title={t("pub.unable")} facts={[printed, ...ended]} level={2} locale={locale}>
        <Text>{t(`pub.causeOf.${answer.cause ?? "OTHER"}`)}</Text>
      </VerificationResult>
    );
  }

  const answered: Fact[] = answer.sourceAnsweredAt !== null ? [{ label: t("pub.fAnswered"), value: answer.sourceAnsweredAt, kind: "datetime" }] : [];

  if (answer.outcome === "absent" || answer.entitlement === null) {
    return (
      <VerificationResult result="not-found" title={t("pub06.absent")} facts={[printed, ...answered]} level={2} locale={locale}>
        <Text>{t("pub06.absentText")}</Text>
      </VerificationResult>
    );
  }

  const entitlement = answer.entitlement;
  const shape = SHAPES[entitlement.statusWord];
  // A field the disclosure profile in effect withholds is absent, so it is not drawn; one VEN holds no value for is "-".
  const { premisesName, businessType, locality } = entitlement;
  return (
    <VerificationResult
      result={shape.result}
      {...(shape.family !== undefined ? { family: shape.family } : {})}
      title={t(`pub06.status.${entitlement.statusWord}`)}
      facts={[
        ...(premisesName !== undefined ? [{ label: t("pub06.fName"), value: premisesName }] : []),
        ...(businessType !== undefined ? [{ label: t("pub06.fType"), value: businessType === null ? "-" : t(`pub06.type.${businessType}`) }] : []),
        ...(locality !== undefined ? [{ label: t("pub06.fPlace"), value: t(`pub.area.${locality}`) }] : []),
        { label: t("pub06.fReference"), value: entitlement.reference, kind: "id" },
        ...answered,
        { label: t("pub.fAnswerRef"), value: entitlement.answerRef, kind: "id" },
      ]}
      level={2}
      locale={locale}
    />
  );
}
