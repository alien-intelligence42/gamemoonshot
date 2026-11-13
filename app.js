// GameClear Dojo — static, dependency-free leaderboard.
// Data comes from data.json, which scripts/build.mjs assembles from data/.

const CFG = window.DOJO_CONFIG ?? { repo: "your-org/gamecleardojo", branch: "main" };
const app = document.getElementById("app");

const TRACK_LABEL = {
  pixels: "Pixels-only",
  harness: "Harness",
};
const TRACK_HELP = {
  pixels: "Sees only rendered frames (+ optional audio), acts only through keyboard / mouse / controller input.",
  harness: "May read game memory or APIs, use custom tools (pathfinding, maps, save states for analysis), or a game-specific scaffold.",
};
// Evidence level, strongest first. Derived from the data (see evidenceOf), never typed by hand,
// so a run cannot claim "verified" without a maintainer flipping its status.
const EVIDENCE = [
  { key: "verified", icon: "✓", label: "Human-verified", help: "A maintainer watched the footage and checked every claimed milestone." },
  { key: "video", icon: "▶", label: "Video, unverified", help: "Public video of the run is linked, but no maintainer has checked it yet." },
  { key: "author", icon: "✎", label: "Author report", help: "Only a paper, blog or post by the people who ran the agent; no linked video of the run." },
  { key: "news", icon: "📰", label: "News only", help: "Only third-party press coverage; no first-party report or video found." },
];
const EVIDENCE_BY_KEY = Object.fromEntries(EVIDENCE.map((e, i) => [e.key, { ...e, rank: i }]));
function evidenceOf(run) {
  if (run.status === "verified") return "verified";
  if ((run.videos ?? []).length) return "video";
  if (run.source_type === "author") return "author";
  return "news";
}
const evidenceBadge = (run) => {
  const e = EVIDENCE_BY_KEY[evidenceOf(run)];
  return `<span class="badge ev-${e.key}" title="${esc(e.help)}">${e.icon} ${esc(e.label)}</span>`;
};
const STATUS_NOTE = {
  pending: "submitted · awaiting review",
  curated: "added by maintainers",
  verified: "",
};

