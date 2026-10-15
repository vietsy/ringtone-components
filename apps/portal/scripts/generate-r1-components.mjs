#!/usr/bin/env node
/**
 * Writes the portal's R1 component module from the copy of the design system R1 in components/r1/source.
 *
 * The design system ships its components as one script that reads React from the page and attaches itself
 * to window.R1. This turns that script into an ES module the portal can import, without changing a
 * component: it imports React and createPortal instead of reading them from window, it imports the format
 * rules from @rightone/formatting instead of carrying its own copy (R23.7: one formatting layer), it takes
 * element ids from React's useId so a server render and the browser agree, and it exports every component
 * by name.
 *
 * Each step checks the text it replaces is there exactly as expected, and the design system's format block
 * is checked against the hash of the copy that was ported into @rightone/formatting/src/r1.ts. A refreshed
 * copy whose format rules changed stops the generator with the instruction to port the change first.
 *
 *   node scripts/generate-r1-components.mjs          write components/r1/generated
 *   node scripts/generate-r1-components.mjs --check  fail when a generated file differs from what it would write
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const r1 = resolve(here, "../components/r1");
const source = (name) => resolve(r1, "source", name);
const generated = (name) => resolve(r1, "generated", name);

/** The design system's format block that @rightone/formatting/src/r1.ts was ported from. */
const FORMAT_BLOCK_SHA256 = "bdb98d5d7f882b18fcefb2cd95628bcc8b333465f93116221704167369cd162e";
const FORMAT_NAMES = [
  "TZ", "ZERO_MINOR", "nf", "minus", "formatCount", "percentDigits", "formatPercent", "formatMoney", "toDate",
  "dtf", "offsetLabel", "formatDate", "formatTime", "shortMonth", "formatTimestamp", "formatStamp",
  "formatDateShort", "formatPeriod",
];

const sha = (text) => createHash("sha256").update(text).digest("hex");

function fail(message) {
  process.stderr.write(`generate-r1-components: ${message}\n`);
  process.exit(1);
}

/** Replaces `from` with `to`, and stops unless `from` occurs exactly `count` times. */
function replaceExactly(text, from, to, count, what) {
  const found = text.split(from).length - 1;
  if (found !== count) fail(`expected ${count} of ${what}, found ${found}; the design system's bundle changed shape.`);
  return text.split(from).join(to);
}

