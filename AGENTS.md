# AGENTS.md

Wine & Proton Pulse is a local news aggregator and game-compatibility dashboard for Linux gaming.

## Commands

- `npm run dev` — Fastify API on `4320` + Vite on `5174` (Vite proxies `/api`)
- `npm run build` — build the React app into `dist/frontend`
- `npm start` — serve the built app and API (default `http://127.0.0.1:4320`)
- `npm run typecheck` — strict TypeScript check
- `npm run lint` — ESLint
- `npm test` — Vitest unit + integration tests
- `npm run test:coverage` — coverage with enforced thresholds
- `npm run test:e2e` — build + Playwright E2E (fixture-seeded, offline)
- `npm run verify` — typecheck → lint → unit/integration → build → E2E
- `npm run seed:demo` — reset `.tmp/demo-data` and seed deterministic fixtures
- `npm run seed:live` — perform one real sync into `data/`
- `npm run sync:games` — refresh Steam/ProtonDB compatibility for the live DB
- `npm run docs:screenshots` — capture `docs/` screenshots from a running demo server
- `npm run e2e:server` — seed fixtures and serve the E2E build on `4321`

## Architecture

- `server/app.ts` — `createApp()` returns the Fastify app plus context, sync manager, scheduler and SSE hub. Keep this testable and side-effect free.
- `server/index.ts` — production wiring, migrations, HTTP client, graceful shutdown.
- `server/config.ts` — environment config and source definitions.
- `server/db/` — libsql/SQLite connection, migrations and repository. Use parameterized SQL only.
- `server/lib/` — HTTP, text, Markdown, classification, query and time helpers.
- `server/sources/` — one module per upstream: WineHQ GitLab, GitHub releases, RSS, Steam, ProtonDB, AWA.
- `server/services/` — compatibility sync, news sync manager, scheduler and SSE hub.
- `server/routes/` — API routes; shared DTOs live in `shared/types.ts`.
- `src/` — React 19 + Vite + Tailwind 4 UI. Views live in `src/views/`, reusable UI in `src/components/`, data hooks in `src/hooks/`.
- `tests/e2e/` — Playwright tests; `server/test/fixtures/` contains committed real-world samples.

## Data flow

- News sync: AWA (if stale) → build game matcher → Wine/GitHub/RSS sources → upsert.
- Compatibility sync: Steam featured categories → ProtonDB summaries → tier snapshots and events.
- Scheduler runs news every `NEWS_REFRESH_MINUTES`; games and AWA refresh on their own staleness windows.
- SSE (`/api/events`) pushes `news_update`, `games_update`, `awa_update`, `fetch_complete` and `fetch_error`. The client also polls stats.

## Testing rules

- **Never call live upstream APIs in unit, integration or E2E tests.** Use `server/test/fixtures` and `createFixtureHttpClient()`.
- Add or update a fixture and a test whenever a source parser or classifier changes.
- E2E uses a deterministic seeded database and `DISABLE_SCHEDULER=1`.
- Do not weaken or skip tests to make a change pass. Run `npm run verify` before finishing.
- For UI changes, inspect the screenshots in `test-results/screenshots/` and keep the axe check at zero serious/critical violations.

## Conventions

- TypeScript strict; avoid `any` unless the upstream shape is genuinely untrusted.
- No comments unless they explain a non-obvious decision.
- Use the existing dark “pulse” palette (`ink`, `mist`, `wine`, `proton`) and lucide icons.
- Keep external links `target="_blank"` + `rel="noopener noreferrer"`.
- Store times as epoch seconds in SQLite and return epoch seconds from the API.
- Deduplicate by stable source IDs; do not delete cached data when an upstream fails.
- `data/`, `.tmp/`, `dist/`, `test-results/` and `playwright-report/` are generated and ignored.

## Environment

- `PORT` (default `4320`), `HOST` (default `127.0.0.1`), `DATA_DIR` (default `./data`).
- Optional `GITHUB_TOKEN` raises the GitHub API limit. `DISABLE_SCHEDULER=1` is useful for local UI work.
- The existing AI dashboard may occupy port `3000`; do not assume it is free.

## OpenCode harness

- `/verify` runs the full verification suite.
- `qa` is a read-only subagent for independent test and screenshot review.
- Playwright MCP is configured in `opencode.json` for interactive browser checks.