// ---------- helpers ----------
const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const safeUrl = (u) => (typeof u === "string" && /^https?:\/\//.test(u) ? u : null);
const link = (u, text, cls = "") => {
  const s = safeUrl(u);
  return s ? `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer"${cls ? ` class="${cls}"` : ""}>${esc(text)}</a>` : "";
};

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
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
// Adds a start-time parameter for YouTube / Bilibili / Twitch links so a milestone opens at the right moment.
function videoAt(url, ts) {
  const u = safeUrl(url);
  const sec = parseTime(ts);
  if (!u || sec == null) return u;
  try {
    const p = new URL(u);
    const host = p.hostname.replace(/^www\./, "");
    if (host === "youtu.be" || host.endsWith("youtube.com")) p.searchParams.set("t", `${sec}s`);
    else if (host.endsWith("bilibili.com")) p.searchParams.set("t", String(sec));
    else if (host.endsWith("twitch.tv")) {
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      p.searchParams.set("t", `${h}h${m}m${s}s`);
    } else return u;
    return p.toString();
  } catch {
    return u;
  }
}
const repoUrl = (path = "") => `https://github.com/${CFG.repo}${path}`;

// ---------- ranking ----------
// A run is scored by how far it got, not by a self-reported number:
//   1. cleared the game (reached the milestone marked "final")
//   2. number of milestones reached (each one backed by a video timestamp)
//   3. elapsed time at the furthest milestone (faster is better; unknown sorts last)
//   4. earlier submission wins ties
function scoreRun(game, run) {
  const order = new Map(game.milestones.map((m, i) => [m.id, i]));
  const reached = run.milestones.filter((r) => order.has(r.id)).sort((a, b) => order.get(a.id) - order.get(b.id));
  const furthest = reached[reached.length - 1];
  const finalId = game.milestones.find((m) => m.final)?.id;
  const elapsedVals = reached.map((r) => parseTime(r.elapsed)).filter((x) => x != null);
  return {
    run,
    reached,
    reachedIds: new Set(reached.map((r) => r.id)),
    n: reached.length,
    total: game.milestones.length,
    cleared: reached.some((r) => r.id === finalId),
    furthest: furthest ? game.milestones[order.get(furthest.id)] : null,
    time: furthest ? parseTime(furthest.elapsed) ?? (elapsedVals.length ? Math.max(...elapsedVals) : null) : null,
  };
}
function rankRuns(game, runs) {
  return runs
    .map((r) => scoreRun(game, r))
    .sort(
      (a, b) =>
        Number(b.cleared) - Number(a.cleared) ||
        b.n - a.n ||
        (a.time ?? Infinity) - (b.time ?? Infinity) ||
        String(a.run.submitted_at).localeCompare(String(b.run.submitted_at))
    );
}

// ---------- data ----------
let DATA = null;
async function load() {
  const res = await fetch("data.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`data.json: HTTP ${res.status}`);
  DATA = await res.json();
  const gen = document.getElementById("generated");
  if (gen && DATA.updated) gen.textContent = `Latest entry ${DATA.updated}`;
}
const runsFor = (gameId, { includeRejected = false } = {}) =>
  DATA.submissions.filter((s) => s.game === gameId && (includeRejected || s.status !== "rejected"));

// ---------- views ----------
function viewHome() {
  const cards = DATA.games
    .map((g) => {
      const ranked = rankRuns(g, runsFor(g.id));
      const best = ranked[0];
      const pct = best ? Math.round((best.n / best.total) * 100) : 0;
      return `
      <a class="card" href="#/game/${esc(g.id)}">
        <div>
          <h3>${esc(g.title)}</h3>
          <div class="meta">${esc([g.platform, g.release_year, g.genre].filter(Boolean).join(" · "))}</div>
        </div>
        <div class="tags">
          <span class="tag">${g.milestones.length} milestones</span>
          <span class="tag">${ranked.length} AI run${ranked.length === 1 ? "" : "s"}</span>
          ${(g.human_baselines ?? []).length ? `<span class="tag">human baseline</span>` : ""}
        </div>
        <div class="best">
          <div class="bar-row">
            <div class="bar ${best?.cleared ? "cleared" : ""}"><i style="width:${pct}%"></i></div>
            <span class="num">${best ? `${best.n}/${best.total}` : "0/" + g.milestones.length}</span>
          </div>
          <div class="muted" style="margin-top:6px">
            ${
              best
                ? `Best AI: <b>${esc(best.run.agent)}</b> — ${best.cleared ? "cleared the game" : best.furthest ? `reached ${esc(best.furthest.name)}` : "no milestone yet"}<div style="margin-top:6px">${evidenceBadge(best.run)}</div>`
                : "No AI run yet. Be the first."
            }
          </div>
        </div>
      </a>`;
    })
    .join("");

  return `
    <section class="hero">
      <h1>Can your agent actually finish the game?</h1>
      <p>GameClear Dojo tracks AI agents playing real, full-length video games — Pokémon, Minecraft,
      Red Dead Redemption 2, Sekiro and more. Every game is split into milestones (gyms, chapters, bosses),
      every claim is backed by a video timestamp, and every board shows where human players stand.</p>
    </section>
    <div class="steps">
      <div class="step"><b>1 · Pick a game</b><span>Each game has an ordered list of milestones ending in the clear condition.</span></div>
      <div class="step"><b>2 · Record the run</b><span>Upload the full, unedited run. Partial runs count — every milestone reached is on the board.</span></div>
      <div class="step"><b>3 · Submit</b><span>Video link + timestamps, hardware, models used, and how the agent sees and acts.</span></div>
      <div class="step"><b>4 · Get verified</b><span>A maintainer watches the footage. Every run shows its evidence: human-verified, video, author report, or news only.</span></div>
    </div>
    <div class="section-head">
      <h2>Games</h2>
      <a class="muted" href="${esc(repoUrl("/issues/new?template=new-game.yml"))}" target="_blank" rel="noopener">Propose a game →</a>
    </div>
    <div class="grid">${cards}</div>`;
}

function humanRows(game, colspan) {
  return (game.human_baselines ?? [])
    .map(
      (b) => `
      <tr class="human">
        <td class="rank">H</td>
        <td class="who"><b>${esc(b.label)}</b><span>${esc(b.note ?? "Human reference")}</span></td>
        <td class="hide-sm"><span class="badge human">Human</span></td>
        <td class="prog"><div class="bar-row"><div class="bar human"><i style="width:100%"></i></div><span class="num">${game.milestones.length}/${game.milestones.length}</span></div></td>
        <td class="num">${esc(fmtDuration(parseTime(b.time)))}</td>
        <td class="hide-sm" colspan="${colspan - 5}">${link(b.source, "source")}</td>
      </tr>`
    )
    .join("");
}

function runDetail(game, sc) {
  const r = sc.run;
  const m = r.method ?? {};
  const hw = r.hardware ?? {};
  const videos = r.videos ?? [];
  const ladder = game.milestones
    .map((ms) => {
      const hit = r.milestones.find((x) => x.id === ms.id);
      if (!hit) return `<li class="miss"><span>${esc(ms.name)}</span><span>—</span></li>`;
      const v = videos[hit.video ?? 0];
      const href = v ? videoAt(v.url, hit.timestamp) : null;
      const right = [
        hit.elapsed ? `<span class="mono">${esc(hit.elapsed)}</span>` : "",
        href ? link(href, hit.timestamp ? `▶ ${hit.timestamp}` : "▶ video") : "",
        hit.evidence ? link(hit.evidence, "evidence") : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `<li><span>✓ ${esc(ms.name)}</span><span>${right || "reached"}</span></li>`;
    })
    .join("");
  const dl = (pairs) =>
    `<dl>${pairs
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
      .join("")}</dl>`;

  return `
    <div class="detail-grid">
      <div>
        <h4>Method</h4>
        <p>${esc(m.summary)}</p>
        ${dl([
          ["Models", Array.isArray(m.models) ? m.models.join(", ") : m.models],
          ["Observation", m.observation],
          ["Action", m.action],
          ["Human help", m.human_intervention],
          ["Game speed", m.game_speed],
          ["Restarts", m.restarts],
        ])}
        <div class="links" style="margin-top:8px">
          ${link(m.paper, "Paper")} ${link(m.code, "Code")} ${link(m.project, "Project page")}
        </div>
      </div>
      <div>
        <h4>Evidence</h4>
        <p>${evidenceBadge(r)}</p>
        <p class="muted" style="font-size:13px">${esc(EVIDENCE_BY_KEY[evidenceOf(r)].help)}</p>
        ${dl([
          ["Verified by", r.verified_by],
          ["Verified on", r.verified_at],
          ["Added", r.status === "curated" ? `by maintainers, ${r.submitted_at}` : `submitted ${r.submitted_at}`],
        ])}
        <div class="links" style="margin:6px 0 14px">
          ${link(r.source, r.source_type === "author" ? "Author's report" : r.source_type === "news" ? "News article" : "Source")}
          ${(r.extra_sources ?? []).map((x) => link(x.url, x.label ?? "More")).join("")}
        </div>
        ${Object.keys(hw).length || r.wall_clock || r.cost ? `<h4>Hardware &amp; cost</h4>` : ""}
        ${dl([
          ["GPU", hw.gpu],
          ["CPU", hw.cpu],
          ["RAM", hw.ram_gb ? `${hw.ram_gb} GB` : null],
          ["OS", hw.os],
          ["Inference", hw.inference],
          ["Game runs on", hw.game_host],
          ["Wall-clock", r.wall_clock],
          ["Cost", r.cost],
        ])}
        <h4 style="margin-top:14px">Videos</h4>
        <div class="links">${videos.length ? videos.map((v, i) => link(v.url, v.label ?? `Video ${i + 1}`)).join("") : `<span class="muted">No video of the run linked yet.</span>`}</div>
        ${r.notes ? `<h4 style="margin-top:14px">Notes</h4><p>${esc(r.notes)}</p>` : ""}
      </div>
      <div>
        <h4>Milestones (${sc.n}/${sc.total})</h4>
        <ul class="mini-ladder">${ladder}</ul>
      </div>
    </div>`;
}

const gameState = { track: "all", minEvidence: "news" };

function viewGame(id) {
  const game = DATA.games.find((g) => g.id === id);
  if (!game) return `<div class="empty">Unknown game “${esc(id)}”. <a href="#/">Back to all games</a></div>`;

  let runs = runsFor(game.id);
  if (gameState.track !== "all") runs = runs.filter((r) => r.track === gameState.track);
  const maxRank = EVIDENCE_BY_KEY[gameState.minEvidence].rank;
  runs = runs.filter((r) => EVIDENCE_BY_KEY[evidenceOf(r)].rank <= maxRank);
  const ranked = rankRuns(game, runs);
  const allRanked = rankRuns(game, runsFor(game.id));
  const COLS = 7;

  const rows = ranked
    .map((sc, i) => {
      const r = sc.run;
      const pct = Math.round((sc.n / sc.total) * 100);
      return `
      <tr class="run" data-run="${esc(r.id)}" tabindex="0" aria-expanded="false">
        <td class="rank">${i + 1}</td>
        <td class="who"><b>${esc(r.agent)}</b><span>${esc(r.team)}</span></td>
        <td class="hide-sm"><span class="badge ${esc(r.track)}" title="${esc(TRACK_HELP[r.track])}">${esc(TRACK_LABEL[r.track] ?? r.track)}</span></td>
        <td class="prog">
          <div class="bar-row"><div class="bar ${sc.cleared ? "cleared" : ""}"><i style="width:${pct}%"></i></div><span class="num">${sc.n}/${sc.total}</span></div>
          <div class="muted" style="font-size:13px;margin-top:3px">${sc.cleared ? `<span class="badge cleared">Cleared</span>` : esc(sc.furthest?.name ?? "")}</div>
        </td>
        <td class="num">${esc(fmtDuration(sc.time))}</td>
        <td class="hide-sm">${evidenceBadge(r)}${STATUS_NOTE[r.status] ? `<div class="muted" style="font-size:12px;margin-top:3px">${esc(STATUS_NOTE[r.status])}</div>` : ""}</td>
        <td class="hide-sm num">${esc(r.submitted_at)}</td>
      </tr>
      <tr class="detail" data-detail="${esc(r.id)}" hidden><td colspan="${COLS}">${runDetail(game, sc)}</td></tr>`;
    })
    .join("");

  // Milestone ladder: who reached each milestone first (by submission date) and how many runs reached it.
  const ladder = game.milestones
    .map((ms, i) => {
      const hitters = allRanked.filter((sc) => sc.reachedIds.has(ms.id));
      const first = [...hitters].sort((a, b) => String(a.run.submitted_at).localeCompare(String(b.run.submitted_at)))[0];
      const bestEv = hitters.map((sc) => evidenceOf(sc.run)).sort((a, b) => EVIDENCE_BY_KEY[a].rank - EVIDENCE_BY_KEY[b].rank)[0];
      return `
      <li class="${hitters.length ? "hit" : ""} ${ms.final ? "final" : ""}">
        <span class="idx">${hitters.length ? "✓" : i + 1}</span>
        <span class="name">${esc(ms.name)}${ms.final ? " 🏁" : ""}${ms.description ? `<small>${esc(ms.description)}</small>` : ""}</span>
        <span class="who">${hitters.length ? `<span class="badge ev-${bestEv}" title="Strongest evidence for this milestone: ${esc(EVIDENCE_BY_KEY[bestEv].label)}">${EVIDENCE_BY_KEY[bestEv].icon} ${esc(EVIDENCE_BY_KEY[bestEv].label)}</span><br/>${hitters.length} run${hitters.length > 1 ? "s" : ""} · first: ${esc(first.run.agent)}` : "unclaimed"}</span>
      </li>`;
    })
    .join("");

  const tab = (val, label) => `<button type="button" data-track="${val}" aria-pressed="${gameState.track === val}">${label}</button>`;

  return `
    <div class="crumbs"><a href="#/">Games</a> / ${esc(game.title)}</div>
    <section class="game-head">
      <h1>${esc(game.title)}</h1>
      <div class="tags">${[game.platform, game.release_year, game.genre].filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      ${game.description ? `<p>${esc(game.description)}</p>` : ""}
    </section>
    <dl class="kv">
      <div><dt>Clear condition</dt><dd>${esc(game.clear_condition)}</dd></div>
      <div><dt>Timing</dt><dd>${esc(game.timing ?? "Elapsed in-run time at each milestone (from the first input).")}</dd></div>
      ${game.rules ? `<div><dt>Game-specific rules</dt><dd>${esc(game.rules)}</dd></div>` : ""}
    </dl>
    <div class="two-col">
      <section>
        <div class="section-head">
          <h2>Leaderboard</h2>
          <div class="actions">
            <div class="tabs" role="group" aria-label="Track">${tab("all", "All")}${tab("pixels", "Pixels-only")}${tab("harness", "Harness")}</div>
            <label style="display:flex;gap:6px;align-items:center;font-size:13px;color:var(--muted);grid-auto-flow:column">
              Evidence
              <select id="minEvidence" style="width:auto;padding:4px 8px">
                ${[["news", "All"], ["author", "Author report or better"], ["video", "Has video"], ["verified", "Human-verified only"]]
                  .map(([k, l]) => `<option value="${k}" ${gameState.minEvidence === k ? "selected" : ""}>${l}</option>`)
                  .join("")}
              </select>
            </label>
          </div>
        </div>
        <div class="legend">${EVIDENCE.map((e) => `<span><span class="badge ev-${e.key}">${e.icon} ${esc(e.label)}</span> ${esc(e.help)}</span>`).join("")}</div>
        <div class="table-wrap">
          <table class="board">
            <thead><tr><th>#</th><th>Agent</th><th class="hide-sm">Track</th><th>Progress</th><th>Time</th><th class="hide-sm">Evidence</th><th class="hide-sm">Date</th></tr></thead>
            <tbody>
              ${humanRows(game, COLS)}
              ${rows || `<tr><td colspan="${COLS}"><div class="empty" style="border:0">No AI runs in this view yet. <a href="#/submit?game=${esc(game.id)}">Submit the first one.</a></div></td></tr>`}
            </tbody>
          </table>
        </div>
        <p class="muted" style="font-size:13px">Ranked by: cleared → milestones reached → elapsed time at furthest milestone → submission date. Click a row for method, hardware and per-milestone video timestamps.</p>
        ${
          (game.links ?? []).length
            ? `<h3>References</h3><div class="links">${game.links.map((l) => link(l.url, l.label)).join("")}</div>`
            : ""
        }
      </section>
      <aside>
        <div class="section-head"><h2>Milestones</h2><a class="muted" href="#/submit?game=${esc(game.id)}">Submit →</a></div>
        <ol class="ladder">${ladder}</ol>
      </aside>
    </div>`;
}

function bindGame(id) {
  app.querySelectorAll("[data-track]").forEach((b) =>
    b.addEventListener("click", () => {
      gameState.track = b.dataset.track;
      render();
    })
  );
  app.querySelector("#minEvidence")?.addEventListener("change", (e) => {
    gameState.minEvidence = e.target.value;
    render();
  });
  app.querySelectorAll("tr.run").forEach((tr) => {
    const toggle = () => {
      const d = app.querySelector(`tr[data-detail="${CSS.escape(tr.dataset.run)}"]`);
      d.hidden = !d.hidden;
      tr.setAttribute("aria-expanded", String(!d.hidden));
    };
    tr.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      toggle();
    });
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
}

function viewRules() {
  return `
  <article class="prose">
    <h1>Rules</h1>
    <p class="muted">The point of the Dojo is to measure how far general-purpose agents get through real games,
    in a way other people can check. These rules apply to every game; a game page can add its own.</p>

    <h2>What counts as a run</h2>
    <ul>
      <li>One continuous attempt by an AI agent on an unmodified retail/official copy of the game (patch version noted).</li>
      <li><b>Partial runs count.</b> You are ranked by the milestones you reached; reaching the final milestone means the game is cleared.</li>
      <li>A run may span multiple sessions/videos (e.g. a 200-hour Pokémon run), but the footage must cover the whole run with no gaps between milestones.</li>
      <li>Pausing the game while the model thinks is allowed; say so in the submission (“game speed”).</li>
    </ul>

    <h2>Tracks</h2>
    <ul>
      <li><b>Pixels-only</b> — ${esc(TRACK_HELP.pixels)}</li>
      <li><b>Harness</b> — ${esc(TRACK_HELP.harness)} Describe the harness precisely; two harness runs are only comparable if their tools are.</li>
    </ul>

    <h2>Human intervention</h2>
    <p>Any human input during the run (taking over controls, hand-written hints for a specific puzzle, manual restarts after a crash,
    choosing which save to continue from) must be disclosed in <code>human_intervention</code>. Undisclosed intervention gets a run rejected.
    Disclosed intervention is shown on the board so readers can judge.</p>

    <h2>Evidence you must provide</h2>
    <ul>
      <li><b>Video link(s)</b> — full, unedited, publicly viewable (YouTube, Bilibili, Twitch VOD, or a public file host). Speed-ups are fine if labeled.</li>
      <li><b>Timestamps</b> for every milestone claimed, plus the elapsed run time at that point.</li>
      <li><b>Hardware</b> — GPU/CPU/RAM of the machine running the game and the agent, and whether models ran locally or via API.</li>
      <li><b>Method</b> — a short description, model(s) used, what the agent observes, how it acts. Paper and code links are encouraged.</li>
    </ul>

    <h2>Evidence levels</h2>
    <p>Every run on a board carries exactly one evidence badge, so readers can tell a checked result from a headline.
    The badge is derived from the data, not chosen by the submitter.</p>
    <ul>
      ${EVIDENCE.map((e) => `<li><span class="badge ev-${e.key}">${e.icon} ${esc(e.label)}</span> — ${esc(e.help)}</li>`).join("")}
    </ul>
    <p>Runs are ranked by progress regardless of evidence; use the <b>Evidence</b> filter on a game page to see only
    runs with video, or only human-verified ones. Submissions from authors must include video, so they start at
    “Video, unverified” and move to “Human-verified” once a maintainer has checked each milestone timestamp
    (recorded as <code>verified_by</code> / <code>verified_at</code>). Results the maintainers collected from public
    reports start at “Author report” or “News only”; the authors can upgrade them by submitting footage.
    Runs that fail review are removed from the board.</p>

    <h2>Human baselines</h2>
    <p>Human rows show reference times for finishing the whole game — typically the
    <a href="https://howlongtobeat.com" target="_blank" rel="noopener">HowLongToBeat</a> main-story average and the
    <a href="https://www.speedrun.com" target="_blank" rel="noopener">speedrun.com</a> world record for the closest category.
    They are context, not opponents: AI runs are ranked against each other.</p>
  </article>`;
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
        <span>${esc(m.name)}${m.final ? " 🏁" : ""}</span>
        <input placeholder="H:MM:SS" data-f="elapsed" aria-label="elapsed run time" />
        <input placeholder="H:MM:SS" data-f="timestamp" aria-label="video timestamp" />
        <input placeholder="0" data-f="video" inputmode="numeric" aria-label="video index" />
      </div>`
    )
    .join("");

  return `
  <article>
    <h1>Submit a run</h1>
    <p class="muted prose">Fill this in, then either open a GitHub issue with the generated JSON (maintainers turn it into a PR),
    or add it yourself as <code>data/submissions/&lt;game&gt;/&lt;id&gt;.json</code> in a pull request. CI validates the file.
    Read the <a href="#/rules">rules</a> first.</p>
    <form class="submit" id="submitForm" novalidate>
      <fieldset>
        <legend>Run</legend>
        <div class="fields">
          <label>Game<select name="game">${opts}</select></label>
          <label>Agent name<input name="agent" placeholder="e.g. Cradle" required /></label>
          <label>Team / author<input name="team" placeholder="e.g. Your lab or handle" required /></label>
          <label>Track<select name="track"><option value="pixels">Pixels-only</option><option value="harness">Harness</option></select>
            <span class="hint">Pixels-only = frames in, keyboard/mouse/pad out. Anything else = Harness.</span></label>
          <label>Game version / patch<input name="game_version" placeholder="e.g. Steam build 1.0.1491.50" /></label>
          <label>Wall-clock duration<input name="wall_clock" placeholder="e.g. 3 days, 41 hours of compute" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Videos</legend>
        <label>Video links, one per line (index 0, 1, 2…)<textarea name="videos" placeholder="https://www.youtube.com/watch?v=...&#10;https://www.bilibili.com/video/BV..."></textarea>
          <span class="hint">Full, unedited, public. Multi-part runs: list parts in order and use the index in the milestone table.</span></label>
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
          <label>Human intervention<input name="human_intervention" value="none" />
            <span class="hint">Anything a human did during the run. “none” if nothing.</span></label>
          <label>Restarts / reloads<input name="restarts" placeholder="e.g. reloads from last checkpoint on death, by the agent" /></label>
          <label>Paper URL<input name="paper" type="url" /></label>
          <label>Code URL<input name="code" type="url" /></label>
        </div>
        <label style="margin-top:12px">Summary<textarea name="summary" placeholder="How the agent works: planning, memory, skills, reflection, any game-specific prompting…"></textarea></label>
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
        <label style="margin-top:12px">Notes<textarea name="notes"></textarea></label>
      </fieldset>

      <div class="actions">
        <button class="btn primary" type="submit">Generate submission</button>
        <span class="muted" style="font-size:13px">Nothing is sent anywhere until you open the issue.</span>
      </div>
      <ul class="errors" id="formErrors"></ul>
      <div id="output" hidden>
        <pre class="out" id="json"></pre>
        <div class="actions">
          <button class="btn" type="button" id="copy">Copy JSON</button>
          <a class="btn primary" id="issue" target="_blank" rel="noopener">Open GitHub issue</a>
          <span class="muted" id="pathHint" style="font-size:13px"></span>
        </div>
      </div>
    </form>
  </article>`;
}

const slug = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

function bindSubmit() {
  const form = app.querySelector("#submitForm");
  form.game.addEventListener("change", () => {
    location.hash = `#/submit?game=${encodeURIComponent(form.game.value)}`;
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form).entries());
    const errs = [];
    const videos = String(f.videos ?? "")
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
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

    const errBox = app.querySelector("#formErrors");
    errBox.innerHTML = errs.map((x) => `<li>${esc(x)}</li>`).join("");
    if (errs.length) {
      app.querySelector("#output").hidden = true;
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const id = `${today}-${slug(f.team)}-${slug(f.agent)}`.replace(/-+/g, "-");
    const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v != null));
    const sub = clean({
      id,
      game: f.game,
      agent: f.agent.trim(),
      team: f.team.trim(),
      track: f.track,
      status: "pending",
      submitted_at: today,
      game_version: f.game_version?.trim(),
      videos: videos.map((url, i) => ({ url, label: videos.length > 1 ? `Part ${i + 1}` : "Full run" })),
      milestones,
      method: clean({
        summary: f.summary.trim(),
        models: f.models.split(",").map((s) => s.trim()).filter(Boolean),
        observation: f.observation.trim(),
        action: f.action.trim(),
        game_speed: f.game_speed?.trim(),
        human_intervention: f.human_intervention?.trim() || "none",
        restarts: f.restarts?.trim(),
        paper: f.paper?.trim(),
        code: f.code?.trim(),
      }),
      hardware: clean({
        gpu: f.gpu?.trim(),
        cpu: f.cpu?.trim(),
        ram_gb: f.ram_gb ? Number(f.ram_gb) : undefined,
        os: f.os?.trim(),
        inference: f.inference.trim(),
      }),
      wall_clock: f.wall_clock?.trim(),
      cost: f.cost?.trim(),
      notes: f.notes?.trim(),
    });
    const json = JSON.stringify(sub, null, 2);
    app.querySelector("#json").textContent = json;
    app.querySelector("#output").hidden = false;
    app.querySelector("#pathHint").textContent = `PR path: data/submissions/${f.game}/${id}.json`;
    const gameTitle = DATA.games.find((g) => g.id === f.game)?.title ?? f.game;
    const body = `Submission generated on the GameClear Dojo site.\n\n\`\`\`json\n${json}\n\`\`\`\n`;
    const issue = new URL(repoUrl("/issues/new"));
    issue.searchParams.set("title", `[Run] ${gameTitle} — ${sub.agent} (${sub.team})`);
    issue.searchParams.set("labels", "submission");
    issue.searchParams.set("body", body);
    app.querySelector("#issue").href = issue.toString();
    app.querySelector("#copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(json);
        app.querySelector("#copy").textContent = "Copied";
      } catch {
        app.querySelector("#copy").textContent = "Copy failed — select the text";
      }
    };
  });
}

