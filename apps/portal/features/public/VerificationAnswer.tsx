import { VerificationResult } from "@/components/r1";
import { Text } from "@/components/Text";
import type { CertificateVerification } from "@/lib/api/verification";
import type { Locale, Translate } from "@/lib/i18n/translate";

type Fact = { label: string; value: unknown; kind?: "date" | "datetime" | "period" | "id" };

/**
 * The register's answer for one reference, as SCR-PUB-04 and SCR-PUB-05 draw it. The record type is the
 * page's heading; here the verdict comes first, in words, then the facts and the instant the source
 * answered. ABSENT is neutral, never red, and UNABLE says it is not an absence.
 */
export function VerificationAnswer({
  answer,
  recordNoun,
  t,
  locale,
}: {
  answer: CertificateVerification;
  /** SCR-PUB-05 names the record ("giấy xác nhận"); SCR-PUB-04 speaks of the code. */
  recordNoun?: string;
  t: Translate;
  locale: Locale;
}) {
  const noun = recordNoun !== undefined ? { recordNoun } : {};

  if (answer.outcome === "unable") {
    const facts: Fact[] = answer.attemptEndedAt !== null ? [{ label: t("pub.fEnded"), value: answer.attemptEndedAt, kind: "datetime" }] : [];
    return (
      <VerificationResult {...noun} result="unavailable" title={t("pub.unable")} recordId={answer.reference} facts={facts} level={2} locale={locale}>
        <Text>{t("pub.cause")}</Text>
      </VerificationResult>
    );
  }

  const answered: Fact[] = answer.sourceAnsweredAt !== null ? [{ label: t("pub.fAnswered"), value: answer.sourceAnsweredAt, kind: "datetime" }] : [];

  if (answer.outcome === "absent" || answer.record === null) {
    return <VerificationResult {...noun} result="not-found" title={t("pub.absent")} recordId={answer.reference} facts={answered} level={2} locale={locale} />;
  }

  const record = answer.record;
  const active = record.status === "active";
  const facts: Fact[] = [
    { label: t("pub05.fSince"), value: record.statusSince, kind: "date" },
    { label: t("pub05.fValid"), value: { from: record.validFrom, to: record.validTo }, kind: "period" },
    { label: t("pub05.fScope"), value: t("pub05.scope") },
    { label: t("pub05.fIssuer"), value: t("pub05.issuer") },
    // Only a printout looked up by its own reference was scanned; a record's reference names no printout.
    ...(record.printout !== null ? [{ label: t("pub05.fPrint"), value: t("pub05.printCurrent", { printout: record.printout }) }] : []),
    ...answered,
    { label: t("pub05.fAnswerRef"), value: record.answerRef, kind: "id" },
  ];
  return (
    <VerificationResult
      {...noun}
      // A suspended record is drawn in the danger family, as a revoked one: the place may not rely on it.
      result={active ? "valid" : "revoked"}
      title={t(active ? "pub05.active" : "pub05.suspended")}
      recordId={answer.reference}
      facts={facts}
      level={2}
      locale={locale}
    >
      <Text>{t("pub05.venue")}</Text>
    </VerificationResult>
  );
}
