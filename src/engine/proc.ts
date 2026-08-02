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

    child.stdout!.setEncoding("utf8");
    child.stdout!.on("data", (chunk: string) => {
      stdout += chunk;
      if (!onStdoutLine) return;
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (line.length > 0) onStdoutLine(line);
      }
    });

    child.stderr!.setEncoding("utf8");
    child.stderr!.on("data", (chunk: string) => {
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
