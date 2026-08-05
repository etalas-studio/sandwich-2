# Auto PR Toggle — Implementation Plan

4 August 2026 · Spec: `docs/superpowers/specs/2026-08-04-auto-pr-toggle-design.md`

## Global Constraints

- All existing tests must keep passing
- Auto-PR ON path must be behavior-preserving (no regression)
- `prSummary` for auto-PR OFF done tickets = `"PR content ready — click Open PR to create."`
- Mechanical PR fallback template: title = `Fix: {summary}`, description = `{description}\n{url}\n---\nAutomated by Runchise pipeline • Ticket {key}`
- FIX_BASE for re-reviews uses commit before fix dispatch

## Tasks

### Task 1: Database migration — add pr_title, pr_description columns to tickets
- File: `src/db/migrations/0010_add_pr_content_columns.ts`
- ALTER TABLE tickets ADD COLUMN pr_title TEXT, pr_description TEXT
- Update Ticket interface and queries in `src/db/tickets.ts`
- Update frontend Ticket type in `web/src/types.ts` and `web/src/api/tickets.ts`

### Task 2: Refactor runOpenPr — extract generatePrContent() + executePr()
- File: `src/pipeline/ticket-runner.ts`
- Extract `generatePrContent()`: takes ticket + worktree + modelId → { title, description }
- Extract `executePr()`: takes db + ticket + repoPath + title + description → prUrl
- `runOpenPr()` calls both in sequence (unchanged behavior)
- Write tests for `generatePrContent()` and `executePr()` independently

### Task 3: Pipeline auto-PR OFF branching + new API endpoint
- Files: `src/pipeline/ticket-runner.ts`, `src/routes/tickets.ts`
- In `case "open_pr":`: when autoOpenPr is false, call generatePrContent(), store in DB, mark done
- New endpoint: `POST /api/tickets/:key/open-pr` → reads stored content, calls executePr()
- Write tests for both paths

### Task 4: Frontend — "Open PR" button in TicketDetail
- File: `web/src/components/TicketDetail.tsx`
- When ticket done + prTitle present + no prUrl → show "Open PR" button
- Button calls `POST /api/tickets/:key/open-pr`, shows loading, success/error
- Write component test for the new button state
