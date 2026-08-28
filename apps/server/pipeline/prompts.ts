// ── Sandwich methodology prompts (from sandwich plugin) ──────────────────────

export const SANDWICH_PRD_GUIDE = `
Write a professional PRD document covering:
1. Overview: 2-3 sentence prose — what the product is, who it's for, the core problem it solves
2. Actors: who uses the system (user roles)
3. Modules: named feature areas using client's own language, each with:
   - Status: planned / exists / partial / broken
   - Features: specific capabilities starting with a verb
4. Integrations: external systems the product connects to
5. Constraints: technical, legal, regulatory, or timeline requirements
6. Stakeholders: named parties with decision authority
7. Timeline: project timeline if mentioned
8. Open Questions: things that need clarification from the client before development starts

Rules:
- Base everything strictly on what was stated in the brief — do not invent features
- Keep client's language — if Bahasa Indonesia, write in Bahasa Indonesia
- Do NOT include confidence markers like [stated], [discussed], [inferred] in the output
- Do NOT recommend a tech stack in the PRD

Writing style — sound like a human product manager, not an AI:
- Do NOT use the em dash (—) as a label/description separator (e.g. "Admin HR — pengguna yang mengelola..."). Write it as a normal sentence instead ("Admin HR mengelola...", or "Admin HR: mengelola...").
- Use the em dash sparingly, only for a genuine parenthetical aside mid-sentence — never as a recurring bullet-point pattern.
- Vary sentence structure between bullets and paragraphs — do not repeat the exact same "[Role] — [does X], [does Y], dan [does Z]." template for every actor/feature/item.
- Prefer short, direct sentences over long compound ones stitched together with dashes or semicolons.
- Write section prose (Overview, Constraints, etc.) the way a person would explain it out loud to a colleague, not as a formatted list of clauses.
`;

export const SANDWICH_USERFLOWS_GUIDE = `
## User Flows Structure (Sandwich methodology)
Document primary actor journeys derived from the brief. Each flow:
- ID: UF-001, UF-002, ... (sequential)
- Title: short descriptive name
- Actor: who performs this flow
- Trigger: what starts the flow
- Steps: short imperative phrases, top to bottom
- Outcome: the end state after the flow completes
- Confidence: stated | discussed | inferred | assumed

Cover primary journeys for each main actor. In refinement mode, emit the full updated set.
`;

export const SANDWICH_TECHNICAL_GUIDE = `
## Technical Notes Structure (Sandwich methodology)
Document:
1. Stack: for each layer (frontend / backend / db / infra), the chosen technology and rationale
   - Only recommend where the brief justifies it
2. Architecture Notes: key decisions as heading + prose explanation
3. Risks: technical uncertainties with severity (low | medium | high)
4. Open Decisions: unresolved architectural choices with confidence marker

Rules:
- Base recommendations on brief evidence, not generic best practices
- Risks and open decisions may be empty if none apply
`;

export const SANDWICH_QUOTATION_GUIDE = `
## Quotation Structure (Sandwich methodology)
Produce a professional project quotation covering:
1. Project Overview: what is being built and for whom
2. Scope of Work: itemized deliverables with brief description of each
3. Timeline: breakdown by phase/milestone with estimated duration
4. Pricing: line items with estimated cost per deliverable/phase
   - Labor: hours × rate per role (designer, frontend dev, backend dev, PM)
   - Fixed costs if any (licenses, infrastructure, etc.)
   - Subtotal, any discounts, total
5. Assumptions & Exclusions: what is NOT included, what client must provide
6. Terms: payment schedule (e.g. 50% upfront, 50% on delivery), revision rounds included

Use professional business language. Mark uncertain estimates with a note.
`;

export const SANDWICH_SPECS_GUIDE = `
## Specs & Feature Queue (Sandwich methodology)
Produce a prioritized feature queue plus one spec per feature:
1. Feature Queue — a table listing every feature: ID (F-001, F-002, ...), title, impact (1-10), effort (1-10), risk (1-10), priority score.
2. Per-feature specs — for each feature: scope (what is in/out) and an acceptance-criteria checklist.

Rules:
- Base everything strictly on the brief — do not invent features.
- Keep the client's language.
`;

// ── getokui UI doctrine (from getokui plugin) ────────────────────────────────

