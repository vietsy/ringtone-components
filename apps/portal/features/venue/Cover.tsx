"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { Artwork, PlayerAmbient } from "@/components/r1";

const subscribe = () => () => undefined;

/**
 * True once the page is in the browser. R1's groove stand-in writes each groove's stroke width with every decimal,
 * which the browser shortens when it reads the server's HTML, so a groove drawn on the server never hydrates
 * cleanly; both pieces below are decoration (the title beside them is the text), so they wait for the client.
 */
function useBrowser(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/** R1's Artwork, drawn once the page is in the browser. */
export function Cover(props: ComponentProps<typeof Artwork>) {
  return useBrowser() ? <Artwork {...props} /> : null;
}

/** R1's PlayerAmbient, the guest display's ground from the cover, drawn once the page is in the browser. */
export function Ambient({ title }: { title: string }) {
  return useBrowser() ? <PlayerAmbient title={title} /> : null;
}
