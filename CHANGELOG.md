# Changelog

Append-only. One entry per completed implementation task (not per phase, not on a fixed schedule) — logged as part of that task's own completion commit, so this never goes stale relative to what's actually been built.

Format: `- YYYY-MM-DD: Task N — what it delivered`

- 2026-08-03: Task 1 — PoC comparing headless (`claude -p`) vs interactive PTY Claude Code invocation; selected headless (poc/README.md)
- 2026-08-03: Task 2 — Defined the EngineInvoker interface and result types (src/engine/types.ts)
- 2026-08-03: Task 3 — Implemented ClaudeCodeInvoker for headless claude -p invocation (src/engine/claude-code.ts, src/engine/proc.ts)
- 2026-08-03: Task 4 — Verified ClaudeCodeInvoker end-to-end against the real Claude Code CLI (src/engine/manual-check.ts)
