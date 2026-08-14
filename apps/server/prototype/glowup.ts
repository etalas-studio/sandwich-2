export interface GlowupPromptInput {
  brief: string;
}

export function glowupModelId(): string {
  return process.env.GLOWUP_MODEL ?? "deepseek-v4-flash";
}

export function buildGlowupSystemPrompt(input: GlowupPromptInput): string {
  return [
    `You are SANDWICH's design-polish pass ("glowup"). A first agent already generated a working multi-page static prototype from the client brief below. Your job is to improve its DESIGN QUALITY only — spacing, color, typography, hierarchy, composition, motion, iconography — while KEEPING its content, copy, data, and functionality intact.`,
    ``,
    `## Client Brief (for reference matching)`,
    input.brief,
    ``,
    `## The Taste Library (getokui)`,
    `A curated design-reference library is already copied into this workspace at .getokui/.`,
    `- .getokui/index.json — metadata for 213 templates (slug, category, tags, description, colors, fonts, sections).`,
    `- .getokui/dna/<slug>.json — pre-extracted "Design DNA" for each template (real class strings, spacing, radius, shadow, layout, motion).`,
    ``,
    `## Your Process`,
    `1. Read ONLY index.html and styles.css (the landing page and the shared stylesheet). Do NOT read or edit dashboard.html, module pages, or script.js.`,
    `2. Read .getokui/index.json and pick 1–3 references whose category/tags/description best match the brief's vertical and mood.`,
    `3. Read those references' .getokui/dna/<slug>.json files. Extract concrete tokens (layout.hero_layout, hero.h1_classes, hero.cta_classes, spacing.section_padding, radius, shadow, motion.keyframes_css, layout.composition_techniques).`,
    `4. Apply those tokens to index.html and styles.css IN PLACE (edit, don't recreate). styles.css is shared across all pages, so keep every existing selector/rule that dashboard.html and module pages depend on working.`,
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
    `Edit only index.html and styles.css in place with the write/edit tool. After finishing, respond with ONLY the text "DONE".`,
  ].join("\n");
}

const GLOWUP_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export async function polishWorkspace(
  workspace: string,
  brief: string,
  signal?: AbortSignal,
): Promise<void> {
  const pi = await import("@earendil-works/pi-coding-agent");

  const modelRuntime = await pi.ModelRuntime.create({ modelsPath: null });
  const provider = process.env.OPENCODE_PROVIDER ?? "opencode-go";
  const modelId = glowupModelId();
  const model = modelRuntime.getModel(provider, modelId);
  if (!model) {
    throw new Error(`OpenCode model not available: ${provider}/${modelId}`);
  }

  const { session } = await pi.createAgentSession({
    cwd: workspace,
    model: model as any,
    modelRuntime: modelRuntime as any,
    tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
    sessionManager: pi.SessionManager.inMemory(workspace),
    settingsManager: pi.SettingsManager.inMemory({ compaction: { enabled: false } }),
  });

  let errorMessage = "";

  session.subscribe((event: any) => {
    if (signal?.aborted) return;
    if (event.type === "agent_end") {
      if (typeof event.errorMessage === "string" && event.errorMessage) {
        errorMessage = event.errorMessage;
      }
    }
  });

  try {
    const promptPromise = session.prompt(buildGlowupSystemPrompt({ brief }));
    promptPromise.catch(() => {}); // avoid unhandled rejection on timeout
    await Promise.race([
      promptPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Prototype glowup timed out")), GLOWUP_TIMEOUT_MS),
      ),
    ]);
    // Small delay for agent_end event to propagate
    await new Promise((r) => setTimeout(r, 500));
    session.dispose();

    if (errorMessage) throw new Error(errorMessage);
  } catch (err) {
    session.dispose();
    throw err;
  }
}
