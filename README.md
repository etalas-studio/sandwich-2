# runchise-agent-pipeline

A self-contained web application that assesses a codebase's readiness for autonomous AI agents and manages a ticket backlog. It scans your project — mechanically and with an AI pass — to produce area-by-area risk signals, blocklist entries, and actionable recommendations, then lets you track improvement tickets.

Runs as a single Node.js process with an embedded SQLite database and a React frontend. No Docker, no Postgres, no Redis.

## What it does

1. **Readiness scan** — you point it at a git repository, pick an AI provider, and it runs two passes:
   - **Mechanical** (fast, no AI): detects the tech stack, test command, groups top-level directories into areas with file/churn/signal counts.
   - **Agent pass** (Pi SDK): an AI model explores the codebase and returns a project description, logical area boundaries with risk notes, blocklist patterns (files an agent should never touch), and specific recommendations for making the repo more agent-friendly.

2. **Ticket tracker** — create, edit, delete, and list tickets. Each ticket has a key, description, URL, status, and stage. Intended for tracking improvement work surfaced by the readiness scan.

3. **Provider integrations** — connect AI providers (OpenCode Go via API key, OpenAI Codex via subscription) through the UI. Credentials are stored in the local SQLite database. Model selection dropdown on the scan page.

4. **Purge** — one-click reset of all user data (scans, tickets, users, sessions, credentials) to start fresh.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js built-in `http` module, TypeScript |
| Database | SQLite via `better-sqlite3` |
| AI engine | Pi SDK (`@earendil-works/pi-coding-agent`) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Auth | Custom username/password with session cookies (bcrypt hashing) |

No Express, no ORM, no framework. The server is `node:http`, routing is a hand-rolled trie-based router, and SQL is written directly.

## Getting started

```bash
npm install
npm run build
npm start        # builds and starts the server
```

Opens at `http://127.0.0.1:4319`. On first visit you'll set up an account, then connect a provider in **Integrations** and point the app at a git repository in **Settings**.

### Development

```bash
npm run dev:web    # Vite dev server on :5173, proxies /api to :4319
npm run serve      # backend only (runs from dist/)
npm run test       # typecheck + run all tests
```

## Project structure

```
src/
  auth/            Password hashing, session validation, cookie handling
  db/              SQLite connection, migrations, per-table queries
  engine/          Claude Code CLI invokers (PTY and headless), types
  pipeline/        Pi SDK integration layer, credential store
  routes/          HTTP route handlers (auth, settings, integrations, scans, tickets, purge)
  scanner/         Readiness scan: mechanical pass + AI agent pass
  router.ts        Trie-based HTTP router with middleware
  web-server.ts    Server entry point
web/
  src/
    components/    React components (Sidebar, TicketCard, ReadinessCard, etc.)
    App.tsx        Routes: /tickets, /overview, /settings, /integrations
```

## API routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/me` | Check auth state (setup_required, unauthenticated, or user info) |
| POST | `/api/auth/register` | Create first/only account |
| POST | `/api/auth/login` | Login, returns session cookie |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/settings/project` | Get repo path and first-run status |
| POST | `/api/settings/project` | Set repo path |
| GET | `/api/integrations` | List provider connection status |
| POST | `/api/integrations/:providerId/connect` | Add API key for a provider |
| POST | `/api/integrations/:providerId/disconnect` | Remove API key |
| GET | `/api/scans/latest` | Most recent readiness scan result |
| POST | `/api/scans/run` | Start a new readiness scan |
| POST | `/api/scans/abort` | Abort a running scan |
| GET | `/api/tickets` | List all tickets |
| POST | `/api/tickets` | Create a ticket |
| PUT | `/api/tickets/:key` | Update a ticket |
| DELETE | `/api/tickets/:key` | Delete a ticket |
| POST | `/api/purge` | Delete all user data (scans, tickets, users, sessions, credentials) |

## Database

Single SQLite file at `data/instance.sqlite` (configurable via `DB_PATH`). Tables:

- `users` — single-account auth
- `sessions` — bearer tokens with expiry
- `credentials` — provider API keys
- `instance_settings` — repo path, first-run timestamp
- `readiness_scans` — scan results (status, tech stack, area signals, recommendations)
- `blocklist` — files/patterns agents should never touch
- `tickets` — improvement tickets with status tracking
- `schema_migrations` — migration version tracking

Foreign keys are enforced. Migrations run automatically on startup.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4319` | Server port |
| `DB_PATH` | `data/instance.sqlite` | SQLite database path |
| `WEB_ROOT` | `web/dist` | Static file serving directory |
| `COOKIE_SECURE` | `0` | Set to `1` for HTTPS-only session cookies |
| `TRUSTED_HOSTS` | (empty) | Comma-separated allowed Host header values |
| `ALLOW_LIVE_CLAUDE_CHECK` | (unset) | Must be `1` to run live Claude Code tests (costs real tokens) |
