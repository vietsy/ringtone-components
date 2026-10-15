import { randomInt, randomUUID } from "node:crypto";

/**
 * References in the form the canvas writes them (REG-P5TJ4BXC7M, ISP-2QK7TM4W8E, R1-CER-2026-T7QM4BWJ): a
 * prefix and ten characters from an alphabet without 0, 1, I, L, O and U, so a reference read aloud or copied
 * from paper is not misread.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

function characters(count: number): string {
  let out = "";
  for (let i = 0; i < count; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** A new reference with its prefix: `reference("REG")` gives "REG-" and ten characters. */
export function reference(prefix: string): string {
  return `${prefix}-${characters(10)}`;
}

/** A status record's public reference: "R1-CER-", the year it is issued, and eight characters. */
export function recordReference(year: number): string {
  return `R1-CER-${year}-${characters(8)}`;
}

/** A session's id: unguessable, so a cookie cannot be made up to read another session's data. */
export function sessionId(): string {
  return randomUUID();
}
