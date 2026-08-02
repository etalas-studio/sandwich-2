# PTY Engine Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second `EngineInvoker` implementation — `ClaudeCodePtyInvoker`, driving Claude Code via a real pseudo-terminal (PTY) session instead of headless `claude -p` — selectable as an explicit opt-in, with headless remaining the default. No caller of `EngineInvoker.run()` needs to know or care which implementation is behind it.

**Architecture:** `ClaudeCodePtyInvoker` implements the same `EngineInvoker` interface already defined in `src/engine/types.ts` and already proven by `ClaudeCodeInvoker` (headless). It uses `node-pty` to spawn Claude Code interactively, replays the dialog-detection and `/exit`-forcing approach already validated in `poc/claude-pty-poc.mjs` (3/3 reliability), and extracts the final answer from the raw PTY buffer via regex (accepting the real limitation, recorded in `poc/README.md`, that ANSI-tangled output makes robust structured extraction harder than headless's clean JSON). A small factory function picks between the two implementations based on a config value, so callers depend only on `EngineInvoker`, never on which concrete class backs it.

**Tech Stack:** TypeScript (matches root `tsconfig.json`), `node-pty` (added as a real root dependency this time — the PoC's throwaway `poc/` copy doesn't count; this plan installs it properly in root `package.json`).

## Global Constraints

- Root `package.json` may gain exactly one new dependency for this plan: `node-pty`. This is deliberate and documented — confirmed to install cleanly on this machine during the original PoC (see `poc/README.md` and the original engine-invocation-layer plan's self-review notes).
- No shell (`shell: false` equivalent) — `node-pty`'s `spawn()` takes `file` and `args` as separate parameters (not a single command string), so this is inherent to the API, not something to configure — but still verify the prompt is never concatenated into a single string that could be misinterpreted.
- `tsconfig.json` stays as-is (`strict`, `noUncheckedIndexedAccess`) — do not loosen it.
- Every module gets its own file — the new PTY invoker, its dialog-handling logic, and its tests are separate files, following the same pattern as `src/engine/claude-code.ts` / `proc.ts` / `claude-code.test.ts`.
- `EngineInvoker`, `EngineRunOptions`, `EngineRunResult`, `EngineOutcome` (from `src/engine/types.ts`) are not modified — both invokers already satisfy this interface unchanged.
- This plan does not touch worktrees, the readiness scan, the pipeline stages, storage, or the UI — those consume `EngineInvoker` later, once they exist.

---

### Task 1: Add `node-pty` as a real root dependency

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `node-pty` available as an import in `src/engine/` for Task 2.

- [x] **Step 1: Install `node-pty` in the project root**

```bash
npm install node-pty
```

- [x] **Step 2: Confirm it installed and typechecks are unaffected**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: no errors (this step only adds a dependency, no code changes yet).

- [x] **Step 3: Confirm `package.json`/`package-lock.json` show exactly one new dependency**

```bash
git diff package.json
```

Expected: one line added under `"dependencies"` (not `"devDependencies"` — `node-pty` is a runtime dependency, needed whenever the PTY mode actually runs, not just during development).

- [x] **Step 4: Confirm the installed native `spawn-helper` binary is actually executable**

`node-pty` ships a prebuilt native helper binary that its own npm install does not reliably mark as executable on every machine — confirmed by direct testing during this plan's planning phase: a fresh `npm install node-pty` on this machine left `spawn-helper` as `-rw-r--r--` (not executable), which causes every single `pty.spawn(...)` call to fail immediately with `Error: posix_spawnp failed`, regardless of what binary you're trying to spawn. This is not a bug in this plan's code — it's an environment/packaging quirk worth checking for explicitly rather than debugging blind later.

```bash
find node_modules/node-pty/prebuilds -name "spawn-helper" -exec ls -la {} \;
```

If any listed `spawn-helper` file does NOT show execute permission (i.e. does not start with `-rwx`), fix it:

```bash
find node_modules/node-pty/prebuilds -name "spawn-helper" -exec chmod +x {} \;
```

Then confirm a minimal real spawn actually works before moving on — this is worth verifying now, in isolation, rather than discovering it inside Task 2's test failures:

```bash
node -e "
const pty = require('node-pty');
const term = pty.spawn('/bin/echo', ['hello from node-pty'], { name: 'xterm-256color', cols: 80, rows: 24, cwd: process.cwd() });
term.onData((d) => process.stdout.write(d));
term.onExit(() => process.exit(0));
"
```

Expected output: `hello from node-pty` (possibly followed by a shell-prompt-related control sequence, harmless). If this still fails with `posix_spawnp failed` after the `chmod`, do not proceed to Task 2 — something else is wrong with the `node-pty` install on this machine and needs to be resolved first.

- [x] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add node-pty as a root dependency for the PTY engine invocation mode"
```

---

### Task 2: Implement `ClaudeCodePtyInvoker`

**Files:**
- Create: `src/engine/claude-code-pty.ts`
- Create: `src/engine/claude-code-pty.test.ts`

**Interfaces:**
- Consumes: `EngineInvoker`, `EngineRunOptions`, `EngineRunResult`, `EngineOutcome` from `src/engine/types.ts` (already exists, unchanged).
- Produces: `ClaudeCodePtyInvoker` class, exported from `src/engine/claude-code-pty.ts`, implementing `EngineInvoker`. Consumed by Task 3's factory function.

The dialog-detection regex, the 20-second `/exit` timer, and the 90-second safety timeout below are carried over directly from `poc/claude-pty-poc.mjs`, which already proved them reliable (3/3 runs) against the real Claude Code CLI — this is not new, unvalidated logic.

- [x] **Step 1: Write the failing test — successful run extracts the answer**

```typescript
// src/engine/claude-code-pty.test.ts
import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeCodePtyInvoker } from "./claude-code-pty.js";

/**
 * A fake interactive "claude" binary: a small script that prints a fixed
 * response, then waits for input on stdin (simulating a real Claude Code
 * session sitting at its prompt after answering), and exits when it reads
 * "/exit" — mirroring the real dialog-then-answer-then-wait-for-/exit shape
 * the PoC observed. This keeps the test fast and network-free while still
 * exercising the real PTY-write/read code path.
 */
function writeFakeInteractiveBinary(scratchDir: string): string {
  const fakeBinPath = join(scratchDir, "fake-claude-pty.sh");
  writeFileSync(
    fakeBinPath,
    [
      "#!/bin/sh",
      'echo "the answer is 42"',
      "while true; do",
      "  read -r line",
      '  if [ "$line" = "/exit" ]; then exit 0; fi',
      "done",
    ].join("\n"),
  );
  chmodSync(fakeBinPath, 0o755);
  return fakeBinPath;
}

async function testExtractsAnswerAndForcesCleanExit(): Promise<void> {
  const scratchDir = mkdtempSync(join(tmpdir(), "claude-pty-invoker-test-"));
  const fakeBinPath = writeFakeInteractiveBinary(scratchDir);

  const invoker = new ClaudeCodePtyInvoker({ bin: fakeBinPath, exitAfterMs: 500 });
  const result = await invoker.run({
    prompt: "what is the answer",
    cwd: scratchDir,
    timeoutMs: 5000,
  });

  assert.equal(result.outcome, "ok");
  assert.match(result.finalText, /the answer is 42/);
  assert.equal(result.exitCode, 0);
  console.log("PASS: testExtractsAnswerAndForcesCleanExit");
}

async function main(): Promise<void> {
  await testExtractsAnswerAndForcesCleanExit();
}

void main();
```

- [x] **Step 2: Run it to confirm it fails (the module doesn't exist yet)**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: FAIL — `Cannot find module './claude-code-pty.js'`.

- [x] **Step 3: Write `src/engine/claude-code-pty.ts`**

```typescript
import * as pty from "node-pty";
import type { EngineInvoker, EngineRunOptions, EngineRunResult, EngineOutcome } from "./types.js";

export interface ClaudeCodePtyInvokerOptions {
  /** Defaults to "claude" — overridable so tests can point at a fake binary. */
  bin?: string;
  /**
   * How long to wait after the last observed output before sending "/exit"
   * to force a clean session close. Interactive Claude Code sessions never
   * exit on their own — this is required, not optional. Defaults to 20000ms,
   * matching the value validated in the original PoC (poc/claude-pty-poc.mjs).
   *
   * This is PTY-specific behavior with no headless equivalent, so it stays a
   * constructor option rather than part of EngineRunOptions — the shared
   * interface only carries what every engine implementation needs.
   */
  exitAfterMs?: number;
}

const TRUST_DIALOG_PATTERN = /Is.{0,80}this.{0,80}a.{0,80}project.{0,80}you.{0,80}trust\?/i;
const PERMISSION_DIALOG_PATTERN = /do.{0,20}you.{0,20}want.{0,20}to.{0,20}(proceed|allow)/i;

/**
 * Interactive PTY-based Claude Code invocation. Exists as an opt-in
 * alternative to headless (ClaudeCodeInvoker) for cost-durability reasons —
 * see the Phase 1 design doc's "Agent engine" section and poc/README.md for
 * the full reasoning. Both classes implement EngineInvoker identically from
 * a caller's perspective.
 */
export class ClaudeCodePtyInvoker implements EngineInvoker {
  private readonly bin: string;
  private readonly exitAfterMs: number;

  constructor(options: ClaudeCodePtyInvokerOptions = {}) {
    this.bin = options.bin ?? "claude";
    this.exitAfterMs = options.exitAfterMs ?? 20000;
  }

  async run(options: EngineRunOptions): Promise<EngineRunResult> {
    const { prompt, cwd, timeoutMs, onOutputLine } = options;
    const startedAt = Date.now();

    return new Promise((resolve) => {
      const term = pty.spawn(this.bin, [prompt], {
        name: "xterm-256color",
        cols: 120,
        rows: 30,
        cwd,
        env: process.env as Record<string, string>,
      });

      let rawBuffer = "";
      const transcript: string[] = [];
      let sawTrustDialog = false;
      let sawPermissionDialog = false;
      let finished = false;
      let exitTimer: NodeJS.Timeout | null = null;
      let safetyTimer: NodeJS.Timeout | null = null;

      const clearTimers = () => {
        if (exitTimer) clearTimeout(exitTimer);
        if (safetyTimer) clearTimeout(safetyTimer);
      };

      const finish = (outcome: EngineOutcome, exitCode: number | null) => {
        if (finished) return;
        finished = true;
        clearTimers();
        resolve({
          outcome,
          finalText: outcome === "ok" ? extractFinalText(rawBuffer) : "",
          transcript,
          durationSec: (Date.now() - startedAt) / 1000,
          exitCode,
        });
      };

      term.onData((chunk: string) => {
        rawBuffer += chunk;
        transcript.push(chunk);
        onOutputLine?.(chunk);

        if (!sawTrustDialog && TRUST_DIALOG_PATTERN.test(rawBuffer)) {
          sawTrustDialog = true;
          setTimeout(() => term.write("\r"), 500);
        }
        if (!sawPermissionDialog && PERMISSION_DIALOG_PATTERN.test(rawBuffer)) {
          sawPermissionDialog = true;
          setTimeout(() => term.write("\r"), 500);
        }
      });

      term.onExit(({ exitCode }) => {
        finish(exitCode === 0 ? "ok" : "nonzero_exit", exitCode);
      });

      exitTimer = setTimeout(() => {
        if (!finished) term.write("/exit\r");
      }, this.exitAfterMs);

      safetyTimer = setTimeout(() => {
        if (!finished) {
          term.kill();
          finish("timeout", null);
        }
      }, timeoutMs);
    });
  }
}

/**
 * Pull the agent's answer out of a raw PTY buffer. Unlike headless mode's
 * clean JSON, this buffer is mixed with ANSI escape codes and TUI chrome —
 * this is a best-effort extraction, not a robust parser. This limitation is
 * recorded in poc/README.md as the known tradeoff of the PTY approach.
 */
function extractFinalText(rawBuffer: string): string {
  // Strip common ANSI escape sequences (cursor movement, color codes) so a
  // plain-text match has a chance of finding the real answer underneath.
  // eslint-disable-next-line no-control-regex
  const stripped = rawBuffer.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
  return stripped.trim();
}
```

- [x] **Step 4: Run the test to confirm it passes**

```bash
npx tsc -p tsconfig.json && node dist/engine/claude-code-pty.test.js
```

Expected output:
```
PASS: testExtractsAnswerAndForcesCleanExit
```

If the test hangs or times out, check the fake binary's shebang line permissions (`chmodSync(fakeBinPath, 0o755)`) and confirm `node-pty` installed correctly (Task 1).

- [x] **Step 5: Write a second test — timeout path**

Add this function to `src/engine/claude-code-pty.test.ts`, and call it from `main()`:

```typescript
async function testReportsTimeoutWhenExitNeverHappens(): Promise<void> {
  const scratchDir = mkdtempSync(join(tmpdir(), "claude-pty-invoker-test-"));
  const fakeBinPath = join(scratchDir, "fake-claude-hang.sh");
  // This fake binary ignores "/exit" entirely — it never reads stdin at all,
  // so the invoker's /exit-then-safety-timeout path must be what ends the run.
  writeFileSync(fakeBinPath, "#!/bin/sh\nsleep 10\n");
  chmodSync(fakeBinPath, 0o755);

  const invoker = new ClaudeCodePtyInvoker({ bin: fakeBinPath, exitAfterMs: 100 });
  const result = await invoker.run({
    prompt: "this will hang",
    cwd: scratchDir,
    timeoutMs: 300,
  });

  assert.equal(result.outcome, "timeout");
  console.log("PASS: testReportsTimeoutWhenExitNeverHappens");
}
```

Update `main()`:

```typescript
async function main(): Promise<void> {
  await testExtractsAnswerAndForcesCleanExit();
  await testReportsTimeoutWhenExitNeverHappens();
}
```

- [x] **Step 6: Run both tests to confirm they pass**

```bash
npx tsc -p tsconfig.json && node dist/engine/claude-code-pty.test.js
```

Expected:
```
PASS: testExtractsAnswerAndForcesCleanExit
PASS: testReportsTimeoutWhenExitNeverHappens
```

- [x] **Step 7: Commit**

```bash
git add src/engine/claude-code-pty.ts src/engine/claude-code-pty.test.ts
git commit -m "Implement ClaudeCodePtyInvoker for interactive PTY-based invocation"
```

---

### Task 3: Add a factory function to select between the two invokers by config

**Files:**
- Create: `src/engine/create-invoker.ts`
- Test: `src/engine/create-invoker.test.ts`

**Interfaces:**
- Consumes: `ClaudeCodeInvoker` (from `src/engine/claude-code.ts`, already exists), `ClaudeCodePtyInvoker` (from Task 2), `EngineInvoker` (from `src/engine/types.ts`).
- Produces: `createEngineInvoker(mode: EngineInvocationMode): EngineInvoker` — the single place any future caller (pipeline stages, not part of this plan) will go to get an invoker, without needing to know either concrete class exists.

- [x] **Step 1: Write the failing test**

```typescript
// src/engine/create-invoker.test.ts
import { strict as assert } from "node:assert";
import { createEngineInvoker } from "./create-invoker.js";
import { ClaudeCodeInvoker } from "./claude-code.js";
import { ClaudeCodePtyInvoker } from "./claude-code-pty.js";

function testCreatesHeadlessInvokerByDefault(): void {
  const invoker = createEngineInvoker("headless");
  assert.ok(invoker instanceof ClaudeCodeInvoker);
  console.log("PASS: testCreatesHeadlessInvokerByDefault");
}

function testCreatesPtyInvokerWhenRequested(): void {
  const invoker = createEngineInvoker("pty");
  assert.ok(invoker instanceof ClaudeCodePtyInvoker);
  console.log("PASS: testCreatesPtyInvokerWhenRequested");
}

function main(): void {
  testCreatesHeadlessInvokerByDefault();
  testCreatesPtyInvokerWhenRequested();
}

main();
```

- [x] **Step 2: Run it to confirm it fails**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: FAIL — `Cannot find module './create-invoker.js'`.

- [x] **Step 3: Write `src/engine/create-invoker.ts`**

```typescript
import { ClaudeCodeInvoker } from "./claude-code.js";
import { ClaudeCodePtyInvoker } from "./claude-code-pty.js";
import type { EngineInvoker } from "./types.js";

/**
 * "headless" (claude -p) is the default across this project — see the
 * Phase 1 design doc's "Agent engine" section. "pty" is an explicit opt-in
 * for cost-durability reasons; nothing selects it automatically.
 */
export type EngineInvocationMode = "headless" | "pty";

/**
 * The single place that knows both concrete EngineInvoker implementations
 * exist. Every caller depends only on the returned EngineInvoker, never on
 * ClaudeCodeInvoker or ClaudeCodePtyInvoker directly.
 */
export function createEngineInvoker(mode: EngineInvocationMode): EngineInvoker {
  if (mode === "pty") {
    return new ClaudeCodePtyInvoker();
  }
  return new ClaudeCodeInvoker();
}
```

- [x] **Step 4: Run the test to confirm it passes**

```bash
npx tsc -p tsconfig.json && node dist/engine/create-invoker.test.js
```

Expected output:
```
PASS: testCreatesHeadlessInvokerByDefault
PASS: testCreatesPtyInvokerWhenRequested
```

- [x] **Step 5: Commit**

```bash
git add src/engine/create-invoker.ts src/engine/create-invoker.test.ts
git commit -m "Add createEngineInvoker factory to toggle between headless and PTY modes"
```

---

### Task 4: Manual end-to-end verification of `ClaudeCodePtyInvoker` against the real Claude Code CLI

**Files:**
- Create: `src/engine/manual-check-pty.ts` (a small script, not part of the automated test suite — mirrors the pattern already established by `src/engine/manual-check.ts` for the headless invoker)

**Interfaces:**
- Consumes: `ClaudeCodePtyInvoker` from Task 2.
- Produces: nothing consumed by later tasks — this is a one-time confirmation that the fake-binary tests in Task 2 reflect real behavior against the actual `claude` CLI, exactly as Task 4 did for the headless invoker in the prior plan.

- [x] **Step 1: Write `src/engine/manual-check-pty.ts`**

```typescript
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeCodePtyInvoker } from "./claude-code-pty.js";

