# Engine Invocation Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decide, via a throwaway PoC, whether Claude Code should be invoked headless (`claude -p`) or interactively (real PTY session), then build the real `EngineInvoker` abstraction around whichever mode wins — with Claude Code as the first concrete implementation (Pi SDK implementation is a separate later plan, once its own API is researched).

**Architecture:** A single `EngineInvoker` interface (one method: run a prompt against a target directory, get back a structured result and a live transcript stream) with one concrete implementation for now (`ClaudeCodeInvoker`), chosen at call time based on the PoC's outcome. No dependency on any other subsystem in this plan — this is purely "can we reliably run Claude Code and get its output back," decoupled from readiness scans, worktrees, or the pipeline stages that will later call it.

**Tech Stack:** TypeScript (matches existing root `tsconfig.json`: strict, `NodeNext`, ES2022), Node's built-in `child_process` for headless mode, `node-pty` (confirmed installs cleanly on this machine, adds one dependency) only if the PoC selects the interactive mode.

## Global Constraints

- Root `package.json` may only add dependencies with a clear, documented reason — this plan adds at most one (`node-pty`), added only if Task 1's PoC selects the interactive mode. If headless wins, zero new dependencies.
- No shell (`shell: false` in every spawn) — command arguments must never be interpreted by a shell, since ticket text can end up inside them.
- `tsconfig.json` stays as-is (`strict`, `noUncheckedIndexedAccess`) — do not loosen it.
- Every module gets its own file with one clear responsibility (per `writing-plans` file-structure guidance) — do not fold the PoC script, the invoker interface, and the Claude Code implementation into one file.
- This plan does **not** touch worktrees, the readiness scan, the Judge/Implement/Verify/Open-PR pipeline, storage, or the UI — those are separate plans that will consume this module's output once it exists.

---

### Task 1: PoC — determine whether an interactive PTY session with Claude Code is reliably scriptable

**Files:**
- Create: `poc/claude-pty-poc.mjs` (throwaway, plain Node.js script, not TypeScript — no build step needed to iterate quickly)
- Create: `poc/README.md` (records the outcome and reasoning, so the decision survives after the script itself is deleted)

**Interfaces:**
- Consumes: nothing (standalone script, no dependency on any other task).
- Produces: a recorded decision (`poc/README.md`) — `"headless"` or `"interactive"` — that Task 2 reads before writing the real interface. Nothing else in this plan can start until this decision is written down.

This task is exploratory by nature — the steps below are the investigation script, not a TDD cycle, because there's no "expected behavior" to assert against yet; the whole point is finding out what the real behavior is.

- [ ] **Step 1: Install `node-pty` in a scratch location, not the project**

```bash
mkdir -p poc
cd poc
npm init -y
npm install node-pty
cd ..
```

This keeps the PoC's dependency out of root `package.json` until Task 1 concludes the interactive mode is worth pursuing — if headless wins, `poc/` gets deleted wholesale and root `package.json` never sees `node-pty`.

- [ ] **Step 2: Write the PoC script that spawns Claude Code in a real PTY**

```javascript
// poc/claude-pty-poc.mjs
import * as pty from "node-pty";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Use a throwaway directory so this never touches a real repo.
const scratchDir = mkdtempSync(join(tmpdir(), "claude-pty-poc-"));
writeFileSync(join(scratchDir, "hello.txt"), "hello from the PoC\n");

console.log(`Scratch dir: ${scratchDir}`);

const term = pty.spawn("claude", ["What does hello.txt say? Just tell me the contents."], {
  name: "xterm-256color",
  cols: 120,
  rows: 30,
  cwd: scratchDir,
  env: process.env,
});

let buffer = "";
let sawTrustDialog = false;
let sawPermissionDialog = false;
let finished = false;

term.onData((chunk) => {
  buffer += chunk;
  process.stdout.write(chunk); // mirror to our own terminal so we can watch it live

  // Claude Code's first-run trust dialog asks to trust the working directory.
  if (!sawTrustDialog && /trust this (folder|directory)/i.test(buffer)) {
    sawTrustDialog = true;
    console.log("\n[POC] Detected trust dialog, sending Enter to accept default...");
    setTimeout(() => term.write("\r"), 500);
  }

  // If a permission dialog for a specific tool ever appears, log it — we are not
  // using --dangerously-skip-permissions in this PoC, so it may appear per tool-use.
  if (!sawPermissionDialog && /do you want to (proceed|allow)/i.test(buffer)) {
    sawPermissionDialog = true;
    console.log("\n[POC] Detected a permission dialog, sending Enter to accept default...");
    setTimeout(() => term.write("\r"), 500);
  }
});

term.onExit(({ exitCode }) => {
  finished = true;
  console.log(`\n[POC] Process exited with code ${exitCode}`);
  console.log(`[POC] sawTrustDialog=${sawTrustDialog} sawPermissionDialog=${sawPermissionDialog}`);
});

// Safety timeout: if nothing happens in 60s, kill it and report failure.
setTimeout(() => {
  if (!finished) {
    console.log("\n[POC] TIMEOUT — process did not exit within 60s. Killing.");
    term.kill();
    process.exit(1);
  }
}, 60000);
```

