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
