# Claude Code Engine Invocation PoC — Result

Run on: 2026-08-03
Claude Code version tested: 2.1.220 (Claude Code)

## What was tested
Spawned Claude Code in a real PTY (via node-pty) with a single-turn prompt,
programmatically detecting and dismissing the trust dialog, watching for
task completion. Also compared against headless mode (`claude -p`).

## Findings
- Trust dialog: appeared on every run (new throwaway tmp directory each time) — reliably dismissed with \r after 500ms delay, across 3/3 runs
- Task completion detection: the interactive session never exits on its own. A `/exit` command sent via PTY at 20s reliably forces a clean exit (exit code 0). The agent's answer appears in the PTY output but is tangled with ANSI escape codes, spinner animations, and TUI chrome; a simple regex can still find "hello from the PoC" in the raw buffer, but robust extraction of arbitrary answers would require stripping ANSI sequences and isolating the answer region.
- Reliability across 3 runs: 3/3 succeeded — trust dialog dismissed, answer received, process exited cleanly after `/exit`. Each run took 18–20s wall-clock time.
- Output extraction: possible for simple text via regex on the raw buffer, but the output is heavily mixed with ANSI escape codes, cursor movements, and TUI rendering sequences. Extracting structured output (e.g., JSON, specific code blocks) from the raw PTY buffer would require a non-trivial ANSI-stripping and content-isolation layer.

**Headless comparison (`claude -p`):**
- No trust dialog (handled automatically by Claude Code in headless mode)
- Clean text output, no ANSI escape codes
- Process exits on its own (no `/exit` needed)
- Faster: 10–16 seconds per single-turn prompt
- `--dangerously-skip-permissions` flag available for tool-using automation
- 2/2 test runs succeeded with exit code 0

## Decision
**Chosen invocation mode: headless (`claude -p`)**

## Why
Headless mode is the clear winner for this orchestrator's use case. It produces clean, machine-readable output with no ANSI parsing required, exits on its own, has no trust dialog to detect and dismiss, and is measurably faster (10–16s vs 18–20s). The PTY approach technically works but adds significant complexity (dialog detection with fragile regex, ANSI stripping, forced `/exit`) with no compensating advantage for autonomous, unattended execution. Anthropic's signaled billing change for headless/SDK usage is noted as a future risk, but the architectural simplicity gained today outweighs a hypothetical cost change — and switching from headless to PTY later (if billing ever forces it) is far easier than the reverse, since the PTY approach is strictly more complex.
