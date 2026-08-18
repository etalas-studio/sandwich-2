import type { ReferenceStyle } from "./webref.js";

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

export function buildPrototypeSystemPrompt(
  brief: string,
  styles: ReferenceStyle[] = [],
): string {
  const referenceSection = buildReferenceContext(styles);

  return [
    `You are SANDWICH, an expert prototype builder. You generate complete, production-quality static prototypes.`,
    ``,
    `## Client Brief`,
    brief,
    ``,
    referenceSection,
    ``,
    `## Required Pages`,
    `Generate a MULTI-PAGE static prototype (separate HTML files, no build step, no frameworks).`,
    ``,
    `1. **Landing page** (index.html) — end-user focused, NON-technical copywriting. Explain benefits, not implementation. Include hero, features, pricing, footer.`,
    `2. **Dashboard** (dashboard.html) — business-focused with LOTS of charts and metrics. Use Chart.js from CDN (https://cdn.jsdelivr.net/npm/chart.js). Include KPI cards, bar/line/pie charts, activity table. Make metrics relevant to the brief requirements.`,
    `3. **Module pages** — every module/menu mentioned in the brief gets its own page (e.g. users.html, orders.html, products.html).`,
    ``,
    `## CRUD Requirements (CRITICAL)`,
    `EVERY module page MUST include a complete CRUD flow:`,
    `- A table/list showing existing records (seeded with realistic demo data)`,
    `- An "Add" button opening a form with ALL relevant input fields`,
    `- Edit and Delete buttons on each row`,
    `- Data persistence via localStorage (simulated backend)`,
    `- Shared JavaScript in script.js for CRUD operations`,
    `- Add, edit, AND delete all open the SAME custom in-page modal component (a styled overlay, not the browser's). NEVER use window.confirm(), alert(), or prompt() — native browser dialogs break visual consistency.`,
    ``,
    `## Tables (MUST be production-quality)`,
    `- Use semantic <table> with <thead>, <tbody>, and <th scope="col">/"row".`,
    `- Clear header contrast, consistent cell padding, subtle row hover or zebra striping.`,
    `- Responsive: wrap the table in a container with overflow-x: auto so it scrolls on small screens instead of breaking the layout.`,
    `- Add an empty-state row when there is no data, and column sorting via script.js where relevant.`,
    ``,
    `## Iconography (MUST)`,
    `- NEVER use emoji anywhere in the UI — not in buttons, menus, headers, or empty states.`,
    `- Use ONE icon set for the whole prototype: Lucide.`,
    `- Load it once in the <head> with <script src="https://unpkg.com/lucide@latest"></script>, then place icons with <i data-lucide="icon-name"></i> and call lucide.createIcons() on every page.`,
    `- Give each icon an explicit size and a color from the design palette (not the default emoji-style colors).`,
    ``,
    `## Shared Assets`,
    `- styles.css — shared styles, CSS variables for colors`,
    `- script.js — shared JS (CRUD helpers, navigation, chart rendering)`,
    ``,
    `## Technical Rules`,
    `- Pure static files: HTML, CSS, JavaScript. No frameworks, no bundler.`,
    `- Chart.js loaded from CDN (single script tag).`,
    `- Responsive design (mobile + desktop).`,
    `- All CSS in styles.css, all JS in script.js, minimal inline styles.`,
    `- Write clean, semantic, accessible HTML.`,
    ``,
    `## Output Instructions`,
    `Create the files in the current working directory using the write tool.`,
    `Create: index.html, dashboard.html, styles.css, script.js, and one HTML file per module.`,
    `Start by listing the files you will create, then write each one.`,
    `After writing all files, respond with ONLY the text "DONE".`,
  ].join("\n");
}

/**
 * Refine-mode prompt. A working prototype already lives in the workspace;
 * the agent must apply ONE targeted change in place instead of regenerating.
 */
export function buildPrototypeRefinePrompt(brief: string, instruction: string): string {
  return [
    `You are SANDWICH's prototype revision pass. A working multi-page static prototype already exists in the current working directory. Do NOT regenerate it from scratch.`,
    ``,
    `## Existing prototype`,
    `The files in the working directory are the current version. Read them before editing so your change fits the existing structure, classes, and data.`,
    ``,
    `## Original context (for reference)`,
    brief,
    ``,
    `## Refinement to apply`,
    instruction || "Apply the user's requested change.",
    ``,
    `## Rules`,
    `- Apply ONLY the requested refinement. Keep every other section, copy, data, feature, and file exactly as it is.`,
    `- Edit the existing files in place with the write/edit tool. Do NOT create a new file set, do NOT rename or reorganize files.`,
    `- Preserve the CRUD flows, localStorage logic, Chart.js usage, the single styles.css + script.js structure, and the Lucide icon setup (no emoji).`,
    `- If the request is unclear, make the smallest reasonable change and keep everything else intact.`,
    ``,
    `## Output`,
    `After editing, respond with ONLY the text "DONE".`,
  ].join("\n");
}