- [ ] **Step 3: Run the PoC and observe what actually happens**

```bash
node poc/claude-pty-poc.mjs
```

Watch the live output. Three things to specifically confirm, since these are the concrete unknowns:
1. Does the trust dialog actually appear, and does sending `\r` (Enter) after detecting it correctly dismiss it?
2. Does Claude Code eventually print its actual answer (should mention "hello from the PoC") into the PTY output, and can it be found in `buffer` by searching for text after the last dialog was dismissed?
3. Does the process actually exit on its own once done (interactive Claude Code sessions do not normally exit automatically — check whether a `/exit` needs to be sent, or whether some other signal marks "the turn is complete" that a real invoker could detect programmatically without a human watching).

- [ ] **Step 4: Run it two more times to check reliability, not just one lucky pass**

```bash
node poc/claude-pty-poc.mjs
node poc/claude-pty-poc.mjs
```

Non-interactive automation needs to work close to 100% of the time, not "usually." If dialog timing varies between runs (e.g., the trust dialog takes longer to appear on one run and the hardcoded `500`ms delay before sending Enter fires too early), that is a real finding — write it down, it directly affects the decision.

- [ ] **Step 5: Record the decision in `poc/README.md`**

Write down, in plain language, what was actually observed — not a hypothetical. Use this structure:

```markdown
# Claude Code Engine Invocation PoC — Result

Run on: <date>
Claude Code version tested: <output of `claude --version`>

## What was tested
Spawned Claude Code in a real PTY (via node-pty) with a single-turn prompt,
programmatically detecting and dismissing the trust dialog, watching for
task completion.

## Findings
- Trust dialog: <appeared / did not appear> — <reliably dismissed with \r? yes/no, across N runs>
- Task completion detection: <describe what signal, if any, reliably indicates
  the agent has finished its turn and the terminal is back at the prompt>
- Reliability across 3 runs: <all 3 succeeded / N of 3 succeeded, and why the
  failures happened>
- Output extraction: <was it possible to reliably pull the agent's final answer
  out of the raw PTY buffer, or was it tangled with ANSI escape codes / UI chrome
  in a way that would need significant additional parsing?>

## Decision
**Chosen invocation mode: headless (`claude -p`) / interactive (PTY)**

## Why
<one paragraph, referencing the concrete findings above — not the abstract
tradeoff already described in the design doc, but what THIS PoC actually
showed>
```

- [ ] **Step 6: Delete the scratch `node_modules` inside `poc/`, keep the script and the README**

```bash
rm -rf poc/node_modules poc/package-lock.json
```

Keep `poc/claude-pty-poc.mjs` and `poc/README.md` committed — they're small, and they're the evidence backing whichever decision Task 2 acts on. If the decision is ever revisited later, this is the record of what was actually tried.

- [ ] **Step 7: Commit**

```bash
git add poc/
git commit -m "PoC: determine headless vs interactive Claude Code invocation

Recorded outcome in poc/README.md. This decision gates Task 2's
EngineInvoker implementation."
```

**Do not proceed to Task 2 until `poc/README.md` records a clear decision.** If the PoC is inconclusive after Step 4, add a 4th and 5th run before giving up on interactive mode — but if it's still unreliable, headless is the fallback per the design doc, and that fallback should also be written into `poc/README.md` explicitly (not left implicit).

