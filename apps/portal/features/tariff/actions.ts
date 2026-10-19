"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { keepForPage } from "@/lib/api/flash";
import { requireStaff } from "@/lib/api/session";
import { reproduceCalculation, type ReproduceAttempt } from "@/lib/api/tariff";
import { routes, withAttempt } from "@/lib/routes";

/** A calculation's reference, as ALG-302 writes it. Anything else is not a calculation this act can name. */
const CALCULATION = /^TCL-[A-Z2-7]{10}$/;

/**
 * Reproduce (SCR-TAR-09): the calculation again from what it recorded. The new reproduction heads the Reproductions
 * panel, marked; a refusal is drawn in its place with its code, the calculation staying on the page. Any member of staff may
 * send it; the backend decides who may reproduce (the finance operator and the auditor).
 */
export async function reproduceAct(form: FormData): Promise<void> {
  const calculation = form.get("calculation");
  if (typeof calculation !== "string" || !CALCULATION.test(calculation)) throw new Error("Reproduce names one calculation.");
  const staff = await requireStaff();
  const outcome = await reproduceCalculation(staff, calculation);
  revalidatePath(routes.opsCalculation(calculation));
  if (outcome.data === null) {
    const attempt: ReproduceAttempt = { page: "calculation", calculation, code: outcome.failure?.code ?? "INTERNAL_ERROR" };
    redirect(withAttempt(routes.opsCalculation(calculation), keepForPage(attempt)));
  }
  redirect(routes.opsCalculation(calculation, outcome.data.reproduction));
}
