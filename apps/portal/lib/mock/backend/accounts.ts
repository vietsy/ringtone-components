import { MOCK_ARTIST } from "@/lib/mock/session";
import { accounts, type MockAccount } from "./store";
import { SECURITY_OWNER_EMAIL } from "@/lib/mock/role-assignments";

/**
 * The accounts RightOne ID holds in the demonstration, from the canvas's data sheet: Đỗ Thu Trang, the
 * premises principal of the Then Cửa Việt chain, with the password the sign-in board types; Lục Bảo Ngân,
 * who has registered and not yet confirmed her address; an account suspended by RightOne. The canvas draws no
 * address for the inspector, Âu Thị Ngọc Diệp; hers is on the reserved `.example` domain so it can never be
 * someone's real address.
 */
const SEED: readonly MockAccount[] = [
  // Figma's security owner. The design gives no email or password; these are demo-only credentials.
  {
    email: SECURITY_OWNER_EMAIL,
    name: "Hoàng Anh Tuấn",
    role: "staff",
    password: "RightOne-AnNinh-2026",
    state: "active",
    organisations: [],
    failedAttempts: 0,
    lockedUntil: null,
    staffRoles: ["ACT-SEC"],
    position: "Chủ sở hữu an ninh",
  },
  {
    email: "trang.do@thencuaviet.vn",
    name: "Đỗ Thu Trang",
    role: "principal",
    password: "Hem214-chieu-mua",
    state: "active",
    organisations: ["tcv", "qnh"],
    staffRoles: [],
    position: null,
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
    staffRoles: [],
    position: null,
    failedAttempts: 0,
    lockedUntil: null,
  },
  // Giang Thục Quyên left the company on 28 September: her authority was revoked that day (SCR-PTY-13) and her
  // account is the one RightOne ID suspended (SCR-RID-01's suspended view).
  {
    email: "quyen.giang@thencuaviet.vn",
    name: "Giang Thục Quyên",
    role: "principal",
    password: "Then-Cua-Pasteur#26",
    state: "suspended",
    organisations: ["tcv"],
    staffRoles: [],
    position: null,
    failedAttempts: 0,
    lockedUntil: null,
  },
  // Hầu Ngọc Ánh, the premises delegate (ACT-PRE-DEL): Then Cửa Việt's authority lets her read and submit for
  // Nguyễn Huệ alone, and the one she held for Pasteur ended on 30 September (SCR-PTY-11). PTY decides what she may
  // do; the account only signs her in.
  {
    email: "anh.hau@thencuaviet.vn",
    name: "Hầu Ngọc Ánh",
    role: "principal",
    password: "NguyenHue-41-uyquyen",
    state: "active",
    organisations: ["tcv"],
    staffRoles: [],
    position: null,
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
    staffRoles: [],
    position: null,
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
    staffRoles: [],
    position: null,
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
    staffRoles: [],
    position: null,
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
    staffRoles: [],
    position: null,
    failedAttempts: 0,
    lockedUntil: null,
  },
  // Tống Nhã Uyên, the artist of the artist portal (ACT-ART): she acts for herself, so there is no organisation to
  // choose. No board draws an artist; her name is invented and her address on the reserved `.example` domain.
  {
    email: MOCK_ARTIST.email,
    name: MOCK_ARTIST.name,
    role: "artist",
    password: "NgheSi-1016-uyen",
    state: "active",
    organisations: [],
    staffRoles: [],
    position: null,
    failedAttempts: 0,
    lockedUntil: null,
  },
  // The gateway's staff the operations, policy and oversight boards draw. Phan Gia Lượng and Quan Ngọc Trâm are
  // operations officers who also prepare and approve policy versions (each approves only what the other
  // prepared); Thạch Minh Khải is the independent business approver; Lê Văn Cường reads for the supervising
  // authority. The boards draw no addresses for them, so theirs are on the reserved `.example` domain.
  {
    email: "phan.gialuong@rightone.example",
    name: "Phan Gia Lượng",
    role: "staff",
    password: "VanHanh-1014-luong",
    state: "active",
    organisations: [],
    staffRoles: [
      "ACT-OPS",
      "ACT-SUP",
      "ACT-CAS",
      "ACT-FIN-OP",
      "ACT-EVD",
      "ACT-DAT",
      "ACT-REP",
      "ACT-MKT-OP",
      "ACT-MOD",
      "ACT-POL-APR",
    ],
    position: "Cán bộ vận hành",
    failedAttempts: 0,
    lockedUntil: null,
  },
  {
    email: "quan.ngoctram@rightone.example",
    name: "Quan Ngọc Trâm",
    role: "staff",
    password: "VanHanh-0929-tram",
    state: "active",
    organisations: [],
    staffRoles: ["ACT-OPS", "ACT-SUP", "ACT-CAS", "ACT-FIN-OP", "ACT-POL-PRE"],
    position: "Cán bộ vận hành",
    failedAttempts: 0,
    lockedUntil: null,
  },
  {
    email: "thach.minhkhai@rightone.example",
    name: "Thạch Minh Khải",
    role: "staff",
    password: "PheDuyet-1001-khai",
    state: "active",
    organisations: [],
    staffRoles: ["ACT-BIZ-APR", "ACT-FIN-APR", "ACT-LGL", "ACT-DSP"],
    position: "Người duyệt nghiệp vụ",
    failedAttempts: 0,
    lockedUntil: null,
  },
  {
    email: "le.vancuong@giamsat.example",
    name: "Lê Văn Cường",
    role: "staff",
    password: "GiamSat-0930-cuong",
    state: "active",
    organisations: [],
    staffRoles: ["ACT-REG", "ACT-AUD", "ACT-SEC", "ACT-DPO"],
    position: "Cán bộ giám sát",
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
  for (const account of SEED)
    if (!book.has(account.email)) book.set(account.email, { ...account });
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
export const ORGANISATIONS: readonly {
  id: string;
  name: string;
  slug: string;
  served: boolean;
}[] = [
  {
    id: "tcv",
    name: "Công ty TNHH Then Cửa Việt",
    slug: "then-cua-viet",
    served: true,
  },
  {
    id: "qnh",
    name: "Hộ kinh doanh Quán Nướng Hẻm 214",
    slug: "quan-nuong-hem-214",
    served: false,
  },
  {
    id: "lamhong",
    name: "Hội Quyền tác giả Âm nhạc Lam Hồng",
    slug: "lam-hong",
    served: true,
  },
  {
    id: "hacbach",
    name: "Trung tâm Quyền biểu diễn Hạc Bạch",
    slug: "hac-bach",
    served: true,
  },
  { id: "dayan", name: "Dây Đàn Rights Agency", slug: "day-dan", served: true },
];

export function organisationName(id: string): string {
  return (
    ORGANISATIONS.find((organisation) => organisation.id === id)?.name ?? id
  );
}
