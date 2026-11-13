# GameMoonshot

**Clear the game. Gamify every task. Reach AGI.**

*Game + Moonshot: finishing a game is this era's moonshot for AI. The site's **Why games** page makes the case.*

A leaderboard for AI agents that play through real, full-length video games — mainly modern titles such as Elden Ring, Cyberpunk 2077, GTA V, Red Dead Redemption 2 and Black Myth: Wukong, plus strategy, engineering and story-heavy games (Civilization VI, Factorio, Kerbal Space Program, Baldur's Gate 3), with retro and 2D games (Pokémon, NetHack, Super Mario Bros.) kept further down for comparison.

Unlike [VideoGameBench](https://arxiv.org/abs/2505.18134), which runs one fixed harness on 1990s Game Boy and MS-DOS games, GameMoonshot collects runs from any agent design and scores them by story milestones, with evidence labels.

- **One board per game.** Each game is split into ordered milestones (gym badges, chapters, bosses, advancements) ending in a clear condition.
- **Partial runs count.** An agent that beats three Sekiro bosses is on the board; one that rolls credits ranks above it.
- **Video, not numbers.** Every milestone claim points at a timestamp in a public, unedited video. Maintainers verify.
- **Disclosed setup.** Each run lists hardware, models, observation/action space, and any human intervention.
- **Human baselines.** Every board shows the human speedrun record for context.
- **Evidence levels.** Every run is labelled human-verified, video, author report, or news only.
- **Per-game skins.** Each game page is styled after its game (gilded dark fantasy, sunset city, neon cyberware, tactical HUD, frontier print, ink and vermilion, handheld pixel RPG, blocky sandbox, terminal…) using original CSS art, not official assets.
- **Watch in place.** YouTube, Bilibili and Twitch videos play inside the site; each game has a progress-over-time chart.
- **Two tracks.** *Pixels-only* (frames in, keyboard/mouse/controller out) and *Harness* (game memory, APIs, custom tools).

## Run locally

```bash
npm run dev        # validate data, rebuild data.json, serve on http://localhost:4173
npm run build      # validate data/ and rebuild data.json — run this before committing data changes
npm run validate   # what CI runs: validate data/ and check data.json is up to date
```

Node 18+; no dependencies.

## Layout

```
index.html, app.js, style.css, config.js, favicon.svg   the site (served from the repo root)
data.json                   generated bundle the site loads — commit it, don't edit by hand
data/games/                 game definitions: milestones, clear condition, human baselines
data/submissions/<game>/    one JSON file per run
scripts/build.mjs           validator + bundler -> data.json
.github/                    CI (validate on every PR/push) and issue forms
docs/DATA_FORMAT.md         schema for games and submissions
```

## Submitting a run

1. Open the site's **Submit a run** page, fill in the form, and click *Generate submission*.
2. Either click *Open GitHub issue* (a maintainer turns it into a PR), or add the generated file at `data/submissions/<game>/<id>.json` in your own PR and run `npm run build` so `data.json` is updated too.
3. CI validates the file. A maintainer watches the claimed milestones and flips `status` from `pending` to `verified`.

See the Rules page on the site and [docs/DATA_FORMAT.md](docs/DATA_FORMAT.md).

## Adding a game

Add `data/games/<id>.json` with an ordered milestone list (exactly one marked `"final": true`), a `tier` (`modern` for 3D real-time games, `classic` for retro / 2D / turn-based) and sourced human baselines, then `npm run build`. The home page lists modern games first.

## Deploying

GitHub Pages serves the repo root directly — no build step on GitHub.

1. Set `repo` in `config.js` to the GitHub `owner/name`.
2. Repository → Settings → Pages → Source: **Deploy from a branch**, Branch: **main**, folder **/ (root)**.
3. The site is then at `https://<owner>.github.io/<repo>/`. For the shortest URL, name the repository `<owner>.github.io` (served at `https://<owner>.github.io/`) or add a custom domain.

`.nojekyll` turns off Jekyll processing so files are served as-is.
