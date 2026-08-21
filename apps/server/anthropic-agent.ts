/**
 * Thin agentic loop using the Anthropic SDK routed through 9router.
 * Replaces Pi SDK for prototype/glowup/vision when NINEROUTER_URL is set.
 *
 * Implements the tools Pi SDK would normally provide:
 *   read, write, edit, bash, ls, find, grep
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";

const MAX_TURNS = 40;
const MAX_FILE_BYTES = 200_000; // truncate large reads

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const rawUrl = process.env.NINEROUTER_URL?.replace(/\/+$/, "");
    // 9router accepts Anthropic-format at /v1/messages — strip /v1 suffix for baseURL
    const baseURL = rawUrl?.endsWith("/v1") ? rawUrl.slice(0, -3) : rawUrl;
    _client = new Anthropic({
      apiKey: process.env.NINEROUTER_KEY ?? "no-key",
      baseURL,
      // Null out Stainless telemetry headers that 9router's WAF blocks
      defaultHeaders: {
        "X-Stainless-Lang": null,
        "X-Stainless-Package-Version": null,
        "X-Stainless-Runtime": null,
        "X-Stainless-Runtime-Version": null,
        "X-Stainless-Async": null,
        "X-Stainless-Retry-Count": null,
        "X-Stainless-Timeout": null,
        "User-Agent": null,
      } as any,
    });
  }
  return _client;
}

// ── Tool definitions ─────────────────────────────────────────────────────────

const TOOL_DEFS: Anthropic.Tool[] = [
  {
    name: "read",
    description: "Read the contents of a file.",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string", description: "File path to read" } },
      required: ["path"],
    },
  },
  {
    name: "write",
    description: "Write content to a file (creates or overwrites).",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit",
    description: "Replace an exact string in a file.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path" },
        old_string: { type: "string", description: "Exact string to find" },
        new_string: { type: "string", description: "Replacement string" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "bash",
    description: "Run a bash command in the workspace directory.",
    input_schema: {
      type: "object" as const,
      properties: { command: { type: "string", description: "Shell command to run" } },
      required: ["command"],
    },
  },
  {
    name: "ls",
    description: "List files in a directory.",
    input_schema: {
      type: "object" as const,
      properties: { path: { type: "string", description: "Directory path (default: .)" } },
      required: [],
    },
  },
  {
    name: "find",
    description: "Find files matching a pattern.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Root path to search from" },
        pattern: { type: "string", description: "Filename pattern (glob-style)" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "grep",
    description: "Search file contents for a pattern.",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string", description: "Regex or string to search for" },
        path: { type: "string", description: "File or directory to search" },
      },
      required: ["pattern"],
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────

function safePath(cwd: string, p: string): string {
  const abs = resolve(cwd, p);
  if (!abs.startsWith(cwd)) throw new Error(`Path escapes workspace: ${p}`);
  return abs;
}

function execTool(name: string, input: Record<string, string>, cwd: string): string {
  try {
    switch (name) {
      case "read": {
        const abs = safePath(cwd, input.path!);
        if (!existsSync(abs)) return `Error: file not found: ${input.path}`;
        const buf = readFileSync(abs);
        const text = buf.toString("utf-8");
        return text.length > MAX_FILE_BYTES
          ? text.slice(0, MAX_FILE_BYTES) + "\n[truncated]"
          : text;
      }
      case "write": {
        const abs = safePath(cwd, input.path!);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, input.content ?? "");
        return `Written: ${input.path}`;
      }
      case "edit": {
        const abs = safePath(cwd, input.path!);
        if (!existsSync(abs)) return `Error: file not found: ${input.path}`;
        const original = readFileSync(abs, "utf-8");
        if (!original.includes(input.old_string!)) return `Error: old_string not found in ${input.path}`;
        writeFileSync(abs, original.replace(input.old_string!, input.new_string ?? ""));
        return `Edited: ${input.path}`;
      }
      case "bash": {
        const out = execSync(input.command!, {
          cwd,
          timeout: 30_000,
          maxBuffer: 1_000_000,
          stdio: ["pipe", "pipe", "pipe"],
        });
        return out.toString("utf-8").slice(0, 10_000) || "(no output)";
      }
      case "ls": {
        const dir = input.path ? safePath(cwd, input.path) : cwd;
        if (!existsSync(dir)) return `Error: not found: ${input.path ?? "."}`;
        const entries = readdirSync(dir).map((e) => {
          const stat = statSync(join(dir, e));
          return `${stat.isDirectory() ? "d" : "-"} ${e}`;
        });
        return entries.join("\n") || "(empty)";
      }
      case "find": {
        const root = input.path ? safePath(cwd, input.path) : cwd;
        const pat = input.pattern ?? "*";
        const out = execSync(`find . -name '${pat}' 2>/dev/null | head -100`, {
          cwd: root,
          timeout: 10_000,
        });
        return out.toString("utf-8").trim() || "(no matches)";
      }
      case "grep": {
        const target = input.path ? safePath(cwd, input.path) : cwd;
        const out = execSync(
          `grep -r --include='*.html' --include='*.css' --include='*.js' -l '${input.pattern!.replace(/'/g, "'\\''")}' . 2>/dev/null | head -50`,
          { cwd: target, timeout: 10_000 },
        );
        return out.toString("utf-8").trim() || "(no matches)";
      }
      default:
        return `Error: unknown tool ${name}`;
    }
  } catch (err: any) {
    return `Error: ${err?.message ?? String(err)}`;
  }
}

// ── Agent loop ────────────────────────────────────────────────────────────────

export interface RunAgentOptions {
  cwd: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onEvent?: (type: string, detail?: string) => void;
}

export async function runAnthropicAgent(opts: RunAgentOptions): Promise<void> {
  const { cwd, model, systemPrompt, userPrompt, signal, onEvent } = opts;
  const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000;

  const client = getAnthropicClient();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];

  const deadline = Date.now() + timeoutMs;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (signal?.aborted) throw new Error("Aborted");
    if (Date.now() > deadline) throw new Error("Agent timed out");

    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      tools: TOOL_DEFS,
      messages,
    });

    // Append assistant message
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") {
      onEvent?.("agent_end");
      return;
    }

    if (response.stop_reason !== "tool_use") {
      throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
    }

    // Execute tool calls and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      onEvent?.("tool_start", block.name);
      const result = execTool(block.name, block.input as Record<string, string>, cwd);
      onEvent?.("tool_end", block.name);
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
    }

    messages.push({ role: "user", content: toolResults });
  }

  throw new Error("Agent exceeded max turns");
}

// ── Simple vision call (no agent loop) ───────────────────────────────────────

export async function runAnthropicVision(
  buffer: Buffer,
  mimeType: string,
  prompt: string,
  model: string,
): Promise<string> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType as any, data: buffer.toString("base64") },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
  return response.content
    .filter((b) => b.type === "text")
    .map((b: any) => b.text as string)
    .join("")
    .trim();
}
