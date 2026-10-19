import type { Route } from "next";
import { redirect } from "next/navigation";
import type { LoadOutcome } from "@rightone/ui";
import { keepForPage } from "@/lib/api/flash";
import type { PartyAnswer } from "@/lib/api/parties";
import { withAttempt } from "@/lib/routes";

/** What every party family form hands back to its page: the refusal it met, or what it recorded. */
interface Attempt {
  refusal: { code: string; field: string | null; values: Readonly<Record<string, string>> } | null;
  done: string | null;
}

/**
 * The next screen on success, or the form's screen with the attempt kept (`keepForPage`); both carry what the act
 * answered. A seam that could not ask at all is kept as a refusal with the outage's code, which the page draws as one.
 */
export function settle<T, A extends Attempt>(outcome: LoadOutcome<PartyAnswer<T>>, attempt: Omit<A, "refusal" | "done">, done: (accepted: T) => string, next: Route, back: Route): never {
  const answer = outcome.data;
  if (answer === null) {
    redirect(withAttempt(back, keepForPage({ ...attempt, refusal: { code: outcome.failure?.code ?? "INTERNAL_ERROR", field: null, values: {} }, done: null })));
  }
  if (answer.accepted === null) {
    redirect(withAttempt(back, keepForPage({ ...attempt, refusal: answer.refusal, done: null })));
  }
  redirect(withAttempt(next, keepForPage({ ...attempt, refusal: null, done: done(answer.accepted) })));
}
