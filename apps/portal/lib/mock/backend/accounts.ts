import { accounts, type MockAccount } from "./store";

/**
 * The accounts RightOne ID holds in the demonstration, from the canvas's data sheet: Đỗ Thu Trang, the
 * premises principal of the Then Cửa Việt chain, with the password the sign-in board types; Lục Bảo Ngân,
 * who has registered and not yet confirmed her address; an account suspended by RightOne. The canvas draws no
 * address for the inspector, Âu Thị Ngọc Diệp; hers is on the reserved `.example` domain so it can never be
 * someone's real address.
 */
const SEED: readonly MockAccount[] = [
  {
    email: "trang.do@thencuaviet.vn",
    name: "Đỗ Thu Trang",
    role: "principal",
    password: "Hem214-chieu-mua",
    state: "active",
    organisations: ["tcv", "qnh"],
    failedAttempts: 0,
    lockedUntil: null,
  },
  {
    email: "ngan.luc@thencuaviet.vn",
    name: "Lục Bảo Ngân",
    role: "principal",
    password: "Then-Cua-Pasteur#26",
    state: "unconfirmed",
    organisations: [],
    failedAttempts: 0,
    lockedUntil: null,
  },
  {
    email: "quyen.giang@thencuaviet.vn",
    name: "quyen.giang@thencuaviet.vn",
    role: "principal",
    password: "Then-Cua-Pasteur#26",
    state: "suspended",
    organisations: ["tcv"],
    failedAttempts: 0,
    lockedUntil: null,
  },
  // The administrators of the three rights organisations the canvas draws, one at each stage: Lam Hồng
  // participates (the catalogue boards), Hạc Bạch is submitting its mandate and terms (the governance
  // boards), Dây Đàn is applying to participate (SCR-CAT-01). The canvas draws no addresses for them either.
  {
    email: "baotran.la@lamhong.example",
    name: "La Bảo Trân",
    role: "cmo",
    password: "LamHong-PTC-0107",
    state: "active",
    organisations: ["lamhong"],
    failedAttempts: 0,
    lockedUntil: null,
  },
  {
    email: "thimai.doan@hacbach.example",
    name: "Đoàn Thị Mai",
    role: "cmo",
    password: "HacBach-UyQuyen-26",
    state: "active",
    organisations: ["hacbach"],
    failedAttempts: 0,
    lockedUntil: null,
  },
  {
    email: "lanchi.mac@dayan.example",
    name: "Mạc Thị Lan Chi",
    role: "cmo",
    password: "DayDan-ThamGia-26",
    state: "active",
    organisations: ["dayan"],
    failedAttempts: 0,
    lockedUntil: null,
  },
  {
    email: "ngocdiep.au@kiemtra.example",
    name: "Âu Thị Ngọc Diệp",
    role: "inspector",
    password: "KTVH-0418-kiemtra",
    state: "active",
    organisations: [],
    failedAttempts: 0,
    lockedUntil: null,
  },
];

/**
 * RightOne ID's accounts: every seed account is added once per server process and then lives on with what
 * happened to it (a lock, a confirmation); an account added to the seed later joins without a restart.
 */
export function accountBook(): Map<string, MockAccount> {
  const book = accounts();
  for (const account of SEED) if (!book.has(account.email)) book.set(account.email, { ...account });
  return book;
}

export function findAccount(email: string): MockAccount | null {
  return accountBook().get(email.trim().toLowerCase()) ?? null;
}

/**
 * The organisations RightOne ID knows, by id: the Then Cửa Việt company the premises belong to; the household
 * business Đỗ Thu Trang also belongs to, which RightOne does not serve (choosing it is refused, as SCR-RID-04
 * draws); and the three rights organisations of the CMO boards.
 */
export const ORGANISATIONS: readonly { id: string; name: string; slug: string; served: boolean }[] = [
  { id: "tcv", name: "Công ty TNHH Then Cửa Việt", slug: "then-cua-viet", served: true },
  { id: "qnh", name: "Hộ kinh doanh Quán Nướng Hẻm 214", slug: "quan-nuong-hem-214", served: false },
  { id: "lamhong", name: "Hội Quyền tác giả Âm nhạc Lam Hồng", slug: "lam-hong", served: true },
  { id: "hacbach", name: "Trung tâm Quyền biểu diễn Hạc Bạch", slug: "hac-bach", served: true },
  { id: "dayan", name: "Dây Đàn Rights Agency", slug: "day-dan", served: true },
];

export function organisationName(id: string): string {
  return ORGANISATIONS.find((organisation) => organisation.id === id)?.name ?? id;
}