function buildModule(bundle) {
  const header = "(function () {\n  'use strict';\n  var React = window.React;\n";
  const start = bundle.indexOf(header);
  if (start === -1) fail("the bundle no longer opens with the expected wrapper and React global.");
  const banner = bundle.slice(0, start).trim();

  const tail = "  window.R1 = Object.assign(window.R1 || {}, R1);\n})();\n";
  if (!bundle.endsWith(tail)) fail("the bundle no longer closes by attaching R1 to window.");
  let body = bundle.slice(start + header.length, bundle.length - tail.length);

  // The format rules come from @rightone/formatting.
  const formatStart = "  // ------------------------------------------------------------- formatting\n";
  const formatEnd = "  // ------------------------------------------------------------------ icons\n";
  const a = body.indexOf(formatStart);
  const b = body.indexOf(formatEnd);
  if (a === -1 || b === -1 || b < a) fail("the bundle's format block was not found between its two markers.");
  const block = body.slice(a, b);
  if (sha(block) !== FORMAT_BLOCK_SHA256) {
    fail(
      "the design system's format block changed. Port the change into packages/formatting/src/r1.ts, " +
        `then set FORMAT_BLOCK_SHA256 to ${sha(block)}.`,
    );
  }
  for (const name of FORMAT_NAMES) {
    if (!new RegExp(`(function|var) ${name}\\b`).test(block)) fail(`the format block no longer defines ${name}.`);
  }
  const imported = `${formatStart}  // The format rules live in @rightone/formatting (R23.7); the generator removed the design system's copy.\n${FORMAT_NAMES.map((name) => `  var ${name} = R1_FORMAT.${name};`).join("\n")}\n\n`;
  body = body.slice(0, a) + imported + body.slice(b);

  // createPortal from react-dom, not from window.
  body = replaceExactly(body, "window.ReactDOM && window.ReactDOM.createPortal", "createPortal", 2, "the portal guard");
  body = replaceExactly(body, "window.ReactDOM.createPortal(", "createPortal(", 2, "the portal call");

  // Element ids from React's useId. The design system counts ids in a module variable, which is fine on a
  // page rendered only in the browser, but a server render counts from its own process: the ids in the HTML
  // then differ from the ones the browser computes, hydration fails on every labelled field, and the label,
  // description and error links point at nothing until the next render.
  body = replaceExactly(
    body,
    "  var seq = 0;\n  function useUid(prefix) {\n    var ref = useRef(null);\n    if (ref.current === null) { seq += 1; ref.current = (prefix || 'r1') + '-' + seq; }\n    return ref.current;\n  }\n",
    "  function useUid(prefix) {\n    return (prefix || 'r1') + '-' + React.useId().replace(/[^\\w-]/g, '');\n  }\n",
    1,
    "the id helper",
  );

  // Export every member of the R1 object by name.
  const objectStart = body.indexOf("\n  var R1 = {\n");
  if (objectStart === -1) fail("the R1 object was not found.");
  const objectText = body.slice(objectStart, body.indexOf("\n  };\n", objectStart));
  const formatAt = objectText.indexOf("format: {");
  if (formatAt === -1) fail("the R1 object no longer carries format.");
  const members = [...objectText.slice(0, formatAt).matchAll(/(\w+): (\w+)[,\s]/g)].map(([, key, value]) => ({ key, value }));
  const wrong = members.filter(({ key, value }) => key !== value);
  if (wrong.length > 0) fail(`R1 members whose name differs from their function: ${wrong.map((m) => m.key).join(", ")}.`);
  const names = members.map(({ key }) => key).filter((key) => !FORMAT_NAMES.includes(key));
  const exportsLine = `\nvar format = R1.format;\nexport { ${[...names, "format"].join(", ")} };\nexport default R1;\n`;

  const shaLine = `sha256 ${sha(bundle)}`;
  return [
    '"use client";',
    `// Generated by scripts/generate-r1-components.mjs from components/r1/source/bundle.js (${shaLine}).`,
    "// Do not edit: refresh the copy of the design system R1 in components/r1/source and run the script.",
    banner,
    'import * as React from "react";',
    'import { createPortal } from "react-dom";',
    'import { R1_FORMAT } from "@rightone/formatting";',
    "",
    body,
  ].join("\n") + exportsLine;
}

function buildCss(css) {
  return `/* Generated by scripts/generate-r1-components.mjs from components/r1/source/bundle.css (sha256 ${sha(css)}). Do not edit. */\n${css}`;
}

function buildTypes(types) {
  const global = "declare global { interface Window { R1: { [name: string]: unknown } } }\n";
  const withoutGlobal = replaceExactly(types, global, "", 1, "the window.R1 declaration");
  return `// Generated by scripts/generate-r1-components.mjs from components/r1/source/index.d.ts (sha256 ${sha(types)}). Do not edit.\n${withoutGlobal}\ndeclare const R1: Record<string, unknown>;\nexport default R1;\n`;
}

const outputs = {
  "r1.js": buildModule(readFileSync(source("bundle.js"), "utf8")),
  "r1.css": buildCss(readFileSync(source("bundle.css"), "utf8")),
  "r1.d.ts": buildTypes(readFileSync(source("index.d.ts"), "utf8")),
};

if (process.argv.includes("--check")) {
  const stale = Object.entries(outputs).filter(([name, text]) => {
    try {
      return readFileSync(generated(name), "utf8") !== text;
    } catch {
      return true;
    }
  });
  if (stale.length > 0) fail(`out of date: ${stale.map(([name]) => name).join(", ")}. Run pnpm --filter @rightone/portal generate:r1.`);
  process.stdout.write("generate-r1-components: up to date\n");
} else {
  for (const [name, text] of Object.entries(outputs)) writeFileSync(generated(name), text);
  process.stdout.write(`generate-r1-components: wrote ${Object.keys(outputs).join(", ")}\n`);
}