---

### Task 2: Define the `EngineInvoker` interface and error types

**Files:**
- Create: `src/engine/types.ts`
- Test: `src/engine/types.test.ts` (a plain assertion-based test file — this repo's convention is `selftest.ts`-style dependency-free tests, not a test framework; see the existing `src/selftest.ts` for the pattern to follow)

**Interfaces:**
- Consumes: the decision recorded in `poc/README.md` from Task 1 (informs which concrete shape `run()`'s streaming callback needs — headless gives structured JSON lines, interactive gives raw terminal bytes — but the interface itself is written to be agnostic of that, so Task 3's implementation is free to adapt either raw form to it).
- Produces: `EngineInvoker` interface, `EngineRunOptions`, `EngineRunResult`, `EngineOutcome` — all imported by Task 3 (the Claude Code implementation) and by every future plan that calls an engine (Judge/Implement/Verify stages, not part of this plan).

- [ ] **Step 1: Write `src/engine/types.ts`**

```typescript
/**
 * Engine-agnostic contract for invoking a coding agent. One implementation
 * exists so far (ClaudeCodeInvoker, see claude-code.ts) — this interface is
 * what lets a second engine (e.g. a Pi SDK implementation, a later plan) be
 * added without touching any code that calls an EngineInvoker.
 */
export interface EngineInvoker {
  /**
   * Run a single prompt against a target working directory and return once
   * the agent's turn is complete. Never throws for engine-level failures
   * (timeout, non-zero exit, etc.) — those are reported via EngineRunResult.outcome.
   * Only throws for programmer errors (e.g. invalid options).
   */
  run(options: EngineRunOptions): Promise<EngineRunResult>;
}

export interface EngineRunOptions {
  /** The task instruction sent to the agent. */
  prompt: string;
  /** Directory the agent operates in — always a git worktree in real use, never the main checkout. */
  cwd: string;
  /** Hard ceiling on how long a single run may take before being killed. */
  timeoutMs: number;
  /**
   * Called once per line of new output as it arrives, for live progress
   * display (the Visibility requirement in the design doc). What a "line"
   * means is engine-specific — for a JSON-lines engine it's one JSON object;
   * for a PTY-based engine it's one line of decoded terminal text.
   */
  onOutputLine?: (line: string) => void;
}

export type EngineOutcome = "ok" | "timeout" | "process_error" | "nonzero_exit";

export interface EngineRunResult {
  outcome: EngineOutcome;
  /** The agent's final answer text, extracted from raw output. Empty string if outcome !== "ok". */
  finalText: string;
  /** Every line passed to onOutputLine during the run, in order — the full transcript. */
  transcript: string[];
  durationSec: number;
  /** Process exit code, if the process actually exited (null if killed by timeout). */
  exitCode: number | null;
}
```

- [ ] **Step 2: Write `src/engine/types.test.ts` — a compile-time/shape check, not a behavior test**

Since this file only defines types and interfaces (no logic to unit-test yet), the test confirms the shapes are usable together, catching a class of mistake TDD would normally catch via a red test: a type that can't actually be constructed or satisfied as intended.

```typescript
import type { EngineInvoker, EngineRunOptions, EngineRunResult } from "./types.js";

// This file has no runtime assertions — it's a compile-time check that the
// interface is actually implementable and consumable as designed. If this
// file fails to typecheck, that's the test failing.

const fakeInvoker: EngineInvoker = {
  async run(options: EngineRunOptions): Promise<EngineRunResult> {
    options.onOutputLine?.("example line");
    return {
      outcome: "ok",
      finalText: "done",
      transcript: ["example line"],
      durationSec: 1.5,
      exitCode: 0,
    };
  },
};

async function checkUsage(): Promise<void> {
  const result = await fakeInvoker.run({
    prompt: "test prompt",
    cwd: "/tmp/example",
    timeoutMs: 1000,
    onOutputLine: (line) => console.log(line),
  });
  if (result.outcome !== "ok") throw new Error("expected ok outcome in this fake");
  console.log("PASS: checkUsage");
}

await checkUsage();
```

- [ ] **Step 3: Confirm it typechecks and runs**

```bash
npx tsc -p tsconfig.json && node dist/engine/types.test.js
```

Expected: no compile errors, and the output includes `PASS: checkUsage`. If there are compile errors, the interface shapes in `types.ts` don't actually fit together — fix `types.ts`, not the test.

- [ ] **Step 4: Commit**

```bash
git add src/engine/types.ts src/engine/types.test.ts
git commit -m "Add EngineInvoker interface and result types"
```

---

### Task 3: Implement `ClaudeCodeInvoker` for the headless (`claude -p`) mode

**Files:**
- Create: `src/engine/claude-code.ts`
- Create: `src/engine/proc.ts` (a minimal, focused copy of the reusable spawn-with-timeout logic — do not import from the prior build's `src/proc.ts` at the repo root; this plan's `src/engine/` is a fresh module tree, and pulling in the old file would silently reintroduce untested assumptions from the prior build. It's fine that the logic is similar — write it fresh here, scoped to what `claude-code.ts` needs.)
- Test: `src/engine/claude-code.test.ts`

**Interfaces:**
- Consumes: `EngineInvoker`, `EngineRunOptions`, `EngineRunResult`, `EngineOutcome` from Task 2's `src/engine/types.ts`.
- Produces: `ClaudeCodeInvoker` class, exported from `src/engine/claude-code.ts`, implementing `EngineInvoker`. No other task in this plan consumes it directly (that wiring happens in a later plan, once the pipeline stages exist) — this task's own test file is what proves it works.

This task assumes Task 1's PoC selected **headless mode**. If Task 1 selected interactive mode instead, this task's steps change materially (PTY spawn instead of `child_process.spawn`, dialog handling instead of JSON-line parsing) — in that case, stop here and write a fresh Task 3 using the same TDD shape but PTY-based mechanics, following the pattern discovered in Task 1's PoC script.

- [ ] **Step 1: Write `src/engine/proc.ts` — spawn with timeout, no shell, line-buffered stdout**

```typescript
import { spawn } from "node:child_process";

export interface ProcResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationSec: number;
}

export interface ProcOptions {
  cwd: string;
  timeoutMs: number;
  onStdoutLine?: (line: string) => void;
}

/**
 * Spawn a process with a hard timeout, never through a shell (arguments must
 * never be shell-interpreted, since prompt text can contain arbitrary content).
 */
export function runProcess(bin: string, args: string[], options: ProcOptions): Promise<ProcResult> {
  const { cwd, timeoutMs, onStdoutLine } = options;
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const child = spawn(bin, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let pending = "";

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (!onStdoutLine) return;
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (line.length > 0) onStdoutLine(line);
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    const finish = (exitCode: number | null) => {
      clearTimeout(timer);
      if (onStdoutLine && pending.length > 0) onStdoutLine(pending);
      resolve({ exitCode, stdout, stderr, timedOut, durationSec: (Date.now() - startedAt) / 1000 });
    };

    child.on("error", (err) => {
      stderr += `\n[spawn error] ${err.message}`;
      finish(null);
    });

    child.on("close", (code) => finish(code));
  });
}
```

- [ ] **Step 2: Write the failing test for `ClaudeCodeInvoker`, using a fake `bin` so the test doesn't actually call the real `claude` CLI**

```typescript
// src/engine/claude-code.test.ts
import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeCodeInvoker } from "./claude-code.js";

async function testExtractsFinalTextFromResultLine(): Promise<void> {
  // A fake "claude" binary that emits one stream-json line shaped like a real
  // Claude Code `result` event, so this test never touches the network or a
  // real subscription.
  const scratchDir = mkdtempSync(join(tmpdir(), "claude-code-invoker-test-"));
  const fakeBinPath = join(scratchDir, "fake-claude.sh");
  writeFileSync(
    fakeBinPath,
    `#!/bin/sh\necho '{"type":"result","result":"the answer is 42"}'\n`,
  );
  chmodSync(fakeBinPath, 0o755);

  const invoker = new ClaudeCodeInvoker({ bin: fakeBinPath });
  const result = await invoker.run({
    prompt: "what is the answer",
    cwd: scratchDir,
    timeoutMs: 5000,
  });

  assert.equal(result.outcome, "ok");
  assert.equal(result.finalText, "the answer is 42");
  assert.equal(result.exitCode, 0);
  console.log("PASS: testExtractsFinalTextFromResultLine");
}

