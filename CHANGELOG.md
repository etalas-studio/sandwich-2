# Changelog

Append-only. One entry per completed implementation task (not per phase, not on a fixed schedule) — logged as part of that task's own completion commit, so this never goes stale relative to what's actually been built.

Format: `- YYYY-MM-DD: [plan-name] | @githubusername - what it delivered`

- 2026-08-03: [engine-invocation-layer] | @potensio - PoC comparing headless (`claude -p`) vs interactive PTY Claude Code invocation; selected headless (poc/README.md)
- 2026-08-03: [engine-invocation-layer] | @potensio - Defined the EngineInvoker interface and result types (src/engine/types.ts)
- 2026-08-03: [engine-invocation-layer] | @potensio - Implemented ClaudeCodeInvoker for headless claude -p invocation (src/engine/claude-code.ts, src/engine/proc.ts)
- 2026-08-03: [engine-invocation-layer] | @potensio - Verified ClaudeCodeInvoker end-to-end against the real Claude Code CLI (src/engine/manual-check.ts)
- 2026-08-03: [pty-engine-toggle] | @potensio - Added node-pty as a root dependency for the PTY engine invocation mode
- 2026-08-03: [pty-engine-toggle] | @potensio - Implemented ClaudeCodePtyInvoker for interactive PTY-based Claude Code invocation (src/engine/claude-code-pty.ts)
- 2026-08-03: [pty-engine-toggle] | @potensio - Added createEngineInvoker factory to toggle between headless and PTY invocation modes (src/engine/create-invoker.ts)
- 2026-08-03: [pty-engine-toggle] | @potensio - Verified ClaudeCodePtyInvoker end-to-end against the real Claude Code CLI, including the real trust dialog (src/engine/manual-check-pty.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added better-sqlite3 as a dependency for the embedded SQLite storage layer
- 2026-08-03: [storage-sqlite] | @potensio - Added SQLite migration runner, connection, and initial schema (src/db/connection.ts, src/db/migrate.ts, src/db/migrations/)
- 2026-08-03: [storage-sqlite] | @potensio - Added tickets repository module (src/db/tickets.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added runs repository module (src/db/runs.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added reviews repository module (src/db/reviews.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added readiness_scans repository module (src/db/readiness-scans.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added blocklist_entries repository module (src/db/blocklist.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added credentials repository module (src/db/credentials.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added users repository module (src/db/users.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added sessions repository module (src/db/sessions.ts)
- 2026-08-03: [storage-sqlite] | @potensio - Added instance_settings repository module (src/db/settings.ts)
- 2026-08-03: [ticket-list-view] | @potensio - Added Tailwind CSS as a real build dependency for web/ (web/tailwind.config.js, web/postcss.config.js, web/src/tailwind.css), replacing the design system doc's CDN-only setup
- 2026-08-03: [ticket-list-view] | @potensio - Added minimal src/web-server.ts exposing GET /api/tickets from the real DB, separate from the prior attempt's src/server.ts
- 2026-08-03: [ticket-list-view] | @potensio - Added dev-only seed script for sample tickets (src/seed-tickets.ts)
- 2026-08-03: [ticket-list-view] | @potensio - Added the ticket list screen (web/src/components/TicketList.tsx) as the web app's entry point, styled per docs/design-system.html
- 2026-08-03: [ticket-list-view] | @potensio - Renamed npm scripts so `npm start`/`npm run serve` run the new app; prior-attempt equivalents moved to `start:legacy`/`serve:legacy`