async function main(): Promise<void> {
  const scratchDir = mkdtempSync(join(tmpdir(), "claude-code-pty-manual-check-"));
  writeFileSync(join(scratchDir, "greeting.txt"), "the secret word is mango\n");

  const invoker = new ClaudeCodePtyInvoker();
  console.log(`Running against real claude CLI (PTY mode) in ${scratchDir}...`);

  const result = await invoker.run({
    prompt: "Read greeting.txt and tell me exactly what the secret word is, nothing else.",
    cwd: scratchDir,
    timeoutMs: 120000,
  });

  console.log("\n=== RESULT ===");
  console.log(`outcome: ${result.outcome}`);
  console.log(`finalText (first 500 chars): ${result.finalText.slice(0, 500)}`);
  console.log(`exitCode: ${result.exitCode}`);
  console.log(`durationSec: ${result.durationSec}`);

  if (result.outcome !== "ok") {
    console.error("MANUAL CHECK FAILED: outcome was not ok");
    process.exit(1);
  }
  if (!result.finalText.toLowerCase().includes("mango")) {
    console.error("MANUAL CHECK FAILED: finalText did not mention the secret word");
    process.exit(1);
  }
  console.log("\nMANUAL CHECK PASSED");
}

void main();
```

- [x] **Step 2: Run it against the real CLI**

```bash
npx tsc -p tsconfig.json && node dist/engine/manual-check-pty.js
```

Expected: `MANUAL CHECK PASSED`, and `finalText` should contain "mango" somewhere in the raw (ANSI-stripped) buffer. This will take longer than the headless manual check (Task 4 of the prior plan took ~13-17 seconds; PTY mode's PoC observed 18-20 seconds, plus the trust dialog may appear since this is a fresh scratch directory Claude Code has never seen).

If this fails, do not proceed — check whether the trust-dialog regex still matches the real CLI's current wording (Anthropic could have changed it since the original PoC), and check whether `finalText` contains the answer but buried in enough ANSI noise that the simple `toLowerCase().includes()` check needs a more tolerant match.

- [x] **Step 3: Commit**

```bash
git add src/engine/manual-check-pty.ts
git commit -m "Add manual end-to-end check for ClaudeCodePtyInvoker against real Claude Code CLI"
```

---

## Plan Self-Review Notes

- **Spec coverage**: Implements the "PTY as opt-in toggle" decision recorded in the Phase 1 design doc's updated "Agent engine" section. Covers: a real `node-pty` dependency (Task 1), the `ClaudeCodePtyInvoker` implementation reusing the PoC's already-validated dialog-handling/exit-forcing logic (Task 2), a factory to select between headless and PTY without callers needing to know which concrete class exists (Task 3), and a real end-to-end check against the actual CLI (Task 4) — mirroring exactly the shape of verification the original headless plan used.
- **Placeholder scan**: No "TBD"/"TODO" — every step has real, complete code. The `extractFinalText` function in Task 2 is explicitly documented as "best-effort, not a robust parser" — this is an honest limitation carried over from the PoC's own findings (`poc/README.md`), not a placeholder standing in for unfinished work.
- **Type consistency**: `ClaudeCodePtyInvoker` (Task 2) implements `EngineInvoker` from `src/engine/types.ts` with identical method signature (`run(options: EngineRunOptions): Promise<EngineRunResult>`) to `ClaudeCodeInvoker` (already merged). `createEngineInvoker` (Task 3) returns the same `EngineInvoker` type regardless of mode — callers never see `ClaudeCodePtyInvoker` or `ClaudeCodeInvoker` by name. `EngineInvocationMode` is defined once in Task 3, not redefined anywhere else in this plan.
