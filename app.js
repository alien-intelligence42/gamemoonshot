// GameMoonshot — static, dependency-free leaderboard.
// Data comes from data.json, which scripts/build.mjs assembles from data/.
import { EMBLEMS, UI, MOUNTAINS } from "./icons.js";

const CFG = window.MOONSHOT_CONFIG ?? { repo: "your-org/gamemoonshot", branch: "main" };
const app = document.getElementById("app");
const player = document.getElementById("player");

// ---------- vocab ----------
const TRACK_LABEL = { pixels: "Pixels-only", harness: "Harness" };
const TRACK_HELP = {
  pixels: "Sees only rendered frames (+ optional audio), acts only through keyboard / mouse / controller input.",
  harness: "May read game memory or APIs, use custom tools (pathfinding, maps, save states for analysis), or a game-specific scaffold.",
};

// Evidence level, strongest first. Derived from the data (see evidenceOf), never typed by hand,
// so a run cannot claim "verified" without a maintainer flipping its status.
// Colors are validated for color-vision-deficiency separation; shapes are the secondary encoding.
const EVIDENCE = [
  { key: "verified", label: "Human-verified", shape: "diamond", help: "A maintainer watched the footage and checked every claimed milestone." },
  { key: "video", label: "Video, unverified", shape: "circle", help: "Public footage of the run is linked, but no maintainer has checked it yet." },
  { key: "author", label: "Author report", shape: "square", help: "Only a paper, blog or post by the people who ran the agent; no video of the run." },
  { key: "news", label: "News only", shape: "triangle", help: "Only third-party press or write-ups; no first-party report or video found." },
];
const EV = Object.fromEntries(EVIDENCE.map((e, i) => [e.key, { ...e, rank: i, color: `var(--ev-${e.key})` }]));
function evidenceOf(run) {
  if (run.status === "verified") return "verified";
  if ((run.videos ?? []).length) return "video";
  if (run.source_type === "author") return "author";
  return "news";
}
const footageNote = (run) =>
  evidenceOf(run) === "video" ? ((run.videos ?? []).some((v) => v.full) ? "full run on video" : "partial footage only") : "";

