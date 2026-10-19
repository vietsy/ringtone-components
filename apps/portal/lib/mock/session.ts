/**
 * The canvas's people, as its review states and seeds name them: invented, and the same on every screen. Who
 * is signed in is the session's (`lib/api/session.ts`), never these.
 */
export const MOCK_PRINCIPAL = {
  /** The premises principal of the Then Cửa Việt chain. */
  account: "Đỗ Thu Trang",
  party: "Công ty TNHH Then Cửa Việt",
} as const;

export const MOCK_INSPECTOR = {
  account: "Âu Thị Ngọc Diệp",
} as const;

/**
 * The artist the artist portal's screens draw (ACT-ART): Tống Nhã Uyên, an invented performer with no board of her
 * own, by her RightOne ID address (on the reserved `.example` domain), her name and the party reference PTY's
 * register would give her. ENG takes her as a participant of the artist class; DAT answers her location view.
 */
export const MOCK_ARTIST = {
  email: "nhauyen.tong@nghesi.example",
  name: "Tống Nhã Uyên",
  party: "PTY-207415",
} as const;
