# Design: Target Repo Panel in Settings

Written 31 July 2026.

## Problem

The header already shows a subtle folder-name + branch label (`runchise · master`), but during the pilot it should be unambiguous which exact directory on disk the orchestrator is pointed at — not just the last path segment. This matters because `repoPath` in `config/pipeline.json` is a relative path (`../runchise`), resolved from project root, and has previously gone astray when misunderstood (see CLAUDE.md trap #6).

## Scope

- Add a "Target repo" panel to the existing Settings tab showing the full absolute `repoPath` and `baseBranch`.
- Header is unchanged — folder name + branch is enough there; the full path belongs somewhere more deliberate (Settings), not cluttering the header.
- No new API endpoints. No orchestrator, guardrail, or config-loading changes. Purely additive/display.

## Data Flow

`config.repoPath` is already resolved to an absolute path at load time (`src/config.ts:72`, `config.repoPath = abs(config.repoPath)`). It already flows through `/api/state` (used for the header's `state.config.repoPath`), but the separate `/api/config` endpoint — which `Settings.tsx` fetches independently — does not currently include `repoPath` or `baseBranch`.

Changes:
1. `src/server.ts`: add `repoPath: config.repoPath` and `baseBranch: config.baseBranch` to the JSON object returned by the `/api/config` handler.
2. `web/src/types.ts`: add `repoPath: string` and `baseBranch: string` to the `ConfigResponse` interface.

## UI

New panel at the top of `web/src/components/Settings.tsx`, styled consistently with the existing "Safety limits" / "Lane rules" panels (same `.panel` + `<table>` pattern):

```
Target repo
Path     /Users/riaenriala/Documents/etalas/runchise
Branch   master
```

Full absolute path, no truncation — the whole point is to remove ambiguity about which directory is in play.

## Testing

No new automated test needed — this is a read-only display of already-validated config data (both fields already exist and are exercised by the current 38 selftests via `config.ts` loading). Verify manually in the browser: `npm run build && node dist/cli.js serve`, open Settings tab, confirm the panel renders the correct absolute path and branch.

## Out of Scope

- Any change to how `repoPath` is resolved or validated.
- Header changes.
- Warnings/highlighting if the repo looks "wrong" — not requested, would need a definition of "wrong" that doesn't exist yet.
