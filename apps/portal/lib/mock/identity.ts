import type { LoadOutcome } from "@rightone/ui";
import type { EmailConfirmation, OrganisationChoice, RegistrationAttempt, SignInAttempt } from "@/lib/api/identity";

/** The view states SCR-RID-01 Sign in was drawn in on the RightOne IAM canvas. */
export const RID01_VIEWS = [
  "form",
  "field-error",
  "submitting",
  "invalid",
  "locked",
  "suspended",
  "unconfirmed",
  "session-expired",
  "reauth",
  "external-failed",
  "external-unverified",
  "account-deleted",
  "error",
] as const;
export type Rid01View = (typeof RID01_VIEWS)[number];

/** The view states SCR-RID-04 Choose an organisation was drawn in. */
export const RID04_VIEWS = ["list", "working", "invalid", "empty", "loading", "error"] as const;
export type Rid04View = (typeof RID04_VIEWS)[number];

/** The view states SCR-RID-07 Register was drawn in. */
export const RID07_VIEWS = ["form", "field-error", "submitting", "breached", "sent", "closed", "error"] as const;
export type Rid07View = (typeof RID07_VIEWS)[number];

/** The view states SCR-RID-08 Confirm the email was drawn in. */
export const RID08_VIEWS = ["confirmed", "failed", "bad-link", "error"] as const;
export type Rid08View = (typeof RID08_VIEWS)[number];

/** The canvas's Providers tweak: the external sign-in providers RightOne ID offers. */
export const RID01_PROVIDER_SETS = {
  google: ["Google"],
  all: ["Google", "Microsoft", "Facebook"],
  none: [],
} as const satisfies Record<string, readonly string[]>;
export type ProviderSet = keyof typeof RID01_PROVIDER_SETS;

const failure = (code: string, retryable: boolean, traceId: string | null = null) => ({
  data: null,
  failure: { code, traceId, retryable },
});

/** The people of the Then Cửa Việt chain the canvas signs in, and the sample passwords it types. */
const TRANG = "trang.do@thencuaviet.vn";
const STRONG = "Then-Cua-Pasteur#26";

const BLANK_SIGN_IN: SignInAttempt = {
  email: "",
  password: "",
  remember: false,
  emailError: null,
  passwordError: null,
  outcome: null,
  reauth: false,
};

/**
 * The attempt SCR-RID-01 draws in each view after "Đăng nhập": what was typed, and RightOne ID's answer.
 * The account is locked at 10:15 on 2 October 2026 until 10:27.
 */
export function mockSignInAttempt(view: Exclude<Rid01View, "form">): LoadOutcome<SignInAttempt> {
  const as = (attempt: Partial<SignInAttempt>): LoadOutcome<SignInAttempt> => ({ data: { ...BLANK_SIGN_IN, ...attempt }, failure: null });
  switch (view) {
    case "field-error":
      return as({ email: "trang.do.thencuaviet.vn", emailError: "invalid", passwordError: "required" });
    case "submitting":
      return as({ email: TRANG, password: "Hem214-chieu-mua", remember: true });
    case "invalid":
      return as({ email: TRANG, outcome: { kind: "invalid" } });
    case "locked":
      return as({ email: TRANG, outcome: { kind: "locked", answeredAt: "2026-10-02T10:15:00+07:00", lockedUntil: "2026-10-02T10:27:00+07:00" } });
    case "suspended":
      return as({ email: "quyen.giang@thencuaviet.vn", outcome: { kind: "suspended" } });
    case "unconfirmed":
      return as({ email: "ngan.luc@thencuaviet.vn", outcome: { kind: "unconfirmed" } });
    case "session-expired":
      return as({ email: TRANG, outcome: { kind: "session-expired" } });
    case "reauth":
      return as({ reauth: true });
    case "external-failed":
      return as({ outcome: { kind: "external-failed" } });
    case "external-unverified":
      return as({ outcome: { kind: "external-unverified" } });
    case "account-deleted":
      return as({ outcome: { kind: "account-deleted" } });
    case "error":
      return failure("INTERNAL_ERROR", true, "7c41e09ad2b35f68");
  }
}

/** The two organisations Đỗ Thu Trang belongs to. */
const ORGANISATIONS = [
  { id: "tcv", name: "Công ty TNHH Then Cửa Việt", slug: "then-cua-viet" },
  { id: "qnh", name: "Hộ kinh doanh Quán Nướng Hẻm 214", slug: "quan-nuong-hem-214" },
] as const;

export function mockOrganisationChoice(view: Exclude<Rid04View, "loading">): LoadOutcome<OrganisationChoice> {
  switch (view) {
    case "list":
      return { data: { organisations: ORGANISATIONS, submitted: null, refused: false }, failure: null };
    case "working":
      return { data: { organisations: ORGANISATIONS, submitted: "tcv", refused: false }, failure: null };
    case "invalid":
      // The household business is no longer an organisation she may sign in to.
      return { data: { organisations: ORGANISATIONS, submitted: "qnh", refused: true }, failure: null };
    case "empty":
      return { data: { organisations: [], submitted: null, refused: false }, failure: null };
    case "error":
      return failure("INTERNAL_ERROR", true, "5f0c3a92d7e18b46");
  }
}

const BLANK_REGISTRATION: RegistrationAttempt = {
  fullName: "Lục Bảo Ngân",
  email: "ngan.luc@thencuaviet.vn",
  password: "",
  confirm: "",
  nameError: null,
  passwordError: null,
  confirmError: null,
  outcome: null,
};

/** Lục Bảo Ngân registers. Registration closed is a refusal of the page, not of a field. */
export function mockRegistrationAttempt(view: Exclude<Rid07View, "form">): LoadOutcome<RegistrationAttempt> {
  const as = (attempt: Partial<RegistrationAttempt>): LoadOutcome<RegistrationAttempt> => ({
    data: { ...BLANK_REGISTRATION, ...attempt },
    failure: null,
  });
  switch (view) {
    case "field-error":
      return as({ fullName: "", nameError: "required", password: STRONG, confirm: "Then-Cua-Pasteur#62", confirmError: "mismatch" });
    case "submitting":
      return as({ password: STRONG, confirm: STRONG });
    case "breached":
      return as({ password: "Password@2026", confirm: "Password@2026", passwordError: "breached" });
    case "sent":
      return as({ outcome: "sent" });
    case "closed":
      return failure("REGISTRATION_CLOSED", false);
    case "error":
      return failure("INTERNAL_ERROR", true, "d06e93b1c48a2f57");
  }
}

export function mockEmailConfirmation(view: Rid08View): LoadOutcome<EmailConfirmation> {
  switch (view) {
    case "confirmed":
      return { data: { outcome: "confirmed" }, failure: null };
    case "failed":
      return { data: { outcome: "failed" }, failure: null };
    case "bad-link":
      return { data: { outcome: "bad-link" }, failure: null };
    case "error":
      return failure("INTERNAL_ERROR", true, "1a5fd8c3e9706b24");
  }
}
