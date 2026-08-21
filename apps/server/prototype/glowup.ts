import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface GlowupPromptInput {
  brief: string;
  refs?: GlowupReference[];
}

export interface ReferenceEntry {
  slug: string;
  name: string;
  category: string;
  tags?: string[];
  description?: string;
  colors?: string[];
  fonts?: string[];
}

export interface GlowupReference {
  slug: string;
  dna: Record<string, unknown>;
}

/** Pick 1..limit references whose category/tags/name/description best match the brief. */
export function selectReferences(
  brief: string,
  templates: ReferenceEntry[],
  limit = 3,
): ReferenceEntry[] {
  const words = brief
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);

  const scored = templates
    .map((t) => {
      let score = 0;
      const name = (t.name ?? "").toLowerCase();
      const description = (t.description ?? "").toLowerCase();
      const tags = (t.tags ?? []).map((x) => x.toLowerCase());
      for (const w of words) {
        if (t.category === w) score += 3;
        else {
          if (tags.some((tag) => tag === w)) score += 2;
          if (name.includes(w)) score += 1;
          if (description.includes(w)) score += 1;
        }
      }
      return { entry: t, score };
    })
    .sort((a, b) => b.score - a.score);

  const matched = scored
    .filter((s) => s.score > 0)
    .slice(0, limit)
    .map((s) => s.entry);
  if (matched.length > 0) return matched;
  return templates.slice(0, limit);
}

function buildDnaContext(refs: GlowupReference[]): string {
  if (refs.length === 0) return "";
  const blocks = refs.map((r, i) => {
    const d = r.dna ?? {};
    const tokens = {
      hero: d.hero,
      type_scale: d.type_scale,
      spacing: d.spacing,
      radius: d.radius,
      shadow: d.shadow,
      layout: d.layout,
      motion: d.motion,
      signature: d.signature,
      colors: d.colors,
      fonts: d.fonts,
    };
    return `### Reference ${i + 1}: ${r.slug}\n\`\`\`json\n${JSON.stringify(tokens, null, 2)}\n\`\`\``;
  });
  return ["## Design DNA (pre-selected — apply these tokens)", ...blocks].join("\n\n");
}

/** Load the taste library, pick references in code (not in the model), and return their DNA. */
function resolveReferences(workspace: string, brief: string): GlowupReference[] {
  const indexPath = join(workspace, ".getokui", "index.json");
  if (!existsSync(indexPath)) return [];
  try {
    const indexData = JSON.parse(readFileSync(indexPath, "utf-8")) as {
      templates?: ReferenceEntry[];
    };
    const templates = Array.isArray(indexData.templates) ? indexData.templates : [];
    const selected = selectReferences(brief, templates, 3);
    const refs: GlowupReference[] = [];
    for (const t of selected) {
      const dnaPath = join(workspace, ".getokui", "dna", `${t.slug}.json`);
      if (!existsSync(dnaPath)) continue;
      try {
        const dna = JSON.parse(readFileSync(dnaPath, "utf-8")) as Record<string, unknown>;
        refs.push({
          slug: t.slug,
          // colors/fonts live in index.json (not the dna file), so carry them
          // over from the selected template entry.
          dna: { ...dna, colors: t.colors ?? [], fonts: t.fonts ?? [] },
        });
      } catch {
        // skip unreadable dna
      }
    }
    return refs;
  } catch {
    return [];
  }
}

/**
 * Format a diagnostic log line for a glowup agent event. Returns null for
 * events we don't want to log. Kept pure so the timestamp/tool-activity
 * formatting is unit-testable.
 */
export function glowupEventLogLine(
  event: { type?: string; toolName?: string; isError?: boolean; errorMessage?: string },
  elapsedMs: number,
): string | null {
  const secs = (elapsedMs / 1000).toFixed(1);
  switch (event.type) {
    case "tool_execution_start":
      return `[glowup] +${secs}s tool_start=${event.toolName ?? "?"}`;
    case "tool_execution_end":
      return `[glowup] +${secs}s tool_end=${event.toolName ?? "?"} isError=${event.isError ?? false}`;
    case "agent_end":
      return `[glowup] +${secs}s agent_end${event.errorMessage ? ` error=${event.errorMessage}` : ""}`;
    default:
      return null;
  }
}

export function glowupModelId(): string {
  return process.env.GLOWUP_MODEL ?? process.env.OPENCODE_MODEL ?? "cc/claude-sonnet-4-6";
}

