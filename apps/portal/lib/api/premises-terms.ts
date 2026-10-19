/*
 * The premises register's vocabularies (SCR-PTY-06 to 10, 14 to 16), apart from the seam so a client component can
 * read them without the seam's server-only imports. The seam (`premises.ts`) re-exports every name.
 */

/** SM-191. */
export const PREMISES_STATES = ["IN_REGISTER", "OPERATED", "CHANGE_PENDING", "CLOSED", "CEASED"] as const;
export type PremisesState = (typeof PREMISES_STATES)[number];

/** DR-207's four outcomes as the register carries them. */
export const REGISTER_LICENSING = ["LICENSED", "UNREGISTERED", "LAPSED", "STALE"] as const;
export type RegisterLicensing = (typeof REGISTER_LICENSING)[number];

/** CFG-247: the business-registration source's own classes, which the register records with the scheme's version. */
export const PREMISES_CLASSES = ["BAR", "CAFE", "RESTAURANT", "HOTEL", "KARAOKE", "BAKERY", "SHORT_STAY"] as const;
export type PremisesClass = (typeof PREMISES_CLASSES)[number];

/** The fields of a register entry SCR-PTY-08 lists, in its order; the last two are never overridden by hand. */
export const REGISTER_FIELDS = ["trading_name", "address", "classification", "administrative_area", "party", "licensing_status"] as const;
export type RegisterField = (typeof REGISTER_FIELDS)[number];
/** DR-205 and FIELD_NOT_OVERRIDABLE: what a manual override may reach. */
export const OVERRIDABLE_FIELDS = ["trading_name", "address", "classification", "administrative_area"] as const;
export type OverridableField = (typeof OVERRIDABLE_FIELDS)[number];

export const CHANGE_CAUSES = ["OPERATOR_CHANGE", "CLOSURE", "CESSATION"] as const;
export type ChangeCause = (typeof CHANGE_CAUSES)[number];
