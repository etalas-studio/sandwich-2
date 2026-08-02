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
