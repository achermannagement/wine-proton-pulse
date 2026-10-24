# Wine & Proton Pulse

A local dashboard and aggregator for Wine, Proton and Linux gaming compatibility news. It
turns release notes into structured, filterable changelogs, highlights **game-specific fixes**
and **newly playable titles**, and tracks ProtonDB and anti-cheat status over time.

![Wine & Proton Pulse dashboard](docs/screenshot.png)

![Game compatibility view](docs/games.png)

## What it does

- **Aggregates official release notes** from WineHQ, Valve Proton, GE-Proton, DXVK and
  VKD3D-Proton.
- **Parses changelogs into entries** — features, game fixes, general fixes, newly playable
  games, performance work and anti-cheat changes — instead of dumping raw Markdown.
- **Filters by category, source, time range and full-text search**, including inside parsed
  release entries.
- **Tracks game compatibility** with Steam top sellers/new releases, on-demand Steam search,
  ProtonDB tiers, trend data, daily history and tier-change events.
- **Shows anti-cheat status** from Are We Anti-Cheat Yet, including notes and links.
- **Keeps a local watchlist** and marks stories discovered since your last visit.
- **Stays live** with Server-Sent Events, a manual refresh with cooldown, and source health
  reporting. Failed sources never wipe cached data.

## Sources

| Source | Data | Cadence |
| --- | --- | --- |
| WineHQ GitLab Releases | Full Wine release notes, “What’s new”, fixed-bug list | 30 min |
| ValveSoftware/Proton | Stable Proton releases, hotfixes, newly playable games | 30 min |
| GE-Proton | Community Proton changelogs and game fixes | 30 min |
| DXVK / VKD3D-Proton | Graphics-layer features and game fixes | 30–60 min |
| GamingOnLinux | Linux gaming/Wine/Proton/Steam Deck coverage | 30 min |
| Phoronix | Wine/Proton/Valve/Linux-gaming headlines | 30 min |
| BoilingSteam | Steam Deck and Linux compatibility coverage | 60 min |
| r/linux_gaming | Community Wine/Proton discussion | 60 min |
| Steam + ProtonDB | Featured games, curated popular shelf, search, tiers, trends and snapshots | 6 h / on demand |
| Are We Anti-Cheat Yet | Anti-cheat status for ~1,100 games | 24 h |

All upstream requests use timeouts, retries, conservative concurrency and caching. GitHub
requests use ETags and an optional token. Reddit requests use a browser user agent and tolerate
rate limiting. Release excerpts link back to the original source.

## Quick start

```bash
npm install

# Offline demo data (recommended for a first look)
npm run seed:demo
DISABLE_SCHEDULER=1 DATA_DIR=.tmp/demo-data npm start
# open http://127.0.0.1:4320

# Or development mode with Vite HMR
npm run dev
# UI:  http://localhost:5174
# API: http://127.0.0.1:4320
```

The production server uses port **4320** because port 3000 is commonly occupied by other local
dashboards. Vite uses **5174**. Override with `PORT` / `HOST`.

### Live data

```bash
npm run seed:live
npm start
# open http://127.0.0.1:4320
```

`seed:live` performs one real sync into `data/`. The scheduler then refreshes news every 30
minutes and compatibility data every 6 hours (AWA daily). You can also click **Refresh** in the
header or **Refresh now** on the Sources page.

### Deterministic E2E data

```bash
npm run test:e2e
```

This builds the frontend, seeds `.tmp/e2e-data` from committed fixtures, starts a server on
4321, and runs Playwright. No live upstream API is contacted.

### Useful scripts

| Command | What it does |
| --- | --- |
| `npm run seed:demo` | Reset `.tmp/demo-data` and seed deterministic fixture data |
| `npm run seed:live` | One real sync into `data/` |
| `npm run sync:games` | Refresh the live Steam/ProtonDB game shelf |
| `npm run docs:screenshots` | Capture `docs/` screenshots from a running server (`BASE_URL=...`) |
| `npm run e2e:server` | Seed fixtures and serve the E2E build on 4321 |

## Configuration

