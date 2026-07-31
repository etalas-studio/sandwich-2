import { spawn } from "node:child_process";

export interface ExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationSec: number;
}

export interface ExecOptions {
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  /** Dipanggil per baris stdout. Dipakai untuk menampung transcript agent. */
  onStdoutLine?: (line: string) => void;
}

/**
 * Wrapper spawn yang selalu punya timeout dan tidak pernah pakai shell.
 * Tanpa shell supaya argumen berisi teks tiket tidak pernah diinterpretasi shell.
 */
export function exec(
  bin: string,
  args: string[],
  options: ExecOptions = {},
): Promise<ExecResult> {
  const { cwd, timeoutMs, env, onStdoutLine } = options;
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd,
      env: env ?? process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let pending = "";

    const timer =
      timeoutMs && timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
          }, timeoutMs)
        : null;

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
      if (timer) clearTimeout(timer);
      if (onStdoutLine && pending.length > 0) onStdoutLine(pending);
      resolve({
        exitCode,
        stdout,
        stderr,
        timedOut,
        durationSec: (Date.now() - startedAt) / 1000,
      });
    };

    child.on("error", (err) => {
      stderr += `\n[spawn error] ${err.message}`;
      finish(null);
    });

    child.on("close", (code) => finish(code));
  });
}

/** Isi placeholder {{key}} pada argumen command template. */
export function fillArgs(
  args: string[],
  values: Record<string, string | string[]>,
): string[] {
  const out: string[] = [];

  for (const arg of args) {
    const exactMatch = /^\{\{(\w+)\}\}$/.exec(arg);

    if (exactMatch) {
      const key = exactMatch[1] as string;
      const value = values[key];
      if (value === undefined) continue;
      // Array diperluas menjadi beberapa argumen (misalnya daftar target rspec).
      if (Array.isArray(value)) {
        out.push(...value);
      } else {
        out.push(value);
      }
      continue;
    }

    out.push(
      arg.replace(/\{\{(\w+)\}\}/g, (_full, key: string) => {
        const value = values[key];
        if (value === undefined) return "";
        return Array.isArray(value) ? value.join(" ") : value;
      }),
    );
  }

  return out;
}
