import type { MechanicalResult } from "./mechanical.js";

export interface AgentPassInput {
  repoPath: string;
  mechanicalResult: MechanicalResult;
  signal: AbortSignal;
  invoker: {
    run: (opts: {
      prompt: string;
      cwd: string;
      timeoutMs: number;
    }) => Promise<{ outcome: string; finalText: string }>;
  };
}

export interface AgentDefinedArea {
  name: string;
  paths: string[];
  note: string;
}

export interface Recommendation {
  title: string;
  description: string;
}

export interface AgentPassResult {
  projectName: string | null;
  description: string | null;
  areas: AgentDefinedArea[];
  recommendations: Recommendation[];
  blocklistProposals: Array<{ pattern: string; reason: string }>;
  outcome: "ok" | "timeout" | "process_error" | "nonzero_exit" | "aborted";
}

const SCAN_TIMEOUT_MS = 5 * 60 * 1000;

export async function runAgentPass(input: AgentPassInput): Promise<AgentPassResult> {
  if (input.signal.aborted) {
    return { projectName: null, description: null, areas: [], recommendations: [], blocklistProposals: [], outcome: "aborted" };
  }

  const prompt = buildScanPrompt(input.mechanicalResult);
  const engineResult = await input.invoker.run({
    prompt,
    cwd: input.repoPath,
    timeoutMs: SCAN_TIMEOUT_MS,
  });

  const parsed = parseAgentResponse(engineResult.finalText);

  return {
    projectName: parsed.projectName,
    description: parsed.description,
    areas: parsed.areas,
    recommendations: parsed.recommendations,
    blocklistProposals: parsed.blocklist,
    outcome: engineResult.outcome as AgentPassResult["outcome"],
  };
}

function buildScanPrompt(mech: MechanicalResult): string {
  const projectNameHint = mech.projectName !== "unknown"
    ? `Project name from package.json: ${mech.projectName}`
    : "Project name not found in package.json — infer one from the codebase (e.g. README title, directory name, or what the project calls itself).";

  return [
    "You are analyzing a codebase. Do four things:",
    "",
    "IMPORTANT: You are inside the target project's repository. Use the read, grep, find, and ls tools to explore the source files. The project you must describe is the one whose files you are reading right now — NOT the scanner/orchestrator that sent you this prompt.",
    "",
    "1. Write a descriptive project overview (4-5 sentences). What does this project do? How is it structured? What problem does it solve? Any notable architectural decisions? Do NOT mention the tech stack — focus on purpose, architecture, and behavior.",
    "",
    "2. Define logical area boundaries. Don't just list top-level directories — understand the architecture (DDD, Clean Architecture, MVC, monolith, microservices, etc.) and group related files into meaningful areas. Each area needs a name, one or more path patterns (directory or file globs like \"src/auth/\" or \"src/middleware/*.ts\"), and a short risk note explaining what makes this area sensitive or stable. Include ALL major areas of the codebase.",
    "",
    "3. Identify files, directories, or operations that an AI agent should NEVER touch without human review. Consider: credential files, production configs, database migrations, deployment scripts, auth modules.",
    "",
    "4. Recommend 3-5 specific, actionable improvements to make this codebase more autonomous-agent-friendly. Check for: CLAUDE.md or AGENTS.md (agent instructions), architecture documentation, test command in package.json, CI pipeline, CONTRIBUTING.md, specs/plans directory, English README, lint/format config. Only recommend things that are MISSING — don't suggest adding something that already exists. Each recommendation needs a title and a specific description explaining why it matters for autonomous agents.",
    "",
    projectNameHint,
    `Detected tech stack: ${mech.techStack}`,
    `Test command: ${mech.testCommand ?? "none"}`,
    "",
    "Answer ONLY with a JSON object with five fields:",
    `  - \"projectName\" (string — use the name from package.json above if given; ${mech.projectName === "unknown" ? "otherwise infer one" : "otherwise the same value"})`,
    "  - `description` (string)",
    "  - `areas` (array of {name, paths (string array), note})",
    "  - `blocklist` (array of {pattern, reason})",
    "  - `recommendations` (array of {title, description})",
    "",
    'Example: {"projectName":"my-app","description":"A document processing pipeline that...","areas":[{"name":"Auth & Sessions","paths":["src/auth/"],"note":"Handles credential validation — high-risk area"}],"blocklist":[],"recommendations":[{"title":"Add CLAUDE.md","description":"No agent instructions found. A CLAUDE.md should document conventions and working rules so agents don\'t break them."}]}',
  ].join("\n");
}

interface ParsedResponse {
  projectName: string | null;
  description: string | null;
  areas: AgentDefinedArea[];
  recommendations: Recommendation[];
  blocklist: Array<{ pattern: string; reason: string }>;
}

function parseAgentResponse(text: string): ParsedResponse {
  // Try to find a JSON object with all three fields
  const objMatch = text.match(/\{[\s\S]*"description"[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]) as Record<string, unknown>;

      const projectName = typeof parsed.projectName === "string" && parsed.projectName.length > 0
        ? parsed.projectName
        : null;
      const desc = typeof parsed.description === "string" ? parsed.description : null;

      const recs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
      const recommendations: Recommendation[] = recs
        .filter(
          (r): r is Recommendation =>
            typeof r === "object" &&
            r !== null &&
            typeof (r as Record<string, unknown>).title === "string" &&
            typeof (r as Record<string, unknown>).description === "string",
        )
        .map((r) => ({ title: r.title, description: r.description }));

      const areaList = Array.isArray(parsed.areas) ? parsed.areas : [];
      const areas: AgentDefinedArea[] = areaList
        .filter(
          (a): a is AgentDefinedArea =>
            typeof a === "object" &&
            a !== null &&
            typeof (a as Record<string, unknown>).name === "string" &&
            Array.isArray((a as Record<string, unknown>).paths),
        )
        .map((a) => ({
          name: a.name,
          paths: (a.paths as string[]).filter((p) => typeof p === "string"),
          note: typeof a.note === "string" ? a.note : "",
        }));

      const blist = Array.isArray(parsed.blocklist) ? parsed.blocklist : [];
      const blocklist = blist.filter(
        (entry): entry is { pattern: string; reason: string } =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as Record<string, unknown>).pattern === "string" &&
          typeof (entry as Record<string, unknown>).reason === "string",
      );

      return { projectName, description: desc, areas, recommendations, blocklist };
    } catch {
      // fall through to old format
    }
  }

  // Fallback: old format — just a blocklist array
  const arrMatch = text.match(/\[[\s\S]*?\]/);
  if (arrMatch) {
    try {
      const parsed = JSON.parse(arrMatch[0]) as unknown;
      if (Array.isArray(parsed)) {
        const blocklist = parsed.filter(
          (entry): entry is { pattern: string; reason: string } =>
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as Record<string, unknown>).pattern === "string" &&
            typeof (entry as Record<string, unknown>).reason === "string",
        );
        return { projectName: null, description: null, areas: [], recommendations: [], blocklist };
      }
    } catch {
      // ignore
    }
  }

  return { projectName: null, description: null, areas: [], recommendations: [], blocklist: [] };
}