// Per-game skins (see skins.css); family groups shared rules. Every skin has a light and a dark variant,
// chosen by the site-wide color scheme (body[data-tone]), which also picks the evidence palette.
const SKINS = {
  "gb-dmg": { family: "pixel" }, "gb-crystal": { family: "pixel" }, "gba-emerald": { family: "pixel" }, "gb-adventure": { family: "pixel" },
  blocky: { family: "blocky" }, western: { family: "western" }, shinobi: { family: "shinobi" }, wukong: { family: "wukong" },
  platformer: { family: "platformer" }, terminal: { family: "terminal" }, spire: { family: "spire" },
  erdtree: { family: "erdtree" }, sunset: { family: "sunset" }, neon: { family: "neon" }, tactical: { family: "tactical" },
  factory: { family: "factory" }, orbital: { family: "orbital" }, atlas: { family: "atlas" }, tome: { family: "tome" },
};
const THEME_KEY = "moonshot-theme";
let THEME = document.body.dataset.tone === "light" ? "light" : "dark";
function syncTheme() {
  document.body.dataset.tone = THEME;
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.innerHTML = THEME === "dark" ? UI.sun : UI.moon;
    btn.setAttribute("aria-label", THEME === "dark" ? "Switch to light scheme" : "Switch to dark scheme");
    btn.title = btn.getAttribute("aria-label");
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getComputedStyle(document.body).getPropertyValue("--bg").trim() || "#0c0a08");
}
document.getElementById("themeToggle")?.addEventListener("click", () => {
  THEME = THEME === "dark" ? "light" : "dark";
  try { localStorage.setItem(THEME_KEY, THEME); } catch {}
  syncTheme();
  const m = location.hash.match(/^#\/game\/([^?]+)/);
  if (m && DATA) drawChart(DATA.games.find((g) => g.id === decodeURIComponent(m[1])));
});
function applySkin(game) {
  const b = document.body.dataset;
  const sk = game && SKINS[game.skin];
  if (sk) Object.assign(b, { skin: game.skin, family: sk.family });
  else { delete b.skin; delete b.family; }
  syncTheme();
}
// Progress bar. data-level lets skins color it like a health bar.
function bar(n, total, { cleared = false, human = false, lg = false } = {}) {
  const pct = total ? (n / total) * 100 : 0;
  const level = cleared || human ? "full" : pct >= 50 ? "high" : pct >= 20 ? "mid" : "low";
  const cls = ["bossbar", cleared ? "cleared" : "", human ? "human" : "", lg ? "lg" : ""].filter(Boolean).join(" ");
  return `<div class="bar-row"><div class="${cls}" data-level="${level}" role="img" aria-label="${n} of ${total} milestones"><i style="width:calc(${pct}% - 2px)"></i></div><span class="num">${n}/${total}</span></div>`;
}

// Model vendor, for icons and chart line colors. Derived from the run's models unless "vendor" is set.
const VENDORS = {
  claude: { label: "Claude", icon: "assets/models/claude.svg" },
  gemini: { label: "Gemini", icon: "assets/models/gemini.svg" },
  openai: { label: "GPT", icon: "assets/models/openai.svg" },
  other: { label: "Other", icon: "assets/models/other.svg" },
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
          <a class="btn small" href="${esc(videoAt(item.url, item.ts))}" target="_blank" rel="noopener noreferrer">${UI.external} Open on ${esc(v.platform)}</a>
          <button class="icon-btn" type="button" data-close aria-label="Close video">${UI.close}</button>
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
  const id = regVideo({ url: v.url, title: `${run.agent} — ${v.label ?? "Video"}`, sub: v.covers ?? "" });
  return `
    <button class="vcard" type="button" data-play="${id}" aria-label="Play: ${esc(run.agent)} — ${esc(v.label ?? "video")}">
      <div class="thumb" style="${themeStyle(game)}">
        ${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : `<div class="emblem">${emblem(game)}</div>`}
        <span class="play">${UI.play}</span>
        <span class="platform">${esc(parseVideo(v.url)?.platform ?? "Video")}</span>
      </div>
      <div>
        <div class="vg">${esc(game.title)}</div>
        <div class="vt">${esc(run.agent)} · ${esc(v.label ?? `Video ${idx + 1}`)}</div>
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
  const gen = document.getElementById("generated");
  if (gen && DATA.updated) gen.textContent = `Latest entry ${DATA.updated}`;
}
const runsFor = (gameId) => DATA.submissions.filter((s) => s.game === gameId && s.status !== "rejected");

// ---------- home ----------
function viewHome() {
  const all = DATA.submissions.filter((s) => s.status !== "rejected");
  const clearedGames = DATA.games.filter((g) => rankRuns(g, runsFor(g.id))[0]?.cleared).length;
  const videoCount = all.reduce((n, s) => n + (s.videos?.length ?? 0), 0);
  const verified = all.filter((s) => s.status === "verified").length;

  const card = (g) => {
      const ranked = rankRuns(g, runsFor(g.id));
      const best = ranked[0];
      const vids = ranked.reduce((n, sc) => n + (sc.run.videos?.length ?? 0), 0);
      return `
      <a class="card" href="#/game/${esc(g.id)}" style="${themeStyle(g)}" data-skin="${esc(g.skin ?? "")}">
        <div class="keyart">
          <span class="year">${esc(g.release_year ?? "")}</span>
          <div class="emblem">${emblem(g)}</div>
          ${MOUNTAINS}
        </div>
        <div class="body">
          <div>
            <h3>${esc(g.title)}</h3>
            <div class="meta">${esc([g.platform, g.genre].filter(Boolean).join(" · "))}</div>
          </div>
          <div class="best">
            ${bar(best ? best.n : 0, g.milestones.length, { cleared: best?.cleared })}
            <div>${
              best
                ? `Best AI: <b>${esc(best.run.agent)}</b> — ${best.cleared ? "cleared the game" : best.furthest ? `reached ${esc(best.furthest.name)}` : "no milestone yet"}`
                : `<span class="muted">No AI run yet — the board is open.</span>`
            }</div>
            <div class="foot">
              ${best ? evidenceBadge(best.run) : ""}
              <span class="tag">${ranked.length} run${ranked.length === 1 ? "" : "s"}</span>
              ${vids ? `<span class="tag">▶ ${vids} video${vids === 1 ? "" : "s"}</span>` : ""}
            </div>
          </div>
        </div>
      </a>`;
  };
  const modern = DATA.games.filter((g) => g.tier === "modern").map(card).join("");
  const classic = DATA.games.filter((g) => g.tier !== "modern").map(card).join("");

  VIDEO_REG = [];
  const footage = DATA.games
    .flatMap((g) => runsFor(g.id).flatMap((r) => (r.videos ?? []).map((v, i) => ({ g, r, v, i }))))
    .sort((a, b) => String(b.r.submitted_at).localeCompare(String(a.r.submitted_at)))
    .slice(0, 6);

  return `
    <section class="hero">
      <canvas id="embers" aria-hidden="true"></canvas>
      <div class="hero-inner">
        <div class="eyebrow">This era's moonshot · AI agents · real games</div>
        <h1>Can your agent<br/>finish the game?</h1>
        <a class="slogan" href="#/why">${SLOGAN_HTML}<span class="slogan-more">Why games →</span></a>
        <p class="lede">Finishing a modern game end to end — seeing, planning and acting in real time across a story that takes a person
        30 to 100 hours — is this era's moonshot for AI. GameMoonshot tracks how close agents get on Elden Ring, Cyberpunk 2077, GTA V,
        Red Dead Redemption 2, Black Myth: Wukong and more. Each game is split into milestones (bosses, missions, chapters);
        every claim shows how well it is evidenced, and every board shows where human players stand.</p>
        <div class="hero-actions">
          <a class="btn primary" href="#games">${UI.sword} Choose a game</a>
          <a class="btn" href="#/submit">${UI.scroll} Submit a run</a>
        </div>
      </div>
      ${MOUNTAINS}
    </section>
    <div class="stats"><div class="stats-inner">
      <div class="stat"><b>${DATA.games.length}</b><span>Games on the board</span></div>
      <div class="stat"><b>${all.length}</b><span>AI runs recorded</span></div>
      <div class="stat"><b>${clearedGames}</b><span>Games cleared by AI</span></div>
      <div class="stat"><b>${videoCount}</b><span>Videos linked</span></div>
      <div class="stat"><b>${verified}</b><span>Human-verified runs</span></div>
    </div></div>

    <div class="wrap">
      <section class="section" id="games">
        <div class="section-head">
          <div><h2><span class="ico">${UI.sword}</span>The moonshots</h2>
          <div class="sub">Modern 3D games: real-time combat, open worlds, stories that take a human 20–100 hours. No AI has finished one yet. Partial runs count — every milestone reached is on the board.</div></div>
          <a class="btn small" href="${esc(repoUrl("/issues/new?template=new-game.yml"))}" target="_blank" rel="noopener">Propose a game</a>
        </div>
        <div class="grid">${modern}</div>
      </section>

      <section class="section" id="classics">
        <div class="section-head">
          <div><h2><span class="ico">${UI.scroll}</span>Test flights</h2>
          <div class="sub">Retro, 2D and turn-based games — the kind existing benchmarks use (<a href="https://www.vgbench.com/" target="_blank" rel="noopener">VideoGameBench</a> runs one fixed harness on 1990s Game Boy and MS-DOS games). Kept here as test flights for comparison; <a href="#/rules">how GameMoonshot differs</a>.</div></div>
        </div>
        <div class="grid compact">${classic}</div>
      </section>

      ${
        footage.length
          ? `<section class="section">
        <div class="section-head"><div><h2><span class="ico">${UI.film}</span>Latest footage</h2>
        <div class="sub">Click to watch here. Most of this is stream archives and excerpts, not full verified runs — check each run's evidence badge.</div></div></div>
        <div class="videos">${footage.map(({ g, r, v, i }) => videoCard(g, r, v, i)).join("")}</div>
      </section>`
          : ""
      }

      <section class="section">
        <div class="section-head"><div><h2><span class="ico">${UI.scroll}</span>How it works</h2></div></div>
        <div class="steps">
          <div class="step"><div class="n">01</div><h3>Pick a game</h3><p>Each game has an ordered list of milestones ending in the clear condition.</p></div>
          <div class="step"><div class="n">02</div><h3>Record the run</h3><p>Upload the full, unedited run. Partial runs count.</p></div>
          <div class="step"><div class="n">03</div><h3>Submit</h3><p>Video link and timestamps, hardware, models, and how the agent sees and acts.</p></div>
          <div class="step"><div class="n">04</div><h3>Get verified</h3><p>A maintainer watches the footage. Every run carries its evidence level.</p></div>
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

function humanRow(game, b) {
  return `
    <div class="row human" role="listitem">
      <div class="c-rank"><span class="medal h" title="Human reference">${UI.user.replace("<svg", '<svg width="18" height="18"')}</span></div>
      <div class="c-who who"><b>${esc(b.label)}</b><span>${esc(b.note ?? "Human reference")}</span></div>
      <div class="c-chev"></div>
      <div class="c-prog prog">${bar(game.milestones.length, game.milestones.length, { human: true })}</div>
      <div class="c-meta">
        <div class="c-track"><span class="badge human">Human</span></div>
        <div class="c-time num time">${esc(fmtDuration(parseTime(b.time)))}</div>
        <div class="c-ev">${link(b.source, "speedrun.com ↗")}</div>
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
        const id = regVideo({ url: v.url, ts: hit.timestamp, title: `${r.agent} — ${ms.name}`, sub: `${v.label ?? "Video"} at ${hit.timestamp}` });
        right += ` <a href="${esc(videoAt(v.url, hit.timestamp))}" data-play="${id}">▶ ${esc(hit.timestamp)}</a>`;
      }
      if (hit.evidence) right += ` ${link(hit.evidence, "evidence")}`;
      return `<li><span class="ok">✓</span><span>${esc(ms.name)}</span><span>${right}</span></li>`;
    })
    .join("");
  const vids = videos
    .map((v, i) => {
      const id = regVideo({ url: v.url, title: `${r.agent} — ${v.label ?? `Video ${i + 1}`}`, sub: v.covers ?? "" });
      return `<button class="vid-item" type="button" data-play="${id}"><span class="pbtn">${UI.play}</span><span>${esc(v.label ?? `Video ${i + 1}`)}${v.covers ? `<small>${esc(v.covers)}</small>` : ""}</span></button>`;
    })
    .join("");

  return `
    <div class="detail" id="detail-${esc(r.id)}">
      <div class="detail-grid">
        <div>
          <h4>Method</h4>
          <p>${esc(m.summary)}</p>
          ${dl([
            ["Track", `${TRACK_LABEL[r.track] ?? r.track} — ${TRACK_HELP[r.track] ?? ""}`],
            ["Models", Array.isArray(m.models) ? m.models.join(", ") : m.models],
            ["Observation", m.observation],
            ["Action", m.action],
            ["Human help", m.human_intervention],
            ["Game speed", m.game_speed],
            ["Restarts", m.restarts],
          ])}
          <div class="links" style="margin-top:12px">${link(m.paper, "Paper ↗")} ${link(m.code, "Code ↗")} ${link(m.project, "Project page ↗")}</div>
          ${
            Object.keys(hw).length || r.wall_clock || r.cost
              ? `<h4 style="margin-top:22px">Hardware &amp; cost</h4>${dl([
                  ["GPU", hw.gpu], ["CPU", hw.cpu], ["RAM", hw.ram_gb ? `${hw.ram_gb} GB` : null], ["OS", hw.os],
                  ["Inference", hw.inference], ["Game runs on", hw.game_host], ["Wall-clock", r.wall_clock], ["Cost", r.cost],
                ])}`
              : ""
          }
        </div>
        <div>
          <h4>Evidence</h4>
          <p>${evidenceBadge(r)}</p>
          <p style="font-size:14px">${esc(e.help)}${footageNote(r) ? ` <b style="color:var(--ink)">(${esc(footageNote(r))})</b>` : ""}</p>
          ${dl([
            ["Verified by", r.verified_by],
            ["Verified on", r.verified_at],
            ["Added", r.status === "curated" ? `by maintainers from public sources (${r.submitted_at})` : `submitted ${r.submitted_at}`],
          ])}
          <div class="links" style="margin:12px 0 18px">
            ${link(r.source, r.source_type === "author" ? "Author's report ↗" : r.source_type === "news" ? "Main source ↗" : "Source ↗")}
            ${(r.extra_sources ?? []).map((x) => link(x.url, `${x.label ?? "More"} ↗`)).join("")}
          </div>
          <h4>Videos</h4>
          ${vids ? `<div class="vid-list">${vids}</div>` : `<p class="muted" style="font-size:14px">No video of this run has been found.</p>`}
          ${r.notes ? `<h4 style="margin-top:22px">Notes</h4><p style="font-size:14px">${esc(r.notes)}</p>` : ""}
        </div>
        <div>
          <h4>Milestones · ${sc.n}/${sc.total}</h4>
          <ul class="mini-ladder">${ladder}</ul>
        </div>
      </div>
    </div>`;
}

function viewGame(id) {
  const game = DATA.games.find((g) => g.id === id);
  if (!game) return `<div class="wrap"><div class="empty" style="margin-top:48px">Unknown game “${esc(id)}”. <a href="#/">Back to all games</a></div></div>`;
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
        <div class="c-who who"><b>${vendorIcon(r)}${esc(r.agent)}</b><span>${esc(r.team)}</span></div>
        <div class="c-chev">${UI.chevron.replace("<svg", '<svg class="chev"')}</div>
        <div class="c-prog prog">
          ${bar(sc.n, sc.total, { cleared: sc.cleared })}
          <div class="sub">${sc.cleared ? `<span class="badge cleared">Cleared</span>` : esc(sc.furthest?.name ?? "No milestone yet")}</div>
        </div>
        <div class="c-meta">
          <div class="c-track"><span class="badge track" title="${esc(TRACK_HELP[r.track])}">${esc(TRACK_LABEL[r.track] ?? r.track)}</span></div>
          <div class="c-time num time ${sc.time == null ? "unknown" : ""}" ${sc.approx ? 'title="approximate, from public reports"' : ""}>${sc.approx && sc.time != null ? "~" : ""}${esc(fmtDuration(sc.time))}</div>
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
        <span class="name">${esc(ms.name)}${ms.final ? " — clear" : ""}${ms.description ? `<small>${esc(ms.description)}</small>` : ""}</span>
        <span class="claim">${
          hitters.length
            ? `${evidenceBadge(hitters.find((sc) => evidenceOf(sc.run) === bestEv).run)}<span class="muted">${hitters.length} run${hitters.length > 1 ? "s" : ""} · first: ${esc(first.run.agent)}</span>`
            : `<span class="muted">Unclaimed</span>`
        }</span>
      </li>`;
    })
    .join("");

  const gameVideos = allRanked.flatMap((sc) => (sc.run.videos ?? []).map((v, i) => videoCard(game, sc.run, v, i))).join("");
  const tab = (val, label) => `<button type="button" data-track="${val}" aria-pressed="${gameState.track === val}">${label}</button>`;
  const wr = (game.human_baselines ?? [])[0];

  return `
    <section class="banner" style="${themeStyle(game)}">
      <div class="emblem">${emblem(game)}</div>
      ${game.deco ? `<div class="deco" aria-hidden="true">${esc(game.deco)}</div>` : ""}
      ${MOUNTAINS}
      <div class="crumbs"><a href="#/">Games</a> / ${esc(game.title)}</div>
      <h1>${esc(game.title)}</h1>
      <div class="tags">${[game.platform, game.release_year, game.genre].filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      ${game.description ? `<p class="desc">${esc(game.description)}</p>` : ""}
      <div class="frontier">
        <div class="label"><span>AI frontier</span><span>${
          best ? `${esc(best.run.agent)} — ${best.cleared ? "cleared" : best.furthest ? esc(best.furthest.name) : "no milestone yet"}` : "No AI run yet"
        }</span></div>
        ${bar(best ? best.n : 0, game.milestones.length, { cleared: best?.cleared, lg: true })}
      </div>
    </section>

    <div class="wrap">
      <dl class="facts">
        <div class="fact"><dt>Clear condition</dt><dd>${esc(game.clear_condition)}</dd></div>
        <div class="fact"><dt>Human record</dt><dd>${wr ? `${esc(fmtDuration(parseTime(wr.time)))} — ${esc(wr.label.replace(/^Speedrun WR — /, ""))}` : "—"}</dd></div>
        <div class="fact"><dt>Game rules</dt><dd>${esc(game.rules ?? "Unmodified game; disclose version and settings.")}</dd></div>
      </dl>

      <section class="section">
        <div class="section-head"><div><h2><span class="ico">${UI.chart}</span>Progress vs. play time</h2>
        <div class="sub">How long each agent played (across, log scale) to reach each milestone (up). Each line is one run, colored by model; the model's icon marks how far it got, and its ring shows the evidence level. The hollow ring is the human record for the whole game. Times marked “about” are approximate figures from public reports.</div></div></div>
        <div class="panel"><div class="chart-wrap" id="chart"></div></div>
      </section>

      <section class="section">
        <div class="section-head">
          <div><h2><span class="ico">${UI.trophy}</span>Leaderboard</h2>
          <div class="sub">Ranked by: cleared → milestones reached → elapsed time at the furthest milestone → report date. Click a run for method, sources and videos.</div></div>
          <div class="controls">
            <div class="tabs" role="group" aria-label="Track">${tab("all", "All tracks")}${tab("pixels", "Pixels-only")}${tab("harness", "Harness")}</div>
            <label class="select">Evidence
              <select id="minEvidence">
                ${[["news", "All"], ["author", "Author report or better"], ["video", "Has video"], ["verified", "Human-verified only"]]
                  .map(([k, l]) => `<option value="${k}" ${gameState.minEvidence === k ? "selected" : ""}>${l}</option>`)
                  .join("")}
              </select>
            </label>
          </div>
        </div>
        <div class="legend">${EVIDENCE.map((e) => `<div>${evidenceBadge({ status: e.key === "verified" ? "verified" : "", videos: e.key === "video" ? [1] : [], source_type: e.key })}<span>${esc(e.help)}</span></div>`).join("")}</div>
        <div class="board-head" aria-hidden="true"><span>#</span><span>Agent</span><span></span><span>Progress</span><span>Time</span><span>Evidence</span><span>Reported</span><span></span></div>
        <div class="board" role="list">
          ${(game.human_baselines ?? []).map((b) => humanRow(game, b)).join("")}
          ${rows || `<div class="empty">No AI runs in this view yet. <a href="#/submit?game=${esc(game.id)}">Submit the first one.</a></div>`}
        </div>
      </section>

      ${
        gameVideos
          ? `<section class="section"><div class="section-head"><div><h2><span class="ico">${UI.film}</span>Watch the runs</h2>
             <div class="sub">Plays here. Labels say what each video actually covers.</div></div></div>
             <div class="videos">${gameVideos}</div></section>`
          : ""
      }

      <section class="section">
        <div class="section-head"><div><h2><span class="ico">${UI.scroll}</span>The path</h2>
        <div class="sub">Milestones in order. Lit nodes have been reached by at least one AI run; the badge shows the strongest evidence for it.</div></div>
        <a class="btn small" href="#/submit?game=${esc(game.id)}">Submit a run</a></div>
        <ol class="path">${ladder}</ol>
      </section>

      ${
        (game.links ?? []).length
          ? `<section class="section"><div class="section-head"><div><h2>References</h2></div></div><div class="links">${game.links.map((l) => link(l.url, `${l.label} ↗`)).join("")}</div></section>`
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
    ? `<p class="muted chart-note">Not plotted — no time reported: ${missing.map((s) => esc(s.sc.run.agent)).join(", ")}.</p>`
    : "";
  if (!plotted.length && !humans.length) {
    host.innerHTML = `<div class="chart-empty">No AI run has reported how long it took yet.</div>${missingNote}`;
    return;
  }

  const W = Math.max(320, host.clientWidth);
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
          lines: [`${p.ms.name} — ${p.y}/${N}`, `${p.approx ? "about " : ""}${fmtDuration(p.t)} of play`, `${VENDORS[s.vendor].label} · ${EV[s.ev].label}`],
          aria: `${s.sc.run.agent}: ${p.ms.name} after ${p.approx ? "about " : ""}${fmtDuration(p.t)}`,
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
      hitFor(X(h.t), Y(N), { title: h.b.label, lines: [h.b.note ?? "Human reference", `${fmtDuration(h.t)} for the whole game`], aria: `${h.b.label}: ${fmtDuration(h.t)}` }))
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
  const humanLabel = humans[0] ? placeLabel(X(humans[0].t), Y(N), `${W < 560 ? "Human" : "Human record"} ${fmtDuration(humans[0].t)}`, "human-label", 11) : "";

  const vendorsShown = [...new Set(plotted.map((s) => s.vendor))];
  const ring = (k) => `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="${EV[k].color}" stroke-width="2.2" stroke-dasharray="${RING_DASH[k]}"/></svg>`;
  host.innerHTML = `
    <div class="chart-legend">
      ${vendorsShown.map((v) => `<span><img src="${VENDORS[v].icon}" width="14" height="14" alt=""/><svg viewBox="0 0 16 4" style="width:16px;height:4px"><rect width="16" height="3" rx="1.5" fill="var(--v-${v})"/></svg>${esc(VENDORS[v].label)}</span>`).join("")}
      <span class="sep"></span>
      ${EVIDENCE.map((e) => `<span>${ring(e.key)}${esc(e.label)}</span>`).join("")}
      <span><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="var(--human)" stroke-width="2.2"/></svg>Human record</span>
    </div>
    <svg width="${W}" height="${H}" role="img" aria-label="Milestones reached against play time on ${esc(game.title)}">
      <g class="grid">${yTicks.map((n) => `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(n)}" y2="${Y(n)}"/>`).join("")}${ticks.map((t) => `<line x1="${X(t)}" x2="${X(t)}" y1="${M.t}" y2="${Y(0)}"/>`).join("")}</g>
      ${yTicks.map((n) => `<text x="${M.l - 10}" y="${Y(n) + 4}" text-anchor="end">${n}</text>`).join("")}
      ${ticks.map((t) => `<text x="${X(t)}" y="${H - 20}" text-anchor="middle">${fmtTick(t)}</text>`).join("")}
      <text x="${(M.l + W - M.r) / 2}" y="${H - 3}" text-anchor="middle" class="axis-title">play time (log scale)</text>
      <line class="baseline" x1="${M.l}" x2="${W - M.r}" y1="${Y(0)}" y2="${Y(0)}"/>
      <line class="goal" x1="${M.l}" x2="${W - M.r}" y1="${Y(N)}" y2="${Y(N)}"/>
      ${W >= 560 ? `<text class="goal-label" x="${W - M.r + 10}" y="${Y(N) + 4}">CLEARED</text>` : ""}
      ${lines}${humanMarks}${icons}${aiLabels}${humanLabel}${pointHits}
    </svg>
    <div class="tooltip" hidden></div>
    ${!plotted.length ? `<p class="muted chart-note">No AI run has reported how long it took yet — only the human record is shown.</p>` : ""}
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
    const m = location.hash.match(/^#\/game\/([^?]+)/);
    if (m && DATA) drawChart(DATA.games.find((g) => g.id === decodeURIComponent(m[1])));
  }, 150);
});