export function buildGlowupSystemPrompt(input: GlowupPromptInput): string {
  const dnaSection =
    input.refs && input.refs.length > 0
      ? buildDnaContext(input.refs)
      : [
          "## Design DNA",
          "None provided — apply a clean, modern SaaS aesthetic (generous spacing, strong type hierarchy, one consistent radius + shadow, at least one subtle motion).",
        ].join("\n");

  return [
    `You are SANDWICH's design-polish pass ("glowup"). A first agent already generated a working multi-page static prototype from the client brief below. Your job is to improve its DESIGN QUALITY only — spacing, color, typography, hierarchy, composition, motion, iconography — while KEEPING its content, copy, data, and functionality intact.`,
    ``,
    `## Client Brief (for reference matching)`,
    input.brief,
    ``,
    dnaSection,
    ``,
    `## Your Process`,
    `1. The current contents of index.html and styles.css are provided in the user message. Apply the Design DNA tokens to them IN PLACE using the write tool (write the complete new file — do NOT use edit for piecemeal patches). styles.css is shared across all pages, so keep every existing selector/rule that dashboard.html and module pages depend on working.`,
    ``,
    `## STYLE, NOT CONTENT (MANDATORY)`,
    `- Keep every headline, paragraph, table row, form label, chart, and piece of demo data exactly as it is. Restyle, never rewrite copy.`,
    `- Never copy a reference's text, brand names, logos, photos, or illustrations into the prototype.`,
    `- If a section is empty, use a clearly-marked placeholder (e.g. "[Feature title]"), never the reference's words.`,
    ``,
    `## Preserve the Existing Stack & Structure (MANDATORY)`,
    `- The prototype is plain static HTML + CSS + JS (no Tailwind, no bundler). Keep it that way.`,
    `- Keep the same files and paths. Keep styles.css as the single stylesheet and script.js as the single script. Keep all CRUD interactions (localStorage) and Chart.js usage working.`,
    `- Edit ONLY index.html and styles.css. Do NOT touch dashboard.html, module pages, or script.js. Do NOT add new files unless strictly necessary. Do NOT rename or reorganize files.`,
    ``,
    `## Tailwind → CSS Translation (the DNA speaks Tailwind)`,
    `The DNA files express values as Tailwind utility classes. Translate them into equivalent plain CSS in styles.css. Common mapping:`,
    `- text-5xl/text-6xl/text-7xl/text-8xl → font-size: 3rem/3.75rem/4.5rem/6rem`,
    `- text-base/text-lg → font-size: 1rem/1.125rem`,
    `- py-20 → padding-block: 5rem; pt-28 → padding-top: 7rem; pb-24 → padding-bottom: 6rem`,
    `- rounded-full → border-radius: 9999px; rounded-xl → 0.75rem; rounded-2xl → 1rem`,
    `- tracking-tight → letter-spacing: -0.025em; leading-none → line-height: 1; leading-[1.1] → line-height: 1.1`,
    `- font-thin/font-light/font-semibold/font-bold → font-weight: 100/300/600/700`,
    `- uppercase → text-transform: uppercase`,
    `The DNA's motion.keyframes_css is already raw CSS — paste it verbatim into styles.css and wire the triggers (hover states, scroll reveal) using the DNA's motion.techniques.`,
    ``,
    `## Hard Floors (non-negotiable minimums)`,
    `- Every top-level section has at least py-20 (padding-block: 5rem); hero at least pt-28/pb-24.`,
    `- The hero headline is at least text-5xl (3rem); prefer text-6xl/7xl when the DNA shows it.`,
    `- At least 2 real motions: one ambient @keyframes from the DNA AND one interaction (hover or scroll-reveal).`,
    `- Exactly 0 emoji anywhere. Replace any emoji in the UI with Lucide icons via <script src="https://unpkg.com/lucide@latest"></script> + <i data-lucide="..."></i> + lucide.createIcons(). Give each icon an explicit size and palette color.`,
    `- Pick ONE radius scale and ONE shadow token from the DNA and reuse them consistently.`,
    `- Body text contrast meets WCAG AA (≥ 4.5:1). On white, body text must be #475569 or darker (not #94a3b8). Compute risky pairs, don't eyeball.`,
    ``,
    `## Anti-Slop (kill the AI-generated look)`,
    `- Do NOT keep the generic centered-hero-of-doom (centered headline + subline + 2 buttons + blurred purple blob). Reproduce the DNA's layout.hero_layout (split / split-centered / asymmetric) instead.`,
    `- Land at least ONE signature move from layout.composition_techniques (marquee, bento grid, rotated/overlapping elements, oversized type, grain, horizontal scroll).`,
    `- Introduce asymmetry/tension — not everything centered and symmetric.`,
    `- Vary section rhythm (some full-bleed, some contained).`,
    ``,
    `## Output`,
    `Use the write tool to write the complete new index.html and the complete new styles.css. You MUST call the write tool — do not output HTML as text. Write index.html first, then styles.css. When both writes are done, stop.`,
  ].join("\n");
}