async function testReportsTimeoutOutcome(): Promise<void> {
  const scratchDir = mkdtempSync(join(tmpdir(), "claude-code-invoker-test-"));
  const fakeBinPath = join(scratchDir, "fake-claude-slow.sh");
  writeFileSync(fakeBinPath, `#!/bin/sh\nsleep 5\n`);
  chmodSync(fakeBinPath, 0o755);

  const invoker = new ClaudeCodeInvoker({ bin: fakeBinPath });
  const result = await invoker.run({
    prompt: "this will hang",
    cwd: scratchDir,
    timeoutMs: 200,
  });

  assert.equal(result.outcome, "timeout");
  console.log("PASS: testReportsTimeoutOutcome");
}

async function main(): Promise<void> {
  await testExtractsFinalTextFromResultLine();
  await testReportsTimeoutOutcome();
}

void main();
```

- [ ] **Step 3: Run it to confirm it fails (the module doesn't exist yet)**

```bash
npx tsc -p tsconfig.json --noEmit
```

Expected: FAIL — `Cannot find module './claude-code.js'`.

- [ ] **Step 4: Write `src/engine/claude-code.ts`**

```typescript
import { runProcess } from "./proc.js";
import type { EngineInvoker, EngineRunOptions, EngineRunResult } from "./types.js";

