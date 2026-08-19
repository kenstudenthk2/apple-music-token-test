/**
 * Bundle the TV prototype into one self-contained HTML file.
 *
 * The prototype is authored as separate files under public/tv/ so it stays
 * readable and testable. Reviewers, however, need a single page they can open
 * anywhere with no server and no network. This script inlines every local
 * <link rel="stylesheet"> and <script type="module"> into dist/prototype.html.
 *
 * It is deliberately a dumb text substitution, not a real bundler:
 *   - ES module imports between local scripts are resolved by concatenating the
 *     modules in dependency order and stripping their import/export lines.
 *   - Anything referencing a remote host is left untouched and reported.
 *
 * Usage: node scripts/build-prototype.js
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "public", "tv", "index.html");
const OUT_DIR = path.join(ROOT, "dist");
const OUT_FILE = path.join(OUT_DIR, "prototype.html");
const ARTIFACT_FILE = path.join(OUT_DIR, "prototype-artifact.html");

const LINK_PATTERN = /<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi;
const SCRIPT_PATTERN = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi;
const HREF_PATTERN = /href=["']([^"']+)["']/i;

function isRemote(reference) {
  return /^(https?:)?\/\//i.test(reference) || reference.startsWith("data:");
}

/** Resolve a reference written relative to public/tv/index.html. */
function resolveLocal(reference) {
  return path.resolve(path.dirname(SOURCE), reference.split("?")[0]);
}

/**
 * Strip ESM syntax so several modules can be concatenated into one classic
 * script. Only the forms this project actually uses are handled; anything else
 * throws rather than silently producing a broken bundle.
 */
function flattenModule(source, file) {
  const defaultExport = source.match(/^\s*export\s+default\s+([A-Za-z_$][\w$]*)\s*;?\s*$/m);
  if (source.match(/^\s*export\s+default\b/m) && !defaultExport) {
    throw new Error(
      `${path.basename(file)}: only 'export default <identifier>;' is supported by this bundler.`
    );
  }

  return source
    // export default api;  — nothing in this project imports a default, and the
    // binding itself already exists as a top-level const, so drop the statement.
    .replace(/^\s*export\s+default\s+[A-Za-z_$][\w$]*\s*;?\s*$/gm, "")
    // import { a, b } from "./x.js";
    .replace(/^\s*import\s+\{[^}]*\}\s+from\s+["'][^"']+["'];?\s*$/gm, "")
    // import "./x.js";
    .replace(/^\s*import\s+["'][^"']+["'];?\s*$/gm, "")
    // export { a, b };
    .replace(/^\s*export\s+\{[^}]*\};?\s*$/gm, "")
    // export function foo / export const bar
    .replace(/^\s*export\s+(?=(async\s+)?(function|class|const|let|var)\b)/gm, "");
}

/**
 * Order local modules so a module always appears after everything it imports.
 * Depth-first over the import graph, with a cycle guard.
 */
function collectModules(entryFile, seen = new Set(), ordered = [], stack = new Set()) {
  const key = path.normalize(entryFile);
  if (seen.has(key)) {
    return ordered;
  }
  if (stack.has(key)) {
    throw new Error(`Circular import involving ${path.basename(entryFile)}.`);
  }
  stack.add(key);

  const source = fs.readFileSync(entryFile, "utf8");
  const imports = [...source.matchAll(/^\s*import\s+(?:\{[^}]*\}\s+from\s+)?["']([^"']+)["'];?\s*$/gm)];
  for (const [, reference] of imports) {
    if (isRemote(reference)) {
      console.warn(`  ! remote import left in place: ${reference}`);
      continue;
    }
    collectModules(path.resolve(path.dirname(entryFile), reference), seen, ordered, stack);
  }

  stack.delete(key);
  seen.add(key);
  ordered.push(entryFile);
  return ordered;
}

function build() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Missing prototype entry point: ${path.relative(ROOT, SOURCE)}`);
  }

  let html = fs.readFileSync(SOURCE, "utf8");
  const inlined = [];

  html = html.replace(LINK_PATTERN, (tag) => {
    const href = tag.match(HREF_PATTERN)?.[1];
    if (!href || isRemote(href)) {
      console.warn(`  ! remote stylesheet left in place: ${href}`);
      return tag;
    }
    const file = resolveLocal(href);
    inlined.push(path.relative(ROOT, file));
    return `<style>\n/* ${href} */\n${fs.readFileSync(file, "utf8")}\n</style>`;
  });

  html = html.replace(SCRIPT_PATTERN, (tag, src) => {
    if (isRemote(src)) {
      console.warn(`  ! remote script left in place: ${src}`);
      return tag;
    }

    const modules = collectModules(resolveLocal(src));
    const body = modules
      .map((file) => {
        inlined.push(path.relative(ROOT, file));
        return `/* ${path.relative(path.dirname(SOURCE), file).split(path.sep).join("/")} */\n${flattenModule(fs.readFileSync(file, "utf8"), file)}`;
      })
      .join("\n");

    // Flattening modules into one scope can collide two top-level bindings that
    // were perfectly legal in separate modules (two `const state`, say). Catch
    // it here rather than as a blank page in the browser.
    try {
      new Function(body);
    } catch (error) {
      throw new Error(
        `Bundled script does not parse: ${error.message}. ` +
        `Two modules likely declare the same top-level name — rename one.`
      );
    }

    // One IIFE keeps the concatenated modules out of the global scope.
    return `<script>\n(() => {\n${body}\n})();\n</script>`;
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, html);

  // A second output for publishing as an Artifact, which supplies its own
  // document skeleton. Everything between <head> and </body> survives; the
  // doctype, <html>, <head> and <body> tags do not.
  const artifact = html
    .replace(/^[\s\S]*?<head[^>]*>/i, "")
    .replace(/<\/head>\s*<body[^>]*>/i, "")
    .replace(/<\/body>[\s\S]*$/i, "")
    .replace(/<meta\b[^>]*>\s*/gi, "")
    .trim();
  fs.writeFileSync(ARTIFACT_FILE, `${artifact}\n`);

  console.log(`Inlined ${inlined.length} file(s):`);
  for (const file of inlined) {
    console.log(`  - ${file}`);
  }
  console.log(`Wrote ${path.relative(ROOT, OUT_FILE)} (${(html.length / 1024).toFixed(1)} KB)`);
  console.log(`Wrote ${path.relative(ROOT, ARTIFACT_FILE)}`);

  if (/\bsrc=["'](?!data:)/i.test(html) || /<link\b[^>]*rel=["']stylesheet/i.test(html)) {
    console.warn("Warning: the bundle still references external resources.");
  }
  return OUT_FILE;
}

if (require.main === module) {
  try {
    build();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { build, collectModules, flattenModule };
