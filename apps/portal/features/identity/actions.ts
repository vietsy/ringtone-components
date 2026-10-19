"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import { chooseOrganisation, registerAccount, signInWithPassword } from "@/lib/api/identity";
import { routes } from "@/lib/routes";

const field = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

/** A password is taken as typed: a space in it is part of it. */
const secret = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

/**
 * SCR-RID-01 "Đăng nhập". Signed in, a premises principal goes on to choose the organisation they act for, an
 * inspector to the field client, a rights organisation's administrator to the organisation portal, an artist to
 * the artist portal and a member of the gateway's staff to the operations console; refused, the page shows why,
 * with the address kept and the password not.
 */
export async function signIn(formData: FormData): Promise<void> {
  const outcome = await signInWithPassword(field(formData, "Input.Email"), secret(formData, "Input.Password"), formData.has("Input.RememberMe"));
  if (outcome.data === null) redirect(routes.signIn());
  const { attempt, role } = outcome.data;
  if (role === "inspector") redirect(routes.field());
  if (role === "cmo") redirect(routes.org());
  if (role === "artist") redirect(routes.artistHome());
  if (role === "staff") redirect(routes.ops());
  if (role === "principal") redirect(routes.chooseOrganisation());
  redirect(routes.signIn(keepForPage(attempt)));
}

/**
 * SCR-RID-01 "Đăng nhập với {provider}". The mock backend has no external provider to hand over to, so the
 * attempt ends as RightOne ID answers a provider sign-in that could not be completed.
 */
// Next takes only async functions as server actions; this one answers at once.
// eslint-disable-next-line @typescript-eslint/require-await
export async function signInWithProvider(provider: string, formData: FormData): Promise<void> {
  void provider;
  const attempt = { email: field(formData, "Input.Email"), password: "", remember: false, emailError: null, passwordError: null, outcome: { kind: "external-failed" }, reauth: false };
  redirect(routes.signIn(keepForPage(attempt)));
}

/**
 * SCR-RID-07 "Đăng ký". RightOne ID answers "sent" and mails a confirmation link (SCR-RID-08). The mock backend
 * writes the link to the server's log instead of a mailbox.
 */
export async function register(formData: FormData): Promise<void> {
  const outcome = registerAccount(
    field(formData, "Input.FullName"),
    field(formData, "Input.Email"),
    secret(formData, "Input.Password"),
    secret(formData, "Input.ConfirmPassword"),
  );
  if (outcome.data === null) redirect(routes.register());
  const { attempt, token } = outcome.data;
  if (token !== null) {
    const host = (await headers()).get("host") ?? "localhost";
    console.info(`[RightOne ID mock mail] Confirm ${attempt.email}: http://${host}${routes.confirmEmail(token)}`);
  }
  redirect(routes.register(keepForPage(attempt)));
}

/** SCR-RID-04 "Tiếp tục tới RightOne": act for the organisation chosen, or hear why it cannot be chosen. */
export async function continueToRightOne(formData: FormData): Promise<void> {
  const organisation = field(formData, "organizationId");
  if (organisation === "") redirect(routes.chooseOrganisation());
  const outcome = await chooseOrganisation(organisation);
  if (outcome.data?.accepted === true) redirect(routes.applications());
  redirect(routes.chooseOrganisation(organisation));
}
