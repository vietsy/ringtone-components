import messages from "@/messages/vi.json";

/**
 * A message is rendered from the stable error code, never by parsing `detail` (R23.8).
 *
 * Two reasons, and the second is the one that gets forgotten. The same failure has to read
 * correctly in Vietnamese and in English, which a server-composed sentence cannot do. And a
 * wording improvement on the server must not be a breaking change for this client, which it would
 * be the moment anything here branched on the text.
 */
const CATALOGUE = messages as Record<string, string>;

export interface ErrorPresentation {
  message: string;
  /** Whether to offer a retry. Offering one for a refusal wastes the user's time. */
  retryable: boolean;
  /** Shown so a user reporting the problem can quote something support can find. */
  traceId: string | null;
}

const RETRYABLE = new Set(["RATE_LIMITED", "INTERNAL_ERROR", "SERVICE_NOT_CONFIGURED"]);

export function presentError(code: string, traceId: string | null): ErrorPresentation {
  return {
    message: CATALOGUE[`error.${code}`] ?? CATALOGUE["error.UNKNOWN"] ?? code,
    retryable: RETRYABLE.has(code),
    traceId,
  };
}