// ---------- router ----------
function render() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const [pathPart, query = ""] = hash.split("?");
  const parts = pathPart.split("/").filter(Boolean);
  const params = new URLSearchParams(query);
  let html, bind, nav;
  if (parts[0] === "game" && parts[1]) {
    html = viewGame(decodeURIComponent(parts[1]));
    bind = () => bindGame(parts[1]);
    nav = "home";
    document.title = `${DATA.games.find((g) => g.id === parts[1])?.title ?? "Game"} · GameClear Dojo`;
  } else if (parts[0] === "rules") {
    html = viewRules();
    nav = "rules";
    document.title = "Rules · GameClear Dojo";
  } else if (parts[0] === "submit") {
    html = viewSubmit(params);
    bind = bindSubmit;
    nav = "submit";
    document.title = "Submit a run · GameClear Dojo";
  } else {
    html = viewHome();
    nav = "home";
    document.title = "GameClear Dojo";
  }
  app.innerHTML = html;
  bind?.();
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === nav));
}

let lastPath = null;
window.addEventListener("hashchange", () => {
  const path = location.hash.split("?")[0];
  if (path !== lastPath) {
    gameState.track = "all";
    gameState.minEvidence = "news";
    window.scrollTo(0, 0);
  }
  lastPath = path;
  render();
});

load()
  .then(() => {
    lastPath = location.hash.split("?")[0];
    render();
  })
  .catch((e) => {
    app.innerHTML = `<div class="empty">Could not load leaderboard data: ${esc(e.message)}<br/>Run <code>npm run dev</code> to build data.json and preview locally.</div>`;
  });
