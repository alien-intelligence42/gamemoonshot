// GameMoonshot — static, dependency-free leaderboard.
// Data comes from data.json, which scripts/build.mjs assembles from data/.
import { EMBLEMS, UI, MOUNTAINS } from "./icons.js";

const CFG = window.MOONSHOT_CONFIG ?? { repo: "your-org/gamemoonshot", branch: "main" };
const app = document.getElementById("app");
const player = document.getElementById("player");

// ---------- language ----------
// English or Chinese, from the saved choice, else the browser language. L(en, zh) picks the string for the
// current language; vocab below uses getters so it follows a switch without a reload. Game data
// (titles, descriptions, milestones) stays in English, except the Chinese "_zh" fields of attempts.
const LANG_KEY = "moonshot-lang";
let LANG = (() => {
  let l = null;
  try { l = localStorage.getItem(LANG_KEY); } catch {}
  return l === "en" || l === "zh" ? l : /^zh\b/i.test(navigator.language || "") ? "zh" : "en";
})();
const L = (en, zh) => (LANG === "zh" ? zh : en);

// ---------- vocab ----------
const TRACK_LABEL = {
  get pixels() { return L("Pixels-only", "纯像素"); },
  get harness() { return L("Harness", "工具辅助"); },
};
const TRACK_HELP = {
  get pixels() { return L("Sees only rendered frames (+ optional audio), acts only through keyboard / mouse / controller input.", "只看渲染出的画面（可加音频），只通过键盘、鼠标或手柄操作。"); },
  get harness() { return L("May read game memory or APIs, use custom tools (pathfinding, maps, save states for analysis), or a game-specific scaffold.", "可以读取游戏内存或 API，使用自定义工具（寻路、地图、用于分析的存档），或为该游戏专门搭建的框架。"); },
};

// Evidence level, strongest first. Derived from the data (see evidenceOf), never typed by hand,
// so a run cannot claim "verified" without a maintainer flipping its status.
// Colors are validated for color-vision-deficiency separation; shapes are the secondary encoding.
const evidenceLevel = (key, shape, label, help) => ({ key, shape, get label() { return L(...label); }, get help() { return L(...help); } });
const EVIDENCE = [
  evidenceLevel("verified", "diamond", ["Human-verified", "人工核验"], ["A maintainer watched the footage and checked every claimed milestone.", "维护者看过录像，逐一核对了每个声称达成的里程碑。"]),
  evidenceLevel("video", "circle", ["Video, unverified", "有视频，未核验"], ["Public footage of the run is linked, but no maintainer has checked it yet.", "已附上这次运行的公开录像，但还没有维护者核对。"]),
  evidenceLevel("author", "square", ["Author report", "作者报告"], ["Only a paper, blog or post by the people who ran the agent; no video of the run.", "只有运行者本人的论文、博客或帖子，没有运行录像。"]),
  evidenceLevel("news", "triangle", ["News only", "仅有报道"], ["Only third-party press or write-ups; no first-party report or video found.", "只有第三方报道或文章，找不到一手报告或视频。"]),
];
// Object.assign (not spread) keeps the label/help getters live.
const EV = Object.fromEntries(EVIDENCE.map((e, i) => [e.key, Object.assign(e, { rank: i, color: `var(--ev-${e.key})` })]));
function evidenceOf(run) {
  if (run.status === "verified") return "verified";
  if ((run.videos ?? []).length) return "video";
  if (run.source_type === "author") return "author";
  return "news";
}
const footageNote = (run) =>
  evidenceOf(run) === "video" ? ((run.videos ?? []).some((v) => v.full) ? L("full run on video", "录像覆盖全程") : L("partial footage only", "仅有部分录像")) : "";

// Per-game skins (see skins.css); family groups shared rules. Every skin has a light and a dark variant,
// chosen by the site-wide color scheme (body[data-tone]), which also picks the evidence palette.
const SKINS = {
  "gb-dmg": { family: "pixel" }, "gb-crystal": { family: "pixel" }, "gba-emerald": { family: "pixel" }, "gb-adventure": { family: "pixel" },
  blocky: { family: "blocky" }, western: { family: "western" }, shinobi: { family: "shinobi" }, wukong: { family: "wukong" },
  platformer: { family: "platformer" }, terminal: { family: "terminal" }, spire: { family: "spire" },
  erdtree: { family: "erdtree" }, sunset: { family: "sunset" }, neon: { family: "neon" }, tactical: { family: "tactical" },
  factory: { family: "factory" }, orbital: { family: "orbital" }, atlas: { family: "atlas" }, tome: { family: "tome" }, vice: { family: "vice" },
};
const THEME_KEY = "moonshot-theme";
let THEME = document.body.dataset.tone === "light" ? "light" : "dark";
function syncTheme() {
  document.body.dataset.tone = THEME;
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.innerHTML = THEME === "dark" ? UI.sun : UI.moon;
    btn.setAttribute("aria-label", THEME === "dark" ? L("Switch to light scheme", "切换到浅色") : L("Switch to dark scheme", "切换到深色"));
    btn.title = btn.getAttribute("aria-label");
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getComputedStyle(document.body).getPropertyValue("--bg").trim() || "#0c0a08");
}
document.getElementById("themeToggle")?.addEventListener("click", () => {
  THEME = THEME === "dark" ? "light" : "dark";
  try { localStorage.setItem(THEME_KEY, THEME); } catch {}
  syncTheme();
  const id = currentGameId();
  if (id && DATA) drawChart(DATA.games.find((g) => g.id === id));
});
function applySkin(game) {
  const b = document.body.dataset;
  const sk = game && SKINS[game.skin];
  if (sk) Object.assign(b, { skin: game.skin, family: sk.family });
  else { delete b.skin; delete b.family; }
  syncTheme();
}
// Site chrome outside #app (header, footer) follows the language here; pages re-render on a switch.
function syncLang() {
  document.documentElement.lang = L("en", "zh-CN");
  const set = (sel, html) => { const el = document.querySelector(sel); if (el) el.innerHTML = html; };
  set('nav a[data-nav="home"]', L("Games", "游戏"));
  set('nav a[data-nav="why"]', L(`Why<span class="hide-xs"> games</span>`, `为何<span class="hide-xs">是游戏</span>`));
  set('nav a[data-nav="rules"]', L("Rules", "规则"));
  set('nav a[data-nav="submit"]', L(`Submit<span class="hide-xs"> a run</span>`, `提交<span class="hide-xs">成绩</span>`));
  set(".footer > span:first-child", L(
    "GameMoonshot — Clear the game. Gamify every task. Reach AGI. Emblems are original artwork. Game images © their publishers, loaded from Steam and publisher sites to identify each game.",
    "GameMoonshot —— 打通游戏，把一切任务游戏化，抵达 AGI。徽章为原创作品。游戏图片版权归各发行商所有，从 Steam 和发行商网站加载，仅用于标识游戏。"
  ));
  if (DATA?.updated) set("#generated", L(`Latest entry ${DATA.updated}`, `最新收录 ${DATA.updated}`));
  document.querySelector(".brand")?.setAttribute("aria-label", L("GameMoonshot home", "GameMoonshot 首页"));
  player.setAttribute("aria-label", L("Video player", "视频播放器"));
  const btn = document.getElementById("langToggle");
  if (btn) {
    btn.textContent = L("中", "EN");
    btn.setAttribute("aria-label", L("切换到中文", "Switch to English"));
    btn.title = btn.getAttribute("aria-label");
    btn.lang = L("zh-CN", "en");
  }
  syncTheme();
}
document.getElementById("langToggle")?.addEventListener("click", () => {
  LANG = LANG === "en" ? "zh" : "en";
  try { localStorage.setItem(LANG_KEY, LANG); } catch {}
  syncLang();
  if (DATA) render();
});

// Progress bar. data-level lets skins color it like a health bar.
function bar(n, total, { cleared = false, human = false, lg = false } = {}) {
  const pct = total ? (n / total) * 100 : 0;
  const level = cleared || human ? "full" : pct >= 50 ? "high" : pct >= 20 ? "mid" : "low";
  const cls = ["bossbar", cleared ? "cleared" : "", human ? "human" : "", lg ? "lg" : ""].filter(Boolean).join(" ");
  return `<div class="bar-row"><div class="${cls}" data-level="${level}" role="img" aria-label="${L(`${n} of ${total} milestones`, `${total} 个里程碑中达成 ${n} 个`)}"><i style="width:calc(${pct}% - 2px)"></i></div><span class="num">${n}/${total}</span></div>`;
}

// Model vendor, for icons and chart line colors. Derived from the run's models unless "vendor" is set.
const VENDORS = {
  claude: { label: "Claude", icon: "assets/models/claude.svg" },
  gemini: { label: "Gemini", icon: "assets/models/gemini.svg" },
  openai: { label: "GPT", icon: "assets/models/openai.svg" },
  other: { get label() { return L("Other", "其他"); }, icon: "assets/models/other.svg" },
};
function vendorOf(run) {
  if (run.vendor && VENDORS[run.vendor]) return run.vendor;
  const m = [...(run.method?.models ?? []), run.agent].join(" ");
  if (/claude|sonnet|opus|haiku|fable/i.test(m)) return "claude";
  if (/gemini/i.test(m)) return "gemini";
  if (/\bgpt|\bo3\b|\bo4\b|openai|codex/i.test(m)) return "openai";
  return "other";
}
const vendorIcon = (run, size = 18) => {
  const v = VENDORS[vendorOf(run)];
  return `<img class="vicon" src="${v.icon}" width="${size}" height="${size}" alt="${esc(v.label)}" title="${esc(v.label)}" />`;
};

// ---------- helpers ----------
const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const safeUrl = (u) => (typeof u === "string" && /^https?:\/\//.test(u) ? u : null);
const link = (u, text, cls = "") => {
  const s = safeUrl(u);
  return s ? `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer"${cls ? ` class="${cls}"` : ""}>${esc(text)}</a>` : "";
};
const repoUrl = (path = "") => `https://github.com/${CFG.repo}${path}`;
const themeStyle = (g) => `--ta:${esc(g.theme?.[0] ?? "#6b2a14")};--tb:${esc(g.theme?.[1] ?? "#2a1a10")}`;
const emblem = (g) => EMBLEMS[g.icon] ?? EMBLEMS.badge;

function parseTime(v) {
  const m = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(String(v ?? ""));
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}
function fmtDuration(sec) {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h >= 100) return `${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec % 60).padStart(2, "0")}s`;
}
const roman = (n) =>
  [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]].reduce((s, [v, r]) => {
    while (n >= v) { s += r; n -= v; }
    return s;
  }, "");

function shapeSvg(shape, cx, cy, r, attrs = "") {
  if (shape === "diamond") return `<path d="M${cx} ${cy - r * 1.25}L${cx + r * 1.25} ${cy}L${cx} ${cy + r * 1.25}L${cx - r * 1.25} ${cy}Z" ${attrs}/>`;
  if (shape === "square") return `<rect x="${cx - r * 0.9}" y="${cy - r * 0.9}" width="${r * 1.8}" height="${r * 1.8}" rx="1.5" ${attrs}/>`;
  if (shape === "triangle") return `<path d="M${cx} ${cy - r * 1.2}L${cx + r * 1.1} ${cy + r * 0.8}L${cx - r * 1.1} ${cy + r * 0.8}Z" ${attrs}/>`;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" ${attrs}/>`;
}
const shapeIcon = (key) =>
  `<svg viewBox="0 0 14 14" aria-hidden="true">${shapeSvg(EV[key].shape, 7, 7, 5, `fill="${EV[key].color}"`)}</svg>`;
const evidenceBadge = (run) => {
  const e = EV[evidenceOf(run)];
  return `<span class="badge ev-${e.key}" title="${esc(e.help)}">${shapeIcon(e.key).replace("<svg", '<svg width="11" height="11"')} ${esc(e.label)}</span>`;
};

// ---------- video ----------
function parseVideo(url) {
  const u = safeUrl(url);
  if (!u) return null;
  let p;
  try { p = new URL(u); } catch { return null; }
  const host = p.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") return { platform: "YouTube", yt: p.pathname.slice(1) };
  if (host.endsWith("youtube.com")) {
    const id = p.searchParams.get("v") ?? p.pathname.match(/\/(?:embed|shorts|live)\/([\w-]+)/)?.[1];
    return id ? { platform: "YouTube", yt: id } : { platform: "YouTube" };
  }
  if (host.endsWith("bilibili.com")) {
    const bv = p.pathname.match(/\/video\/(BV\w+)/)?.[1];
    return { platform: "Bilibili", bv };
  }
  if (host === "clips.twitch.tv") return { platform: "Twitch", clip: p.pathname.slice(1) };
  if (host.endsWith("twitch.tv")) {
    const vid = p.pathname.match(/\/videos\/(\d+)/)?.[1];
    const clip = p.pathname.match(/\/clip\/([\w-]+)/)?.[1];
    return { platform: "Twitch", vid, clip };
  }
  return { platform: host };
}
function embedUrl(url, ts) {
  const v = parseVideo(url);
  const sec = parseTime(ts) ?? 0;
  const parent = location.hostname || "localhost";
  if (!v) return null;
  if (v.yt) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.yt)}?autoplay=1&rel=0${sec ? `&start=${sec}` : ""}`;
  if (v.bv) return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(v.bv)}&autoplay=1&high_quality=1${sec ? `&t=${sec}` : ""}`;
  if (v.vid) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return `https://player.twitch.tv/?video=${v.vid}&parent=${parent}&autoplay=true${sec ? `&time=${h}h${m}m${s}s` : ""}`;
  }
  if (v.clip) return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(v.clip)}&parent=${parent}&autoplay=true`;
  return null;
}
function videoAt(url, ts) {
  const u = safeUrl(url);
  const sec = parseTime(ts);
  if (!u || !sec) return u;
  try {
    const p = new URL(u);
    const v = parseVideo(u);
    if (v.platform === "YouTube") p.searchParams.set("t", `${sec}s`);
    else if (v.platform === "Bilibili") p.searchParams.set("t", String(sec));
    else if (v.platform === "Twitch") p.searchParams.set("t", `${Math.floor(sec / 3600)}h${Math.floor((sec % 3600) / 60)}m${sec % 60}s`);
    return p.toString();
  } catch {
    return u;
  }
}
const thumbUrl = (url) => {
  const v = parseVideo(url);
  return v?.yt ? `https://i.ytimg.com/vi/${encodeURIComponent(v.yt)}/hqdefault.jpg` : null;
};

