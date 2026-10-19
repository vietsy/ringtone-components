import { VerificationResult } from "@/components/r1";
import { Text } from "@/components/Text";
import type { CertificateVerification, VerifiedRecord } from "@/lib/api/verification";
import type { Locale, Translate } from "@/lib/i18n/translate";

type Fact = { label: string; value: unknown; kind?: "date" | "datetime" | "period" | "id" };

/**
 * Each status's verdict and its words (PUB's status words). A suspended record is drawn in the danger family, as a
 * revoked or cancelled one: the place may not rely on it; a replaced record points to a newer one.
 */
const VERDICTS: Readonly<Record<VerifiedRecord["status"], { result: "valid" | "revoked" | "expired" | "superseded"; title: string }>> = {
  active: { result: "valid", title: "pub05.active" },
  expiring: { result: "valid", title: "pub05.expiring" },
  reinstated: { result: "valid", title: "pub05.reinstated" },
  suspended: { result: "revoked", title: "pub05.suspended" },
  revoked: { result: "revoked", title: "pub05.revoked" },
  cancelled: { result: "revoked", title: "pub05.cancelled" },
  expired: { result: "expired", title: "pub05.expired" },
  replaced: { result: "superseded", title: "pub05.replaced" },
};

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
    // An absence is kept and can be challenged as a record's answer is, so it carries its reference too.
    const quoted: Fact[] = answer.answerRef !== undefined ? [{ label: t("pub05.fAnswerRef"), value: answer.answerRef, kind: "id" }] : [];
    return <VerificationResult {...noun} result="not-found" title={t("pub.absent")} recordId={answer.reference} facts={[...answered, ...quoted]} level={2} locale={locale} />;
  }

  const record = answer.record;
  const verdict = VERDICTS[record.status];
  // A field the disclosure profile in effect withholds is absent from the answer, and so from the facts (DR-486); the
  // term is one fact, drawn when both its ends are carried.
  const valid: Fact[] =
    record.validFrom !== undefined && record.validTo !== undefined ? [{ label: t("pub05.fValid"), value: { from: record.validFrom, to: record.validTo }, kind: "period" }] : [];
  const facts: Fact[] = [
    ...(record.statusSince !== undefined ? [{ label: t("pub05.fSince"), value: record.statusSince, kind: "date" as const }] : []),
    ...valid,
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
      result={verdict.result}
      title={t(verdict.title)}
      recordId={answer.reference}
      facts={facts}
      level={2}
      locale={locale}
    >
      <Text>{t("pub05.venue")}</Text>
    </VerificationResult>
  );
}