// ---------- why games (manifesto) ----------
const SLOGAN = ["Clear the game.", "Gamify every task.", "Reach AGI."];
const SLOGAN_HTML = SLOGAN.map((s, i) => `<span class="slogan-step">${i ? `<i aria-hidden="true">→</i>` : ""}${s}</span>`).join("");

const GAMIFY = [
  { icon: "code", task: "Software", world: "A codebase and its issue tracker", moves: "Read, edit, run commands", goal: "The feature ships", score: "Tests pass, review approves" },
  { icon: "sigma", task: "Mathematics", world: "Axioms and known results", moves: "Proof steps", goal: "The theorem", score: "A proof checker accepts it" },
  { icon: "flask", task: "Science", world: "A lab or a simulator", moves: "Design and run experiments", goal: "Answer the question", score: "Results that replicate" },
  { icon: "robot", task: "Robotics", world: "A workcell", moves: "Motor commands", goal: "The part is assembled", score: "Success rate, cycle time" },
  { icon: "coin", task: "Business", world: "A market", moves: "Price, build, sell", goal: "Hit the target", score: "Revenue, retention" },
];

const BOSSES = [
  { name: "The Toy Critic", quote: "Games are toys.",
    counter: "A game is a world built so a newcomer, with no manual, can learn its rules, set goals and get better until they win. That is the exact problem a general learner has to solve. Games are toys the way flight simulators are toys." },
  { name: "The Old Champion", quote: "Games are solved. Atari, Go, StarCraft, Dota — done.",
    counter: "Those were specialists: one system per game, trained on far more play than any person gets, often reading game state through an API. None could be handed a new game and finish it. No agent has yet picked up a modern 3D game it wasn't built for and played it to the credits from the screen." },
  { name: "The Serious Adult", quote: "Real work matters more — code, science, robots.",
    counter: "A 60-hour game is a long-horizon task with a clear finish line: see, remember what happened ten hours ago, plan, act in real time, recover from mistakes. A month-long project needs the same skills. An agent that loses the thread halfway through Elden Ring will lose it halfway through your codebase too." },
  { name: "The Reality Gap", quote: "Games aren't the real world.",
    counter: "That is what stage two is for. Any task can be written as a game — a world, the moves allowed, a goal and a score — and every training environment for an agent is a game under another name. Clearing a game you have never seen is doing a task you have never seen." },
  { name: "The Skeptic", quote: "Playing games is a stunt, not a measurement.",
    counter: "A game ends in a way anyone can check: the credits roll, or they don't. This board scores story milestones against play time, asks for unedited video and labels every claim by its evidence. Few benchmarks are this hard to fake and this easy to verify." },
];