// All playable items are registered here so click handlers can look them up by index.
let VIDEO_REG = [];
const regVideo = (item) => VIDEO_REG.push(item) - 1;

function openPlayer(item) {
  const src = embedUrl(item.url, item.ts);
  if (!src) {
    window.open(videoAt(item.url, item.ts), "_blank", "noopener");
    return;
  }
  const v = parseVideo(item.url);
  player.innerHTML = `
    <div class="modal-box">
      <div class="modal-bar">
        <div><b>${esc(item.title)}</b>${item.sub ? `<div class="muted" style="font-size:13px">${esc(item.sub)}</div>` : ""}</div>
        <div class="actions">
          <a class="btn small" href="${esc(videoAt(item.url, item.ts))}" target="_blank" rel="noopener noreferrer">${UI.external} ${esc(L(`Open on ${v.platform}`, `在 ${v.platform} 打开`))}</a>
          <button class="icon-btn" type="button" data-close aria-label="${L("Close video", "关闭视频")}">${UI.close}</button>
        </div>
      </div>
      <div class="modal-frame"><iframe src="${esc(src)}" title="${esc(item.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
    </div>`;
  player.hidden = false;
  document.body.style.overflow = "hidden";
  player.querySelector("[data-close]").focus();
}
function closePlayer() {
  if (player.hidden) return;
  player.hidden = true;
  player.innerHTML = "";
  document.body.style.overflow = "";
}
player.addEventListener("click", (e) => {
  if (e.target === player || e.target.closest("[data-close]")) closePlayer();
});
document.addEventListener("keydown", (e) => e.key === "Escape" && closePlayer());
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-play]");
  if (!t) return;
  e.preventDefault();
  e.stopPropagation();
  openPlayer(VIDEO_REG[Number(t.dataset.play)]);
});

function videoCard(game, run, v, idx) {
  const thumb = thumbUrl(v.url);
  const id = regVideo({ url: v.url, title: `${run.agent} — ${v.label ?? L("Video", "视频")}`, sub: v.covers ?? "" });
  return `
    <button class="vcard" type="button" data-play="${id}" aria-label="${L("Play", "播放")}: ${esc(run.agent)} — ${esc(v.label ?? L("video", "视频"))}">
      <div class="thumb" style="${themeStyle(game)}">
        ${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : `<div class="emblem">${emblem(game)}</div>`}
        <span class="play">${UI.play}</span>
        <span class="platform">${esc(parseVideo(v.url)?.platform ?? L("Video", "视频"))}</span>
      </div>
      <div>
        <div class="vg">${esc(game.title)}</div>
        <div class="vt">${esc(run.agent)} · ${esc(v.label ?? L(`Video ${idx + 1}`, `视频 ${idx + 1}`))}</div>
        ${v.covers ? `<div class="vs">${esc(v.covers)}</div>` : ""}
      </div>
    </button>`;
}

// ---------- ranking ----------
// 1. cleared (reached the milestone marked "final")  2. milestones reached
// 3. elapsed time at the furthest milestone (faster first; unknown last)  4. earlier submission
function scoreRun(game, run) {
  const order = new Map(game.milestones.map((m, i) => [m.id, i]));
  const reached = run.milestones.filter((r) => order.has(r.id)).sort((a, b) => order.get(a.id) - order.get(b.id));
  const furthest = reached[reached.length - 1];
  const finalId = game.milestones.find((m) => m.final)?.id;
  // time shown = when the last of the reached milestones was done (badges can come out of order)
  const timed = reached.map((r) => ({ t: parseTime(r.elapsed), approx: !!r.approx })).filter((x) => x.t != null);
  const last = timed.reduce((a, b) => (b.t >= (a?.t ?? -1) ? b : a), null);
  return {
    run,
    reachedIds: new Set(reached.map((r) => r.id)),
    n: reached.length,
    total: game.milestones.length,
    cleared: reached.some((r) => r.id === finalId),
    furthest: furthest ? game.milestones[order.get(furthest.id)] : null,
    time: last?.t ?? null,
    approx: !!last?.approx,
  };
}
const rankRuns = (game, runs) =>
  runs
    .map((r) => scoreRun(game, r))
    .sort(
      (a, b) =>
        Number(b.cleared) - Number(a.cleared) ||
        b.n - a.n ||
        (a.time ?? Infinity) - (b.time ?? Infinity) ||
        String(a.run.submitted_at).localeCompare(String(b.run.submitted_at))
    );

// ---------- data ----------
let DATA = null;
async function load() {
  const res = await fetch("data.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
  DATA = await res.json();
  syncLang();
}
const runsFor = (gameId) => DATA.submissions.filter((s) => s.game === gameId && s.status !== "rejected");

// ---------- home ----------
// The logo SVG lives once, inline in index.html's header; the hero reuses that markup.
const logoSvg = () => document.querySelector(".brand .logo")?.outerHTML.replace('class="logo"', "") ?? "";
const STEAM_ART = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";
// Official art for a game: its own "art" links (publisher sites), else its Steam images. card = a wide
// header image with the logo; banner = background art for the game page. Null when the game has neither.
function artFor(g) {
  const steam = g.steam_appid ? `${STEAM_ART}/${Number(g.steam_appid)}` : null;
  const card = g.art?.card ?? (steam && `${steam}/header.jpg`);
  const banner = g.art?.banner ?? (steam && `${steam}/library_hero.jpg`);
  return card || banner ? { card, banner } : null;
}
// For a just-released game ("new" tier): how long until launch, or how many days it has been out.
// Day 1 is launch day. Counted in the viewer's calendar, so it changes at their midnight.
function releaseNote(g) {
  if (!g.release_date) return "";
  const [y, m, d] = g.release_date.split("-").map(Number);
  const out = Date.UTC(y, m - 1, d);
  const now = new Date();
  const days = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - out) / 864e5);
  const date = new Date(out).toLocaleDateString(LANG === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  if (days < 0) return L(`Out ${date} — in ${-days} day${days === -1 ? "" : "s"}`, `${date}发售——还有 ${-days} 天`);
  return L(`Out ${date} — day ${days + 1}`, `${date}发售——第 ${days + 1} 天`);
}
function viewHome() {
  const all = DATA.submissions.filter((s) => s.status !== "rejected");
  const clearedGames = DATA.games.filter((g) => rankRuns(g, runsFor(g.id))[0]?.cleared).length;
  const videoCount = all.reduce((n, s) => n + (s.videos?.length ?? 0), 0);
  const verified = all.filter((s) => s.status === "verified").length;

  // feature: the wide card for a new release, with its description and the days since launch.
  const card = (g, feature = false) => {
      const ranked = rankRuns(g, runsFor(g.id));
      const best = ranked[0];
      const vids = ranked.reduce((n, sc) => n + (sc.run.videos?.length ?? 0), 0);
      // Official header art (see artFor). If it fails to load, the card falls back to the emblem art.
      const cardUrl = artFor(g)?.card;
      const art = cardUrl
        ? `<img class="art" src="${esc(cardUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer"
             onerror="this.parentNode.classList.remove('has-art'); this.remove()" />`
        : "";
      return `
      <a class="card" href="game/${esc(g.id)}/" style="${themeStyle(g)}" data-skin="${esc(g.skin ?? "")}">
        <div class="keyart${art ? " has-art" : ""}">
          ${art}
          <span class="year">${esc(g.release_year ?? "")}</span>
          <div class="emblem">${emblem(g)}</div>
          ${MOUNTAINS}
        </div>
        <div class="body">
          <div>
            <h3>${esc(g.title)}</h3>
            <div class="meta">${esc([g.platform, g.genre].filter(Boolean).join(" · "))}</div>
          </div>
          ${feature ? `<div class="fresh">${UI.footprints}<span>${esc(releaseNote(g))}</span></div>${g.description ? `<p class="desc">${esc(g.description)}</p>` : ""}` : ""}
          <div class="best">
            ${bar(best ? best.n : 0, g.milestones.length, { cleared: best?.cleared })}
            <div>${
              best
                ? `${L("Best AI", "最佳 AI")}: <b>${esc(best.run.agent)}</b> — ${best.cleared ? L("cleared the game", "已通关") : best.furthest ? `${L("reached", "已到达")} ${esc(best.furthest.name)}` : L("no milestone yet", "尚无里程碑")}`
                : `<span class="muted">${L("No AI run yet — the board is open.", "还没有 AI 运行——榜单虚位以待。")}</span>`
            }</div>
            <div class="foot">
              ${best ? evidenceBadge(best.run) : ""}
              <span class="tag">${L(`${ranked.length} run${ranked.length === 1 ? "" : "s"}`, `${ranked.length} 次运行`)}</span>
              ${vids ? `<span class="tag">▶ ${L(`${vids} video${vids === 1 ? "" : "s"}`, `${vids} 个视频`)}</span>` : ""}
            </div>
          </div>
        </div>
      </a>`;
  };
  const fresh = DATA.games.filter((g) => g.tier === "new").map((g) => card(g, true)).join("");
  const modern = DATA.games.filter((g) => g.tier === "modern").map((g) => card(g)).join("");
  const classic = DATA.games.filter((g) => g.tier === "classic").map((g) => card(g)).join("");

  VIDEO_REG = [];
  const footage = DATA.games
    .flatMap((g) => runsFor(g.id).flatMap((r) => (r.videos ?? []).map((v, i) => ({ g, r, v, i }))))
    .sort((a, b) => String(b.r.submitted_at).localeCompare(String(a.r.submitted_at)))
    .slice(0, 6);

  return `
    <section class="hero">
      <canvas id="embers" aria-hidden="true"></canvas>
      <div class="hero-inner">
        <div class="hero-top">
          <div class="hero-head">
            <div class="eyebrow">${L("This era's moonshot · AI agents · real games", "这个时代的登月计划 · AI 智能体 · 真实游戏")}</div>
            <h1>${L("Can your agent<br/>finish the game?", "你的智能体<br/>能通关吗？")}</h1>
            <a class="slogan" href="why/">${sloganHtml()}<span class="slogan-more">${L("Why games →", "为何是游戏 →")}</span></a>
          </div>
          <div class="moon-art" aria-hidden="true">${logoSvg()}</div>
        </div>
        <p class="lede">${L(
          `Finishing a modern game end to end — seeing, planning and acting in real time across a story that takes a person
          30 to 100 hours — is this era's moonshot for AI. GameMoonshot tracks how close agents get on Elden Ring, Cyberpunk 2077, GTA V,
          Red Dead Redemption 2, Black Myth: Wukong and more, and on GTA VI from launch day, before any guide exists. Each game is split into milestones (bosses, missions, chapters);
          every claim shows how well it is evidenced, and every board shows where human players stand.`,
          `端到端通关一款现代游戏——在一个需要人类玩上 30 到 100 小时的故事里，实时地观察、规划和行动——是这个时代 AI 的登月计划。GameMoonshot 追踪智能体在《艾尔登法环》《赛博朋克 2077》《GTA V》《荒野大镖客：救赎 2》《黑神话：悟空》等游戏中能走多远，也从首发当天起追踪还没有任何攻略的《GTA VI》。每款游戏都拆分成一串里程碑（Boss、任务、章节）；每项成绩都标明证据强度，每个榜单都列出人类玩家的水平。`
        )}</p>
        <div class="hero-actions">
          <a class="btn primary" href="#${fresh ? "new" : "games"}">${UI.sword} ${L("Choose a game", "选择游戏")}</a>
          <a class="btn" href="submit/">${UI.scroll} ${L("Submit a run", "提交成绩")}</a>
        </div>
      </div>
      ${MOUNTAINS}
    </section>
    <div class="stats"><div class="stats-inner">
      <div class="stat"><b>${DATA.games.length}</b><span>${L("Games on the board", "上榜游戏")}</span></div>
      <div class="stat"><b>${all.length}</b><span>${L("AI runs recorded", "AI 运行记录")}</span></div>
      <div class="stat"><b>${clearedGames}</b><span>${L("Games cleared by AI", "被 AI 通关的游戏")}</span></div>
      <div class="stat"><b>${videoCount}</b><span>${L("Videos linked", "关联视频")}</span></div>
      <div class="stat"><b>${verified}</b><span>${L("Human-verified runs", "人工核验的运行")}</span></div>
    </div></div>

    <div class="wrap">
      ${
        fresh
          ? `<section class="section" id="new">
        <div class="section-head">
          <div><h2><span class="ico">${UI.footprints}</span>${L("Uncharted: new releases", "未知之地：新发售游戏")}</h2>
          <div class="sub">${L(
            "Games out so recently that there are few walkthroughs, wikis or videos yet, and no model was trained on them. An agent has to explore, work out what the game wants and remember what it learned, much like a player on launch day. Runs here must say whether the agent could look things up, and when. A game moves to the moonshots once guides for it are widely available.",
            "刚发售不久的游戏：攻略、wiki 和视频都还很少，也没有哪个模型在训练时见过它们。智能体得像首发当天的玩家一样自己探索，弄清游戏要它做什么，并记住学到的东西。这里的每次运行都要说明智能体能不能查资料、从什么时候开始能查。等攻略普遍出现后，这款游戏会移到“登月目标”里。"
          )}</div></div>
        </div>
        <div class="grid feature">${fresh}</div>
      </section>`
          : ""
      }
      <section class="section" id="games">
        <div class="section-head">
          <div><h2><span class="ico">${UI.sword}</span>${L("The moonshots", "登月目标")}</h2>
          <div class="sub">${L(
            "Modern games that take a person tens of hours or more: real-time combat and open worlds, plus grand strategy, factory building, spaceflight and a dialogue-heavy party RPG. Partial runs count — every milestone reached is on the board.",
            "需要人类玩上数十小时甚至更久的现代游戏：实时战斗与开放世界，还有大战略、工厂建造、航天和以对话为主的团队 RPG。部分完成也算数——每达到一个里程碑都会上榜。"
          )}</div></div>
          <a class="btn small" href="${esc(repoUrl("/issues/new?template=new-game.yml"))}" target="_blank" rel="noopener">${L("Propose a game", "推荐游戏")}</a>
        </div>
        <div class="grid">${modern}</div>
      </section>

      <section class="section" id="classics">
        <div class="section-head">
          <div><h2><span class="ico">${UI.scroll}</span>${L("Test flights", "试飞")}</h2>
          <div class="sub">${L(
            `Retro, 2D and turn-based games — the kind existing benchmarks use (<a href="https://www.vgbench.com/" target="_blank" rel="noopener">VideoGameBench</a> runs one fixed harness on 1990s Game Boy and MS-DOS games). Kept here as test flights for comparison; <a href="rules/">how GameMoonshot differs</a>.`,
            `复古、2D 和回合制游戏——也就是现有基准常用的那类（<a href="https://www.vgbench.com/" target="_blank" rel="noopener">VideoGameBench</a> 用一套固定框架跑 1990 年代的 Game Boy 和 MS-DOS 游戏）。保留在这里作为对照的试飞；<a href="rules/">GameMoonshot 有何不同</a>。`
          )}</div></div>
        </div>
        <div class="grid compact">${classic}</div>
      </section>

      ${
        footage.length
          ? `<section class="section">
        <div class="section-head"><div><h2><span class="ico">${UI.film}</span>${L("Latest footage", "最新录像")}</h2>
        <div class="sub">${L(
          "Click to watch here. Most of this is stream archives and excerpts, not full verified runs — check each run's evidence badge.",
          "点击即可在此观看。这里大多是直播存档和片段，并非完整的已核验运行——请留意每次运行的证据标签。"
        )}</div></div></div>
        <div class="videos">${footage.map(({ g, r, v, i }) => videoCard(g, r, v, i)).join("")}</div>
      </section>`
          : ""
      }

      <section class="section">
        <div class="section-head"><div><h2><span class="ico">${UI.scroll}</span>${L("How it works", "如何参与")}</h2></div></div>
        <div class="steps">
          <div class="step"><div class="n">01</div><h3>${L("Pick a game", "选一款游戏")}</h3><p>${L("Each game has an ordered list of milestones ending in the clear condition.", "每款游戏都有一串按顺序排列的里程碑，最后一个就是通关条件。")}</p></div>
          <div class="step"><div class="n">02</div><h3>${L("Record the run", "录下运行")}</h3><p>${L("Upload the full, unedited run. Partial runs count.", "上传完整、未剪辑的运行录像。部分完成也算数。")}</p></div>
          <div class="step"><div class="n">03</div><h3>${L("Submit", "提交")}</h3><p>${L("Video link and timestamps, hardware, models, and how the agent sees and acts.", "视频链接和时间戳、硬件、模型，以及智能体如何观察和操作。")}</p></div>
          <div class="step"><div class="n">04</div><h3>${L("Get verified", "等待核验")}</h3><p>${L("A maintainer watches the footage. Every run carries its evidence level.", "维护者会观看录像。每次运行都带有证据等级标签。")}</p></div>
        </div>
      </section>
    </div>`;
}

