/**
 * Whether the seams in `lib/api` answer from mock data.
 *
 * `@rightone/api-client` is not published yet, so without this every seam returns
 * SERVICE_NOT_CONFIGURED - a failure, never an empty result. `RIGHTONE_DATA=mock` makes them answer
 * from `lib/mock` instead, with the sample data the design canvas uses, and every page then says so
 * at its foot. It is read when a request arrives, so one image serves both.
 */
export function usesMockData(): boolean {
  return process.env.RIGHTONE_DATA === "mock";
}

/** The failure a seam returns while the API client is not wired. */
export const NOT_CONFIGURED = {
  data: null,
  failure: { code: "SERVICE_NOT_CONFIGURED", traceId: null, retryable: true },
} as const;