function viewWhy() {
  const modern = DATA.games.filter((g) => g.tier === "modern");
  const cleared = modern.filter((g) => rankRuns(g, runsFor(g.id))[0]?.cleared).length;
  const started = modern.filter((g) => rankRuns(g, runsFor(g.id))[0]?.n > 0).length;

  const shelf = DATA.games
    .map((g) => `<a class="cart" href="#/game/${esc(g.id)}" style="${themeStyle(g)}" title="${esc(g.title)}" aria-label="${esc(g.title)}">${emblem(g)}</a>`)
    .join("");

  const stages = [
    { n: 1, icon: UI.gamepad, state: "now", status: "In progress", title: "Clear the game",
      body: "A modern game is the richest test we can build and still score: real-time perception, control, memory across tens of hours, planning, and a story that only ends if you keep going. An AI that sits down at a game it has never seen and plays it to the end has learned a whole world, not just answered questions about one.",
      foot: `<div class="frontier"><div class="label"><span>Modern games cleared by AI</span><span>${cleared} of ${modern.length} · ${started} started</span></div>${bar(cleared, modern.length, { lg: true })}</div>` },
    { n: 2, icon: UI.target, state: "locked", status: "Unlocks next", title: "Gamify every task",
      body: "Then turn the problem around. Give any task a world, rules, a goal and a score, and it becomes a game. The better we get at writing tasks as games, the more of the world an agent that clears games can take on.",
      foot: `<div class="tags">${GAMIFY.map((t) => `<span class="tag">${UI[t.icon]}${esc(t.task)}</span>`).join("")}</div>` },
    { n: 3, icon: UI.crown, state: "final", status: "Final boss", title: "Reach AGI",
      body: "An agent that can clear any game you hand it, in a world where any task can be made into a game, is a general agent. Game-clearing is not a narrow skill beside general intelligence — with every task gamified, it is general intelligence, measured.",
      foot: `<div class="tags"><span class="tag">${UI.star}Any game</span><span class="tag">${UI.star}Any task</span><span class="tag">${UI.star}No manual</span></div>` },
  ];

  const field = (icon, label, val) => `<div><dt>${UI[icon]}${label}</dt><dd>${esc(val)}</dd></div>`;

  return `
  <section class="why-hero">
    <canvas id="embers" aria-hidden="true"></canvas>
    ${MOUNTAINS}
    <div class="why-hero-inner">
      <div class="eyebrow">Manifesto · Player 1</div>
      <h1>Why games</h1>
      <p class="slogan big">${SLOGAN_HTML}</p>
      <p class="lede">Games are not a side quest on the way to general AI. They are the main quest.</p>
      <div class="shelf" aria-label="Games on the board">${shelf}</div>
    </div>
  </section>

  <div class="wrap">
    <section class="section">
      <div class="section-head"><div><h2><span class="ico">${UI.scroll}</span>The main quest</h2>
      <div class="sub">Three stages. GameMoonshot tracks stage one, in public.</div></div></div>
      <ol class="quest">${stages
        .map(
          (s) => `<li class="stage" data-state="${s.state}">
          <div class="stage-top"><span class="stage-ico">${s.icon}</span>
            <span class="stage-n">Stage ${s.n}</span>
            <span class="stage-status">${s.state === "locked" ? UI.lock : s.state === "final" ? UI.skull : UI.flame}${s.status}</span></div>
          <h3>${s.title}</h3><p>${s.body}</p>${s.foot}</li>`
        )
        .join("")}</ol>
    </section>

    <section class="section">
      <div class="section-head"><div><h2><span class="ico">${UI.gamepad}</span>Every task is a game</h2>
      <div class="sub">State the world, the moves, the goal and the score, and a task becomes something an agent can clear.</div></div></div>
      <div class="carts">${GAMIFY.map(
        (t) => `<article class="taskcart"><header><span class="ico">${UI[t.icon]}</span><h3>${esc(t.task)}</h3></header>
        <dl>${field("globe", "World", t.world)}${field("gamepad", "Moves", t.moves)}${field("target", "Goal", t.goal)}${field("trophy", "Score", t.score)}</dl></article>`
      ).join("")}</div>
    </section>

    <section class="section">
      <div class="section-head"><div><h2><span class="ico">${UI.skull}</span>Boss rush</h2>
      <div class="sub">Five arguments that games don't matter, and the counter that brings each one down.</div></div></div>
      <div class="bosses">${BOSSES.map(
        (b, i) => `<article class="boss">
          <div class="boss-head"><span class="boss-ico">${UI.skull}</span>
            <div><div class="boss-n">Boss ${i + 1} / ${BOSSES.length}</div><h3>${esc(b.name)}</h3></div>
            <span class="defeated">Defeated</span></div>
          <div class="hp"><span>HP</span><div class="bossbar"><i style="width:0"></i></div><span>0</span></div>
          <blockquote>“${esc(b.quote)}”</blockquote>
          <p><b>${UI.sword}Counter</b> ${esc(b.counter)}</p>
        </article>`
      ).join("")}
        <a class="boss next" href="${esc(repoUrl("/issues/new"))}" target="_blank" rel="noopener">
          <div class="q" aria-hidden="true">?</div>
          <h3>A new challenger</h3>
          <p>Have an argument we haven't answered? Open an issue and it joins the boss rush.</p>
        </a></div>
    </section>

    <section class="press-start">
      <div class="blink">Press start</div>
      <p>Stage one is open. ${cleared ? `${cleared} modern game${cleared === 1 ? "" : "s"} cleared so far.` : "No AI has cleared a modern game yet."} Bring an agent.</p>
      <div class="hero-actions">
        <a class="btn primary" href="#/">${UI.sword} Choose a game</a>
        <a class="btn" href="#/submit">${UI.scroll} Submit a run</a>
        <a class="btn" href="#/rules">${UI.check} Read the rules</a>
      </div>
    </section>
  </div>`;
}

