// Fails the lint when a CSS module sets type, a radius, a shadow, motion or a colour outside the tokens of globals.css
// (ADR 0017: the system is one shared layer every page composes; docs/design/principles.md). globals.css itself defines
// the tokens and is not checked. Run: node apps/web/scripts/type.mjs
/* global console, process, URL */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Resolved from this file, never from the cwd, so it runs from any directory (and never from a URL's pathname, which keeps %20).
const root = fileURLToPath(new URL("../src", import.meta.url));

function* cssFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* cssFiles(path);
    else if (name.endsWith(".module.css")) yield path;
  }
}

const TOKEN = (prefix) => `var\\(--${prefix}[\\w-]*\\)`;
const FAMILY = "var\\(--(sans|display|mono)\\)";

/** Each property a module may set only through a token, and what a value may look like. */
const RULES = [
  {
    prop: "font-size",
    why: "a type step (--text-*)",
    ok: (v) => new RegExp(`^(inherit|${TOKEN("text-")})$`).test(v),
  },
  {
    prop: "font",
    why: "a type role (--font-*), or a weight, a type step, a line height and a family, all from the tokens",
    ok: (v) => new RegExp(`^(inherit|${TOKEN("font-")}|([4-9]00 )?${TOKEN("text-")}( / [\\d.]+)? ${FAMILY})$`).test(v),
  },
  {
    prop: "border-radius",
    why: "a radius token (--radius-*), a circle, 0 or inherit, corner by corner",
    ok: (v) => v.split(/\s+/).every((part) => new RegExp(`^(0|50%|inherit|${TOKEN("radius")})$`).test(part)),
  },
  {
    prop: "box-shadow",
    why: "an elevation (--shadow-*), none, or a ring or inset hairline in a token colour",
    ok: (v) =>
      // The variables first, so a mix of a token (`color-mix(in srgb, var(--up) 18%, transparent)`) reads as one mix.
      v
        .replace(/var\(--[\w-]+\)/g, "VAR")
        .replace(/color-mix\([^)]*\)/g, "MIX")
        .split(",")
        .every((part) => /^(none|VAR|(inset )?0 0 0 [\d.]+px (VAR|MIX))$/.test(part.trim())),
  },
  {
    prop: "transition",
    why: "a duration token (--dur-*) and never `all`",
    ok: (v) => v === "none" || (!/\b\d+(\.\d+)?m?s\b/.test(v) && !/(^|[\s,])all([\s,]|$)/.test(v)),
  },
  {
    prop: "animation",
    why: "a duration token (--dur-*)",
    ok: (v) => v === "none" || !/\b\d+(\.\d+)?m?s\b/.test(v),
  },
  {
    prop: "text-transform",
    why: "no label in capitals",
    ok: (v) => v !== "uppercase",
  },
  {
    prop: "font-weight",
    why: "nothing lighter than 400",
    ok: (v) => !/^[1-3]00$/.test(v),
  },
];

/** No property in a module may name a colour of its own: every colour is a token, set for light and for dark. */
const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch)\(/i;

let failed = 0;
const sizes = new Set();
for (const file of cssFiles(root)) {
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  // Every declaration, wherever it sits: one per line or several in a one-line rule. A selector's own colon (a:hover)
  // never ends in a semicolon before its brace, so it is never read as one.
  for (const m of css.matchAll(/(?<=[{;\s])([a-z-]+)\s*:\s*([^;{}]+);/g)) {
    const [, prop, raw] = m;
    const value = raw.trim();
    const line = css.slice(0, m.index).split("\n").length;
    const where = `${file.slice(root.length + 1)}:${line}  ${prop}: ${value}`;
    if (LITERAL_COLOUR.test(value)) {
      failed++;
      console.log(`${where}\n    wanted a colour token from globals.css`);
    }
    const rule = RULES.find((r) => r.prop === prop);
    if (!rule) continue;
    if (prop === "font-size" || prop === "font") sizes.add(value);
    if (!rule.ok(value)) {
      failed++;
      console.log(`${where}\n    wanted ${rule.why}`);
    }
  }
}

console.log(`${sizes.size} type value(s) in the modules: ${[...sizes].sort().join(", ")}`);
console.log(failed ? `\n${failed} declaration(s) outside the tokens` : "\nevery module sets type, radius, shadow, motion and colour through the tokens");
process.exit(failed ? 1 : 0);
