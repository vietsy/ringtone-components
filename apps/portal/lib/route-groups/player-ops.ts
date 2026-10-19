import { enc, route } from "./route";

/**
 * Player devices and evidence on the consoles (SCR-PLR-01, 02, 03, 07, 10, 11, 13, 15, SCR-IAM-07, 08), the public
 * certification register and device-assurance policy (SCR-PLR-10, 11), and the guest actions (SCR-PLR-19). This
 * group's routes, spread into `routes` by `lib/routes.ts`; only the work on this group edits this file.
 */

/** A query string of the values given; an empty or null value is left out, so the address names only a filter set. */
function query(values: Readonly<Record<string, string | null | undefined>>): string {
  const pairs = Object.entries(values).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "");
  return pairs.length === 0 ? "" : `?${new URLSearchParams(pairs).toString()}`;
}

export const playerOpsRoutes = {
  /** SCR-PLR-01 Device estate, with its filter */
  opsDevices: (filter: Readonly<{ device?: string | null; premises?: string | null; status?: string | null; supplier?: string | null }> = {}) =>
    route(`/ops/devices${query({ device: filter.device, premises_id: filter.premises, status: filter.status, supplier: filter.supplier })}`),
  /** SCR-PLR-03 Enrol a device */
  opsEnrolDevice: () => route("/ops/devices/enrol"),
  /** SCR-PLR-02 Device record */
  opsDevice: (device: string) => route(`/ops/devices/${enc(device)}`),
  /** SCR-IAM-07 Device register, with its filter */
  opsDeviceRegister: (filter: Readonly<{ premises?: string | null; state?: string | null }> = {}) =>
    route(`/ops/device-register${query({ premises_id: filter.premises, state: filter.state })}`),
  /** SCR-IAM-08 Device detail and revocation */
  opsDeviceCredential: (credential: string) => route(`/ops/device-register/${enc(credential)}`),
  /** SCR-PLR-07 Evidence acceptance: a device's latest batch */
  evidenceAcceptance: (device?: string) => route(`/evidence/acceptance${query({ device })}`),
  /** SCR-PLR-15 Playback decisions: a device's local day, of one kind */
  evidenceDecisions: (asked: Readonly<{ device?: string | null; day?: string | null; kind?: string | null }> = {}) =>
    route(`/evidence/playback-decisions${query({ device: asked.device, day: asked.day, kind: asked.kind })}`),
  /** SCR-PLR-15 Export the day: the day's decisions as CSV */
  evidenceDecisionsExport: (device: string, day: string) => route(`/evidence/playback-decisions/export${query({ device, day })}`),
  /** SCR-PLR-13 Offline-continuity policy */
  evidenceOfflinePolicy: () => route("/evidence/offline-continuity"),
  /** SCR-PLR-11 on the evidence console: draft and approve a device-assurance policy version */
  evidenceAssurancePolicy: () => route("/evidence/assurance-policy"),
  /** SCR-PLR-15's rule set on the evidence console: draft and approve a loudness and transition version */
  evidencePlaybackRules: () => route("/evidence/playback-rules"),
  /** SCR-PLR-10 Certification register, on the evidence console */
  evidenceCertification: (filter?: string) => route(`/evidence/certification${query({ show: filter })}`),
  /** SCR-PLR-10 Certification register, public */
  certificationRegister: (filter?: string) => route(`/player-certification${query({ show: filter })}`),
  /** SCR-PLR-11 Device-assurance policy, public: the version in effect, or another published one */
  assurancePolicy: (version?: number) => route(`/player-assurance-policy${query({ version: version === undefined ? null : String(version) })}`),
  /** SCR-PLR-19 Guest actions: the installed display's actions layout, and the guest's phone page its code opens */
  guestActions: (premises: string) => route(`/now/${enc(premises)}/actions`),
} as const;
