"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Reads the page again every so often while a state can change without the reader acting: SCR-CAT-24's window
 * closes on its own when the processor picks the submission up, and the screen switches to the refusal wording
 * in place rather than letting the button stay live and fail. What the reader typed stays, as a refresh keeps
 * client state.
 */
export function StatePoll({ everyMs }: { everyMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), everyMs);
    return () => window.clearInterval(timer);
  }, [router, everyMs]);
  return null;
}
