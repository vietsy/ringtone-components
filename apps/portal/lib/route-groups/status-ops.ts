import { enc, route } from "./route";

/**
 * CER on the operations console: status records, issue approval, status changes (SCR-CER-01 to 09), and the
 * signing keys on the security console (SCR-CER-10).
 * This group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 *
 * A record is addressed by its key: its public reference once issued, the decision it was opened under while it
 * waits to issue (a pending record holds no reference). A list's filter is in its address, so a reload or a shared
 * link keeps it (design/03 convention 8).
 */

const query = (params: Readonly<Record<string, string | null | undefined>>) => {
  const kept = Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "");
  return kept.length === 0 ? "" : `?${new URLSearchParams(kept).toString()}`;
};

export const statusOpsRoutes = {
  /**
   * SCR-CER-01 Status records. Without a filter it opens on the records waiting to issue or renew; `waiting` false
   * lists every record. `after` is where the next page starts.
   */
  opsStatusRecords: (criteria?: { status?: string | null; premises?: string | null; waiting?: boolean; after?: string | null }) =>
    route(
      `/ops/status-records${
        criteria === undefined
          ? ""
          : query({
              status: criteria.status,
              premises_id: criteria.premises,
              waiting: criteria.waiting === false ? "off" : "on",
              cursor: criteria.after,
            })
      }`,
    ),
  /** SCR-CER-02 Status record */
  opsStatusRecord: (record: string) => route(`/ops/status-records/${enc(record)}`),
  /** SCR-CER-03 Approve an issue */
  opsStatusRecordApproval: (record: string) => route(`/ops/status-records/${enc(record)}/approve`),
  /** SCR-CER-05 Propose a status change: on the record's open review when one is named, or opening one */
  opsStatusRecordProposal: (record: string, review?: string) => route(`/ops/status-records/${enc(record)}/propose${query({ review })}`),
  /** SCR-CER-09 Record history */
  opsStatusRecordHistory: (record: string) => route(`/ops/status-records/${enc(record)}/history`),
  /** The printout an officer's Print opens on SCR-CER-02: the sheet of SCR-CER-13 */
  opsStatusRecordPrint: (record: string, printout: string) => route(`/ops/status-records/${enc(record)}/print${query({ printout })}`),
  /** SCR-CER-04 Status reviews, by state */
  opsStatusReviews: (state?: string) => route(`/ops/status-records/reviews${query({ state })}`),
  /** SCR-CER-06 Decide a status change */
  opsStatusReview: (review: string) => route(`/ops/status-records/reviews/${enc(review)}`),
  /** SCR-CER-07 Re-decided obligations, by state */
  opsFollowUps: (state?: string) => route(`/ops/status-records/follow-ups${query({ state })}`),
  /** SCR-CER-08 Resolve a follow-up */
  opsFollowUp: (followUp: string) => route(`/ops/status-records/follow-ups/${enc(followUp)}`),
  /** SCR-CER-10 Signing keys, on the security console */
  securitySigningKeys: () => route("/security/signing-keys"),
} as const;
