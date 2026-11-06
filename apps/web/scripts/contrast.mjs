// Checks every text role against every ground it sits on, in light and in dark, from the tokens in globals.css: WCAG AA
// (4.5:1 for text) and APCA (Lc 75 for body text, Lc 60 for the smaller text people must read and for figures, Lc 15 for
// a light hairline), the two rulers production's guard used (ADR 0017 keeps them). Dark is written twice in globals.css,
// under the media query and pinned by data-theme, so the two copies must match. Run: node apps/web/scripts/contrast.mjs
/* global console, process, URL */
import { readFileSync } from "node:fs";

// Resolved from this file, never from the cwd, so it runs from any directory.
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The custom properties a block sets. */
const tokens = (body) => Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

function block(re, name) {
  const m = css.match(re);
  if (!m) {
    console.log(`globals.css has no ${name} block`);
    process.exit(1);
  }
  return tokens(m[1]);
}

const light = block(/^:root\s*\{([^}]*)\}/m, "light :root");
const darkMedia = block(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/, "dark (system)");
const darkPinned = block(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/, "dark (chosen)");

let failed = 0;
const fail = (line) => {
  failed++;
  console.log(`FAIL ${line}`);
};

// The two dark copies must be the same set of values, or a visitor who chose dark sees another palette than one whose system is dark.
for (const key of new Set([...Object.keys(darkMedia), ...Object.keys(darkPinned)])) {
  if (darkMedia[key] !== darkPinned[key]) fail(`dark --${key}: ${darkMedia[key] ?? "unset"} under the media query, ${darkPinned[key] ?? "unset"} pinned by data-theme`);
}