// Rising embers in the hero. Stops itself when the hero leaves the DOM.
function startEmbers() {
  const c = document.getElementById("embers");
  if (!c || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = c.getContext("2d");
  let w, h, dpr;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = c.clientWidth; h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const N = Math.round(Math.min(70, w / 18));
  const ps = Array.from({ length: N }, () => spawn(true));
  function spawn(init) {
    return { x: Math.random() * w, y: init ? Math.random() * h : h + 10, r: Math.random() * 1.8 + 0.6, vy: Math.random() * 0.5 + 0.25, vx: (Math.random() - 0.5) * 0.25, ph: Math.random() * 6.28, life: Math.random() * 0.6 + 0.4 };
  }
  let t = 0;
  const tick = () => {
    if (!c.isConnected) { removeEventListener("resize", resize); return; }
    t += 0.016;
    ctx.clearRect(0, 0, w, h);
    for (const p of ps) {
      p.y -= p.vy; p.x += p.vx + Math.sin(t * 1.3 + p.ph) * 0.25;
      if (p.y < -10) Object.assign(p, spawn(false));
      const a = Math.max(0, Math.min(1, p.y / h)) * p.life;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, `rgba(255,190,110,${a})`);
      g.addColorStop(0.4, `rgba(226,102,47,${a * 0.5})`);
      g.addColorStop(1, "rgba(226,102,47,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.283); ctx.fill();
    }
    requestAnimationFrame(tick);
  };
  addEventListener("resize", resize);
  requestAnimationFrame(tick);
}

// ---------- game page ----------
const gameState = { track: "all", minEvidence: "news", open: new Set() };

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "source"; } };
function humanRow(game, b) {
  return `
    <div class="row human" role="listitem">
      <div class="c-rank"><span class="medal h" title="${L("Human reference", "人类参考")}">${UI.user.replace("<svg", '<svg width="18" height="18"')}</span></div>
      <div class="c-who who"><b>${esc(b.label)}</b><span>${esc(b.note ?? L("Human reference", "人类参考"))}</span></div>
      <div class="c-chev"></div>
      <div class="c-prog prog">${bar(game.milestones.length, game.milestones.length, { human: true })}</div>
      <div class="c-meta">
        <div class="c-track"><span class="badge human">${L("Human", "人类")}</span></div>
        <div class="c-time num time">${esc(fmtDuration(parseTime(b.time)))}</div>
        <div class="c-ev">${link(b.source, `${hostOf(b.source)} ↗`)}</div>
        <div class="c-date"></div>
      </div>
    </div>`;
}

