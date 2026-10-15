import { usesMockData } from "@/lib/api/source";

/**
 * The view state a mock screen shows. On the design canvas each board has a View state tweak; with mock
 * data the same states are reachable as `?view=<name>`, so every state that was designed can be shown
 * and reviewed. Without mock data the view comes from the data and this returns the fallback.
 */
export function demoView<V extends string>(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
  views: readonly V[],
  fallback: V,
): V {
  if (!usesMockData()) return fallback;
  const asked = searchParams.view;
  return typeof asked === "string" && (views as readonly string[]).includes(asked) ? (asked as V) : fallback;
}

/**
 * The design-review override alone: the view `?view=` asks for, in mock mode, or null. A page reads its state
 * from the data; a reviewer can still force any state the canvas drew (an outage, a refusal, loading) to
 * check it, and a page given null reads the session's data as a person using the portal would.
 */
export function reviewView<V extends string>(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
  views: readonly V[],
): V | null {
  if (!usesMockData()) return null;
  const asked = searchParams.view;
  return typeof asked === "string" && (views as readonly string[]).includes(asked) ? (asked as V) : null;
}

