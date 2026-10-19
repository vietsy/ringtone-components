import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every screen is built from the design system R1 and draws nothing of its own. A screen arranges R1's
 * components with layout from the tokens (flex, grid, gap, a maximum width); what a thing looks like - its
 * ink, surface, border, type - belongs to a component. Two portal components hold the only visual properties
 * a screen may need beyond R1: `Text` for running text, `ThemeSurface` for a page in another theme. A finding
 * here is fixed by using a component, extending one, or adding one beside those two. The register's
 * explicitly requested CSS Module owns only token-based layout around existing R1 components.
 */

const portal = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Where a visual property may be written: the two components that own them. */
const VISUAL_OWNERS = new Set(["components/Text.tsx", "components/ThemeSurface.tsx"]);

const LOCAL_CSS_USERS = new Set([
  "features/coverage/CoveragePageClient.tsx",
  "features/mandate/detail/MandateDetailClient.tsx",
  "features/mandate/register/MandateRegisterPage.tsx",
  "features/mandate/register/MandateRegisterClient.tsx",
]);
const LOCAL_CSS_MODULES = new Set([
  "features/coverage/CoveragePageClient.module.css",
  "features/mandate/register/MandateRegister.module.css",
  "features/mandate/detail/MandateDetail.module.css",
]);

/** The document itself: the root layout writes html, head, body and the token stylesheet. */
const DOCUMENT = new Set(["app/layout.tsx"]);

/**
 * Raw elements a component stands for: text, headings, actions, fields, lists, tables, images, landmarks the
 * shells draw. A div, a form, a section and a footer carry layout or a submit and are allowed.
 */
const RAW_ELEMENT =
  /<(p|h[1-6]|button|a|input|select|textarea|table|thead|tbody|tr|td|th|ul|ol|li|dl|dt|dd|label|img|svg|span|nav|header|aside|main|hr|strong|em|b|i|small)[\s>/]/g;

/** Style keys that say what a thing looks like rather than where it sits. */
const VISUAL_KEY =
  /\b(color|background\w*|border\w*|outline\w*|font\w*|lineHeight|letterSpacing|textTransform|textDecoration\w*|boxShadow|opacity|fill|stroke|filter|transition|animation|transform|cursor)\s*:/g;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path.includes(join("components", "r1")) ? [] : sources(path);
    return /\.(tsx|ts|css)$/.test(name) ? [path] : [];
  });
}

const files = ["app", "features", "components"].flatMap((dir) => sources(join(portal, dir)));
const read = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
const name = (path: string) => relative(portal, path).replaceAll("\\", "/");

function findings(test: (text: string, file: string) => string[]): string[] {
  return files.flatMap((path) => test(read(path), name(path)).map((hit) => `${name(path)}: ${hit}`));
}

describe("every screen is built from the design system", () => {
  it("draws no raw text, action, field, list or landmark element where a component stands for it", () => {
    const hits = findings((text, file) =>
      file.endsWith(".tsx") && !DOCUMENT.has(file)
        ? [...text.matchAll(RAW_ELEMENT)]
            .filter((m) => !(m[1] === "input" && text.slice(m.index, m.index + 40).includes('type="hidden"')))
            .map((m) => `<${m[1] ?? ""}>`)
        : [],
    );
    expect(hits).toEqual([]);
  });

  it("writes no visual property outside the components that own them", () => {
    const hits = findings((text, file) =>
      VISUAL_OWNERS.has(file) || !/\.tsx?$/.test(file) ? [] : [...text.matchAll(VISUAL_KEY)].map((m) => m[1] ?? ""),
    );
    expect(hits).toEqual([]);
  });

  it("uses class names only in visual owners and the register CSS Module consumers", () => {
    const hits = findings((text, file) =>
      file.endsWith(".tsx") && !VISUAL_OWNERS.has(file) && !LOCAL_CSS_USERS.has(file) ? [...text.matchAll(/className=/g)].map(() => "className") : [],
    );
    expect(hits).toEqual([]);
  });

  it("writes no length, colour or stylesheet of its own: every value is a token", () => {
    const hits = findings((text, file) => {
      if (file.endsWith(".css") && !LOCAL_CSS_MODULES.has(file)) return ["a stylesheet outside the design system"];
      return [
        ...[...text.matchAll(/["'`(\s:]-?\d*\.?\d+(px|rem|em)\b/g)].map((m) => m[0].trim()),
        ...[...text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]),
        ...[...text.matchAll(/\b(margin|padding|gap|width|height|top|left|right|bottom|inset)\w*\s*:\s*[1-9]\d*\b(?![\d.%])/g)].map((m) => m[0]),
      ];
    });
    expect(hits).toEqual([]);
  });
});