function runDetail(game, sc) {
  const r = sc.run;
  const m = r.method ?? {};
  const hw = r.hardware ?? {};
  const videos = r.videos ?? [];
  const e = EV[evidenceOf(r)];
  const dl = (pairs) => {
    const rows = pairs.filter(([, v]) => v != null && v !== "");
    return rows.length ? `<dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : "";
  };
  const ladder = game.milestones
    .map((ms) => {
      const hit = r.milestones.find((x) => x.id === ms.id);
      if (!hit) return `<li class="miss"><span>·</span><span>${esc(ms.name)}</span><span></span></li>`;
      const v = videos[hit.video ?? 0];
      let right = hit.elapsed ? `<span class="mono">${hit.approx ? "~" : ""}${esc(hit.elapsed)}</span>` : "";
      if (v && hit.timestamp) {
        const id = regVideo({ url: v.url, ts: hit.timestamp, title: `${r.agent} — ${ms.name}`, sub: L(`${v.label ?? "Video"} at ${hit.timestamp}`, `${v.label ?? "视频"} ${hit.timestamp} 处`) });
        right += ` <a href="${esc(videoAt(v.url, hit.timestamp))}" data-play="${id}">▶ ${esc(hit.timestamp)}</a>`;
      }
      if (hit.evidence) right += ` ${link(hit.evidence, L("evidence", "证据"))}`;
      return `<li><span class="ok">✓</span><span>${esc(ms.name)}</span><span>${right}</span></li>`;
    })
    .join("");
  const vids = videos
    .map((v, i) => {
      const vl = v.label ?? L(`Video ${i + 1}`, `视频 ${i + 1}`);
      const id = regVideo({ url: v.url, title: `${r.agent} — ${vl}`, sub: v.covers ?? "" });
      return `<button class="vid-item" type="button" data-play="${id}"><span class="pbtn">${UI.play}</span><span>${esc(vl)}${v.covers ? `<small>${esc(v.covers)}</small>` : ""}</span></button>`;
    })
    .join("");

  return `
    <div class="detail" id="detail-${esc(r.id)}">
      <div class="detail-grid">
        <div>
          <h4>${L("Method", "方法")}</h4>
          <p>${esc(m.summary)}</p>
          ${dl([
            [L("Track", "赛道"), `${TRACK_LABEL[r.track] ?? r.track} — ${TRACK_HELP[r.track] ?? ""}`],
            [L("Models", "模型"), Array.isArray(m.models) ? m.models.join(", ") : m.models],
            [L("Observation", "观察"), m.observation],
            [L("Action", "动作"), m.action],
            [L("Human help", "人工协助"), m.human_intervention],
            [L("Game speed", "游戏速度"), m.game_speed],
            [L("Restarts", "重开"), m.restarts],
          ])}
          <div class="links" style="margin-top:12px">${link(m.paper, L("Paper ↗", "论文 ↗"))} ${link(m.code, L("Code ↗", "代码 ↗"))} ${link(m.project, L("Project page ↗", "项目主页 ↗"))}</div>
          ${
            Object.keys(hw).length || r.wall_clock || r.cost
              ? `<h4 style="margin-top:22px">${L("Hardware &amp; cost", "硬件与成本")}</h4>${dl([
                  ["GPU", hw.gpu], ["CPU", hw.cpu], [L("RAM", "内存"), hw.ram_gb ? `${hw.ram_gb} GB` : null], [L("OS", "操作系统"), hw.os],
                  [L("Inference", "推理"), hw.inference], [L("Game runs on", "游戏运行于"), hw.game_host], [L("Wall-clock", "实际耗时"), r.wall_clock], [L("Cost", "成本"), r.cost],
                ])}`
              : ""
          }
        </div>
        <div>
          <h4>${L("Evidence", "证据")}</h4>
          <p>${evidenceBadge(r)}</p>
          <p style="font-size:14px">${esc(e.help)}${footageNote(r) ? ` <b style="color:var(--ink)">(${esc(footageNote(r))})</b>` : ""}</p>
          ${dl([
            [L("Verified by", "核验人"), r.verified_by],
            [L("Verified on", "核验日期"), r.verified_at],
            [L("Added", "收录"), r.status === "curated"
              ? L(`by maintainers from public sources (${r.submitted_at})`, `由维护者根据公开资料整理（${r.submitted_at}）`)
              : L(`submitted ${r.submitted_at}`, `提交于 ${r.submitted_at}`)],
          ])}
          <div class="links" style="margin:12px 0 18px">
            ${link(r.source, r.source_type === "author" ? L("Author's report ↗", "作者报告 ↗") : r.source_type === "news" ? L("Main source ↗", "主要来源 ↗") : L("Source ↗", "来源 ↗"))}
            ${(r.extra_sources ?? []).map((x) => link(x.url, `${x.label ?? L("More", "更多")} ↗`)).join("")}
          </div>
          <h4>${L("Videos", "视频")}</h4>
          ${vids ? `<div class="vid-list">${vids}</div>` : `<p class="muted" style="font-size:14px">${L("No video of this run has been found.", "尚未找到这次运行的视频。")}</p>`}
          ${r.notes ? `<h4 style="margin-top:22px">${L("Notes", "备注")}</h4><p style="font-size:14px">${esc(r.notes)}</p>` : ""}
        </div>
        <div>
          <h4>${L("Milestones", "里程碑")} · ${sc.n}/${sc.total}</h4>
          <ul class="mini-ladder">${ladder}</ul>
        </div>
      </div>
    </div>`;
}

// Agent work on a game that isn't ranked: it reached no milestone, or ran outside the board's rules
// (other settings, isolated fights, a different game mode). Shown under the leaderboard so the work is on
// record without competing with ranked runs. Text comes from the game's "attempts"; unlike the rest of the
// game data, each text field may carry a Chinese version in "<field>_zh", used when the page is in Chinese.
const zh = (o, k) => (LANG === "zh" && o[`${k}_zh`]) || o[k];
// One line on how a run plays: what the agent sees → how it acts. Runs on the same board can differ a
// lot here (a bot API that reads game state vs. screenshots and a mouse), so the leaderboard shows it on
// every row. Falls back to "observation → action" for runs without method.interface.
function howOf(r) {
  const m = r.method ?? {};
  return zh(m, "interface") || (m.observation && m.action ? `${m.observation} → ${m.action}` : "");
}

function attemptCard(a) {
  const who = [zh(a, "team"), a.date].filter(Boolean).map(esc).join(" · ");
  const extra = (a.links ?? []).map((l) => link(l.url, `${zh(l, "label")} ↗`)).join("");
  return `
    <article class="attempt">
      <header><h3>${esc(zh(a, "name"))}</h3>${who ? `<span class="who">${who}</span>` : ""}</header>
      <p>${esc(zh(a, "result"))}</p>
      ${a.why_not ? `<p class="why"><b>${L("Why it isn't ranked", "为何未排名")}</b>${esc(zh(a, "why_not"))}</p>` : ""}
      ${(a.models ?? []).length ? `<div class="tags">${a.models.map((m) => `<span class="tag">${esc(m)}</span>`).join("")}</div>` : ""}
      <div class="links">${link(a.url, L("Source ↗", "来源 ↗"))}${extra}</div>
    </article>`;
}

function viewGame(id) {
  const game = DATA.games.find((g) => g.id === id);
  if (!game) return `<div class="wrap"><div class="empty" style="margin-top:48px">${L(`Unknown game “${esc(id)}”.`, `未知游戏“${esc(id)}”。`)} <a href="./">${L("Back to all games", "返回全部游戏")}</a></div></div>`;
  VIDEO_REG = [];

  const allRanked = rankRuns(game, runsFor(game.id));
  let runs = runsFor(game.id);
  if (gameState.track !== "all") runs = runs.filter((r) => r.track === gameState.track);
  const maxRank = EV[gameState.minEvidence].rank;
  runs = runs.filter((r) => EV[evidenceOf(r)].rank <= maxRank);
  const ranked = rankRuns(game, runs);
  const best = allRanked[0];

  const rows = ranked
    .map((sc, i) => {
      const r = sc.run;
      const open = gameState.open.has(r.id);
      return `
      <div class="row" role="listitem" data-run="${esc(r.id)}" tabindex="0" aria-expanded="${open}" aria-controls="detail-${esc(r.id)}">
        <div class="c-rank"><span class="medal ${i < 3 ? `r${i + 1}` : ""}">${i + 1}</span></div>
        <div class="c-who who"><b>${vendorIcon(r)}${esc(r.agent)}</b><span>${esc(r.team)}</span>${howOf(r) ? `<span class="how" title="${L("What the agent sees → how it acts", "智能体看到什么 → 怎么操作")}">${esc(howOf(r))}</span>` : ""}</div>
        <div class="c-chev">${UI.chevron.replace("<svg", '<svg class="chev"')}</div>
        <div class="c-prog prog">
          ${bar(sc.n, sc.total, { cleared: sc.cleared })}
          <div class="sub">${sc.cleared ? `<span class="badge cleared">${L("Cleared", "已通关")}</span>` : esc(sc.furthest?.name ?? L("No milestone yet", "尚无里程碑"))}</div>
        </div>
        <div class="c-meta">
          <div class="c-track"><span class="badge track" title="${esc(TRACK_HELP[r.track])}">${esc(TRACK_LABEL[r.track] ?? r.track)}</span></div>
          <div class="c-time num time ${sc.time == null ? "unknown" : ""}" ${sc.approx ? `title="${L("approximate, from public reports", "约数，来自公开报道")}"` : ""}>${sc.approx && sc.time != null ? "~" : ""}${esc(fmtDuration(sc.time))}</div>
          <div class="c-ev ev">${evidenceBadge(r)}${footageNote(r) ? `<div class="note">${esc(footageNote(r))}</div>` : ""}</div>
          <div class="c-date date num">${esc(r.submitted_at)}</div>
        </div>
      </div>
      <div ${open ? "" : "hidden"} data-detail="${esc(r.id)}">${runDetail(game, sc)}</div>`;
    })
    .join("");

  const ladder = game.milestones
    .map((ms, i) => {
      const hitters = allRanked.filter((sc) => sc.reachedIds.has(ms.id));
      const first = [...hitters].sort((a, b) => String(a.run.submitted_at).localeCompare(String(b.run.submitted_at)))[0];
      const bestEv = hitters.map((sc) => evidenceOf(sc.run)).sort((a, b) => EV[a].rank - EV[b].rank)[0];
      return `
      <li class="${hitters.length ? "hit" : ""} ${ms.final ? "final" : ""}">
        <span class="node"><span>${roman(i + 1)}</span></span>
        <span class="name">${esc(ms.name)}${ms.final ? L(" — clear", " — 通关") : ""}${ms.description ? `<small>${esc(ms.description)}</small>` : ""}</span>
        <span class="claim">${
          hitters.length
            ? `${evidenceBadge(hitters.find((sc) => evidenceOf(sc.run) === bestEv).run)}<span class="muted">${L(`${hitters.length} run${hitters.length > 1 ? "s" : ""} · first: `, `${hitters.length} 次运行 · 首个：`)}${esc(first.run.agent)}</span>`
            : `<span class="muted">${L("Unclaimed", "尚无人达成")}</span>`
        }</span>
      </li>`;
    })
    .join("");

  const gameVideos = allRanked.flatMap((sc) => (sc.run.videos ?? []).map((v, i) => videoCard(game, sc.run, v, i))).join("");
  const tab = (val, label) => `<button type="button" data-track="${val}" aria-pressed="${gameState.track === val}">${label}</button>`;
  const wr = (game.human_baselines ?? [])[0];

  // Official background art (see artFor); it fills the right of the banner and fades into the skin's own
  // background, so the text keeps the colors the skin chose. On error the banner goes back to the emblem art.
  const bannerUrl = artFor(game)?.banner;
  const heroArt = bannerUrl
    ? `<img class="art" src="${esc(bannerUrl)}" alt="" decoding="async" referrerpolicy="no-referrer"
         onerror="this.parentNode.classList.remove('has-art'); this.remove()" />`
    : "";
  return `
    <section class="banner${heroArt ? " has-art" : ""}" style="${themeStyle(game)}">
      ${heroArt}
      <div class="emblem">${emblem(game)}</div>
      ${game.deco ? `<div class="deco" aria-hidden="true">${esc(game.deco)}</div>` : ""}
      ${MOUNTAINS}
      <div class="crumbs"><a href="./">${L("Games", "游戏")}</a> / ${esc(game.title)}</div>
      <h1>${esc(game.title)}</h1>
      <div class="tags">${[game.platform, game.release_year, game.genre].filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}${
        game.tier === "new" ? `<span class="tag fresh">${esc(releaseNote(game))}</span>` : ""
      }</div>
      ${game.description ? `<p class="desc">${esc(game.description)}</p>` : ""}
      <div class="frontier">
        <div class="label"><span>${L("AI frontier", "AI 前沿")}</span><span>${
          best ? `${esc(best.run.agent)} — ${best.cleared ? L("cleared", "已通关") : best.furthest ? esc(best.furthest.name) : L("no milestone yet", "尚无里程碑")}` : L("No AI run yet", "还没有 AI 运行")
        }</span></div>
        ${bar(best ? best.n : 0, game.milestones.length, { cleared: best?.cleared, lg: true })}
      </div>
    </section>

    <div class="wrap">
      <dl class="facts">
        <div class="fact"><dt>${L("Clear condition", "通关条件")}</dt><dd>${esc(game.clear_condition)}</dd></div>
        <div class="fact"><dt>${L("Human record", "人类纪录")}</dt><dd>${wr ? `${parseTime(wr.time) != null ? `${esc(fmtDuration(parseTime(wr.time)))} — ` : ""}${esc(wr.label.replace(/^Speedrun WR — /, ""))}` : "—"}</dd></div>
        <div class="fact"><dt>${L("Game rules", "游戏规则")}</dt><dd>${esc(game.rules ?? L("Unmodified game; disclose version and settings.", "未修改的游戏；须说明版本和设置。"))}</dd></div>
      </dl>

      <section class="section">
        <div class="section-head"><div><h2><span class="ico">${UI.chart}</span>${L("Progress vs. play time", "进度与游玩时长")}</h2>
        <div class="sub">${L(
          "How long each agent played (across, log scale) to reach each milestone (up). Each line is one run, colored by model; the model's icon marks how far it got, and its ring shows the evidence level. The hollow ring is the human record for the whole game. Times marked “about” are approximate figures from public reports.",
          "每个智能体玩了多久（横轴，对数刻度）才达到每个里程碑（纵轴）。每条线是一次运行，按模型着色；模型图标标出它走到的最远处，外圈表示证据等级。空心圆是人类通关全作的纪录。标“约”的时间是来自公开报道的近似值。"
        )}</div></div></div>
        <div class="panel"><div class="chart-wrap" id="chart"></div></div>
      </section>

      <section class="section">
        <div class="section-head">
          <div><h2><span class="ico">${UI.trophy}</span>${L("Leaderboard", "排行榜")}</h2>
          <div class="sub">${L(
            "Ranked by: cleared → milestones reached → elapsed time at the furthest milestone → report date. Click a run for method, sources and videos.",
            "排序依据：是否通关 → 达成的里程碑数 → 到达最远里程碑时的用时 → 报告日期。点击某次运行可查看方法、来源和视频。"
          )}</div></div>
          <div class="controls">
            <div class="tabs" role="group" aria-label="${L("Track", "赛道")}">${tab("all", L("All tracks", "全部赛道"))}${tab("pixels", TRACK_LABEL.pixels)}${tab("harness", TRACK_LABEL.harness)}</div>
            <label class="select">${L("Evidence", "证据")}
              <select id="minEvidence">
                ${[["news", L("All", "全部")], ["author", L("Author report or better", "作者报告及以上")], ["video", L("Has video", "有视频")], ["verified", L("Human-verified only", "仅人工核验")]]
                  .map(([k, l]) => `<option value="${k}" ${gameState.minEvidence === k ? "selected" : ""}>${l}</option>`)
                  .join("")}
              </select>
            </label>
          </div>
        </div>
        <div class="legend">${EVIDENCE.map((e) => `<div>${evidenceBadge({ status: e.key === "verified" ? "verified" : "", videos: e.key === "video" ? [1] : [], source_type: e.key })}<span>${esc(e.help)}</span></div>`).join("")}</div>
        <div class="board-head" aria-hidden="true"><span>#</span><span>${L("Agent", "智能体")}</span><span></span><span>${L("Progress", "进度")}</span><span>${L("Time", "用时")}</span><span>${L("Evidence", "证据")}</span><span>${L("Reported", "报告日期")}</span><span></span></div>
        <div class="board" role="list">
          ${(game.human_baselines ?? []).map((b) => humanRow(game, b)).join("")}
          ${rows || `<div class="empty">${L("No AI runs in this view yet.", "当前筛选下还没有 AI 运行。")} <a href="submit/?game=${esc(game.id)}">${L("Submit the first one.", "提交第一个。")}</a></div>`}
        </div>
      </section>

      ${
        (game.attempts ?? []).length
          ? `<section class="section" id="attempts"><div class="section-head"><div><h2><span class="ico">${UI.footprints}</span>${L("Attempts not on the board", "未上榜的尝试")}</h2>
             <div class="sub">${L(
               "Agent work on this game that hasn't reached a milestone yet, or ran outside this board's rules (isolated fights, other settings). Listed for the record, not ranked.",
               "针对这款游戏的智能体工作：还没达成任何里程碑，或不在本榜规则内（例如只打单场战斗、用了别的设置）。列在这里留作记录，不参与排名。"
             )}</div></div></div>
             <div class="attempts">${game.attempts.map(attemptCard).join("")}</div></section>`
          : ""
      }

      ${
        gameVideos
          ? `<section class="section"><div class="section-head"><div><h2><span class="ico">${UI.film}</span>${L("Watch the runs", "观看运行")}</h2>
             <div class="sub">${L("Plays here. Labels say what each video actually covers.", "在本页播放。标签注明了每个视频实际涵盖的内容。")}</div></div></div>
             <div class="videos">${gameVideos}</div></section>`
          : ""
      }

      <section class="section">
        <div class="section-head"><div><h2><span class="ico">${UI.scroll}</span>${L("The path", "通关之路")}</h2>
        <div class="sub">${L(
          "Milestones in order. Lit nodes have been reached by at least one AI run; the badge shows the strongest evidence for it.",
          "按顺序排列的里程碑。点亮的节点表示至少有一次 AI 运行达成；徽章显示其中最强的证据。"
        )}</div></div>
        <a class="btn small" href="submit/?game=${esc(game.id)}">${L("Submit a run", "提交成绩")}</a></div>
        <ol class="path">${ladder}</ol>
      </section>

      ${
        (game.links ?? []).length
          ? `<section class="section"><div class="section-head"><div><h2>${L("References", "参考资料")}</h2></div></div><div class="links">${game.links.map((l) => link(l.url, `${l.label} ↗`)).join("")}</div></section>`
          : ""
      }
    </div>`;
}

// ---------- chart: progress vs. time spent ----------
// x = the agent's elapsed play time when it reached each milestone (log scale, so minutes and hundreds
// of hours fit together); y = milestones reached. One step line per run in its model vendor's color, a
// dot per milestone, and the model's icon at the run's furthest point. The icon's ring shows evidence.
// Human records are plotted for scale.
const fmtTick = (sec) => (sec < 3600 ? `${Math.round(sec / 60)}m` : `${Math.round(sec / 3600)}h`);
const RING_DASH = { verified: "", video: "", author: "3 2", news: "1 2.2" };
function drawChart(game) {
  const host = app.querySelector("#chart");
  if (!host) return;
  const N = game.milestones.length;
  const order = new Map(game.milestones.map((m, i) => [m.id, i]));
  const series = rankRuns(game, runsFor(game.id)).map((sc) => {
    const reached = sc.run.milestones.filter((r) => order.has(r.id)).sort((a, b) => order.get(a.id) - order.get(b.id));
    // y = milestones done by time t. Runs may take milestones out of list order (e.g. Marsh before Soul),
    // and an untimed milestone counts as done by the earliest timed milestone listed after it.
    const own = reached.map((r) => { const t = parseTime(r.elapsed); return t > 0 ? t : null; });
    const eff = [];
    for (let i = reached.length - 1, later = null; i >= 0; i--) {
      if (own[i] != null) later = later == null ? own[i] : Math.min(later, own[i]);
      eff[i] = own[i] ?? later;
    }
    const pts = [];
    reached
      .map((r, i) => ({ r, t: own[i], pos: i }))
      .filter((p) => p.t != null)
      .sort((a, b) => a.t - b.t || a.pos - b.pos)
      .forEach(({ r, t }) => {
        const p = { t, y: eff.filter((e) => e != null && e <= t).length, ms: game.milestones[order.get(r.id)], approx: !!r.approx };
        if (pts.length && pts[pts.length - 1].t === t) pts[pts.length - 1] = p;
        else pts.push(p);
      });
    return { sc, pts, vendor: vendorOf(sc.run), ev: evidenceOf(sc.run) };
  });
  const plotted = series.filter((s) => s.pts.length);
  const missing = series.filter((s) => !s.pts.length);
  const humans = (game.human_baselines ?? []).map((b) => ({ b, t: parseTime(b.time) })).filter((h) => h.t).sort((a, b) => a.t - b.t);
  const missingNote = missing.length
    ? `<p class="muted chart-note">${L("Not plotted — no time reported: ", "未绘出——没有报告用时：")}${missing.map((s) => esc(s.sc.run.agent)).join(L(", ", "、"))}${L(".", "。")}</p>`
    : "";
  if (!plotted.length && !humans.length) {
    host.innerHTML = `<div class="chart-empty">${L("No AI run has reported how long it took yet.", "还没有 AI 运行报告用时。")}</div>${missingNote}`;
    return;
  }

  const W = Math.max(240, host.clientWidth); // follows its container down to small phones
  const H = W < 560 ? 290 : 360;
  const M = { l: 40, r: W < 560 ? 20 : 170, t: 30, b: 42 };
  const all = [...plotted.flatMap((s) => s.pts.map((p) => p.t)), ...humans.map((h) => h.t)];
  const lo = Math.log10(Math.min(...all) / 2.5), hi = Math.log10(Math.max(...all) * 2.5);
  const X = (t) => M.l + ((Math.log10(t) - lo) / (hi - lo)) * (W - M.l - M.r);
  const Y = (n) => M.t + (1 - n / N) * (H - M.t - M.b);
  const ticks = [60, 600, 3600, 36000, 360000, 3600000].filter((t) => Math.log10(t) >= lo && Math.log10(t) <= hi);
  const yTicks = [...new Set([0, Math.round(N / 2), N])];

  const tipItems = [];
  const hitFor = (cx, cy, item, r = 12) => {
    tipItems.push({ ...item, x: cx, y: cy });
    return `<circle class="hit" data-i="${tipItems.length - 1}" cx="${cx}" cy="${cy}" r="${r}" tabindex="0" aria-label="${esc(item.aria)}"/>`;
  };

  const lines = plotted
    .map((s) => {
      const col = `var(--v-${s.vendor})`;
      let d = `M${X(s.pts[0].t)},${Y(s.pts[0].y)}`;
      for (const p of s.pts.slice(1)) d += `H${X(p.t)}V${Y(p.y)}`;
      const dots = s.pts.slice(0, -1).map((p) => `<circle class="mdot" cx="${X(p.t)}" cy="${Y(p.y)}" r="3.6" fill="${col}"/>`).join("");
      return `<g class="run-line">${s.pts.length > 1 ? `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.2"/>` : ""}${dots}</g>`;
    })
    .join("");
  const pointHits = plotted
    .flatMap((s) =>
      s.pts.map((p) =>
        hitFor(X(p.t), Y(p.y), {
          title: s.sc.run.agent,
          lines: [`${p.ms.name} — ${p.y}/${N}`, L(`${p.approx ? "about " : ""}${fmtDuration(p.t)} of play`, `游玩${p.approx ? "约 " : " "}${fmtDuration(p.t)}`), `${VENDORS[s.vendor].label} · ${EV[s.ev].label}`],
          aria: L(`${s.sc.run.agent}: ${p.ms.name} after ${p.approx ? "about " : ""}${fmtDuration(p.t)}`, `${s.sc.run.agent}：${p.ms.name}，用时${p.approx ? "约 " : " "}${fmtDuration(p.t)}`),
        }, 9)
      )
    )
    .join("");
  // model icon at each run's furthest point; ring = evidence (color + dash pattern)
  const icons = plotted
    .map((s) => {
      const p = s.pts[s.pts.length - 1];
      const cx = X(p.t), cy = Y(p.y), R = 13;
      return `<g class="vmark"><circle cx="${cx}" cy="${cy}" r="${R}" fill="#fff" stroke="${EV[s.ev].color}" stroke-width="2.6" stroke-dasharray="${RING_DASH[s.ev]}"/>
        <image href="${VENDORS[s.vendor].icon}" x="${cx - 8.5}" y="${cy - 8.5}" width="17" height="17"/></g>`;
    })
    .join("");
  const humanMarks = humans
    .map((h) => `<circle class="human-pt" cx="${X(h.t)}" cy="${Y(N)}" r="7"/>` +
      hitFor(X(h.t), Y(N), { title: h.b.label, lines: [h.b.note ?? L("Human reference", "人类参考"), L(`${fmtDuration(h.t)} for the whole game`, `全作用时 ${fmtDuration(h.t)}`)], aria: `${h.b.label}: ${fmtDuration(h.t)}` }))
    .join("");

  // direct labels: each run at its furthest point (short model name; full name is in the tooltip),
  // plus the fastest human record. Try spots around the mark; skip any that hit a label or icon.
  const shortName = (s) => (s.sc.run.method?.models?.length === 1 ? s.sc.run.method.models[0] : s.sc.run.agent);
  const names = plotted.map(shortName);
  const nameOf = (s, i) => (names.filter((n) => n === names[i]).length > 1 ? s.sc.run.agent : names[i]);
  const boxes = plotted.map((s) => { const p = s.pts[s.pts.length - 1]; return { x1: X(p.t) - 14, x2: X(p.t) + 14, y1: Y(p.y) - 14, y2: Y(p.y) + 14 }; });
  if (humans[0]) boxes.push({ x1: X(humans[0].t) - 8, x2: X(humans[0].t) + 8, y1: Y(N) - 8, y2: Y(N) + 8 });
  const hits = (b) => boxes.some((o) => b.x1 < o.x2 && b.x2 > o.x1 && b.y1 < o.y2 && b.y2 > o.y1);
  const placeLabel = (x, y, text, cls = "", r = 17) => {
    const w = text.length * 6.8 + 4;
    const spots = [[x + r, y + 4, "start"], [x - r, y + 4, "end"]];
    for (const dy of [18, -14, 32, -28, 46]) spots.push([x + r - 6, y + dy + 4, "start"], [x - r + 6, y + dy + 4, "end"]);
    const boxOf = ([lx, ly, a]) => { const x1 = a === "start" ? lx : lx - w; return { x1, x2: x1 + w, y1: ly - 12, y2: ly + 3 }; };
    const inside = (b) => b.x1 >= 2 && b.x2 <= W - 2 && b.y1 >= 0 && b.y2 <= Y(0) - 2;
    // no clear spot (narrow screens): leave it to the tooltip and legend rather than overlap
    const spot = spots.find((s) => { const b = boxOf(s); return inside(b) && !hits(b); });
    if (!spot) return "";
    boxes.push(boxOf(spot));
    return `<text class="dlabel ${cls}" x="${spot[0]}" y="${spot[1]}" text-anchor="${spot[2]}">${esc(text)}</text>`;
  };
  const aiLabels = plotted.map((s, i) => { const p = s.pts[s.pts.length - 1]; return placeLabel(X(p.t), Y(p.y), nameOf(s, i)); }).join("");
  const humanLabel = humans[0] ? placeLabel(X(humans[0].t), Y(N), `${W < 560 ? L("Human", "人类") : L("Human record", "人类纪录")} ${fmtDuration(humans[0].t)}`, "human-label", 11) : "";

  const vendorsShown = [...new Set(plotted.map((s) => s.vendor))];
  const ring = (k) => `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="${EV[k].color}" stroke-width="2.2" stroke-dasharray="${RING_DASH[k]}"/></svg>`;
  host.innerHTML = `
    <div class="chart-legend">
      ${vendorsShown.map((v) => `<span><img src="${VENDORS[v].icon}" width="14" height="14" alt=""/><svg viewBox="0 0 16 4" style="width:16px;height:4px"><rect width="16" height="3" rx="1.5" fill="var(--v-${v})"/></svg>${esc(VENDORS[v].label)}</span>`).join("")}
      <span class="sep"></span>
      ${EVIDENCE.map((e) => `<span>${ring(e.key)}${esc(e.label)}</span>`).join("")}
      <span><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="var(--human)" stroke-width="2.2"/></svg>${L("Human record", "人类纪录")}</span>
    </div>
    <svg width="${W}" height="${H}" role="img" aria-label="${esc(L(`Milestones reached against play time on ${game.title}`, `${game.title}：里程碑与游玩时长`))}">
      <g class="grid">${yTicks.map((n) => `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(n)}" y2="${Y(n)}"/>`).join("")}${ticks.map((t) => `<line x1="${X(t)}" x2="${X(t)}" y1="${M.t}" y2="${Y(0)}"/>`).join("")}</g>
      ${yTicks.map((n) => `<text x="${M.l - 10}" y="${Y(n) + 4}" text-anchor="end">${n}</text>`).join("")}
      ${ticks.map((t) => `<text x="${X(t)}" y="${H - 20}" text-anchor="middle">${fmtTick(t)}</text>`).join("")}
      <text x="${(M.l + W - M.r) / 2}" y="${H - 3}" text-anchor="middle" class="axis-title">${L("play time (log scale)", "游玩时长（对数刻度）")}</text>
      <line class="baseline" x1="${M.l}" x2="${W - M.r}" y1="${Y(0)}" y2="${Y(0)}"/>
      <line class="goal" x1="${M.l}" x2="${W - M.r}" y1="${Y(N)}" y2="${Y(N)}"/>
      ${W >= 560 ? `<text class="goal-label" x="${W - M.r + 10}" y="${Y(N) + 4}">${L("CLEARED", "通关")}</text>` : ""}
      ${lines}${humanMarks}${icons}${aiLabels}${humanLabel}${pointHits}
    </svg>
    <div class="tooltip" hidden></div>
    ${!plotted.length ? `<p class="muted chart-note">${L("No AI run has reported how long it took yet — only the human record is shown.", "还没有 AI 运行报告用时——图中只显示人类纪录。")}</p>` : ""}
    ${missingNote}`;

  const tip = host.querySelector(".tooltip");
  const svgTop = () => host.querySelector("svg").getBoundingClientRect().top - host.getBoundingClientRect().top;
  host.querySelectorAll(".hit").forEach((hit) => {
    const it = tipItems[Number(hit.dataset.i)];
    const show = () => {
      tip.innerHTML = `<b>${esc(it.title)}</b>${it.lines.map(esc).join("<br/>")}`;
      tip.hidden = false;
      tip.style.left = `${Math.min(Math.max(it.x, 120), W - 120)}px`;
      tip.style.top = `${it.y + svgTop()}px`;
      tip.classList.toggle("below", it.y < H * 0.45);
    };
    hit.addEventListener("mouseenter", show);
    hit.addEventListener("focus", show);
    hit.addEventListener("mouseleave", () => (tip.hidden = true));
    hit.addEventListener("blur", () => (tip.hidden = true));
  });
}

function bindGame(id) {
  const game = DATA.games.find((g) => g.id === id);
  if (!game) return;
  app.querySelectorAll("[data-track]").forEach((b) =>
    b.addEventListener("click", () => { gameState.track = b.dataset.track; render(); })
  );
  app.querySelector("#minEvidence")?.addEventListener("change", (e) => { gameState.minEvidence = e.target.value; render(); });
  app.querySelectorAll(".row[data-run]").forEach((row) => {
    const toggle = () => {
      const d = app.querySelector(`[data-detail="${CSS.escape(row.dataset.run)}"]`);
      d.hidden = !d.hidden;
      row.setAttribute("aria-expanded", String(!d.hidden));
      if (d.hidden) gameState.open.delete(row.dataset.run);
      else gameState.open.add(row.dataset.run);
    };
    row.addEventListener("click", (e) => { if (!e.target.closest("a,button")) toggle(); });
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  });
  drawChart(game);
}
let resizeTimer;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const id = currentGameId();
    if (id && DATA) drawChart(DATA.games.find((g) => g.id === id));
  }, 150);
});

// ---------- why games (manifesto) ----------
const SLOGAN = () => L(["Clear the game.", "Gamify every task.", "Reach AGI."], ["打通游戏", "把一切任务游戏化", "抵达 AGI"]);
const sloganHtml = () => SLOGAN().map((s, i) => `<span class="slogan-step">${i ? `<i aria-hidden="true">→</i>` : ""}${s}</span>`).join("");

// Each text field is [English, Chinese].
const GAMIFY = [
  { icon: "code", task: ["Software", "软件"], world: ["A codebase and its issue tracker", "代码库和它的 issue 列表"], moves: ["Read, edit, run commands", "阅读、修改、运行命令"], goal: ["The feature ships", "功能上线"], score: ["Tests pass, review approves", "测试通过，评审批准"] },
  { icon: "sigma", task: ["Mathematics", "数学"], world: ["Axioms and known results", "公理和已知结论"], moves: ["Proof steps", "证明步骤"], goal: ["The theorem", "定理"], score: ["A proof checker accepts it", "证明检查器接受证明"] },
  { icon: "flask", task: ["Science", "科学"], world: ["A lab or a simulator", "实验室或模拟器"], moves: ["Design and run experiments", "设计并进行实验"], goal: ["Answer the question", "回答科学问题"], score: ["Results that replicate", "可复现的结果"] },
  { icon: "robot", task: ["Robotics", "机器人"], world: ["A workcell", "一个工作单元"], moves: ["Motor commands", "电机指令"], goal: ["The part is assembled", "零件装配完成"], score: ["Success rate, cycle time", "成功率、节拍时间"] },
  { icon: "coin", task: ["Business", "商业"], world: ["A market", "一个市场"], moves: ["Price, build, sell", "定价、生产、销售"], goal: ["Hit the target", "达成目标"], score: ["Revenue, retention", "营收、留存"] },
];

const BOSSES = [
  { name: ["The Toy Critic", "玩具论者"], quote: ["Games are toys.", "游戏只是玩具。"],
    counter: ["A game is a world built so a newcomer, with no manual, can learn its rules, set goals and get better until they win. That is the exact problem a general learner has to solve. Games are toys the way flight simulators are toys.",
      "游戏是专门打造的世界：让一个没有说明书的新手也能学会规则、定下目标、不断进步直到获胜。这正是通用学习者要解决的问题。说游戏是玩具，就像说飞行模拟器是玩具。"] },
  { name: ["The Old Champion", "昔日冠军"], quote: ["Games are solved. Atari, Go, StarCraft, Dota — done.", "游戏早就被解决了。Atari、围棋、星际争霸、Dota——都赢过了。"],
    counter: ["Those were specialists: one system per game, trained on far more play than any person gets, often reading game state through an API. None could be handed a new game and finish it. No agent has yet picked up a modern 3D game it wasn't built for and played it to the credits from the screen.",
      "那些都是专才：一个游戏一个系统，训练的对局量远超任何人一辈子能玩的，而且常常通过 API 读取游戏状态。它们没有一个能拿到新游戏就打到通关。至今还没有哪个智能体能接手一款并非为它打造的现代 3D 游戏，只看屏幕一路玩到片尾字幕。"] },
  { name: ["The Serious Adult", "正经大人"], quote: ["Real work matters more — code, science, robots.", "真正的工作更重要——写代码、做科研、造机器人。"],
    counter: ["A 60-hour game is a long-horizon task with a clear finish line: see, remember what happened ten hours ago, plan, act in real time, recover from mistakes. A month-long project needs the same skills. An agent that loses the thread halfway through Elden Ring will lose it halfway through your codebase too.",
      "一款 60 小时的游戏就是一个终点清晰的长程任务：看懂画面，记住十小时前发生的事，做计划，实时行动，从失误中恢复。一个为期一个月的项目需要的正是同样的能力。在《艾尔登法环》里半路迷失的智能体，在你的代码库里也会半路迷失。"] },
  { name: ["The Reality Gap", "现实鸿沟"], quote: ["Games aren't the real world.", "游戏不是真实世界。"],
    counter: ["That is what stage two is for. Any task can be written as a game — a world, the moves allowed, a goal and a score — and every training environment for an agent is a game under another name. Clearing a game you have never seen is doing a task you have never seen.",
      "这正是第二阶段要做的事。任何任务都可以写成游戏——一个世界、允许的操作、一个目标和一个分数——而智能体的每个训练环境，本质上都是换了名字的游戏。能通关一款从没见过的游戏，就能完成一项从没见过的任务。"] },
  { name: ["The Skeptic", "怀疑论者"], quote: ["Playing games is a stunt, not a measurement.", "玩游戏只是作秀，不是测量。"],
    counter: ["A game ends in a way anyone can check: the credits roll, or they don't. This board scores story milestones against play time, asks for unedited video and labels every claim by its evidence. Few benchmarks are this hard to fake and this easy to verify.",
      "游戏的结局任何人都能核实：片尾字幕要么出现了，要么没有。这个榜单按剧情里程碑和游玩时长计分，要求提供未剪辑的视频，并给每项成绩标注证据等级。很少有基准像这样既难以造假，又容易核实。"] },
];

function viewWhy() {
  const T = (pair) => L(...pair);
  const modern = DATA.games.filter((g) => g.tier !== "classic");
  const cleared = modern.filter((g) => rankRuns(g, runsFor(g.id))[0]?.cleared).length;
  const started = modern.filter((g) => rankRuns(g, runsFor(g.id))[0]?.n > 0).length;

  // A tidy block of game emblems plus a "propose a game" tile. Columns: whichever of 5, 4, 6, 7 leaves the
  // fewest empty slots in the last row (earlier wins ties), so the block stays a clean rectangle as games are added.
  const shelf =
    DATA.games
      .map((g) => `<a class="cart" href="game/${esc(g.id)}/" style="${themeStyle(g)}" title="${esc(g.title)}" aria-label="${esc(g.title)}">${emblem(g)}</a>`)
      .join("") +
    `<a class="cart add" href="${esc(repoUrl("/issues/new?template=new-game.yml"))}" target="_blank" rel="noopener" title="${L("Propose a game", "推荐游戏")}" aria-label="${L("Propose a game", "推荐游戏")}">+</a>`;
  const tiles = DATA.games.length + 1;
  const shelfCols = [5, 4, 6, 7].reduce((best, c) => ((-tiles % c + c) % c < (-tiles % best + best) % best ? c : best));

  const stages = [
    { n: 1, icon: UI.gamepad, state: "now", status: L("In progress", "进行中"), title: L("Clear the game", "打通游戏"),
      body: L("A modern game is the richest test we can build and still score: real-time perception, control, memory across tens of hours, planning, and a story that only ends if you keep going. An AI that sits down at a game it has never seen and plays it to the end has learned a whole world, not just answered questions about one.",
        "现代游戏是我们能构建、又仍然能打分的最丰富的测试：实时感知、操控、跨越数十小时的记忆、规划，以及一个只有坚持下去才会结束的故事。一个 AI 如果能坐下来玩一款从没见过的游戏，并一路打到结局，它学会的是一整个世界，而不只是回答关于世界的问题。"),
      foot: `<div class="frontier"><div class="label"><span>${L("Modern games cleared by AI", "被 AI 通关的现代游戏")}</span><span>${L(`${cleared} of ${modern.length} · ${started} started`, `${cleared} / ${modern.length} · 已开始 ${started}`)}</span></div>${bar(cleared, modern.length, { lg: true })}</div>` },
    { n: 2, icon: UI.target, state: "locked", status: L("Unlocks next", "下一个解锁"), title: L("Gamify every task", "把一切任务游戏化"),
      body: L("Then turn the problem around. Give any task a world, rules, a goal and a score, and it becomes a game. The better we get at writing tasks as games, the more of the world an agent that clears games can take on.",
        "然后把问题反过来。给任何任务配上世界、规则、目标和分数，它就变成了一个游戏。我们越擅长把任务写成游戏，能通关游戏的智能体就能接手越多的事情。"),
      foot: `<div class="tags">${GAMIFY.map((t) => `<span class="tag">${UI[t.icon]}${esc(T(t.task))}</span>`).join("")}</div>` },
    { n: 3, icon: UI.crown, state: "final", status: L("Final boss", "最终 Boss"), title: L("Reach AGI", "抵达 AGI"),
      body: L("An agent that can clear any game you hand it, in a world where any task can be made into a game, is a general agent. Game-clearing is not a narrow skill beside general intelligence — with every task gamified, it is general intelligence, measured.",
        "在一个任何任务都能变成游戏的世界里，一个能通关你交给它的任何游戏的智能体，就是通用智能体。通关游戏不是通用智能旁边的一项窄技能——当一切任务都被游戏化，它就是可以度量的通用智能。"),
      foot: `<div class="tags"><span class="tag">${UI.star}${L("Any game", "任何游戏")}</span><span class="tag">${UI.star}${L("Any task", "任何任务")}</span><span class="tag">${UI.star}${L("No manual", "无需说明书")}</span></div>` },
  ];

  const field = (icon, label, val) => `<div><dt>${UI[icon]}${label}</dt><dd>${esc(T(val))}</dd></div>`;

  return `
  <section class="why-hero">
    <canvas id="embers" aria-hidden="true"></canvas>
    ${MOUNTAINS}
    <div class="why-hero-inner">
      <div class="why-copy">
        <div class="eyebrow">${L("Manifesto · Player 1", "宣言 · 玩家 1")}</div>
        <h1>${L("Why games", "为何是游戏")}</h1>
        <p class="slogan big">${sloganHtml()}</p>
        <p class="lede">${L("Games are not a side quest on the way to general AI. They are the main quest.", "游戏不是通往通用 AI 路上的支线任务，而是主线任务。")}</p>
      </div>
      <div class="shelf" style="--cols:${shelfCols}" aria-label="${L("Games on the board", "上榜游戏")}">${shelf}</div>
    </div>
  </section>

  <div class="wrap">
    <section class="section">
      <div class="section-head"><div><h2><span class="ico">${UI.scroll}</span>${L("The main quest", "主线任务")}</h2>
      <div class="sub">${L("Three stages. GameMoonshot tracks stage one, in public.", "三个阶段。GameMoonshot 公开追踪第一阶段。")}</div></div></div>
      <ol class="quest">${stages
        .map(
          (s) => `<li class="stage" data-state="${s.state}">
          <div class="stage-top"><span class="stage-ico">${s.icon}</span>
            <span class="stage-n">${L(`Stage ${s.n}`, `第 ${s.n} 阶段`)}</span>
            <span class="stage-status">${s.state === "locked" ? UI.lock : s.state === "final" ? UI.skull : UI.flame}${s.status}</span></div>
          <h3>${s.title}</h3><p>${s.body}</p>${s.foot}</li>`
        )
        .join("")}</ol>
    </section>

    <section class="section">
      <div class="section-head"><div><h2><span class="ico">${UI.gamepad}</span>${L("Every task is a game", "一切任务皆是游戏")}</h2>
      <div class="sub">${L("State the world, the moves, the goal and the score, and a task becomes something an agent can clear.", "说清世界、操作、目标和分数，一项任务就变成了智能体可以通关的东西。")}</div></div></div>
      <div class="carts">${GAMIFY.map(
        (t) => `<article class="taskcart"><header><span class="ico">${UI[t.icon]}</span><h3>${esc(T(t.task))}</h3></header>
        <dl>${field("globe", L("World", "世界"), t.world)}${field("gamepad", L("Moves", "操作"), t.moves)}${field("target", L("Goal", "目标"), t.goal)}${field("trophy", L("Score", "分数"), t.score)}</dl></article>`
      ).join("")}</div>
    </section>

    <section class="section">
      <div class="section-head"><div><h2><span class="ico">${UI.skull}</span>${L("Boss rush", "Boss 车轮战")}</h2>
      <div class="sub">${L("Five arguments that games don't matter, and the counter that brings each one down.", "五种认为游戏无关紧要的论调，以及击倒每一种的反击。")}</div></div></div>
      <div class="bosses">${BOSSES.map(
        (b, i) => `<article class="boss">
          <div class="boss-head"><span class="boss-ico">${UI.skull}</span>
            <div><div class="boss-n">Boss ${i + 1} / ${BOSSES.length}</div><h3>${esc(T(b.name))}</h3></div>
            <span class="defeated">${L("Defeated", "已击败")}</span></div>
          <div class="hp"><span>HP</span><div class="bossbar"><i style="width:0"></i></div><span>0</span></div>
          <blockquote>“${esc(T(b.quote))}”</blockquote>
          <p><b>${UI.sword}${L("Counter", "反击")}</b> ${esc(T(b.counter))}</p>
        </article>`
      ).join("")}
        <a class="boss next" href="${esc(repoUrl("/issues/new"))}" target="_blank" rel="noopener">
          <div class="q" aria-hidden="true">?</div>
          <h3>${L("A new challenger", "新的挑战者")}</h3>
          <p>${L("Have an argument we haven't answered? Open an issue and it joins the boss rush.", "有我们还没回应的论调？开一个 issue，它就会加入车轮战。")}</p>
        </a></div>
    </section>

    <section class="press-start">
      <div class="blink">${L("Press start", "按下 START")}</div>
      <p>${L(
        `Stage one is open. ${cleared ? `${cleared} modern game${cleared === 1 ? "" : "s"} cleared so far.` : "No AI has cleared a modern game yet."} Bring an agent.`,
        `第一阶段已开放。${cleared ? `目前已有 ${cleared} 款现代游戏被通关。` : "还没有 AI 通关现代游戏。"}带上你的智能体来吧。`
      )}</p>
      <div class="hero-actions">
        <a class="btn primary" href="./">${UI.sword} ${L("Choose a game", "选择游戏")}</a>
        <a class="btn" href="submit/">${UI.scroll} ${L("Submit a run", "提交成绩")}</a>
        <a class="btn" href="rules/">${UI.check} ${L("Read the rules", "阅读规则")}</a>
      </div>
    </section>
  </div>`;
}

// ---------- rules ----------
const viewRules = () => (LANG === "zh" ? rulesZh() : rulesEn());
const evidenceList = () =>
  EVIDENCE.map((e) => `<li>${evidenceBadge({ status: e.key === "verified" ? "verified" : "", videos: e.key === "video" ? [1] : [], source_type: e.key })} — ${esc(e.help)}</li>`).join("");

function rulesZh() {
  return `
  <div class="wrap">
    <div class="page-head"><h1>任务规则</h1>
      <p>目的是衡量智能体在真实游戏中能走多远，并且让其他人可以核查。这些规则适用于所有游戏；单个游戏页面可以补充自己的规则。</p></div>
    <article class="prose">
      <h2>与 VideoGameBench 的区别</h2>
      <p>为什么要用游戏？请看<a href="why/">为何是游戏</a>。</p>
      <p><a href="https://arxiv.org/abs/2505.18134" target="_blank" rel="noopener">VideoGameBench</a>（Zhang、Griffiths、Narasimhan 和 Press，2025）是一个受控基准：用同一个智能体框架 VG-Agent 包装每个视觉语言模型，从原始画面出发玩 1990 年代的 Game Boy 和 MS-DOS 游戏（Doom II、Civilization I、Link's Awakening DX、Pokémon Crystal 等），并在固定检查点打分。</p>
      <p>GameMoonshot 问的是另一个问题：<i>任何</i>智能体在人们今天真正在玩的游戏里能走多远？</p>
      <ul>
        <li><b>游戏。</b>主榜单是现代游戏——《艾尔登法环》《赛博朋克 2077》《GTA V》《荒野大镖客：救赎 2》《黑神话：悟空》——有实时战斗、开放世界和需要人类玩 20–100 小时的剧情；另外还有考验其他能力的游戏：大战略（《文明 VI》）、工厂自动化（《异星工厂》）、轨道工程（《坎巴拉太空计划》）和以对话为主的团队 RPG（《博德之门 3》）。复古和 2D 榜单作为更低一级的对照保留；其中几款（Pokémon Red、Pokémon Crystal、Link's Awakening DX）与 VideoGameBench 的游戏重合。</li>
        <li><b>智能体。</b>任何设计都欢迎：自定义框架里的前沿模型、强化学习策略、多智能体团队。运行分为纯像素赛道和工具辅助赛道，必须公开所用工具和任何人工协助，而不是所有人共用一个框架。</li>
        <li><b>计分。</b>按剧情里程碑（Boss、任务、章节）和游玩时长计分，与人类速通纪录并列，每项成绩都标注证据强度。</li>
      </ul>
      <h2>什么算一次运行</h2>
      <ul>
        <li>由 AI 智能体在未修改的正版游戏上进行的一次连续尝试（注明版本）。</li>
        <li><b>部分完成也算数。</b>按达到的里程碑排名；达到最后一个里程碑即为通关。</li>
        <li>一次运行可以跨越多个时段和多个视频（200 小时的宝可梦运行也没问题），但录像必须覆盖整个运行，里程碑之间不能有缺口。</li>
        <li>允许在模型思考时暂停游戏；请在“游戏速度”中注明。</li>
      </ul>
      <h2>赛道</h2>
      <ul>
        <li><b>${esc(TRACK_LABEL.pixels)}</b> — ${esc(TRACK_HELP.pixels)}</li>
        <li><b>${esc(TRACK_LABEL.harness)}</b> — ${esc(TRACK_HELP.harness)}请准确描述；只有工具相当时，两次工具辅助运行才可比较。</li>
      </ul>
      <h2>人工干预</h2>
      <p>运行过程中的任何人为输入——接管操作、针对某个谜题的提示、崩溃后手动重启、清空模型上下文、选择从哪个存档继续——都必须在 <code>human_intervention</code> 中披露。未披露的干预会导致运行被移除。已披露的干预会显示在榜单上，由读者自行判断。</p>
      <h2>必须提供的证据</h2>
      <ul>
        <li><b>视频</b>——完整、未剪辑、公开可看（YouTube、Bilibili、Twitch 回放或公开的文件托管）。可以加速播放，但需注明。</li>
        <li><b>时间戳</b>——每个声称达成的里程碑都要有，并附上到达时的运行用时。</li>
        <li><b>硬件</b>——运行游戏和智能体的机器的 GPU/CPU/内存，以及模型是本地运行还是通过 API 调用。</li>
        <li><b>方法</b>——简要说明、所用模型、智能体观察什么、如何行动。鼓励附上论文和代码链接。</li>
      </ul>
      <h2>证据等级</h2>
      <p>每次运行都只带一个证据标签，由数据推导得出，而不是由提交者自选：</p>
      <ul>${evidenceList()}</ul>
      <p>无论证据如何，运行都按进度排名；在游戏页面用<b>证据</b>筛选器可以缩小榜单范围。作者自己提交的运行必须包含视频，所以起点是“有视频，未核验”，在维护者核对每个里程碑的时间戳后（记录在 <code>verified_by</code> / <code>verified_at</code>）变为“人工核验”。维护者从公开报道整理的结果起点更低；作者可以通过提交录像来提升等级。视频标签还会注明录像覆盖的是完整运行还是其中一部分。</p>
      <h2>人类基准</h2>
      <p>人类一行显示 <a href="https://www.speedrun.com" target="_blank" rel="noopener">speedrun.com</a> 上最接近类别的世界纪录。它们是参照，而不是对手：AI 运行之间相互排名。</p>
    </article>
  </div>`;
}

function rulesEn() {
  return `
  <div class="wrap">
    <div class="page-head"><h1>Mission rules</h1>
      <p>The point is to measure how far agents get through real games, in a way other people can check.
      These rules apply to every game; a game page can add its own.</p></div>
    <article class="prose">
      <h2>How this differs from VideoGameBench</h2>
      <p>Why games at all? See <a href="why/">Why games</a>.</p>
      <p><a href="https://arxiv.org/abs/2505.18134" target="_blank" rel="noopener">VideoGameBench</a> (Zhang, Griffiths, Narasimhan and Press, 2025)
      is a controlled benchmark: one agent harness, VG-Agent, wraps each vision-language model and plays 1990s Game Boy and MS-DOS games
      (Doom II, Civilization I, Link's Awakening DX, Pokémon Crystal and others) from raw frames, scored at fixed checkpoints.</p>
      <p>GameMoonshot asks a different question: how far does <i>any</i> agent get through the games people actually play today?</p>
      <ul>
        <li><b>Games.</b> The main boards are modern titles — Elden Ring, Cyberpunk 2077, GTA V, Red Dead Redemption 2, Black Myth: Wukong —
        with real-time combat, open worlds and stories that take a human 20–100 hours, plus games that test other skills: grand strategy
        (Civilization VI), factory automation (Factorio), orbital engineering (Kerbal Space Program) and a dialogue-heavy party RPG (Baldur's Gate 3). Retro and 2D boards stay as a lower rung for comparison;
        a few of them (Pokémon Red, Pokémon Crystal, Link's Awakening DX) overlap with VideoGameBench's games.</li>
        <li><b>Agents.</b> Any design is welcome: a frontier model in a custom harness, an RL policy, a multi-agent team. Runs are split into a
        pixels-only and a harness track and must disclose their tools and any human help, rather than all sharing one harness.</li>
        <li><b>Scoring.</b> Story milestones (bosses, missions, chapters) against play time, next to human speedrun records,
        with every claim labeled by how well it is evidenced.</li>
      </ul>
      <h2>What counts as a run</h2>
      <ul>
        <li>One continuous attempt by an AI agent on an unmodified official copy of the game (version noted).</li>
        <li><b>Partial runs count.</b> You are ranked by the milestones you reached; reaching the final milestone means the game is cleared.</li>
        <li>A run may span many sessions and videos (a 200-hour Pokémon run is fine), but the footage must cover the whole run with no gaps between milestones.</li>
        <li>Pausing the game while the model thinks is allowed; say so under “game speed”.</li>
      </ul>
      <h2>Tracks</h2>
      <ul>
        <li><b>Pixels-only</b> — ${esc(TRACK_HELP.pixels)}</li>
        <li><b>Harness</b> — ${esc(TRACK_HELP.harness)} Describe it precisely; two harness runs are only comparable if their tools are.</li>
      </ul>
      <h2>Human intervention</h2>
      <p>Any human input during the run — taking over controls, hints for a specific puzzle, manual restarts after a crash,
      clearing the model's context, choosing which save to continue from — must be disclosed in <code>human_intervention</code>.
      Undisclosed intervention gets a run removed. Disclosed intervention is shown on the board so readers can judge.</p>
      <h2>Evidence you must provide</h2>
      <ul>
        <li><b>Video</b> — full, unedited, publicly viewable (YouTube, Bilibili, Twitch VOD, or a public file host). Speed-ups are fine if labeled.</li>
        <li><b>Timestamps</b> for every milestone claimed, plus the elapsed run time at that point.</li>
        <li><b>Hardware</b> — GPU/CPU/RAM of the machine running the game and the agent, and whether models ran locally or via API.</li>
        <li><b>Method</b> — a short description, model(s), what the agent observes, how it acts. Paper and code links are encouraged.</li>
      </ul>
      <h2>Evidence levels</h2>
      <p>Every run carries exactly one evidence badge, derived from the data rather than chosen by the submitter:</p>
      <ul>${evidenceList()}</ul>
      <p>Runs are ranked by progress regardless of evidence; use the <b>Evidence</b> filter on a game page to narrow the board.
      Author submissions must include video, so they start at “Video, unverified” and become “Human-verified” once a maintainer
      has checked each milestone timestamp (recorded as <code>verified_by</code> / <code>verified_at</code>). Results collected by maintainers
      from public reports start lower; their authors can upgrade them by submitting footage. A video badge also says whether the
      footage covers the full run or only part of it.</p>
      <h2>Human baselines</h2>
      <p>Human rows show <a href="https://www.speedrun.com" target="_blank" rel="noopener">speedrun.com</a> world records for the closest category.
      They are context, not opponents: AI runs are ranked against each other.</p>
    </article>
  </div>`;
}

// ---------- submit form (generates the JSON file for a PR / issue) ----------
function viewSubmit(params) {
  const gameId = params.get("game") ?? DATA.games[0]?.id;
  const game = DATA.games.find((g) => g.id === gameId) ?? DATA.games[0];
  const opts = DATA.games.map((g) => `<option value="${esc(g.id)}" ${g.id === game.id ? "selected" : ""}>${esc(g.title)}</option>`).join("");
  const msRows = game.milestones
    .map(
      (m) => `
      <div class="ms-row" data-ms="${esc(m.id)}">
        <input type="checkbox" aria-label="${esc(L(`${m.name} reached`, `已达成 ${m.name}`))}" />
        <span>${esc(m.name)}${m.final ? L(" — clear", " — 通关") : ""}</span>
        <input placeholder="H:MM:SS" data-f="elapsed" aria-label="${L("elapsed run time", "运行用时")}" />
        <input placeholder="H:MM:SS" data-f="timestamp" aria-label="${L("video timestamp", "视频时间戳")}" />
        <input placeholder="0" data-f="video" inputmode="numeric" aria-label="${L("video index", "视频编号")}" />
      </div>`
    )
    .join("");

  const eg = (en, zh) => L(`e.g. ${en}`, `例如 ${zh}`);
  return `
  <div class="wrap">
    <div class="page-head"><h1>${L("Submit a run", "提交成绩")}</h1>
      <p>${L(
        `Fill this in, then open a GitHub issue with the generated JSON (maintainers turn it into a PR), or add it yourself as
        <code>data/submissions/&lt;game&gt;/&lt;id&gt;.json</code> and run <code>npm run build</code>. Read the <a href="rules/">rules</a> first.`,
        `填写下表，然后用生成的 JSON 开一个 GitHub issue（维护者会把它转成 PR），或者自己把它加到
        <code>data/submissions/&lt;game&gt;/&lt;id&gt;.json</code> 并运行 <code>npm run build</code>。请先阅读<a href="rules/">规则</a>。`
      )}</p></div>
    <form class="submit" id="submitForm" novalidate>
      <fieldset>
        <legend>${L("Run", "运行")}</legend>
        <div class="fields">
          <label>${L("Game", "游戏")}<select name="game">${opts}</select></label>
          <label>${L("Agent name", "智能体名称")}<input name="agent" placeholder="${eg("Cradle", "Cradle")}" required /></label>
          <label>${L("Team / author", "团队 / 作者")}<input name="team" placeholder="${eg("your lab or handle", "你的实验室或用户名")}" required /></label>
          <label>${L("Track", "赛道")}<select name="track"><option value="pixels">${TRACK_LABEL.pixels}</option><option value="harness">${TRACK_LABEL.harness}</option></select>
            <span class="hint">${L("Pixels-only = frames in, keyboard/mouse/pad out. Anything else = Harness.", "纯像素 = 输入画面，输出键盘/鼠标/手柄操作。其他情况都算工具辅助。")}</span></label>
          <label>${L("Game version / patch", "游戏版本 / 补丁")}<input name="game_version" placeholder="${eg("Steam build 1.0.1491.50", "Steam build 1.0.1491.50")}" /></label>
          <label>${L("Wall-clock duration", "实际耗时")}<input name="wall_clock" placeholder="${eg("3 days, 41 hours of compute", "3 天，41 小时计算时间")}" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>${L("Videos", "视频")}</legend>
        <label>${L("Video links, one per line (numbered 0, 1, 2…)", "视频链接，每行一个（编号 0、1、2……）")}<textarea name="videos" placeholder="https://www.youtube.com/watch?v=...&#10;https://www.bilibili.com/video/BV..."></textarea>
          <span class="hint">${L("Full, unedited, public. Multi-part runs: list parts in order and use the number in the milestone table.", "完整、未剪辑、公开。分段的运行：按顺序列出各段，并在里程碑表中填写对应编号。")}</span></label>
        <label style="margin-top:12px;display:flex;gap:10px;align-items:center;grid-auto-flow:column;justify-content:start"><input type="checkbox" name="full" checked style="width:auto;accent-color:var(--gold)" /> ${L("These videos together cover the whole run", "这些视频合起来覆盖了整个运行")}</label>
      </fieldset>
      <fieldset>
        <legend>${L("Milestones reached", "已达成的里程碑")}</legend>
        <div class="ms-table">
          <div class="ms-row head"><span></span><span>${L("Milestone", "里程碑")}</span><span>${L("Elapsed run time", "运行用时")}</span><span>${L("Video timestamp", "视频时间戳")}</span><span>${L("Video #", "视频编号")}</span></div>
          ${msRows}
        </div>
      </fieldset>
      <fieldset>
        <legend>${L("Method", "方法")}</legend>
        <div class="fields">
          <label>${L("Models used", "所用模型")}<input name="models" placeholder="${eg("GPT-4o, Claude Opus 4.5 (comma-separated)", "GPT-4o, Claude Opus 4.5（用逗号分隔）")}" /></label>
          <label>${L("Observation", "观察")}<input name="observation" placeholder="${eg("screenshots every 2s at 1280×720", "每 2 秒截图一次，1280×720")}" /></label>
          <label>${L("Action", "动作")}<input name="action" placeholder="${eg("keyboard + mouse via pyautogui", "通过 pyautogui 操作键盘和鼠标")}" /></label>
          <label>${L("Game speed", "游戏速度")}<input name="game_speed" placeholder="${eg("real-time / paused while thinking", "实时 / 思考时暂停")}" /></label>
          <label>${L("Human intervention", "人工干预")}<input name="human_intervention" value="none" /><span class="hint">${L("Anything a human did during the run. “none” if nothing.", "运行中人做过的任何事。没有就填 “none”。")}</span></label>
          <label>${L("Restarts / reloads", "重开 / 读档")}<input name="restarts" placeholder="${eg("agent reloads last checkpoint on death", "死亡后智能体读取上一个检查点")}" /></label>
          <label>${L("Paper URL", "论文链接")}<input name="paper" type="url" /></label>
          <label>${L("Code URL", "代码链接")}<input name="code" type="url" /></label>
        </div>
        <label style="margin-top:14px">${L("Summary", "概述")}<textarea name="summary" placeholder="${L("How the agent works: planning, memory, skills, reflection, any game-specific prompting…", "智能体如何工作：规划、记忆、技能、反思、针对这款游戏的提示……")}"></textarea></label>
      </fieldset>
      <fieldset>
        <legend>${L("Hardware", "硬件")}</legend>
        <div class="fields">
          <label>GPU<input name="gpu" placeholder="${eg("1× RTX 4090 24GB", "1× RTX 4090 24GB")}" /></label>
          <label>CPU<input name="cpu" placeholder="${eg("Ryzen 9 7950X", "Ryzen 9 7950X")}" /></label>
          <label>${L("RAM (GB)", "内存（GB）")}<input name="ram_gb" inputmode="numeric" /></label>
          <label>${L("OS", "操作系统")}<input name="os" placeholder="${eg("Windows 11", "Windows 11")}" /></label>
          <label>${L("Inference", "推理")}<input name="inference" placeholder="${eg("OpenAI API / local vLLM on 2× H100", "OpenAI API / 在 2× H100 上本地运行 vLLM")}" /></label>
          <label>${L("Approx. cost", "大致成本")}<input name="cost" placeholder="${eg("~$350 API spend", "约 350 美元 API 费用")}" /></label>
        </div>
        <label style="margin-top:14px">${L("Notes", "备注")}<textarea name="notes"></textarea></label>
      </fieldset>
      <div class="actions">
        <button class="btn primary" type="submit">${UI.scroll} ${L("Generate submission", "生成提交内容")}</button>
        <span class="muted" style="font-size:13px">${L("Nothing is sent anywhere until you open the issue.", "在你打开 issue 之前，不会发送任何内容。")}</span>
      </div>
      <ul class="errors" id="formErrors"></ul>
      <div id="output" hidden>
        <pre class="out" id="json"></pre>
        <div class="actions">
          <button class="btn" type="button" id="copy">${L("Copy JSON", "复制 JSON")}</button>
          <a class="btn primary" id="issue" target="_blank" rel="noopener">${UI.external} ${L("Open GitHub issue", "打开 GitHub issue")}</a>
          <span class="muted" id="pathHint" style="font-size:13px"></span>
        </div>
      </div>
    </form>
  </div>`;
}

const slug = (s) =>
  String(s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function bindSubmit() {
  const form = app.querySelector("#submitForm");
  form.game.addEventListener("change", () => navigate(`submit/?game=${encodeURIComponent(form.game.value)}`, { replace: true }));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form).entries());
    const errs = [];
    const videos = String(f.videos ?? "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (!f.agent?.trim()) errs.push(L("Agent name is required.", "请填写智能体名称。"));
    if (!f.team?.trim()) errs.push(L("Team / author is required.", "请填写团队 / 作者。"));
    if (!videos.length) errs.push(L("At least one video link is required.", "至少需要一个视频链接。"));
    videos.forEach((v) => !safeUrl(v) && errs.push(L(`Not an http(s) URL: ${v}`, `不是 http(s) 链接：${v}`)));

    const milestones = [];
    form.querySelectorAll(".ms-row[data-ms]").forEach((row) => {
      if (!row.querySelector('input[type="checkbox"]').checked) return;
      const get = (k) => row.querySelector(`[data-f="${k}"]`).value.trim();
      const entry = { id: row.dataset.ms };
      const el = get("elapsed"), ts = get("timestamp"), vi = get("video");
      if (el) {
        if (parseTime(el) == null) errs.push(L(`${row.dataset.ms}: elapsed must be H:MM:SS`, `${row.dataset.ms}：运行用时须为 H:MM:SS`));
        entry.elapsed = el;
      }
      if (ts) {
        if (parseTime(ts) == null) errs.push(L(`${row.dataset.ms}: timestamp must be H:MM:SS`, `${row.dataset.ms}：时间戳须为 H:MM:SS`));
        entry.timestamp = ts;
      } else errs.push(L(`${row.dataset.ms}: a video timestamp is needed for verification`, `${row.dataset.ms}：核验需要视频时间戳`));
      const idx = vi === "" ? 0 : Number(vi);
      if (!Number.isInteger(idx) || idx < 0 || idx >= Math.max(videos.length, 1)) errs.push(L(`${row.dataset.ms}: video # must be 0–${Math.max(videos.length - 1, 0)}`, `${row.dataset.ms}：视频编号须为 0–${Math.max(videos.length - 1, 0)}`));
      entry.video = idx;
      milestones.push(entry);
    });
    if (!milestones.length) errs.push(L("Tick at least one milestone you reached.", "请至少勾选一个已达成的里程碑。"));
    if (!f.summary?.trim()) errs.push(L("Method summary is required.", "请填写方法概述。"));
    if (!f.models?.trim()) errs.push(L("List the model(s) used.", "请列出所用模型。"));
    if (!f.observation?.trim() || !f.action?.trim()) errs.push(L("Describe observation and action space.", "请描述观察空间和动作空间。"));
    if (!f.gpu?.trim() && !f.cpu?.trim()) errs.push(L("Give at least GPU or CPU.", "请至少填写 GPU 或 CPU。"));
    if (!f.inference?.trim()) errs.push(L("Say where inference ran (API / local).", "请说明推理在哪里运行（API / 本地）。"));

    app.querySelector("#formErrors").innerHTML = errs.map((x) => `<li>${esc(x)}</li>`).join("");
    if (errs.length) { app.querySelector("#output").hidden = true; return; }

    const today = new Date().toISOString().slice(0, 10);
    const id = `${today}-${slug(f.team)}-${slug(f.agent)}`.replace(/-+/g, "-");
    const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v != null));
    const sub = clean({
      id, game: f.game, agent: f.agent.trim(), team: f.team.trim(), track: f.track, status: "pending", submitted_at: today,
      game_version: f.game_version?.trim(),
      videos: videos.map((url, i) => clean({ url, label: videos.length > 1 ? `Part ${i + 1}` : "Full run", full: f.full ? true : undefined })),
      milestones,
      method: clean({
        summary: f.summary.trim(), models: f.models.split(/[,，、]/).map((s) => s.trim()).filter(Boolean),
        observation: f.observation.trim(), action: f.action.trim(), game_speed: f.game_speed?.trim(),
        human_intervention: f.human_intervention?.trim() || "none", restarts: f.restarts?.trim(), paper: f.paper?.trim(), code: f.code?.trim(),
      }),
      hardware: clean({ gpu: f.gpu?.trim(), cpu: f.cpu?.trim(), ram_gb: f.ram_gb ? Number(f.ram_gb) : undefined, os: f.os?.trim(), inference: f.inference.trim() }),
      wall_clock: f.wall_clock?.trim(), cost: f.cost?.trim(), notes: f.notes?.trim(),
    });
    const json = JSON.stringify(sub, null, 2);
    app.querySelector("#json").textContent = json;
    app.querySelector("#output").hidden = false;
    app.querySelector("#pathHint").textContent = `${L("PR path", "PR 路径")}: data/submissions/${f.game}/${id}.json`;
    const gameTitle = DATA.games.find((g) => g.id === f.game)?.title ?? f.game;
    const issue = new URL(repoUrl("/issues/new"));
    issue.searchParams.set("title", `[Run] ${gameTitle} — ${sub.agent} (${sub.team})`);
    issue.searchParams.set("labels", "submission");
    issue.searchParams.set("body", `Submission generated on the GameMoonshot site.\n\n\`\`\`json\n${json}\n\`\`\`\n`);
    app.querySelector("#issue").href = issue.toString();
    app.querySelector("#copy").onclick = async () => {
      try { await navigator.clipboard.writeText(json); app.querySelector("#copy").textContent = L("Copied", "已复制"); }
      catch { app.querySelector("#copy").textContent = L("Copy failed — select the text", "复制失败——请手动选中文本"); }
    };
  });
}

