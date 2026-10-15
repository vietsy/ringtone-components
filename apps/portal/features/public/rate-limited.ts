import { R1_FORMAT } from "@rightone/formatting";
import type { Translate } from "@/lib/i18n/translate";

/**
 * VERIFICATION_RATE_LIMITED's sentence: "Hãy thử lại sau {retry_after}. Không cần tài khoản.", with the time the
 * requester may look up again in Vietnam time and its offset, as the canvas writes it ("10:24 (GMT+7)").
 */
export function rateLimitedText(retryAfter: string | null, t: Translate): string {
  const at = retryAfter !== null ? R1_FORMAT.toDate(retryAfter) : null;
  if (at === null) return t("pub.rateTextNoTime");
  return t("pub.rateText", { time: R1_FORMAT.formatTime(at) ?? "-", zone: R1_FORMAT.offsetLabel(at) });
}
