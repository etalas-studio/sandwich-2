# runchise-agent-pipeline

A self-contained web application that assesses a codebase's readiness for autonomous AI agents and manages a ticket backlog. It scans your project — mechanically and with an AI pass — to produce area-by-area risk signals, blocklist entries, and actionable recommendations, then lets you track improvement tickets.

Runs as a single Node.js process with an embedded SQLite database and a React frontend. No Docker, no Postgres, no Redis.

## What it does

1. **Readiness scan** — you point it at a git repository, pick an AI provider, and it runs two passes:
   - **Mechanical** (fast, no AI): detects the tech stack, test command, groups top-level directories into areas with file/churn/signal counts.
   - **Agent pass** (Pi SDK): an AI model explores the codebase in a throwaway git worktree and returns a project description, logical area boundaries with risk notes, blocklist patterns (files an agent should never touch), and specific recommendations for making the repo more agent-friendly.

2. **Ticket tracker** — create, edit, delete, and list tickets, or pull them from Jira via OAuth (Bitbucket OAuth connects but has no ticket-pull yet). Each ticket has a key, summary, description, URL, status, and stage.

3. **Ticket pipeline** — a four-stage autonomous run per ticket, triggered from the UI: **Judge** (blocklist check + AI agent-ready/needs-human/quick-win call) → **Implement** (creates a real `git worktree`, invokes the agent to write code) → **Verify** (agent self-reviews its own diff) → **Open PR**. Runs in an isolated worktree, streams live progress via polling (and SSE for the ticket-run route), and can be stopped mid-run. **Open PR is currently fake** — it fabricates a PR URL and doesn't call any real VCS API; nothing is actually pushed or opened anywhere.

4. **Provider integrations** — connect AI providers (OpenCode Go, Anthropic, or OpenAI Codex) through the UI, plus Jira/Bitbucket OAuth for ticket import. Credentials are stored in the local SQLite database. Model selection dropdown on the scan page.

5. **Purge** — one-click reset of all user data (scans, tickets, users, sessions, credentials) to start fresh.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js built-in `http` module, TypeScript |
| Database | SQLite via `better-sqlite3` |
| AI engine | Pi SDK (`@earendil-works/pi-coding-agent`) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Auth | Custom username/password with session cookies (scrypt hashing) |

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
  auth/            Password hashing (scrypt), session validation, cookie handling
  db/              SQLite connection, migrations, per-table queries
  engine/          Claude Code CLI invokers (PTY and headless) — unused by the live app;
                   kept as a reference for the approach the Pi SDK replaced
  pipeline/        Pi SDK integration layer, credential store, OAuth (Jira/Bitbucket),
                   ticket-runner.ts (the Judge/Implement/Verify/Open PR pipeline)
  routes/          HTTP route handlers (auth, settings, integrations, oauth, scans,
                   tickets, ticket-run, purge)
  scanner/         Readiness scan: mechanical pass + AI agent pass
  router.ts        Trie-based HTTP router with middleware
  web-server.ts    Server entry point
web/
  src/
    components/    React components (Sidebar, TicketCard, TicketDetail, ReadinessCard, etc.)
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
| POST | `/api/settings/sync` | `git pull` the configured repo path |
| GET | `/api/integrations` | List provider connection status |
| POST | `/api/integrations/:providerId/connect` | Add API key for a provider |
| POST | `/api/integrations/:providerId/disconnect` | Remove API key |
| GET | `/api/integrations/jira/authorize` | Start Jira OAuth flow |
| GET | `/api/integrations/jira/callback` | Jira OAuth callback (public) |
| GET | `/api/integrations/bitbucket/authorize` | Start Bitbucket OAuth flow |
| GET | `/api/integrations/bitbucket/callback` | Bitbucket OAuth callback (public) |
| GET | `/api/scans/latest` | Most recent readiness scan result |
| POST | `/api/scans/run` | Start a new readiness scan |
| POST | `/api/scans/abort` | Abort a running scan |
| GET | `/api/tickets` | List all tickets |
| POST | `/api/tickets` | Create a ticket |
| PUT | `/api/tickets/:key` | Update a ticket |
| DELETE | `/api/tickets/:key` | Delete a ticket |
| POST | `/api/tickets/pull` | Import tickets from Jira (OAuth must be connected) |
| POST | `/api/tickets/:key/run` | Run the Judge → Implement → Verify → Open PR pipeline on a ticket |
| POST | `/api/tickets/:key/resolve` | Answer a quick-win judge question, injects the choice and reruns |
| GET | `/api/tickets/:key/stream` | SSE stream of a ticket's pipeline progress |
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