// ---------- router ----------
// Every page has a real URL: ./, why/, rules/, submit/ and game/<id>/. scripts/build.mjs writes a copy of
// index.html into each of those folders (with a <base> pointing back at the site root), so a page loads
// directly, and links between pages are handled here with the History API instead of reloading.
const SITE_ROOT = new URL(".", document.baseURI); // the site root, wherever the site is hosted
// Pin <base> to that root as an absolute URL. A relative <base> (the page copies' "../") or none at all (the
// root page) is re-resolved against the address bar after pushState, which would send links and data.json
// fetches to the wrong folder.
(document.querySelector("base") ?? document.head.appendChild(document.createElement("base"))).href = SITE_ROOT.href;
const PAGE_RE = /^(?:index\.html|why\/|rules\/|submit\/|game\/[^/]+\/)?$/;

// Path of a URL relative to the site root ("" for home, "game/rdr2/" for a game), or null if outside it.
function routeOf(url) {
  return url.origin === SITE_ROOT.origin && url.pathname.startsWith(SITE_ROOT.pathname)
    ? url.pathname.slice(SITE_ROOT.pathname.length)
    : null;
}
function currentGameId() {
  const m = /^game\/([^/]+)\//.exec(routeOf(location) ?? "");
  return m ? decodeURIComponent(m[1]) : null;
}