// ---------- rules ----------
function viewRules() {
  return `
  <div class="wrap">
    <div class="page-head"><h1>Mission rules</h1>
      <p>The point is to measure how far agents get through real games, in a way other people can check.
      These rules apply to every game; a game page can add its own.</p></div>
    <article class="prose">
      <h2>How this differs from VideoGameBench</h2>
      <p>Why games at all? See <a href="#/why">Why games</a>.</p>
      <p><a href="https://arxiv.org/abs/2505.18134" target="_blank" rel="noopener">VideoGameBench</a> (Zhang, Griffiths, Narasimhan and Press, 2025)
      is a controlled benchmark: one agent harness, VG-Agent, wraps each vision-language model and plays 1990s Game Boy and MS-DOS games
      (Doom II, Civilization I, Link's Awakening DX, Pokémon Crystal and others) from raw frames, scored at fixed checkpoints.</p>
      <p>GameMoonshot asks a different question: how far does <i>any</i> agent get through the games people actually play today?</p>
      <ul>
        <li><b>Games.</b> The main boards are modern 3D titles — Elden Ring, Cyberpunk 2077, GTA V, Red Dead Redemption 2, Black Myth: Wukong —
        with real-time combat, open worlds and stories that take a human 20–100 hours. Retro and 2D boards stay as a lower rung for comparison;
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
      <ul>${EVIDENCE.map((e) => `<li>${evidenceBadge({ status: e.key === "verified" ? "verified" : "", videos: e.key === "video" ? [1] : [], source_type: e.key })} — ${esc(e.help)}</li>`).join("")}</ul>
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
        <input type="checkbox" aria-label="${esc(m.name)} reached" />
        <span>${esc(m.name)}${m.final ? " — clear" : ""}</span>
        <input placeholder="H:MM:SS" data-f="elapsed" aria-label="elapsed run time" />
        <input placeholder="H:MM:SS" data-f="timestamp" aria-label="video timestamp" />
        <input placeholder="0" data-f="video" inputmode="numeric" aria-label="video index" />
      </div>`
    )
    .join("");

  return `
  <div class="wrap">
    <div class="page-head"><h1>Submit a run</h1>
      <p>Fill this in, then open a GitHub issue with the generated JSON (maintainers turn it into a PR), or add it yourself as
      <code>data/submissions/&lt;game&gt;/&lt;id&gt;.json</code> and run <code>npm run build</code>. Read the <a href="#/rules">rules</a> first.</p></div>
    <form class="submit" id="submitForm" novalidate>
      <fieldset>
        <legend>Run</legend>
        <div class="fields">
          <label>Game<select name="game">${opts}</select></label>
          <label>Agent name<input name="agent" placeholder="e.g. Cradle" required /></label>
          <label>Team / author<input name="team" placeholder="e.g. your lab or handle" required /></label>
          <label>Track<select name="track"><option value="pixels">Pixels-only</option><option value="harness">Harness</option></select>
            <span class="hint">Pixels-only = frames in, keyboard/mouse/pad out. Anything else = Harness.</span></label>
          <label>Game version / patch<input name="game_version" placeholder="e.g. Steam build 1.0.1491.50" /></label>
          <label>Wall-clock duration<input name="wall_clock" placeholder="e.g. 3 days, 41 hours of compute" /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Videos</legend>
        <label>Video links, one per line (numbered 0, 1, 2…)<textarea name="videos" placeholder="https://www.youtube.com/watch?v=...&#10;https://www.bilibili.com/video/BV..."></textarea>
          <span class="hint">Full, unedited, public. Multi-part runs: list parts in order and use the number in the milestone table.</span></label>
        <label style="margin-top:12px;display:flex;gap:10px;align-items:center;grid-auto-flow:column;justify-content:start"><input type="checkbox" name="full" checked style="width:auto;accent-color:var(--gold)" /> These videos together cover the whole run</label>
      </fieldset>
      <fieldset>
        <legend>Milestones reached</legend>
        <div class="ms-table">
          <div class="ms-row head"><span></span><span>Milestone</span><span>Elapsed run time</span><span>Video timestamp</span><span>Video #</span></div>
          ${msRows}
        </div>
      </fieldset>
      <fieldset>
        <legend>Method</legend>
        <div class="fields">
          <label>Models used<input name="models" placeholder="e.g. GPT-4o, Claude Opus 4.5 (comma-separated)" /></label>
          <label>Observation<input name="observation" placeholder="e.g. screenshots every 2s at 1280×720" /></label>
          <label>Action<input name="action" placeholder="e.g. keyboard + mouse via pyautogui" /></label>
          <label>Game speed<input name="game_speed" placeholder="e.g. real-time / paused while thinking" /></label>
          <label>Human intervention<input name="human_intervention" value="none" /><span class="hint">Anything a human did during the run. “none” if nothing.</span></label>
          <label>Restarts / reloads<input name="restarts" placeholder="e.g. agent reloads last checkpoint on death" /></label>
          <label>Paper URL<input name="paper" type="url" /></label>
          <label>Code URL<input name="code" type="url" /></label>
        </div>
        <label style="margin-top:14px">Summary<textarea name="summary" placeholder="How the agent works: planning, memory, skills, reflection, any game-specific prompting…"></textarea></label>
      </fieldset>
      <fieldset>
        <legend>Hardware</legend>
        <div class="fields">
          <label>GPU<input name="gpu" placeholder="e.g. 1× RTX 4090 24GB" /></label>
          <label>CPU<input name="cpu" placeholder="e.g. Ryzen 9 7950X" /></label>
          <label>RAM (GB)<input name="ram_gb" inputmode="numeric" /></label>
          <label>OS<input name="os" placeholder="e.g. Windows 11" /></label>
          <label>Inference<input name="inference" placeholder="e.g. OpenAI API / local vLLM on 2× H100" /></label>
          <label>Approx. cost<input name="cost" placeholder="e.g. ~$350 API spend" /></label>
        </div>
        <label style="margin-top:14px">Notes<textarea name="notes"></textarea></label>
      </fieldset>
      <div class="actions">
        <button class="btn primary" type="submit">${UI.scroll} Generate submission</button>
        <span class="muted" style="font-size:13px">Nothing is sent anywhere until you open the issue.</span>
      </div>
      <ul class="errors" id="formErrors"></ul>
      <div id="output" hidden>
        <pre class="out" id="json"></pre>
        <div class="actions">
          <button class="btn" type="button" id="copy">Copy JSON</button>
          <a class="btn primary" id="issue" target="_blank" rel="noopener">${UI.external} Open GitHub issue</a>
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
  form.game.addEventListener("change", () => { location.hash = `#/submit?game=${encodeURIComponent(form.game.value)}`; });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form).entries());
    const errs = [];
    const videos = String(f.videos ?? "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (!f.agent?.trim()) errs.push("Agent name is required.");
    if (!f.team?.trim()) errs.push("Team / author is required.");
    if (!videos.length) errs.push("At least one video link is required.");
    videos.forEach((v) => !safeUrl(v) && errs.push(`Not an http(s) URL: ${v}`));

    const milestones = [];
    form.querySelectorAll(".ms-row[data-ms]").forEach((row) => {
      if (!row.querySelector('input[type="checkbox"]').checked) return;
      const get = (k) => row.querySelector(`[data-f="${k}"]`).value.trim();
      const entry = { id: row.dataset.ms };
      const el = get("elapsed"), ts = get("timestamp"), vi = get("video");
      if (el) {
        if (parseTime(el) == null) errs.push(`${row.dataset.ms}: elapsed must be H:MM:SS`);
        entry.elapsed = el;
      }
      if (ts) {
        if (parseTime(ts) == null) errs.push(`${row.dataset.ms}: timestamp must be H:MM:SS`);
        entry.timestamp = ts;
      } else errs.push(`${row.dataset.ms}: a video timestamp is needed for verification`);
      const idx = vi === "" ? 0 : Number(vi);
      if (!Number.isInteger(idx) || idx < 0 || idx >= Math.max(videos.length, 1)) errs.push(`${row.dataset.ms}: video # must be 0–${Math.max(videos.length - 1, 0)}`);
      entry.video = idx;
      milestones.push(entry);
    });
    if (!milestones.length) errs.push("Tick at least one milestone you reached.");
    if (!f.summary?.trim()) errs.push("Method summary is required.");
    if (!f.models?.trim()) errs.push("List the model(s) used.");
    if (!f.observation?.trim() || !f.action?.trim()) errs.push("Describe observation and action space.");
    if (!f.gpu?.trim() && !f.cpu?.trim()) errs.push("Give at least GPU or CPU.");
    if (!f.inference?.trim()) errs.push("Say where inference ran (API / local).");

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
        summary: f.summary.trim(), models: f.models.split(",").map((s) => s.trim()).filter(Boolean),
        observation: f.observation.trim(), action: f.action.trim(), game_speed: f.game_speed?.trim(),
        human_intervention: f.human_intervention?.trim() || "none", restarts: f.restarts?.trim(), paper: f.paper?.trim(), code: f.code?.trim(),
      }),
      hardware: clean({ gpu: f.gpu?.trim(), cpu: f.cpu?.trim(), ram_gb: f.ram_gb ? Number(f.ram_gb) : undefined, os: f.os?.trim(), inference: f.inference.trim() }),
      wall_clock: f.wall_clock?.trim(), cost: f.cost?.trim(), notes: f.notes?.trim(),
    });
    const json = JSON.stringify(sub, null, 2);
    app.querySelector("#json").textContent = json;
    app.querySelector("#output").hidden = false;
    app.querySelector("#pathHint").textContent = `PR path: data/submissions/${f.game}/${id}.json`;
    const gameTitle = DATA.games.find((g) => g.id === f.game)?.title ?? f.game;
    const issue = new URL(repoUrl("/issues/new"));
    issue.searchParams.set("title", `[Run] ${gameTitle} — ${sub.agent} (${sub.team})`);
    issue.searchParams.set("labels", "submission");
    issue.searchParams.set("body", `Submission generated on the GameMoonshot site.\n\n\`\`\`json\n${json}\n\`\`\`\n`);
    app.querySelector("#issue").href = issue.toString();
    app.querySelector("#copy").onclick = async () => {
      try { await navigator.clipboard.writeText(json); app.querySelector("#copy").textContent = "Copied"; }
      catch { app.querySelector("#copy").textContent = "Copy failed — select the text"; }
    };
  });
}

