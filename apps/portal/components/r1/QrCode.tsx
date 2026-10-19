"use client";

import type * as React from "react";
import { cx, isNil } from "./lib/helpers";
import { tx } from "./lib/strings";
import type { Locale } from "./lib/types";

// A QR code encoder (ISO/IEC 18004, byte mode, UTF-8), so a code is made from the address it opens instead of
// being pasted in as a picture. Versions 1 to 40, error correction L, M, Q or H, the mask with the lowest penalty.
type QrLevel = "L" | "M" | "Q" | "H";

const QR_BLOCKS: Record<QrLevel, number[]> = {
  L: [
    1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19,
    20, 21, 22, 24, 25,
  ],
  M: [
    1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33,
    35, 37, 38, 40, 43, 45, 47, 49,
  ],
  Q: [
    1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45,
    48, 51, 53, 56, 59, 62, 65, 68,
  ],
  H: [
    1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51,
    54, 57, 60, 63, 66, 70, 74, 77, 81,
  ],
};

const QR_ECC: Record<QrLevel, number[]> = {
  L: [
    7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  M: [
    10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28,
    28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  ],
  Q: [
    13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  H: [
    17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
};

const QR_FORMAT: Record<QrLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

function qrRawModules(v: number): number {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const n = Math.floor(v / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (v >= 7) r -= 36;
  }
  return r;
}

function qrMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function qrEcc(data: number[], degree: number): number[] {
  const div: number[] = [];
  let i: number,
    j: number,
    root = 1;
  for (i = 0; i < degree; i++) div.push(0);
  div[degree - 1] = 1;
  for (i = 0; i < degree; i++) {
    for (j = 0; j < degree; j++) {
      div[j] = qrMul(div[j]!, root);
      if (j + 1 < degree) div[j]! ^= div[j + 1]!;
    }
    root = qrMul(root, 2);
  }
  const rem = div.map(function () {
    return 0;
  });
  data.forEach(function (b) {
    const f = b ^ rem.shift()!;
    rem.push(0);
    for (let k = 0; k < degree; k++) rem[k]! ^= qrMul(div[k]!, f);
  });
  return rem;
}

function qrEncode(text: string, level: QrLevel | undefined): string[] | null {
  const ecl = Object.prototype.hasOwnProperty.call(QR_FORMAT, String(level)) ? level! : "M";
  let bytes: number[] = [],
    i: number;
  if (typeof TextEncoder !== "undefined")
    bytes = Array.prototype.slice.call(new TextEncoder().encode(String(text))) as number[];
  else {
    const s = unescape(encodeURIComponent(String(text)));
    for (i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
  }
  let ver = 0,
    cap = 0;
  for (let v = 1; v <= 40; v++) {
    cap = Math.floor(qrRawModules(v) / 8) - QR_ECC[ecl][v - 1]! * QR_BLOCKS[ecl][v - 1]!;
    if (4 + (v < 10 ? 8 : 16) + 8 * bytes.length <= cap * 8) {
      ver = v;
      break;
    }
  }
  if (!ver) return null;
  const bits: number[] = [];
  function put(val: number, len: number) {
    for (let b = len - 1; b >= 0; b--) bits.push((val >>> b) & 1);
  }
  put(4, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach(function (b) {
    put(b, 8);
  });
  put(0, Math.min(4, cap * 8 - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  const data: number[] = [];
  for (i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad);
  // Split into blocks, add the error correction to each, and interleave.
  const nb = QR_BLOCKS[ecl][ver - 1]!,
    ecLen = QR_ECC[ecl][ver - 1]!,
    raw = Math.floor(qrRawModules(ver) / 8);
  const nShort = nb - (raw % nb),
    shortLen = Math.floor(raw / nb),
    blocks: number[][] = [];
  let k = 0;
  for (i = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - ecLen + (i < nShort ? 0 : 1));
    k += dat.length;
    const ecc = qrEcc(dat, ecLen);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const words: number[] = [];
  let j: number;
  for (i = 0; i < blocks[0]!.length; i++)
    for (j = 0; j < nb; j++) if (i !== shortLen - ecLen || j >= nShort) words.push(blocks[j]![i]!);
  // The function patterns.
  const n = ver * 4 + 17,
    m: boolean[][] = [],
    fn: boolean[][] = [];
  for (i = 0; i < n; i++) {
    m.push([]);
    fn.push([]);
    for (j = 0; j < n; j++) {
      m[i]!.push(false);
      fn[i]!.push(false);
    }
  }
  function set(x: number, y: number, dark: boolean | number) {
    m[y]![x] = !!dark;
    fn[y]![x] = true;
  }
  for (i = 0; i < n; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  [
    [3, 3],
    [n - 4, 3],
    [3, n - 4],
  ].forEach(function (c) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)),
          x = c[0]! + dx,
          y = c[1]! + dy;
        if (x >= 0 && x < n && y >= 0 && y < n) set(x, y, d !== 2 && d !== 4);
      }
  });
  const align: number[] = [];
  if (ver > 1) {
    const na = Math.floor(ver / 7) + 2,
      step = Math.floor((ver * 8 + na * 3 + 5) / (na * 4 - 4)) * 2;
    for (let pos = n - 7; align.length < na - 1; pos -= step) align.unshift(pos);
    align.unshift(6);
  }
  align.forEach(function (ay, ai) {
    align.forEach(function (ax, aj) {
      if ((ai === 0 && aj === 0) || (ai === 0 && aj === align.length - 1) || (ai === align.length - 1 && aj === 0))
        return;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    });
  });
  function format(mask: number) {
    const d = (QR_FORMAT[ecl] << 3) | mask;
    let r = d;
    let b: number;
    for (b = 0; b < 10; b++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const f = ((d << 10) | r) ^ 0x5412,
      bit = function (q: number) {
        return (f >>> q) & 1;
      };
    for (b = 0; b <= 5; b++) set(8, b, bit(b));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (b = 9; b < 15; b++) set(14 - b, 8, bit(b));
    for (b = 0; b < 8; b++) set(n - 1 - b, 8, bit(b));
    for (b = 8; b < 15; b++) set(8, n - 15 + b, bit(b));
    set(8, n - 8, true);
  }
  format(0);
  if (ver >= 7) {
    let r = ver;
    for (i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const vb = (ver << 12) | r;
    for (i = 0; i < 18; i++) {
      const bt = (vb >>> i) & 1,
        a = n - 11 + (i % 3),
        b2 = Math.floor(i / 3);
      set(a, b2, bt);
      set(b2, a, bt);
    }
  }
  // The codewords, in two-column zigzags from the bottom right.
  let bi = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++)
      for (j = 0; j < 2; j++) {
        const x = right - j,
          y = ((right + 1) & 2) === 0 ? n - 1 - vert : vert;
        if (!fn[y]![x] && bi < words.length * 8) {
          m[y]![x] = ((words[bi >>> 3]! >>> (7 - (bi & 7))) & 1) === 1;
          bi++;
        }
      }
  }
  const MASKS: Array<(x: number, y: number) => boolean> = [
    function (x, y) {
      return (x + y) % 2 === 0;
    },
    function (x, y) {
      return y % 2 === 0;
    },
    function (x) {
      return x % 3 === 0;
    },
    function (x, y) {
      return (x + y) % 3 === 0;
    },
    function (x, y) {
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    },
    function (x, y) {
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    },
    function (x, y) {
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    },
    function (x, y) {
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    },
  ];
  function applyMask(q: number) {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fn[y]![x] && MASKS[q]!(x, y)) m[y]![x] = !m[y]![x];
  }
  function penalty() {
    let score = 0,
      x: number,
      y: number,
      dark = 0;
    function lines(get: (a: number, b: number) => boolean) {
      for (let a = 0; a < n; a++) {
        let run = 0,
          color = false;
        const hist = [0, 0, 0, 0, 0, 0, 0];
        const add = function (len: number) {
          if (hist[0] === 0) len += n;
          hist.pop();
          hist.unshift(len);
        };
        const count = function () {
          const c = hist[1]!,
            core = c > 0 && hist[2] === c && hist[3] === c * 3 && hist[4] === c && hist[5] === c;
          return (
            (core && hist[0]! >= c * 4 && hist[6]! >= c ? 1 : 0) + (core && hist[6]! >= c * 4 && hist[0]! >= c ? 1 : 0)
          );
        };
        for (let b = 0; b < n; b++) {
          if (get(a, b) === color) {
            run++;
            if (run === 5) score += 3;
            else if (run > 5) score++;
          } else {
            add(run);
            if (!color) score += count() * 40;
            color = get(a, b);
            run = 1;
          }
        }
        if (color) {
          add(run);
          run = 0;
        }
        add(run + n);
        score += count() * 40;
      }
    }
    lines(function (a, b) {
      return m[a]![b]!;
    });
    lines(function (a, b) {
      return m[b]![a]!;
    });
    for (y = 0; y < n - 1; y++)
      for (x = 0; x < n - 1; x++) {
        const c = m[y]![x];
        if (c === m[y]![x + 1] && c === m[y + 1]![x] && c === m[y + 1]![x + 1]) score += 3;
      }
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (m[y]![x]) dark++;
    return score + (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10;
  }
  let best = 0,
    bestScore = Infinity;
  for (let q = 0; q < 8; q++) {
    applyMask(q);
    format(q);
    const sc = penalty();
    if (sc < bestScore) {
      best = q;
      bestScore = sc;
    }
    applyMask(q);
  }
  applyMask(best);
  format(best);
  return m.map(function (row) {
    return row
      .map(function (d) {
        return d ? "1" : "0";
      })
      .join("");
  });
}

let QR_CACHE: Record<string, string[]> = {},
  QR_CACHED = 0;

export type QrCodeProps = {
  /** rows of 0 and 1 from any encoder; or leave it out and pass value */ modules?: string[] | undefined;
  /** the text or address to encode (byte mode, UTF-8, versions 1 to 40) */ value?: string | undefined;
  /** error correction, default M */ level?: "L" | "M" | "Q" | "H" | undefined;
  size?: number | undefined;
  /** the margin in modules, default 4 (ISO/IEC 18004) */ quiet?: number | undefined;
  /** what the code opens; defaults to "Mã QR mở <value>" */ label?: string | undefined;
  locale?: Locale | undefined;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
};

// A QR code, from its module matrix (modules: one string per row, "1" for a dark module) or made here from value.
// The quiet zone is four modules, as ISO/IEC 18004 requires. A code always has a name: label, or "QR code that
// opens <value>" when the page gives none.
export function QrCode(p: QrCodeProps) {
  const t = tx(p.locale).qr;
  let rows = p.modules;
  if ((!rows || !rows.length) && !isNil(p.value) && p.value !== "") {
    const key = (p.level || "M") + "|" + p.value;
    if (!QR_CACHE[key]) {
      if (QR_CACHED > 64) {
        QR_CACHE = {};
        QR_CACHED = 0;
      }
      QR_CACHE[key] = qrEncode(p.value, p.level) || [];
      QR_CACHED++;
    }
    rows = QR_CACHE[key];
  }
  rows = rows || [];
  if (!rows.length) return null;
  const n = rows.length,
    quiet = isNil(p.quiet) ? 4 : p.quiet,
    total = n + quiet * 2;
  const size = p.size || 160;
  const label = p.label || (!isNil(p.value) && p.value !== "" ? t.opens.replace("{url}", p.value) : t.label);
  const rects: React.ReactElement[] = [];
  rows.forEach(function (row, y) {
    for (let x = 0; x < row.length; x++)
      if (row.charAt(x) === "1")
        rects.push(<rect key={y * 1000 + x} x={x + quiet} y={y + quiet} width={1.02} height={1.02} />);
  });
  return (
    <svg
      className={cx("r1-qr", p.className)}
      width={size}
      height={size}
      viewBox={"0 0 " + total + " " + total}
      role="img"
      aria-label={label}
      style={p.style}
      shapeRendering="crispEdges"
    >
      <rect width={total} height={total} className="r1-qr__paper" />
      <g className="r1-qr__ink">{rects}</g>
    </svg>
  );
}
