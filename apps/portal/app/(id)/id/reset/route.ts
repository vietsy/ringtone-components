import { redirect } from "next/navigation";
import { resetData } from "@/lib/api/session";
import { routes } from "@/lib/routes";

/**
 * Resetting the sample data, the link at the foot of every page while the portal runs on mock data: this
 * browser's world returns to the seed, the session ends, and the reader is back at sign-in. A route handler
 * because the link is a link; it touches nothing but this browser's own copy of the data.
 */
export async function GET(): Promise<never> {
  await resetData();
  redirect(routes.signIn());
}