const GLOWUP_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes — glowup reads the full index.json + DNA and edits in place

function readWorkspaceFile(workspace: string, filename: string): string {
  const p = join(workspace, filename);
  if (!existsSync(p)) return "";
  try {
    return readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

export async function polishWorkspace(
  workspace: string,
  brief: string,
  signal?: AbortSignal,
): Promise<void> {
  const modelId = glowupModelId();
  const refs = resolveReferences(workspace, brief);
  const systemPrompt = buildGlowupSystemPrompt({ brief, refs });
  console.log(`[glowup] start model=${modelId} workspace=${workspace} refs=${refs.map((r) => r.slug).join(",") || "none"}`);

  if (process.env.NINEROUTER_URL) {
    const { runAnthropicAgent } = await import("../anthropic-agent.js");

    // Pre-load files so the agent skips read turns entirely.
    const indexHtml = readWorkspaceFile(workspace, "index.html");
    const stylesCss = readWorkspaceFile(workspace, "styles.css");
    const userPrompt = [
      "Polish the prototype as described in the system prompt.",
      "",
      indexHtml ? `<index.html>\n${indexHtml}\n</index.html>` : "(index.html not found)",
      "",
      stylesCss ? `<styles.css>\n${stylesCss}\n</styles.css>` : "(styles.css not found)",
    ].join("\n");

    await runAnthropicAgent({
      cwd: workspace,
      model: modelId,
      systemPrompt,
      userPrompt,
      signal,
      timeoutMs: GLOWUP_TIMEOUT_MS,
      onEvent: (type, detail) => {
        const line = glowupEventLogLine({ type, toolName: detail }, Date.now());
        if (line) console.log(line);
      },
    });
    return;
  }

  const pi = await import("@earendil-works/pi-coding-agent");
  const { getModelRuntime } = await import("../model-runtime.js");
  const modelRuntime = await getModelRuntime();
  const provider = process.env.OPENCODE_PROVIDER ?? "opencode-go";
  const model = modelRuntime.getModel(provider, modelId);
  if (!model) throw new Error(`OpenCode model not available: ${provider}/${modelId}`);

  const { session } = await pi.createAgentSession({
    cwd: workspace,
    model: model as any,
    modelRuntime: modelRuntime as any,
    tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
    sessionManager: pi.SessionManager.inMemory(workspace),
    settingsManager: pi.SettingsManager.inMemory({ compaction: { enabled: false } }),
  });

  let errorMessage = "";
  const startMs = Date.now();

  session.subscribe((event: any) => {
    if (signal?.aborted) return;
    const line = glowupEventLogLine(event, Date.now() - startMs);
    if (line) console.log(line);
    if (event.type === "agent_end" && typeof event.errorMessage === "string" && event.errorMessage) {
      errorMessage = event.errorMessage;
    }
  });

  try {
    const indexHtml = readWorkspaceFile(workspace, "index.html");
    const stylesCss = readWorkspaceFile(workspace, "styles.css");
    const piUserPrompt = [
      systemPrompt,
      "",
      indexHtml ? `<index.html>\n${indexHtml}\n</index.html>` : "(index.html not found)",
      "",
      stylesCss ? `<styles.css>\n${stylesCss}\n</styles.css>` : "(styles.css not found)",
    ].join("\n");
    const promptPromise = session.prompt(piUserPrompt);
    promptPromise.catch(() => {});
    await Promise.race([
      promptPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Prototype glowup timed out")), GLOWUP_TIMEOUT_MS),
      ),
    ]);
    await new Promise((r) => setTimeout(r, 500));
    session.dispose();
    if (errorMessage) throw new Error(errorMessage);
  } catch (err) {
    session.dispose();
    throw err;
  }
}
