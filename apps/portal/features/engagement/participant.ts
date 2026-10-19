import type { Route } from "next";
import { artistNav } from "@/components/shells/artist-nav";
import { premisesNav } from "@/components/shells/premises-nav";
import type { Participant } from "@/lib/api/engagement";
import { requireArtist, requirePrincipal, type Artist, type Principal } from "@/lib/api/session";
import type { Locale } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import type { Frame } from "@/lib/view/frame";

/**
 * The portal a participant reads their own engagement in, and everything a participant screen needs to know about it:
 * who reads (the seam scopes every read to them), the shell's account and nav, and where the five screens are. A
 * premises principal reads it in the premises portal, for the organisation they act for; an artist in the artist
 * portal, for themselves, with SCR-ENG-05 beside it. The screens themselves are the same for both.
 */

export type PortalKind = "premises" | "artist";

/** A nav item as `PortalShell` takes it. */
type NavItem = { label: string; href?: string; current?: boolean; icon?: string };

export interface ParticipantPortal {
  kind: PortalKind;
  who: Participant;
  /** The account the shell names. */
  account: string;
  /** Whose participation it is, as each page's meta line says: the organisation acted for, or the artist. */
  party: string;
  nav: (frame: Frame, locale: Locale) => NavItem[];
  home: Route;
  balance: (at?: { asAt?: string | null; after?: string | null }) => Route;
  points: Route;
  event: (id: string) => Route;
  /** SCR-ENG-05, the artist's alone. */
  referral: Route | null;
}

export function premisesPortal(principal: Principal): ParticipantPortal {
  return {
    kind: "premises",
    who: principal,
    account: principal.account,
    party: principal.party,
    nav: (frame, locale) => premisesNav("engagement", frame, locale),
    home: routes.engagement(),
    balance: routes.engagementBalance,
    points: routes.engagementPoints(),
    event: routes.engagementEvent,
    referral: null,
  };
}

export function artistPortal(artist: Artist): ParticipantPortal {
  return {
    kind: "artist",
    who: artist,
    account: artist.account,
    party: artist.account,
    nav: (frame, locale) => artistNav("engagement", frame, locale),
    home: routes.artistEngagement(),
    balance: routes.artistEngagementBalance,
    points: routes.artistEngagementPoints(),
    event: routes.artistEngagementEvent,
    referral: routes.artistReferral(),
  };
}

/**
 * The portal an act was made from, with the session that may make it: the signed-in artist, or the premises principal.
 * The page names the portal; the session decides who acts, so a portal named wrongly reaches only the sign-in page.
 */
export async function requirePortal(kind: string): Promise<ParticipantPortal> {
  return kind === "artist" ? artistPortal(await requireArtist()) : premisesPortal(await requirePrincipal());
}