export interface ClaudeCodeInvokerOptions {
  /** Defaults to "claude" — overridable so tests can point at a fake binary. */
  bin?: string;
}

/**
 * Headless Claude Code invocation, via `claude -p`. See the Phase 1 design
 * doc's "Agent engine" section for why headless was chosen over an
 * interactive PTY session (or the reverse — check poc/README.md for
 * which mode this project actually settled on).
 */
export class ClaudeCodeInvoker implements EngineInvoker {
  private readonly bin: string;

  constructor(options: ClaudeCodeInvokerOptions = {}) {
    this.bin = options.bin ?? "claude";
  }

  async run(options: EngineRunOptions): Promise<EngineRunResult> {
    const { prompt, cwd, timeoutMs, onOutputLine } = options;
    const transcript: string[] = [];

    const args = [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--verbose",
    ];

    const result = await runProcess(this.bin, args, {
      cwd,
      timeoutMs,
      onStdoutLine: (line) => {
        transcript.push(line);
        onOutputLine?.(line);
      },
    });

    if (result.timedOut) {
      return {
        outcome: "timeout",
        finalText: "",
        transcript,
        durationSec: result.durationSec,
        exitCode: result.exitCode,
      };
    }

    if (result.exitCode === null) {
      return {
        outcome: "process_error",
        finalText: "",
        transcript,
        durationSec: result.durationSec,
        exitCode: null,
      };
    }

    if (result.exitCode !== 0) {
      return {
        outcome: "nonzero_exit",
        finalText: "",
        transcript,
        durationSec: result.durationSec,
        exitCode: result.exitCode,
      };
    }

    return {
      outcome: "ok",
      finalText: extractFinalText(transcript),
      transcript,
      durationSec: result.durationSec,
      exitCode: result.exitCode,
    };
  }
}

/**
 * Pull the agent's final answer out of a stream-json transcript. Tolerant by
 * design: if a line isn't valid JSON (e.g. the engine's output format ever
 * changes), it's skipped rather than thrown — losing one line of parsing is
 * better than losing the entire run's result.
 */
