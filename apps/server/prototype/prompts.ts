export interface PrototypePromptInput {
  brief: string;
  palette: string | null;
  logoData: string | null;
}

export function buildPrototypeSystemPrompt(input: PrototypePromptInput): string {
  const paletteSection = input.palette
    ? `## Color Palette (client-provided)\nUse these exact colors as CSS variables in styles.css:\n${input.palette}\n`
    : `## Color Palette\nChoose a professional palette that fits the brief. Define them as CSS variables in styles.css.\n`;

  const logoSection = (() => {
    if (!input.logoData) {
      return `## Logo\nCreate a simple text-based logo placeholder that fits the brand.\n`;
    }
    if (input.logoData.startsWith("data:")) {
      return `## Logo (client-uploaded)\nThe client logo image is saved at: assets/logo.png\nReference it in the header and favicon using: <img src="assets/logo.png" alt="logo">\n`;
    }
    if (/^https?:\/\//.test(input.logoData)) {
      return `## Logo (client-provided URL)\nThe client logo is at: ${input.logoData}\nReference it in the header and favicon.\n`;
    }
    return `## Logo (client description)\nThe client described their logo as: ${input.logoData}\nCreate a matching logo placeholder in the header and favicon.\n`;
  })();

  return [
    `You are SANDWICH, an expert prototype builder. You generate complete, production-quality static prototypes.`,
    ``,
    `## Client Brief`,
    input.brief,
    ``,
    paletteSection,
    ``,
    logoSection,
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
