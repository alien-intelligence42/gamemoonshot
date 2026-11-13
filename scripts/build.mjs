#!/usr/bin/env node
// Validates everything under data/ and bundles it into ./data.json, which the site (served from the
// repo root by GitHub Pages) loads. Also writes one copy of index.html per page (why/, rules/, submit/,
// game/<id>/) so every page has a real URL that loads directly.
//   node scripts/build.mjs          -> validate + write data.json and the page copies
//   node scripts/build.mjs --check  -> validate + fail if any of those are out of date (CI on pull requests)
// No dependencies on purpose: contributors only need Node 18+.

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const BUNDLE = path.join(ROOT, "data.json");
const CHECK_ONLY = process.argv.includes("--check");

export const TRACKS = ["pixels", "harness"];
export const STATUSES = ["verified", "pending", "curated", "rejected"];
const SOURCE_TYPES = ["author", "news"];
// Emblem names defined in icons.js.
// Skin names defined in skins.css / app.js SKINS.
const SKINS = ["gb-dmg", "gb-crystal", "gba-emerald", "gb-adventure", "blocky", "western", "shinobi", "wukong", "platformer", "terminal", "spire", "erdtree", "sunset", "neon", "tactical", "factory", "orbital", "atlas", "tome"];
const ICONS = ["badge", "crystal", "emerald", "pickaxe", "horseshoe", "katana", "staff", "flag", "at", "spire", "shield", "tree", "palm", "chip", "dogtag", "gear", "rocket", "laurel", "d20"];
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d+):([0-5]\d):([0-5]\d)$/; // H:MM:SS, hours unbounded

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${path.relative(ROOT, file)}: ${msg}`);
const warn = (file, msg) => warnings.push(`${path.relative(ROOT, file)}: ${msg}`);

const isUrl = (v) => typeof v === "string" && /^https?:\/\/[^\s]+$/.test(v);
const isStr = (v) => typeof v === "string" && v.trim().length > 0;

export function parseTime(v) {
  if (v == null || v === "") return null;
  const m = TIME_RE.exec(String(v));
  if (!m) return NaN;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    err(file, `invalid JSON (${e.message})`);
    return null;
  }
}

async function listJson(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await listJson(p)));
    else if (ent.name.endsWith(".json")) out.push(p);
  }
  return out.sort();
}

function requireFields(file, obj, fields, prefix = "") {
  for (const f of fields) {
    if (!isStr(obj?.[f])) err(file, `missing or empty "${prefix}${f}"`);
  }
}

function checkUrlField(file, obj, key, label, required = false) {
  const v = obj?.[key];
  if (v == null || v === "") {
    if (required) err(file, `missing "${label}"`);
    return;
  }
  if (!isUrl(v)) err(file, `"${label}" must be an http(s) URL, got ${JSON.stringify(v)}`);
}

function validateGame(file, g) {
  requireFields(file, g, ["id", "title", "clear_condition"]);
  if (g.id && !ID_RE.test(g.id)) err(file, `game id "${g.id}" must be lowercase kebab-case`);
  if (g.id && path.basename(file, ".json") !== g.id) err(file, `file name must match id "${g.id}"`);
  if (!Array.isArray(g.milestones) || g.milestones.length === 0) {
    err(file, `"milestones" must be a non-empty array`);
    return;
  }
  const seen = new Set();
  g.milestones.forEach((m, i) => {
    requireFields(file, m, ["id", "name"], `milestones[${i}].`);
    if (m.id && !ID_RE.test(m.id)) err(file, `milestone id "${m.id}" must be lowercase kebab-case`);
    if (seen.has(m.id)) err(file, `duplicate milestone id "${m.id}"`);
    seen.add(m.id);
  });
  if (!g.milestones.some((m) => m.final)) {
    err(file, `exactly one milestone must have "final": true (the clear condition)`);
  }
  if (g.milestones.filter((m) => m.final).length > 1) err(file, `more than one milestone marked "final"`);
  for (const [i, b] of (g.human_baselines ?? []).entries()) {
    requireFields(file, b, ["label"], `human_baselines[${i}].`);
    const t = parseTime(b.time);
    if (b.time != null && Number.isNaN(t)) err(file, `human_baselines[${i}].time must be H:MM:SS`);
    checkUrlField(file, b, "source", `human_baselines[${i}].source`, true);
  }
  for (const [i, l] of (g.links ?? []).entries()) checkUrlField(file, l, "url", `links[${i}].url`, true);
  if (!["modern", "classic"].includes(g.tier)) err(file, `tier must be "modern" (current, long-form) or "classic" (retro / 2D / turn-based)`);
  if (g.skin != null && !SKINS.includes(g.skin)) err(file, `skin must be one of ${SKINS.join(", ")}`);
  if (g.icon != null && !ICONS.includes(g.icon)) err(file, `icon must be one of ${ICONS.join(", ")}`);
  if (g.steam_appid != null && !(Number.isInteger(g.steam_appid) && g.steam_appid > 0)) {
    err(file, `steam_appid must be the game's numeric Steam app id (from store.steampowered.com/app/<id>)`);
  }
  if (g.theme != null && !(Array.isArray(g.theme) && g.theme.length === 2 && g.theme.every((c) => /^#[0-9a-f]{6}$/i.test(c)))) {
    err(file, `theme must be two hex colors, e.g. ["#8a2420", "#1f2a5c"]`);
  }
}

function validateSubmission(file, s, gamesById) {
  requireFields(file, s, ["id", "game", "agent", "team", "track", "status", "submitted_at"]);
  if (s.id && !ID_RE.test(s.id)) err(file, `submission id "${s.id}" must be lowercase kebab-case`);
  if (s.id && path.basename(file, ".json") !== s.id) err(file, `file name must match id "${s.id}"`);
  const game = gamesById.get(s.game);
  if (!game) {
    err(file, `unknown game "${s.game}"`);
    return;
  }
  if (path.basename(path.dirname(file)) !== s.game) err(file, `must live in data/submissions/${s.game}/`);
  if (s.track && !TRACKS.includes(s.track)) err(file, `track must be one of ${TRACKS.join(", ")}`);
  if (s.status && !STATUSES.includes(s.status)) err(file, `status must be one of ${STATUSES.join(", ")}`);
  if (s.submitted_at && !DATE_RE.test(s.submitted_at)) err(file, `submitted_at must be YYYY-MM-DD`);

  // Curated entries are public results compiled by maintainers from the authors' reports. They often
  // lack a full-run video or hardware details, so those fields are optional for them; a source URL is not.
  const curated = s.status === "curated";
  if (curated && !isUrl(s.source)) err(file, `curated entries need a "source" URL`);
  if (curated && !SOURCE_TYPES.includes(s.source_type)) {
    err(file, `curated entries need "source_type": "author" (first-party report) or "news" (third-party press)`);
  }
  if (s.source_type != null && !SOURCE_TYPES.includes(s.source_type)) err(file, `source_type must be author or news`);
  if (s.vendor != null && !["claude", "gemini", "openai", "other"].includes(s.vendor)) err(file, `vendor must be claude, gemini, openai or other`);
  if (s.status === "verified") {
    if (!isStr(s.verified_by)) err(file, `verified runs need "verified_by" (the maintainer who checked the footage)`);
    if (!DATE_RE.test(s.verified_at ?? "")) err(file, `verified runs need "verified_at" (YYYY-MM-DD)`);
    if (!(s.videos ?? []).length) err(file, `verified runs need at least one video`);
  }
  for (const [i, x] of (s.extra_sources ?? []).entries()) checkUrlField(file, x, "url", `extra_sources[${i}].url`, true);

  if (!Array.isArray(s.videos) || (s.videos.length === 0 && !curated)) err(file, `"videos" needs at least one link`);
  for (const [i, v] of (s.videos ?? []).entries()) checkUrlField(file, v, "url", `videos[${i}].url`, true);

  const m = s.method ?? {};
  requireFields(file, m, curated ? ["summary"] : ["summary", "observation", "action"], "method.");
  const models = Array.isArray(m.models) ? m.models : m.models == null ? [] : [m.models];
  if (!models.every(isStr) || (!curated && models.length === 0)) {
    err(file, `method.models must be a non-empty list of model names`);
  }
  if (typeof m.human_intervention !== "string") {
    err(file, `method.human_intervention is required (use "none" if there was none, "unknown" for curated)`);
  }
  for (const k of ["paper", "code", "project"]) checkUrlField(file, m, k, `method.${k}`);

  const hw = s.hardware ?? {};
  if (!curated) {
    requireFields(file, hw, ["inference"], "hardware.");
    if (!isStr(hw.gpu) && !isStr(hw.cpu)) err(file, `hardware needs at least "gpu" or "cpu"`);
  }

  const known = new Set(game.milestones.map((x) => x.id));
  if (!Array.isArray(s.milestones) || (s.milestones.length === 0 && !curated)) {
    err(file, `"milestones" must list at least one reached milestone`);
    return;
  }
  const seen = new Set();
  for (const [i, r] of s.milestones.entries()) {
    if (!known.has(r.id)) err(file, `milestones[${i}]: "${r.id}" is not a milestone of ${s.game}`);
    if (seen.has(r.id)) err(file, `milestones[${i}]: duplicate "${r.id}"`);
    seen.add(r.id);
    const t = parseTime(r.elapsed);
    if (r.elapsed != null && Number.isNaN(t)) err(file, `milestones[${i}].elapsed must be H:MM:SS`);
    if (r.video != null) {
      const vi = Number(r.video);
      if (!Number.isInteger(vi) || vi < 0 || vi >= (s.videos?.length ?? 0)) {
        err(file, `milestones[${i}].video must index into "videos"`);
      }
    }
    if (r.timestamp != null && Number.isNaN(parseTime(r.timestamp))) {
      err(file, `milestones[${i}].timestamp must be H:MM:SS`);
    }
    if (s.status === "verified" && r.timestamp == null && r.evidence == null) {
      warn(file, `milestones[${i}] "${r.id}" is verified without a video timestamp or evidence link`);
    }
    if (r.evidence != null) checkUrlField(file, r, "evidence", `milestones[${i}].evidence`);
    if (r.approx != null && (typeof r.approx !== "boolean" || r.elapsed == null)) err(file, `milestones[${i}].approx must be true/false and needs "elapsed"`);
  }
}

// Mirrors evidenceOf() in site/app.js.
function evidenceOf(s) {
  if (s.status === "verified") return "verified";
  if ((s.videos ?? []).length) return "video";
  return s.source_type === "author" ? "author" : "news";
}
function evidenceSummary(subs) {
  const c = {};
  for (const s of subs) c[evidenceOf(s)] = (c[evidenceOf(s)] ?? 0) + 1;
  return ["verified", "video", "author", "news"].filter((k) => c[k]).map((k) => `${k}:${c[k]}`).join(" ");
}

// Mirrors the ranking in site/app.js so the build can print a summary.
function progressOf(game, s) {
  const reached = new Set(s.milestones.map((m) => m.id));
  const n = game.milestones.filter((m) => reached.has(m.id)).length;
  const cleared = game.milestones.some((m) => m.final && reached.has(m.id));
  return { n, total: game.milestones.length, cleared };
}

async function main() {
  const gameFiles = await listJson(path.join(DATA, "games"));
  const games = [];
  for (const f of gameFiles) {
    const g = await readJson(f);
    if (!g) continue;
    validateGame(f, g);
    games.push(g);
  }
  const gamesById = new Map();
  for (const g of games) {
    if (gamesById.has(g.id)) err(path.join(DATA, "games"), `duplicate game id "${g.id}"`);
    gamesById.set(g.id, g);
  }

  const subFiles = await listJson(path.join(DATA, "submissions"));
  const submissions = [];
  const subIds = new Set();
  for (const f of subFiles) {
    const s = await readJson(f);
    if (!s) continue;
    validateSubmission(f, s, gamesById);
    if (subIds.has(s.id)) err(f, `duplicate submission id "${s.id}"`);
    subIds.add(s.id);
    submissions.push(s);
  }

  for (const w of warnings) console.warn(`warn  ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`error ${e}`);
    console.error(`\n${errors.length} error(s). Fix them and re-run "npm run validate".`);
    process.exit(1);
  }

  console.log(`ok    ${games.length} games, ${submissions.length} submissions`);
  for (const g of games) {
    const subs = submissions.filter((s) => s.game === g.id && s.status !== "rejected");
    const best = subs.map((s) => progressOf(g, s)).sort((a, b) => b.n - a.n)[0];
    console.log(
      `      ${g.id.padEnd(26)} ${String(subs.length).padStart(2)} runs  best ${(best ? `${best.n}/${best.total}${best.cleared ? " CLEARED" : ""}` : "-").padEnd(13)} ${evidenceSummary(subs)}`
    );
  }
  const bundle = {
    // Deterministic (no build timestamp) so data.json only changes when data/ does.
    updated: [...submissions.flatMap((x) => [x.submitted_at, x.verified_at])].filter(Boolean).sort().pop() ?? null,
    games: games.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title)),
    submissions: submissions.sort((a, b) => a.game.localeCompare(b.game) || a.id.localeCompare(b.id)),
  };
  const json = JSON.stringify(bundle, null, 1) + "\n";

  if (CHECK_ONLY) {
    const current = existsSync(BUNDLE) ? await readFile(BUNDLE, "utf8") : "";
    if (current !== json) {
      console.error(`error data.json is out of date with data/. Run "npm run build" and commit data.json.`);
      process.exit(1);
    }
    console.log("ok    data.json is up to date");
    await syncPages(bundle.games);
    return;
  }
  await syncPages(bundle.games);
  await writeFile(BUNDLE, json);
  console.log(`wrote data.json`);
}

// ---------- page copies ----------
// GitHub Pages only serves files, so each page's URL needs an index.html. They are copies of the root
// index.html with a <base> back to the site root (so style.css, app.js and data.json resolve from any
// depth) and that page's own title and description (for search results and link previews).
const PAGE_MARK = "<!-- Generated by scripts/build.mjs from index.html. Edit index.html, then run npm run build. -->";
const escHtml = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function pageList(games) {
  return [
    { dir: "why", title: "Why games · GameMoonshot" },
    { dir: "rules", title: "Rules · GameMoonshot" },
    { dir: "submit", title: "Submit a run · GameMoonshot" },
    ...games.map((g) => ({ dir: `game/${g.id}`, title: `${g.title} · GameMoonshot`, description: g.description })),
  ];
}

function pageHtml(template, page) {
  const base = "../".repeat(page.dir.split("/").length);
  let html = template
    .replace(/<meta charset="utf-8" \/>/, (m) => `${m}\n    ${PAGE_MARK}\n    <base href="${base}" />`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escHtml(page.title)}</title>`);
  if (page.description) html = html.replace(/(name="description"\s+content=")[^"]*"/, `$1${escHtml(page.description)}"`);
  return html;
}

// Writes the page copies, or with --check reports any that are missing, stale or no longer needed.
async function syncPages(games) {
  const template = await readFile(path.join(ROOT, "index.html"), "utf8");
  if (!template.includes('<meta charset="utf-8" />')) throw new Error(`index.html: expected <meta charset="utf-8" />`);
  const pages = pageList(games);
  const problems = [];
  for (const page of pages) {
    const file = path.join(ROOT, page.dir, "index.html");
    const html = pageHtml(template, page);
    const current = existsSync(file) ? await readFile(file, "utf8") : null;
    if (current === html) continue;
    if (CHECK_ONLY) problems.push(`${page.dir}/index.html is ${current == null ? "missing" : "out of date"}`);
    else {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, html);
    }
  }
  // Game pages for games that no longer exist. Only folders this script wrote are touched.
  const wanted = new Set(pages.map((p) => p.dir));
  const gameDir = path.join(ROOT, "game");
  for (const d of existsSync(gameDir) ? await readdir(gameDir, { withFileTypes: true }) : []) {
    if (!d.isDirectory() || wanted.has(`game/${d.name}`)) continue;
    const file = path.join(gameDir, d.name, "index.html");
    if (!existsSync(file) || !(await readFile(file, "utf8")).includes(PAGE_MARK)) continue;
    if (CHECK_ONLY) problems.push(`game/${d.name}/ is for a game that no longer exists`);
    else await rm(path.join(gameDir, d.name), { recursive: true });
  }
  if (problems.length) {
    for (const p of problems) console.error(`error ${p}`);
    console.error(`Run "npm run build" and commit the result.`);
    process.exit(1);
  }
  console.log(CHECK_ONLY ? "ok    page copies are up to date" : `wrote ${pages.length} page copies`);
}

main();
