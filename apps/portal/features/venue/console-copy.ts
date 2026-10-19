import type { Family, StatusValue } from "@/components/r1";
import type { CaseHead, Classification, EnforcementKind, HistoryRow, MoodVersionState, ScopeDetail, ScopeFamily } from "@/lib/api/venue";
import type { Locale, Translate } from "@/lib/i18n/translate";
import { day, refusalWords } from "./copy";

/*
 * The words the consoles' Player screens share (SCR-VEN-12 to 18), from the same catalogue as the premises' screens
 * (`venops.*`, `ven12.*` to `ven18.*`), so a state, a class and a refusal read the same on both sides of a service.
 */

/** The premises class as a column or a fact names it ("Quán cà phê"), and in a sentence ("loại cơ sở: quán cà phê"). */
export const classWord = (classification: Classification | null, t: Translate) => (classification === null ? null : t(`venops.class.${classification}`));
export const classInline = (classification: Classification, t: Translate) => t(`venops.classInline.${classification}`);

/** SCR-VEN-13's header line: "Mã dịch vụ RPS-…. Loại cơ sở: quán cà phê. Đăng ký ngày …; loại cơ sở xác nhận cùng ngày." */
export function headMeta(head: CaseHead, t: Translate, locale: Locale): string {
  const enrolled = day(head.enrolledAt, locale);
  if (head.classification === null) return t("ven13.metaNoClass", { code: head.code, d: enrolled });
  const confirmed = day(head.classConfirmedAt, locale);
  return confirmed === enrolled
    ? t("ven13.meta", { code: head.code, cls: classInline(head.classification, t), d: enrolled })
    : t("ven13.metaLater", { code: head.code, cls: classInline(head.classification, t), d: enrolled, c: confirmed });
}

/** An enforcement action as a badge: a suspension and a revocation in danger, each with its own shape; a restriction in attention. */
const ACTION: Readonly<Record<EnforcementKind, { family: Family; icon?: string }>> = {
  SUSPEND: { family: "danger", icon: "pause" },
  RESTRICT: { family: "attention" },
  REVOKE: { family: "danger", icon: "ban" },
};

export function actionStatus(action: EnforcementKind, t: Translate): StatusValue {
  const { family, icon } = ACTION[action];
  return { family, label: t(`venops.action.${action}`), ...(icon !== undefined ? { icon } : {}) };
}

/** A scope exit's cause as SCR-VEN-13 writes it: "Đăng ký: nghĩa vụ được quyết định lại". */
export function causeWords(family: ScopeFamily, detail: ScopeDetail, t: Translate): string {
  return t("venops.cause", { family: t(`venops.family.${family}`), detail: t(`venops.detailInline.${detail}`) });
}

/** A shared mood version's state: an approved one waiting for its date draws attention; the past ones are quiet. */
export function moodState(state: MoodVersionState, t: Translate): StatusValue {
  const label = t(`venops.mood.${state}`);
  if (state === "APPROVED") return { family: "attention", label };
  return state === "SUPERSEDED" || state === "WITHDRAWN" ? { family: "neutral", label, quiet: true } : { family: "neutral", label };
}

/** Who recorded a history row: a person by name, or RightOne's own schedule. */
export const recordedBy = (row: HistoryRow, t: Translate) => (row.recordedBy.kind === "SYSTEM" ? t("ven04.hSystem") : row.recordedBy.name);

/** A refusal's sentence split as a Banner takes it, from the family's catalogue. */
export const refusal = (code: string, t: Translate) => ({ code, ...refusalWords(code, t) });

/** The whole refusal sentence, for a field's error or a disabled control's reason (convention 12). */
export const sentence = (code: string, t: Translate) => t(`ven.refusal.${code}`);