Copy `.env.example` to `.env` or export variables directly.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4320` | API/production server port |
| `HOST` | `127.0.0.1` | Bind address |
| `DATA_DIR` | `./data` | SQLite directory (`pulse.db`) |
| `DISABLE_SCHEDULER` | `0` | Set to `1` for UI work or tests |
| `NEWS_REFRESH_MINUTES` | `30` | Scheduler news interval |
| `GAMES_REFRESH_HOURS` | `6` | Steam/ProtonDB staleness window |
| `AWA_REFRESH_HOURS` | `24` | Anti-cheat dataset staleness window |
| `MANUAL_REFRESH_COOLDOWN_SECONDS` | `60` | Manual refresh cooldown |
| `HTTP_TIMEOUT_MS` | `20000` | Upstream request timeout |
| `GITHUB_TOKEN` | empty | Optional; raises GitHub API limit from 60 to 5,000/hour |

## Architecture

```
server/
  app.ts, index.ts          Fastify app factory, production wiring
  config.ts                 Env + source definitions
  db/                       libsql/SQLite migrations and repository
  lib/                      HTTP, Markdown, classification, text, time, query helpers
  sources/                  WineHQ, GitHub, RSS, Steam, ProtonDB, AWA
  services/                 Sync manager, compatibility sync, scheduler, SSE hub
  routes/                   Feed, releases, games, sources, stats, SSE, refresh
shared/types.ts             API DTOs shared by server and client
src/                        React 19 + Vite + Tailwind 4 UI
tests/e2e/                  Playwright tests
server/test/fixtures/       Committed real-world samples for offline tests
```

The server parses release bodies into `news_entries` with category flags. Items and entries are
queryable by `feature`, `gamefix`, `bugfix`, `compat`, `release`, `discussion` and `anticheat`.
Game mentions are matched conservatively against a gazetteer built from Steam, AWA and a small
alias list. Compatibility snapshots are stored daily; tier changes and anti-cheat changes become
`compat_events` that feed the pulse panel.

## API

- `GET /api/feed` — paginated news with `category`, `source`, `q`, `range`, `game`, `limit`, `offset`
- `GET /api/feed/:id` — full parsed item
- `GET /api/releases` — latest version per release source
- `GET /api/games` — featured/tracked games with tier and anti-cheat filters
- `GET /api/games/:appid` — history, events, related news, anti-cheat
- `GET /api/games/search?q=` — Steam search + ProtonDB lookup
- `GET /api/compat/events` — recent tier/anti-cheat changes
- `GET /api/sources`, `GET /api/stats`, `GET /api/health`
- `GET /api/events` — Server-Sent Events
- `POST /api/refresh` — manual single-flight sync with cooldown

## Testing

```bash
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run test:e2e
npm run verify        # typecheck, lint, coverage tests, build, E2E
```

- **81 unit/integration tests** cover parsers, classifiers, source fetchers, HTTP retries/304s,
  database filters, API routes, SSE, scheduler behavior, failures and idempotency.
- **Coverage** is 86% statements / 89% lines / 70% branches, with enforced thresholds.
- **10 Playwright tests** cover feed tabs/filters/search, release drawers, game filters/search,
  watchlist, live refresh via SSE, source health, error recovery, mobile overflow and axe
  accessibility checks.
- Tests are hermetic: fixtures are committed, upstream calls are mocked, E2E uses a seeded DB.

## OpenCode harness

This project includes project-local workflow upgrades:

- `AGENTS.md` — commands, architecture, data-flow and testing rules.
- `/verify` (`.opencode/commands/verify.md`) — runs the full verification suite and reports results.
- `qa` subagent (`.opencode/agents/qa.md`) — read-only independent test and screenshot review.
- Playwright MCP (`opencode.json`) — headless browser tools for interactive UI checks.
- Permission rules allow the project’s test/build commands while requiring approval for
  destructive or pushey commands.

## Notes and limitations

- ProtonDB, Steam store endpoints and Reddit RSS are unofficial interfaces and can change or
  rate-limit. The dashboard degrades gracefully and keeps last-good data.
- ProtonDB tiers are crowd-sourced player reports, not guarantees.
- AWA status is a snapshot of a community-maintained assessment.
- Release-note parsing is heuristic. It is tested against real fixtures, but unusual formatting
  can produce imperfect groupings. The original release is always one click away.
- This is an unofficial fan project, not affiliated with Valve, WineHQ, ProtonDB, GamingOnLinux,
  Phoronix, BoilingSteam, Reddit, or Are We Anti-Cheat Yet.