const hex = (s) => s.match(/^#([0-9a-f]{6})$/i)?.[1];
/** A colour as [r, g, b, alpha], from a hex or an `rgb(r g b / a%)`. */
const rgba = (s) => {
  const h = hex(s);
  if (h) return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
  const m = s.match(/^rgb\((\d+) (\d+) (\d+)(?: \/ (\d+)%)?\)$/);
  return m ? [+m[1], +m[2], +m[3], m[4] ? +m[4] / 100 : 1] : null;
};
/** A translucent colour laid over an opaque ground. */
const over = (fg, bg) => fg.slice(0, 3).map((c, i) => Math.round(c * fg[3] + bg[i] * (1 - fg[3])));
const lum = ([r, g, b]) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
/** APCA (SAPC-4g, 0.0.98G): the perceptual lightness contrast of text on a background, as |Lc|. */
function apca(text, bg) {
  const y = ([r, g, b]) => 0.2126729 * (r / 255) ** 2.4 + 0.7151522 * (g / 255) ** 2.4 + 0.072175 * (b / 255) ** 2.4;
  const clamp = (v) => (v <= 0.022 ? v + (0.022 - v) ** 1.414 : v);
  const yt = clamp(y(text));
  const yb = clamp(y(bg));
  if (Math.abs(yb - yt) < 0.0005) return 0;
  let out;
  if (yb > yt) {
    const s = (yb ** 0.56 - yt ** 0.57) * 1.14;
    out = s < 0.1 ? 0 : s - 0.027;
  } else {
    const s = (yb ** 0.65 - yt ** 0.62) * 1.14;
    out = s > -0.1 ? 0 : s + 0.027;
  }
  return Math.abs(out * 100);
}

/**
 * Text roles, the grounds each sits on and the floors: the WCAG ratio and the APCA Lc. A ground written `mix:<token>:<n>`
 * is `color-mix(in srgb, <token> n%, transparent)` over the surface, as the gold and warning badges are drawn.
 */
const PAIRS = [
  ["ink", ["paper", "surface", "sunken"], 4.5, 75],
  ["ink-2", ["paper", "surface", "sunken"], 4.5, 75],
  ["ink-3", ["paper", "surface"], 4.5, 60],
  ["gold", ["paper", "surface", "mix:gold:12"], 4.5, 60],
  ["up", ["paper", "surface"], 4.5, 60],
  ["down", ["paper", "surface", "mix:down:10"], 4.5, 60],
  ["on-button", ["button"], 4.5, 60],
  // A coin's monogram on the heat tile is a glyph on a fill, which production's guard held to 3:1 and Lc 45.
  ["on-heat", ["heat-from", "heat-to"], 3, 45],
  // An asset's monogram on its badge, the paper on an ink disc, is a glyph on a fill too.
  ["paper", ["ink"], 3, 45],
  // The dark tile is the same in both schemes (Jupiter's swap sits on it).
  ["on-tile", ["tile"], 4.5, 75],
  ["on-tile-2", ["tile"], 4.5, 60],
];
/**
 * The band's own roles (globals.css, `.on-band`), the same floors as the page's: inside a band the page's tokens are
 * re-set to these, so the header, the pulse strip, the home page's hero, figures and invitation, the footer and the phone
 * bar are held to them. "You do." in the band's gold at a headline's size takes the large-text floor; a monogram on the
 * gold ramp is a glyph on a fill.
 */
const BAND_PAIRS = [
  ["on-band", ["band", "band-raised"], 4.5, 75],
  ["on-band-2", ["band", "band-raised"], 4.5, 60],
  ["band-gold-from", ["band"], 3, 45],
  ["band-gold-to", ["band", "band-raised"], 4.5, 60],
  ["on-band-button", ["band-button"], 4.5, 60],
  ["on-band-button", ["band-gold-from", "band-gold-to"], 3, 45],
];
/** Hairlines want Lc 15 against the light grounds they sit on (production's floor; dark hairlines are not held to it). */
const LINES = [["line", ["paper", "surface", "sunken"], 15]];

/** Every text role and hairline of one palette, as the page would draw it, against the floors. */
function check(mode, vars, hairlines, pairs = PAIRS) {
  const colour = (name) => {
    const mix = name.match(/^mix:([\w-]+):(\d+)$/);
    if (mix) {
      const c = rgba(vars[mix[1]] ?? "");
      const surface = rgba(vars.surface ?? "");
      return c && surface ? over([...c.slice(0, 3), Number(mix[2]) / 100], surface) : null;
    }
    const c = rgba(vars[name] ?? "");
    return c ? over(c, rgba(vars.paper)) : null;
  };
  const rows = [];
  for (const [fg, grounds, aa, lc] of pairs) {
    for (const ground of grounds) {
      const t = colour(fg);
      const b = colour(ground);
      if (!t || !b) {
        fail(`${mode}: --${fg} or ${ground} is not a colour the guard reads`);
        continue;
      }
      const r = ratio(t, b);
      const l = apca(t, b);
      const ok = r >= aa && l >= lc;
      if (!ok) fail(`${mode}: --${fg} on ${ground} is ${r.toFixed(2)}:1 and Lc ${l.toFixed(0)}, wanted ${aa}:1 and Lc ${lc}`);
      rows.push(`${fg} on ${ground} ${r.toFixed(2)}:1 Lc ${l.toFixed(0)}`);
    }
  }
  if (hairlines) {
    for (const [line, grounds, lc] of LINES) {
      for (const ground of grounds) {
        const b = colour(ground);
        const l = apca(over(rgba(vars[line]), b), b);
        if (l < lc) fail(`${mode}: --${line} on ${ground} is Lc ${l.toFixed(0)}, wanted Lc ${lc}`);
        rows.push(`${line} on ${ground} Lc ${l.toFixed(0)}`);
      }
    }
  }
  console.log(`${mode}: ${rows.join(", ")}`);
}

check("light", { ...light }, true);
check("dark", { ...light, ...darkMedia }, false);
check("band light", { ...light }, false, BAND_PAIRS);
check("band dark", { ...light, ...darkMedia }, false, BAND_PAIRS);

console.log(failed ? `\n${failed} pair(s) under the floors` : "\nevery text role passes AA and APCA on every ground it sits on, in light and dark");
process.exit(failed ? 1 : 0);
