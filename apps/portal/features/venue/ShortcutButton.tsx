"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { Button } from "@/components/r1";

type Props = ComponentProps<typeof Button> & { shortcut: string };

const noSubscription = () => () => undefined;

/**
 * An R1 Button whose keyboard shortcut is bound and drawn once the page has hydrated: SCR-VEN-13's three acts. R1 draws
 * an Alt shortcut the platform's way ("⌥O" on Apple devices, "Alt+O" elsewhere), which the server cannot know, so a
 * shortcut drawn on the server would not match the browser's first render.
 */
export function ShortcutButton({ shortcut, ...props }: Props) {
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  return <Button {...props} {...(hydrated ? { shortcut } : {})} />;
}
