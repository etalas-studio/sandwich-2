# Attachment Pipeline Feed — Design

4 August 2026

## Problem

Tickets pulled from Jira include attachments (screenshots, log files, PDFs), but the pipeline's AI agent only sees `summary`, `key`, `description`, and `url`. The agent has no access to attachment content, so it works blind on tickets whose essential context lives in screenshots or attached files.

Attachments are already stored as JSON metadata (`[{ filename, mimeType, size, url }]`) in the `tickets.attachments` column. A working proxy route (`GET /api/tickets/:key/attachments/:index`) already serves binary content through the server's Jira OAuth token. What's missing is feeding those binaries into the pipeline stages.

## Design

### Architecture: download once, reuse across stages

A cache directory under `data/attachments/{ticketKey}/` holds the downloaded binaries. Before the Judge stage, all attachments are fetched and saved there. The Judge agent sees them in the cache directory. If the ticket passes Judge and proceeds to Implement, the cache is copied into `<worktree>/.attachments/` so the agent discovers them alongside the source code. Verify stage reuses the same worktree copy.

```
data/attachments/RR-123/
├── screenshot-error.png
├── stack-trace.log
└── design-mock.png

  ┌─ Judge: cwd = repo root, prompt points to data/attachments/RR-123/
  │
  ├─ [Judge passes → worktree created]
  │
  ├─ Copy: data/attachments/RR-123/ → <worktree>/.attachments/
  │
  ├─ Implement: cwd = worktree, prompt mentions .attachments/
  ├─ Verify:   cwd = worktree, prompt mentions .attachments/
  │
  └─ Cleanup: cache dir deleted at end of run (worktree cleanup already exists)
```

### What changes

**One file:** `src/pipeline/ticket-runner.ts`

1. **New helper:** `downloadAttachments(ticket, destDir)` — parses `ticket.attachments`, fetches each via `getOAuthToken("jira")` + the stored content URL, writes to `destDir/<filename>`. Skips non-downloadable files gracefully (logged, not fatal).

2. **Judge stage (before agent invocation):**
   - Call `downloadAttachments(ticket, data/attachments/{key}/)`
   - Add to prompt: `Attachments are available at data/attachments/{key}/ — read them for visual context (screenshots, diagrams, etc.).`

3. **Implement stage (after worktree creation, before agent invocation):**
   - If cache dir exists, copy recursively to `<worktree>/.attachments/`
   - Add to prompt: `Ticket attachments are in the .attachments/ directory.`

4. **Verify stage:** No code change — `.attachments/` already exists from Implement.

5. **End-of-run cleanup:** Delete `data/attachments/{key}/` (added alongside existing worktree cleanup).

### What does NOT change

- `InvokerFactory` / invoker interface — stays plain `{ prompt, cwd, timeoutMs }`
- Model selection — Claude Sonnet already handles vision (reads screenshots from filesystem)
- DB schema — `attachments` column is already TEXT/JSON
- Frontend — proxy route for browser downloads is unchanged and independent
- Prompt structure beyond the added attachment locator lines

### Decisions

| Question | Decision | Why |
|---|---|---|
| Download once or per stage? | Once, cached | Avoids redundant network calls; attachments are small |
| Full flat image inlining vs filesystem? | Filesystem | No interface changes; Claude reads files natively; saves tokens |
| Include all attachments? | Yes, all | Filtering by MIME type adds complexity for marginal benefit; Claude skips unreadable files |
| Skip large files? | No explicit limit | Jira already enforces per-instance attachment size caps |
| Cache location | `data/attachments/{key}/` | Outside repo, ignored by git |
| What if download fails mid-pipeline? | Skip that attachment, log, continue | Don't block the pipeline over a single broken attachment URL |

### Edge cases

- **No attachments:** no-op — don't create empty directories, don't mention attachments in prompt
- **Duplicate filenames:** append `-2`, `-3`, etc. (simple dedup)
- **Jira token expired mid-download:** catch, log, skip remaining attachments, continue pipeline
- **Attachment file is binary/unreadable:** downloaded anyway; Claude handles or ignores it gracefully
- **Zero-byte attachment:** still download, still place; Claude can handle empty files