function render() {
  const parts = (routeOf(location) ?? "").split("/").filter(Boolean);
  const params = new URLSearchParams(location.search);
  let html, bind, nav;
  if (parts[0] === "game" && parts[1]) {
    const id = decodeURIComponent(parts[1]);
    html = viewGame(id);
    bind = () => bindGame(id);
    nav = "home";
    document.title = `${DATA.games.find((g) => g.id === id)?.title ?? L("Game", "游戏")} · GameMoonshot`;
  } else if (parts[0] === "why") {
    html = viewWhy(); bind = startEmbers; nav = "why"; document.title = `${L("Why games", "为何是游戏")} · GameMoonshot`;
  } else if (parts[0] === "rules") {
    html = viewRules(); nav = "rules"; document.title = `${L("Rules", "规则")} · GameMoonshot`;
  } else if (parts[0] === "submit") {
    html = viewSubmit(params); bind = bindSubmit; nav = "submit"; document.title = `${L("Submit a run", "提交成绩")} · GameMoonshot`;
  } else {
    html = viewHome(); bind = startEmbers; nav = "home"; document.title = "GameMoonshot";
  }
  applySkin(parts[0] === "game" ? DATA.games.find((g) => g.id === decodeURIComponent(parts[1] ?? "")) : null);
  app.innerHTML = html;
  bind?.();
  if (location.hash.length > 1) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === nav));
}