export const GETOKUI_PROTOTYPE_GUIDE = `
## UI/Prototype Quality Standards (getokui doctrine)

### Anti-slop rules — FORBIDDEN defaults:
- The centered-hero-of-doom: headline centered, one subline, two buttons, blurred blob behind
- The stock section conveyor: hero → logo strip → 3 feature cards → testimonial → 3-tier pricing → FAQ → CTA band → footer
- Everything centered & symmetric, uniform rounded-2xl on every box, Inter + indigo/purple gradient

### Required instead:
- Reproduce the actual composition from design references (split / asymmetric / editorial)
- Include at least ONE signature move: bento grid, marquee, rotated/overlapping elements, oversized type, grain texture
- Introduce asymmetry somewhere — off-center focal point, oversized element breaking the grid
- Vary section rhythm — different widths, some full-bleed, some contained

### Hard minimums for any UI:
- Section vertical padding: at least py-20 on desktop, hero at least pt-28/pb-24
- Hero headline: at least text-5xl (prefer text-6xl or text-7xl)
- Type hierarchy: at least 3 clearly distinct levels
- Motion: at least 2 real animations — one ambient (@keyframes) and one interaction (hover/scroll-reveal)
- Icons: NEVER emoji — use Lucide (tech/SaaS/fintech) or Solar (premium/soft/editorial). One set only, consistent throughout
- Consistency: one radius token and one shadow token used everywhere (no mixing)
- Contrast: body text must be readable on its background

### Icon implementation:
HTML — Lucide: <script src="https://unpkg.com/lucide@latest"></script> then <i data-lucide="arrow-right" class="w-5 h-5"></i>
HTML — Solar: <script src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js"></script> then <iconify-icon icon="solar:arrow-right-linear" width="20"></iconify-icon>

### Indonesian brand benchmarks for component quality:
- Fintech/payment: Bank Jago, Jenius, Xendit, Midtrans, Flip
- Super-app: Gojek, Grab, Tokopedia, Traveloka
- SaaS/dev-tools: Mekari, Kata.ai, Ruangguru
- Global bars: Stripe (CTA quality), Linear (motion + precision), Vercel (developer feel), Airbnb (warmth + photo)

Output full, self-contained HTML with Tailwind CDN. Include real @keyframes animations. No placeholder lorem ipsum — generate plausible content for the domain.

### App/Dashboard prototype requirements (when building a product app, not a landing page):

#### CRUD must be fully functional — not mocked:
- Use a JavaScript array/object as in-memory data store (initialized with realistic seed data)
- CREATE: form submissions must push real objects into the store and re-render the list immediately
- READ: tables and lists must render from the store, not hardcoded HTML rows
- UPDATE: edit buttons must open a pre-filled form/modal; saving must update the store and re-render
- DELETE: delete buttons must remove from store and re-render; add a confirmation step
- All IDs must be auto-generated (use Date.now() or a counter)
- State must survive tab switches within the prototype (use the same JS store, not re-fetch)

#### Tables — never fake:
- Render rows from data, not static HTML
- Include: sort by column (toggle asc/desc), search/filter input that filters rows in real-time
- Pagination if rows > 10: show page X of Y, prev/next buttons
- Empty state: dedicated UI when no rows match filter or store is empty
- Row actions: Edit and Delete buttons on every row, both fully wired

#### Forms and modals:
- Required field validation: highlight invalid fields, show error message below each field
- Submit must be disabled while invalid
- Modal must close on backdrop click AND on explicit close/cancel button
- After submit: close modal, show success toast (auto-dismiss after 3s), re-render list
- Never reload the page on form submit — preventDefault always

#### Navigation:
- Multi-view apps: implement a real router (show/hide sections based on active state in JS)
- Active nav item must be visually highlighted
- Back/breadcrumb must work — clicking it returns to the previous view

#### UI completeness — EVERY component must be finished:
- No placeholder "coming soon" or disabled-forever buttons
- Dropdown menus must open/close on click, close on outside click
- Date pickers: use native <input type="date"> if a library is not loaded
- Status badges: use distinct colors per status (not all grey)
- Charts/stats: use real numbers from the store (e.g., count rows by status)
- Sidebar must be collapsible on mobile if the layout has one

#### Error and loading states:
- Show a loading skeleton or spinner on initial render (simulate 300ms delay with setTimeout)
- Show an error state UI if an operation fails (can be simulated with try/catch on the store)

#### Code quality in the output:
- One renderXxx() function per major component — never inline render spaghetti
- Store mutations must always trigger a full re-render of the affected component
- No global CSS conflicts — scope styles with consistent class prefixes or use Tailwind only
`;
