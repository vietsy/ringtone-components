/**
 * Acceptance criteria are bound by title (rightone-api ADR-0016; R22.1 and gate Q01 in
 * testing-standard.md §4).
 *
 * A test proves a criterion by carrying its tag in the test's own title:
 *
 *     it("@AC-FR-PUB-004-01 shows a revoked certificate as revoked", () => { ... });
 *
 * The title is what reaches the JUnit result and the runner's filter, so an executed result joins
 * to its criterion without anyone reading the source, and `vitest run -t "@AC-FR-PUB-004-01"`
 * runs the proof of one criterion. A tag in a comment reaches neither, and it stays where it is
 * when the test under it is skipped, renamed or deleted - which is how a criterion comes to look
 * proven by a test that no longer runs.
 *
 * Only an `it` or `test` title binds. A `describe` title would claim that every test in the block
 * proves the criterion, which is the same over-claim as a trait on a C# class, and the Q01 parser
 * in rightone-platform does not count it.
 *
 * This checks the shape of a binding only. Whether the criterion exists in the specification needs
 * rightone-platform checked out beside this repository, so that half runs there:
 * `scripts/check-tests.py --code ../rightone-web`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import ts from "typescript";

const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const PRUNE = new Set(["node_modules", ".git", ".next", "dist", "coverage", ".turbo"]);
const MENTION = /@?AC-FR-[A-Za-z0-9-]*/g;
const TAG = /^@AC-FR-[A-Z]{2,3}-\d{3}-\d{2}$/;
const RULE = "R22.1, Q01, rightone-api ADR-0016";

function testFiles(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    if (PRUNE.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...testFiles(path));
    else if (TEST_FILE.test(name)) found.push(path);
  }
  return found;
}

/** `it`, `it.only`, `it.each([...])`, `test.each\`...\``: the names from the root outwards. */
function calleeChain(expression) {
  if (ts.isIdentifier(expression)) return [expression.text];
  if (ts.isPropertyAccessExpression(expression)) {
    const chain = calleeChain(expression.expression);
    return chain && [...chain, expression.name.text];
  }
  if (ts.isCallExpression(expression)) return calleeChain(expression.expression);
  if (ts.isTaggedTemplateExpression(expression)) return calleeChain(expression.tag);
  return null;
}

function isText(node) {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateExpression(node) ||
    ts.isRegularExpressionLiteral(node) ||
    ts.isJsxText(node)
  );
}

function check(path) {
  const text = readFileSync(path, "utf8");
  const kind = /\.[cm]?[jt]sx$/.test(path)
    ? ts.ScriptKind.TSX
    : /\.[cm]?js$/.test(path)
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  const titles = [];
  const literals = [];

  const visit = (node) => {
    if (isText(node)) literals.push([node.getStart(source), node.getEnd()]);
    if (ts.isCallExpression(node)) {
      const chain = calleeChain(node.expression);
      const title = node.arguments[0];
      if (chain && title && isText(title) && ["it", "test", "describe"].includes(chain[0])) {
        const suite = chain.includes("describe") ? "suite" : chain.includes("step") ? null : "test";
        if (suite) titles.push({ start: title.getStart(source), end: title.getEnd(), kind: suite });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  const findings = [];
  let tags = 0;
  for (const match of text.matchAll(MENTION)) {
    tags += 1;
    const at = match.index;
    const line = source.getLineAndCharacterOfPosition(at).line + 1;
    const tag = match[0];
    const title = titles.find((t) => t.start <= at && at < t.end);
    if (title?.kind === "test") {
      if (!TAG.test(tag)) {
        findings.push([line, `malformed tag ${tag} in a test title; write @AC-FR-<FAM>-nnn-nn`]);
      }
    } else if (title?.kind === "suite") {
      findings.push([
        line,
        `${tag} in a describe title claims every test in the block proves it. Put it in the ` +
          `title of the it or test that does`,
      ]);
    } else {
      const where = literals.some(([s, e]) => s <= at && at < e) ? "a string" : "a comment";
      findings.push([
        line,
        `${tag} in ${where} is not a binding: no test result carries it. Put it in the title ` +
          `of the it or test that proves the criterion`,
      ]);
    }
  }
  return { findings: findings.sort((a, b) => a[0] - b[0]), tags };
}

let failed = false;
let read = 0;
let tags = 0;
for (const path of testFiles(".")) {
  const result = check(path);
  read += 1;
  tags += result.tags;
  for (const [line, message] of result.findings) {
    process.stderr.write(`${path}:${line}: ${message}. ${RULE}.\n`);
    failed = true;
  }
}
if (!failed) {
  process.stdout.write(`${read} test files, ${tags} AC-FR- tags, each in an it or test title\n`);
}
process.exit(failed ? 1 : 0);
