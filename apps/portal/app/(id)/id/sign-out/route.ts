import { redirect } from "next/navigation";
import { endSession } from "@/lib/api/session";
import { routes } from "@/lib/routes";

/**
 * Signing out, the shells' Sign out control: the session ends and the reader is back at sign-in. A route
 * handler because R1's shells take the way out as a link; it changes nothing but the reader's own session.
 */
export async function GET(): Promise<never> {
  await endSession();
  redirect(routes.signIn());
}
