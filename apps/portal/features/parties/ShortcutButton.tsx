"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { Button } from "@/components/r1";

type Props = ComponentProps<typeof Button> & { shortcut: string };

const noSubscription = () => () => undefined;

/**
 * An R1 Button whose Alt shortcut is bound and drawn once the page has hydrated. R1 draws it the platform's way
 * ("⌥N" on Apple devices, "Alt+N" elsewhere), which the server cannot know, so drawing it on the server would not
 * match the browser's first render.
 */
export function ShortcutButton({ shortcut, ...props }: Props) {
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  return <Button {...props} {...(hydrated ? { shortcut } : {})} />;
}
