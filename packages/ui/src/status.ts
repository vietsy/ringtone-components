import type { StatusFamily } from "@rightone/tokens";

/**
 * The seventeen state models in the FRD produce well over a hundred distinct states, and they map
 * onto five status families.
 *
 * Five of those mappings are product-specific and easy to get wrong in the obvious direction.
 * They are named individually here, with the reason, because each one is a case where the
 * intuitive colour would teach the user the wrong thing.
 */

export interface StatusPresentation {
  family: StatusFamily;
  /** Never colour alone: every badge carries its label, and the families differ in icon shape too. */
  labelKey: string;
  iconShape: "check" | "clock" | "cross" | "dash" | "dot";
}

const FAMILY_ICON: Record<StatusFamily, StatusPresentation["iconShape"]> = {
  positive: "check",
  attention: "clock",
  danger: "cross",
  neutral: "dash",
  info: "dot",
};

/**
 * The five mappings the design brief calls out. Everything else falls through to the general rule.
 */
const PRODUCT_SPECIFIC: Record<string, StatusFamily> = {
  /** SM-11. Offline is normal operation under FR-PLR-013. Red here trains the venue to ignore red. */
  offline_still_playing: "info",
  /** SM-04, FR-CLM-010. Money on hold is a governed outcome. Nobody did anything wrong. */
  held_value: "attention",
  /** SM-08. It may still progress; red would read as rejection. */
  warned_medium_risk: "attention",
  /** SM-15. It is a breach of the seven-working-day baseline, not merely a state. */
  overdue_remittance: "danger",
  /** SM-01. A correct, complete outcome - and specifically not an empty result. */
  no_payable_obligation: "positive",
};

const GENERAL: Record<string, StatusFamily> = {
  active: "positive",
  reconciled: "positive",
  accepted: "positive",
  cleared: "positive",
  published: "positive",

  expiring: "attention",
  pending: "attention",
  under_review: "attention",
  provisional: "attention",

  refused: "danger",
  revoked: "danger",
  suspended: "danger",
  blocked: "danger",
  failed: "danger",

  draft: "neutral",
  closed: "neutral",
  historical: "neutral",
  superseded: "neutral",
  not_applicable: "neutral",

  queued: "info",
  in_progress: "info",
};

export function familyOf(state: string): StatusFamily | null {
  return PRODUCT_SPECIFIC[state] ?? GENERAL[state] ?? null;
}

/**
 * Presentation for a state. Returns null for an unmapped state rather than defaulting to neutral:
 * a state nobody mapped should be visible as a gap, not rendered as "historical".
 */
export function presentStatus(state: string): StatusPresentation | null {
  const family = familyOf(state);
  if (family === null) return null;

  return { family, labelKey: `status.${state}`, iconShape: FAMILY_ICON[family] };
}

/** The states whose mapping is deliberate and must not be "corrected" to the obvious colour. */
export const PRODUCT_SPECIFIC_STATES = Object.keys(PRODUCT_SPECIFIC);
