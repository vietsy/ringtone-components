import { randomUUID } from "node:crypto";
import { putFlash, readFlash } from "@/lib/mock/backend/store";
import { usesMockData } from "./source";

/**
 * What a form hands to the page it redirects to: a refused act, the fields to correct, the values typed. The
 * action keeps it and puts its id in the address (`?attempt=`), so a reload shows the same answer, the back
 * button works, and nothing typed - a password least of all - travels in the address.
 */
export function keepForPage(value: unknown): string {
  const id = randomUUID();
  putFlash(id, value);
  return id;
}

/** The value a form kept for this page, from the `?attempt=` it redirected with; null when there is none. */
export function readForPage<T>(searchParams: Readonly<Record<string, string | string[] | undefined>>): T | null {
  const id = searchParams.attempt;
  return usesMockData() && typeof id === "string" ? readFlash<T>(id) : null;
}
