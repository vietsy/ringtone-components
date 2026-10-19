"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { Button } from "@/components/r1";

type Props = ComponentProps<typeof Button> & { shortcut: string };

const noSubscription = () => () => undefined;

/**
 * Whether the page has hydrated: false on the server and during hydration, true afterwards. R1 draws an Alt shortcut
 * the platform's way ("⌥N" on Apple devices, "Alt+N" elsewhere), which the server cannot know, so a shortcut drawn on
 * the server would not match the browser's first render.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

/** An R1 Button whose Alt shortcut is bound and drawn once the page has hydrated; the button itself is the server's. */
export function ShortcutButton({ shortcut, ...props }: Props) {
  const hydrated = useHydrated();
  return <Button {...props} {...(hydrated ? { shortcut } : {})} />;
}
