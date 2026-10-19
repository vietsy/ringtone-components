import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { themeCss } from "../lib/theme/css-variables.js";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, "..", path), "utf8");

/** The source of every R1 component: the component files, lib/ and the gallery's specimens. */
function componentSource(dir = resolve(here, "../components/r1")): string {
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .map((path) => (statSync(path).isDirectory() ? componentSource(path) : /\.tsx?$/.test(path) ? readFileSync(path, "utf8") : ""))
    .join("\n");
}

type Scopes = Map<string, Map<string, string>>;

/** Custom properties per selector, from the plain blocks a tokens stylesheet is made of. */
function scopes(css: string): Scopes {
  const out: Scopes = new Map();
  for (const [, selector = "", body = ""] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const key = selector.trim();
    const props = out.get(key) ?? new Map<string, string>();
    for (const [, name = "", value = ""] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) props.set(name, normalise(value));
    out.set(key, props);
  }
  return out;
}

function normalise(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** R1 writes its dark theme as references to the primitives; resolve them before comparing. */
function resolveRefs(value: string, primitives: Map<string, string>): string {
  return value.replace(/var\((--[\w-]+)\)/g, (whole, name: string) => primitives.get(name) ?? whole);
}

describe("the theme emitted from @rightone/tokens", () => {
  const ours = scopes(themeCss());
  const r1 = scopes(read("../../packages/tokens/r1/tokens.css"));
  const r1Primitives = r1.get(':root, [data-theme="dark"]') ?? new Map<string, string>();

  it("defines every custom property of R1's tokens.css, in the same scope, with the same value", () => {
    const differences: string[] = [];
    for (const [selector, props] of r1) {
      if (props.size === 0) continue;
      const mine = ours.get(selector);
      if (mine === undefined) {
        differences.push(`${selector}: scope missing`);
        continue;
      }
      for (const [name, value] of props) {
        const expected = resolveRefs(value, r1Primitives);
        const actual = mine.get(name);
        if (actual !== expected) differences.push(`${selector} ${name}: R1 ${expected}, ours ${actual ?? "missing"}`);
      }
    }
    expect(differences).toEqual([]);
  });

  it("defines every custom property the R1 components read", () => {
    const stylesheet = read("components/r1/r1.css");
    const module = componentSource();
    const defined = new Set([...ours.values()].flatMap((props) => [...props.keys()]));
    // The component stylesheet declares some properties of its own (the Player frame's --pl-* sizes), and
    // the module sets others on an element at run time ('--r1-field-width', setProperty('--r1-notice-h')).
    for (const [, name = ""] of stylesheet.matchAll(/(--[\w-]+)\s*:/g)) defined.add(name);
    for (const [, name = ""] of module.matchAll(/['"](--[\w-]+)['"]/g)) defined.add(name);
    const source = `${stylesheet}\n${module}`;
    // A read with a fallback (var(--glass-out, 0px)) is optional by design.
    const withFallback = new Set([...source.matchAll(/var\((--[\w-]+)\s*,/g)].map(([, name = ""]) => name));
    const used = new Set([...source.matchAll(/var\((--[\w-]+)/g)].map(([, name = ""]) => name));
    const undefinedNames = [...used]
      .filter((name) => !withFallback.has(name))
      .filter((name) =>
        // 'var(--chart-' + n + ')' builds the name at run time: one defined name must carry the prefix.
        name.endsWith("-") ? ![...defined].some((known) => known.startsWith(name)) : !defined.has(name),
      )
      .sort();
    expect(undefinedNames).toEqual([]);
  });

  it("writes no hex value outside the token blocks", () => {
    // Hex values belong to the colour declarations; a type-style class or a scale never carries one.
    const classes = themeCss().split("\n").filter((line) => line.startsWith("."));
    expect(classes.some((line) => /#[0-9a-f]{3,8}\b/i.test(line))).toBe(false);
  });
});
