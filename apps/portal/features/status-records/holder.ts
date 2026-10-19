import type { HolderState, RecordStatus } from "@/lib/api/status-records";

/** The status a holder's page reads, as the record's own (SM-03): every state an issued record takes, and pending. */
export function holderStatus(state: HolderState | "pending"): RecordStatus {
  return state === "pending" ? "PENDING_ISSUE" : (state.toUpperCase() as Uppercase<HolderState>);
}
