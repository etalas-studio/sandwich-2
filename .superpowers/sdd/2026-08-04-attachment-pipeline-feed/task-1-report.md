# Task 1 Report: `downloadAttachments` helper + unit test

## What I implemented

Added `downloadAttachments` function to `src/pipeline/ticket-runner.ts` — a helper that downloads ticket attachments from Jira's API to a local filesystem directory. The function:

- Parses `attachmentsJson` (JSON string of `[{ filename, mimeType, size, url }]`)
- Skips immediately if `token` is null or `attachmentsJson` is null/empty/invalid
- Creates `destDir` with `mkdirSync({ recursive: true })`
- Deduplicates filenames by appending `-2`, `-3`, etc.
- Fetches each attachment with `Authorization: Bearer <token>` header
- Logs and skips individual download failures (HTTP errors, network errors)
- Accepts an optional `fetchFn` parameter for testability (defaults to global `fetch`)

Added 5 unit tests in `src/pipeline/ticket-runner.test.ts`:
1. Downloads attachments to the target directory (happy path)
2. Skips all when token is null
3. Skips all when attachmentsJson is null or empty
4. Continues after individual download failure
5. Handles duplicate filenames by appending -2, -3

## Tests run and results

### RED (TDD Step 2)
```
$ npm run build
src/pipeline/ticket-runner.test.ts(10,61): error TS2305: Module '"./ticket-runner.js"' has no exported member 'downloadAttachments'.
```
Expected: FAIL — `downloadAttachments` not yet exported.

### GREEN (TDD Step 4)
```
$ npm run build && node --test dist/pipeline/ticket-runner.test.js
# tests 14
# pass 14
# fail 0
```
All 14 tests pass (9 existing + 5 new).

### Full suite
```
$ npm run test
# tests 85
# pass 84
# fail 1 (pre-existing node-pty spawn issue — unrelated)
```

## Files changed

- `src/pipeline/ticket-runner.ts` — Added `downloadAttachments` export, `mkdirSync`/`writeFileSync`/`extname` imports
- `src/pipeline/ticket-runner.test.ts` — Added `downloadAttachments` import, `readFileSync` import, 5-test `describe("downloadAttachments", ...)` suite

## Self-review findings

- Follows existing code patterns (async functions, JSDoc, error handling style)
- No changes to `InvokerFactory` interface
- All edge cases from the design spec covered: null token, null/empty JSON, duplicate filenames, individual failure resilience
- Mock fetch type mismatch resolved with `any` parameter (the test project uses `lib: ["ES2022"]` without DOM types, so `RequestInfo`/`URL`/`Request` aren't available)

## Concerns

None. Implementation is clean, tests are thorough, and the function is ready for Task 2 integration into the Judge stage.
