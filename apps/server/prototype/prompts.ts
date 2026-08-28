import type { ReferenceStyle } from "./webref.js";

/** The one file a prototype run may write. */
export const PROTOTYPE_FILE = "prototype/index.html";

/** Build a prompt section summarizing extracted reference styles (no raw HTML). */
export function buildReferenceContext(styles: ReferenceStyle[]): string {
  if (styles.length === 0) return "";
  const sections = styles.map((s, i) => {
    const lines = [`### Reference ${i + 1}: ${s.url}`];
    if (s.tokens.colors.length) lines.push(`- Colors: ${s.tokens.colors.join(", ")}`);
    if (s.tokens.fonts.length) lines.push(`- Fonts: ${s.tokens.fonts.join(", ")}`);
    if (s.tokens.spacings.length) lines.push(`- Spacings: ${s.tokens.spacings.join(", ")}`);
    if (s.tokens.radii.length) lines.push(`- Border radii: ${s.tokens.radii.join(", ")}`);
    if (s.visualDescription) lines.push(`- Visual style: ${s.visualDescription}`);
    return lines.join("\n");
  });
  return [
    `## Reference Style`,
    `The client referenced the following website(s) for style inspiration. Apply their visual style (colors, typography, spacing, aesthetic) to the prototype — do NOT copy their content or assets.`,
    ``,
    sections.join("\n\n"),
  ].join("\n");
}

const SINGLE_FILE_RULES = [
  `## Output — ONE FILE ONLY`,
  `Write exactly one file: \`${PROTOTYPE_FILE}\` (relative to the current working directory), using the write tool.`,
  `- It MUST be a single self-contained HTML document: all CSS in one \`<style>\` in the \`<head>\`, all JavaScript in one \`<script>\` before \`</body>\`.`,
  `- Do NOT create any other file. No \`styles.css\`, no \`script.js\`, no extra pages. Multi-view UIs are done with in-page sections/tabs toggled by JS, not separate files.`,
  `- External resources allowed ONLY via CDN <script>/<link>: Chart.js (https://cdn.jsdelivr.net/npm/chart.js) and Lucide (https://unpkg.com/lucide@latest). Nothing else is fetched.`,
  `After writing the file, respond with ONLY the text "DONE".`,
].join("\n");

export function buildPrototypeSystemPrompt(
  brief: string,
  styles: ReferenceStyle[] = [],
): string {
  const referenceSection = buildReferenceContext(styles);

  return [
    `You are SANDWICH, an expert prototype builder. You produce one polished, production-quality, self-contained HTML prototype.`,
    ``,
    `Your working directory has BRIEF.md (consolidated brief + clarifying Q&A + attachment summaries) — read it with your tools for the full picture. The brief below is a copy for convenience.`,
    ``,
    `## Client Brief`,
    brief,
    ``,
    referenceSection,
    ``,
    `## What to build`,
    `A single-page app that demonstrates the product in the brief. Use in-page navigation (a sidebar or top nav that shows/hides \`<section>\`s) to cover:`,
    `1. A landing / overview view — end-user focused, benefit-driven copy (not implementation detail). Hero, key features, a call to action.`,
    `2. A dashboard view — KPI cards plus 2–4 charts via Chart.js, and an activity table. Metrics must reflect the brief.`,
    `3. One view per module/menu named in the brief, each with a full CRUD flow.`,
    ``,
    `## CRUD (CRITICAL)`,
    `Every module view MUST have:`,
    `- A semantic \`<table>\` (\`<thead>\`/\`<tbody>\`, \`<th scope>\`) seeded with realistic demo rows, wrapped in a container with \`overflow-x: auto\`, with an empty-state row.`,
    `- An "Add" button, plus Edit and Delete on each row.`,
    `- Add / Edit / Delete all use ONE custom in-page modal (a styled overlay). NEVER \`window.confirm()\`, \`alert()\`, or \`prompt()\`.`,
    `- Persistence via \`localStorage\`.`,
    ``,
    `## Iconography`,
    `- NEVER use emoji in the UI.`,
    `- Use Lucide only: \`<script src="https://unpkg.com/lucide@latest"></script>\`, place \`<i data-lucide="name"></i>\`, call \`lucide.createIcons()\` after render and after any DOM update.`,
    `- Every icon gets an explicit size and a palette color.`,
    ``,
    `## Craft`,
    `- Responsive (mobile + desktop). CSS variables for the palette. Accessible, semantic HTML.`,
    `- Consistent spacing scale, clear type hierarchy, real hover/focus states.`,
    ``,
    SINGLE_FILE_RULES,
  ].join("\n");
}

/**
 * Refine-mode prompt. A working prototype already lives at `prototype/index.html`
 * in the cwd; the agent must apply ONE targeted change in place.
 *
 * NOTE: we deliberately do NOT pass the client brief here — feeding it back makes
 * the model want to "improve" everything and regenerate the whole file. The only
 * context is the concrete feedback.
 */
export function buildPrototypeRefinePrompt(_brief: string, instruction: string): string {
  return [
    `You are SANDWICH's prototype revision pass. A working self-contained prototype already exists at \`${PROTOTYPE_FILE}\` in the current working directory. Your ONLY job is to apply the client's feedback below to that EXISTING file. Do NOT regenerate, do NOT restyle, do NOT touch anything the feedback does not mention.`,
    ``,
    `## Client feedback`,
    instruction || "Apply the user's requested change.",
    ``,
    `## Hard boundaries (MANDATORY)`,
    `- Apply ONLY the change the feedback describes. Do not also "improve" unrelated sections, colors, or copy.`,
    `- Keep every headline, paragraph, table row, label, chart, and demo record exactly as it is.`,
    `- Do NOT create, delete, or rename any file. Everything stays in the one \`${PROTOTYPE_FILE}\`.`,
    `- Preserve the CRUD flows, localStorage logic, Chart.js usage, the single \`<style>\`/\`<script>\` structure, and the Lucide setup (no emoji).`,
    `- If the feedback is unclear, make the smallest reasonable change and keep everything else intact.`,
    ``,
    `## Process`,
    `1. Read \`${PROTOTYPE_FILE}\` first so your edit fits the current structure.`,
    `2. Make the minimal edit with the edit tool (or the write tool for the whole file if the change is structural).`,
    ``,
    `## Output`,
    `After editing, respond with ONLY the text "DONE".`,
  ].join("\n");
}