function extractFinalText(transcript: string[]): string {
  for (const line of transcript) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (typeof parsed !== "object" || parsed === null) continue;
    const obj = parsed as Record<string, unknown>;
    if (obj["type"] === "result" && typeof obj["result"] === "string") {
      return obj["result"];
    }
  }
  return "";
}
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
npx tsc -p tsconfig.json && node dist/engine/claude-code.test.js
```

Expected output:
```
PASS: testExtractsFinalTextFromResultLine
PASS: testReportsTimeoutOutcome
```

- [ ] **Step 6: Commit**

```bash
git add src/engine/proc.ts src/engine/claude-code.ts src/engine/claude-code.test.ts
git commit -m "Implement ClaudeCodeInvoker for headless claude -p mode"
```

---

### Task 4: Manual end-to-end verification against the real Claude Code CLI

**Files:**
- Create: `src/engine/manual-check.ts` (a small script, not part of the automated test suite — deleted or kept as a debugging utility, not wired into `npm run selftest`)

**Interfaces:**
- Consumes: `ClaudeCodeInvoker` from Task 3.
- Produces: nothing consumed by later tasks — this is a one-time confirmation that the fake-binary tests in Task 3 reflect real behavior, not just the test's own assumptions about what `claude -p` outputs.

- [ ] **Step 1: Write `src/engine/manual-check.ts`**

```typescript
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeCodeInvoker } from "./claude-code.js";

async function main(): Promise<void> {
  const scratchDir = mkdtempSync(join(tmpdir(), "claude-code-manual-check-"));
  writeFileSync(join(scratchDir, "greeting.txt"), "the secret word is banana\n");

  const invoker = new ClaudeCodeInvoker();
  console.log(`Running against real claude CLI in ${scratchDir}...`);

  const result = await invoker.run({
    prompt: "Read greeting.txt and tell me exactly what the secret word is, nothing else.",
    cwd: scratchDir,
    timeoutMs: 60000,
    onOutputLine: (line) => console.log(`[transcript] ${line}`),
  });

  console.log("\n=== RESULT ===");
  console.log(`outcome: ${result.outcome}`);
  console.log(`finalText: ${result.finalText}`);
  console.log(`exitCode: ${result.exitCode}`);
  console.log(`durationSec: ${result.durationSec}`);

  if (result.outcome !== "ok") {
    console.error("MANUAL CHECK FAILED: outcome was not ok");
    process.exit(1);
  }
  if (!result.finalText.toLowerCase().includes("banana")) {
    console.error("MANUAL CHECK FAILED: finalText did not mention the secret word");
    process.exit(1);
  }
  console.log("\nMANUAL CHECK PASSED");
}

void main();
```

- [ ] **Step 2: Run it against the real CLI**

```bash
npx tsc -p tsconfig.json && node dist/engine/manual-check.js
```

Expected: `MANUAL CHECK PASSED`, and `finalText` should contain "banana". This confirms `ClaudeCodeInvoker` works against the actual installed Claude Code CLI (this machine has `claude` version 2.1.220 available, confirmed during planning), not just the fake binary from Task 3's tests.

If this fails, do not proceed — it means Task 3's implementation made an incorrect assumption about the real CLI's output format that the fake-binary test didn't catch. Fix `claude-code.ts` and re-run this check before moving on.

- [ ] **Step 3: Commit**

```bash
git add src/engine/manual-check.ts
git commit -m "Add manual end-to-end check against real Claude Code CLI

Confirms ClaudeCodeInvoker works against the actual claude binary,
not just the fake-binary unit tests."
```

---

## Plan Self-Review Notes

- **Spec coverage**: This plan implements only the "Agent engine" subsection of the Phase 1 design doc's Architecture section — specifically the PoC-gate requirement and a first concrete `EngineInvoker` implementation. It deliberately does not cover: the Pi SDK implementation (needs its own research per the design doc's Open Questions — separate future plan), the Judge/Implement/Verify/Open-PR pipeline stages (separate plan — they will *consume* `EngineInvoker` once it exists), worktree management, readiness scan, storage, or UI. This matches the `writing-plans` scope-check requirement to decompose a multi-subsystem spec into independent plans.
- **Placeholder scan**: No "TBD"/"TODO" — every step has real code. Task 3's "if Task 1 selects interactive mode instead" branch is an explicit fork, not a placeholder — it names what would need to change (PTY spawn, dialog handling) without pretending to have already written that code, since it's genuinely contingent on Task 1's real-world finding.
- **Type consistency**: `EngineInvoker`/`EngineRunOptions`/`EngineRunResult`/`EngineOutcome` are defined once in Task 2 and referenced identically (same names, same shapes) in Tasks 3 and 4. `ClaudeCodeInvoker` is defined once in Task 3 and imported (not redefined) in Task 4.
