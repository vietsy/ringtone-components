import type { Route } from "next";

/**
 * Typed routes check a literal path against the app directory, but a path built from a reference is a plain
 * string to the compiler. Every path is built with this, in `lib/routes.ts` or one of its groups, and nowhere
 * else, so these are the places that vouch for a path, and `redirect()` and `<Link>` take it without a cast.
 */
export const route = (path: string): Route => path as Route;

export const enc = encodeURIComponent;
