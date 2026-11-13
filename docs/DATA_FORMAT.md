# Data format

Everything on the site is generated from JSON files in `data/`. `npm run validate` checks them; CI runs the same check on every pull request.

```
data/
  games/<game-id>.json                       one file per game
  submissions/<game-id>/<submission-id>.json one file per run
```

## Game — `data/games/<id>.json`

| field | required | notes |
|---|---|---|
| `id` | yes | kebab-case, must equal the file name |
| `title` | yes | |
| `platform`, `release_year`, `genre` | no | shown as tags |
| `description` | no | one or two sentences |
| `clear_condition` | yes | what "beating the game" means for this board |
| `timing` | no | how elapsed time is measured (default: run time from first input) |
| `rules` | no | game-specific rules (allowed difficulty, version, glitches…) |
| `order` | no | sort order on the home page |
| `icon` | no | emblem from `icons.js`: badge, crystal, emerald, pickaxe, horseshoe, katana, staff, flag, at, spire, shield |
| `theme` | no | two hex colors for the card / banner gradient, e.g. `["#8a2420", "#1f2a5c"]` |
| `milestones[]` | yes | ordered; each `{ id, name, description?, final? }`. Exactly one has `"final": true` — reaching it means the game is cleared |
| `human_baselines[]` | no | `{ label, time: "H:MM:SS", note?, source: url }` |
| `links[]` | no | `{ label, url }` — references, prior work |

Milestones should be things a reviewer can confirm on video in a few seconds: a badge screen, a boss "Immortality Severed" banner, a chapter title card, an advancement toast.

## Submission — `data/submissions/<game>/<id>.json`

```jsonc
{
  "id": "2026-11-13-mylab-myagent",      // kebab-case, equals file name
  "game": "sekiro",                       // must exist in data/games
  "agent": "MyAgent",
  "team": "My Lab",
  "track": "pixels",                      // "pixels" | "harness"
  "status": "pending",                    // "pending" | "verified" | "curated" | "rejected" (maintainers set this)
  "submitted_at": "2026-11-13",
  "game_version": "1.06",
  "source": "https://...",                // required for "curated" entries: where the result was reported
  "source_type": "author",                // required for "curated": "author" (first-party report) | "news" (third-party press)
  "extra_sources": [ { "label": "Dumplog", "url": "https://..." } ],
  "verified_by": "maintainer-handle",     // required once status is "verified"
  "verified_at": "2026-11-20",            // required once status is "verified"

  // YouTube, Bilibili and Twitch links play inside the site. "full": true when the videos together cover
  // the whole run; "covers" says what a partial video shows.
  "videos": [ { "url": "https://www.youtube.com/watch?v=...", "label": "Part 1", "full": true, "covers": "..." } ],
  "milestones": [
    // video = index into videos[], timestamp = position in that video, elapsed = run time so far
    { "id": "gyoubu-oniwa", "video": 0, "timestamp": "1:02:10", "elapsed": "1:02:10" },
    { "id": "lady-butterfly", "video": 0, "timestamp": "2:40:05", "elapsed": "2:40:05", "evidence": "https://..." }
  ],

  "method": {
    "summary": "How the agent works.",
    "models": ["GPT-4o"],
    "observation": "1080p screenshots every 1s",
    "action": "keyboard + mouse",
    "human_intervention": "none",          // required; free text
    "game_speed": "real-time",
    "restarts": "agent reloads checkpoint on death",
    "paper": "https://...", "code": "https://...", "project": "https://..."
  },
  "hardware": {
    "gpu": "RTX 4090", "cpu": "i9-13900K", "ram_gb": 64, "os": "Windows 11",
    "inference": "OpenAI API",            // required
    "game_host": "same machine"
  },
  "wall_clock": "52 hours",
  "cost": "~$900 API",
  "notes": ""
}
```

## Evidence level

Each run shows one evidence badge, derived (never typed by hand) in this order:

| badge | condition |
|---|---|
| ✓ Human-verified | `status` is `verified` (requires `verified_by`, `verified_at` and at least one video) |
| ▶ Video, unverified | at least one entry in `videos` |
| ✎ Author report | `source_type` is `author` |
| 📰 News only | everything else |

Author submissions must include video, so they start at *Video, unverified*. Curated entries start at *Author report* or *News only* until someone links footage.

## Ranking

Within a game (optionally filtered by track):

1. runs that reached the `final` milestone first,
2. then more milestones reached,
3. then shorter `elapsed` at the furthest milestone (missing times sort last),
4. then earlier `submitted_at`.

Rejected runs are hidden. Pending runs are shown with a badge and can be filtered out.