// ---------- router ----------
function render() {
  let hash = location.hash.replace(/^#/, "") || "/";
  const jumpToGames = hash === "games"; // in-page anchor on the home page
  if (jumpToGames) hash = "/";
  const [pathPart, query = ""] = hash.split("?");
  const parts = pathPart.split("/").filter(Boolean);
  const params = new URLSearchParams(query);
  let html, bind, nav;
  if (parts[0] === "game" && parts[1]) {
    const id = decodeURIComponent(parts[1]);
    html = viewGame(id);
    bind = () => bindGame(id);
    nav = "home";
    document.title = `${DATA.games.find((g) => g.id === id)?.title ?? "Game"} · GameMoonshot`;
  } else if (parts[0] === "why") {
    html = viewWhy(); bind = startEmbers; nav = "why"; document.title = "Why games · GameMoonshot";
  } else if (parts[0] === "rules") {
    html = viewRules(); nav = "rules"; document.title = "Rules · GameMoonshot";
  } else if (parts[0] === "submit") {
    html = viewSubmit(params); bind = bindSubmit; nav = "submit"; document.title = "Submit a run · GameMoonshot";
  } else {
    html = viewHome(); bind = startEmbers; nav = "home"; document.title = "GameMoonshot";
  }
  applySkin(parts[0] === "game" ? DATA.games.find((g) => g.id === decodeURIComponent(parts[1] ?? "")) : null);
  app.innerHTML = html;
  bind?.();
  if (jumpToGames) document.getElementById("games")?.scrollIntoView();
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === nav));
}

let lastPath = null;
window.addEventListener("hashchange", () => {
  if (location.hash === "#games" && document.getElementById("games")) {
    document.getElementById("games").scrollIntoView();
    return;
  }
  const path = location.hash.split("?")[0];
  if (path !== lastPath) {
    Object.assign(gameState, { track: "all", minEvidence: "news", open: new Set() });
    closePlayer();
    window.scrollTo(0, 0);
  }
  lastPath = path;
  render();
});

load()
  .then(() => { lastPath = location.hash.split("?")[0]; render(); })
  .catch((e) => {
    app.innerHTML = `<div class="wrap"><div class="empty" style="margin-top:48px">Could not load leaderboard data: ${esc(e.message)}<br/>Run <code>npm run dev</code> to build data.json and preview locally.</div></div>`;
  });