let lastPath = null, lastSearch = null;
// Called after the URL changes (link click, back/forward). A new page resets per-page state and scrolls to
// the top; a change of query on the same page (e.g. the submit form's game picker) just re-renders.
function onRoute() {
  if (location.pathname !== lastPath) {
    Object.assign(gameState, { track: "all", minEvidence: "news", open: new Set() });
    closePlayer();
    if (!location.hash) window.scrollTo(0, 0);
  }
  lastPath = location.pathname;
  lastSearch = location.search;
  render();
}
function navigate(href, { replace = false } = {}) {
  history[replace ? "replaceState" : "pushState"](null, "", new URL(href, SITE_ROOT));
  onRoute();
}

document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest("a[href]");
  if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
  const url = new URL(a.href);
  const route = routeOf(url);
  if (route == null || !PAGE_RE.test(route)) return; // files (data.json, assets) and other sites
  // An in-page anchor on the current page (e.g. "Choose a game" -> #games): let the browser scroll.
  if (url.hash && url.pathname === location.pathname && url.search === location.search) return;
  e.preventDefault();
  if (url.href !== location.href) navigate(url.href);
});
window.addEventListener("popstate", () => {
  // Back/forward between anchors on one page: the browser scrolls, nothing to re-render.
  if (location.pathname === lastPath && location.search === lastSearch) return;
  onRoute();
});

// Links from before pages had their own URLs looked like #/game/rdr2 or #/submit?game=rdr2.
// Send them to the matching page, keeping the address bar clean.
if (location.hash.startsWith("#/")) {
  const [p, q] = location.hash.slice(2).split("?");
  const path = p.replace(/\/+$/, "");
  history.replaceState(null, "", new URL(`${path ? `${path}/` : ""}${q ? `?${q}` : ""}`, SITE_ROOT));
}

syncLang();
load()
  .then(() => { lastPath = location.pathname; lastSearch = location.search; render(); })
  .catch((e) => {
    app.innerHTML = `<div class="wrap"><div class="empty" style="margin-top:48px">${L("Could not load leaderboard data", "无法加载榜单数据")}: ${esc(e.message)}<br/>${L("Run <code>npm run dev</code> to build data.json and preview locally.", "运行 <code>npm run dev</code> 构建 data.json 并在本地预览。")}</div></div>`;
  });
