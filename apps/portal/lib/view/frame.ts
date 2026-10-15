import { headers } from "next/headers";

/**
 * The form factor a page lays itself out for. R1's shells and tables take it as a prop (`layout`,
 * `tablet`), the way the design canvas drew each frame, so a page decides it once, on the server,
 * before render: no flash of the desktop layout on a phone.
 *
 * `?frame=phone` (or `tablet`, `desktop`) overrides the guess, so a reviewer can read the phone layout
 * on a desktop browser.
 */
export type Frame = "desktop" | "tablet" | "phone";

const FRAMES: readonly Frame[] = ["desktop", "tablet", "phone"];

export async function getFrame(searchParams: Readonly<Record<string, string | string[] | undefined>>): Promise<Frame> {
  const asked = searchParams.frame;
  if (typeof asked === "string" && (FRAMES as readonly string[]).includes(asked)) return asked as Frame;
  const agent = (await headers()).get("user-agent") ?? "";
  if (/Mobi|iPhone/i.test(agent)) return "phone";
  if (/iPad|Tablet|Android/i.test(agent)) return "tablet";
  return "desktop";
}
