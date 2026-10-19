import { enc, route } from "./route";

/**
 * Cases and notices for the premises: raise a case, my case, my notices, notice preferences (SCR-CAS-01, 02,
 * SCR-COM-10, 12). A case and a notice are read by their reference, which is the credential on the routes that
 * need no account, so those two pages open with or without a session.
 * This group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 */
export const premisesMoreRoutes = {
  /** The nav's Cases: the signed-in principal's own cases, each opening SCR-CAS-02 */
  myCases: () => route("/cases"),
  /**
   * SCR-CAS-01 Raise a case: on the account route for a signed-in principal, on the account-free route for anyone
   * else. `subject` is the record the case is about (a decision, a payment), `group` the stakeholder group the
   * reader says they are, as GET /intake-routes takes it.
   */
  raiseCase: (subject?: string, group?: string) => {
    const query = new URLSearchParams();
    if (subject !== undefined && subject !== "") query.set("subject", subject);
    if (group !== undefined && group !== "") query.set("group", group);
    const search = query.toString();
    return route(search === "" ? "/cases/new" : `/cases/new?${search}`);
  },
  /** SCR-CAS-02 My case, by its reference */
  myCase: (reference: string) => route(`/cases/${enc(reference)}`),
  /** The nav's Notices: the notices sent to the signed-in principal's party, each opening SCR-COM-10 */
  myNotices: () => route("/notices"),
  /** SCR-COM-10 My notice, by its reference */
  myNotice: (reference: string) => route(`/notices/${enc(reference)}`),
  /** SCR-COM-12 Notice preferences; `notice` is the notice it was opened from, which Back to the notice returns to */
  noticePreferences: (notice?: string) =>
    route(notice === undefined || notice === "" ? "/notices/preferences" : `/notices/preferences?notice=${enc(notice)}`),
} as const;
