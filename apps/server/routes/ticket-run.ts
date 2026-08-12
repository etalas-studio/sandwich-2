import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type Database from "better-sqlite3";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Router } from "../router.js";
import type { InvokerFactory } from "../scanner/run-scan.js";
import { getProjectRepoPath } from "../db/project.js";
import { getTicket, updateTicket } from "../db/tickets.js";
import { getCredential } from "../db/credentials.js";
import { runTicketPipeline } from "../pipeline/ticket-runner.js";
import type { TicketRunEvent } from "../pipeline/ticket-runner.js";
import { sendJson } from "../http-utils.js";

// ── Sandwich methodology (from sandwich plugin) ──────────────────────────────
const SANDWICH_PRD_GUIDE = `
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
`;

const SANDWICH_USERFLOWS_GUIDE = `
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

const SANDWICH_TECHNICAL_GUIDE = `
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

const SANDWICH_QUOTATION_GUIDE = `
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

// ── getokui UI doctrine (from getokui plugin) ────────────────────────────────
const GETOKUI_PROTOTYPE_GUIDE = `
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
`;

type ConversationTurn = { role: "user" | "assistant"; content: string };

function buildMessages(summary: string, description: string, history: ConversationTurn[]): ConversationTurn[] {
  const lower = (summary ?? "").toLowerCase();
  const isFlow = lower.includes("user flow") || lower.includes("alur");
  const isTech = lower.includes("technical") || lower.includes("teknis") || lower.includes("specs");
  const isQuotation = lower.includes("quotation") || lower.includes("quote") || lower.includes("penawaran") || lower.includes("harga");
  const isPrototype = lower.includes("prototype") || lower.includes("landing") || lower.includes("ui") || lower.includes("design") || lower.includes("html");

  const docGuide = isPrototype
    ? GETOKUI_PROTOTYPE_GUIDE
    : isQuotation
    ? SANDWICH_QUOTATION_GUIDE
    : isFlow
    ? SANDWICH_USERFLOWS_GUIDE
    : isTech
    ? SANDWICH_TECHNICAL_GUIDE
    : SANDWICH_PRD_GUIDE;

  const outputInstruction = isPrototype
    ? `Output a complete, self-contained HTML prototype file. Include all CSS and JS inline. Follow ALL quality standards above. NO preamble — start with <!DOCTYPE html>.`
    : `Output the full document in markdown. Be thorough and professional. Return ONLY the document content — no meta-commentary.`;

  const system = [
    `You are SANDWICH, an expert product consultant AI built by Etalas.`,
    `You help clients turn ideas and briefs into structured product documents.`,
    `Reply in the same language as the client (Indonesian or English).`,
    ``,
    `## Your process:`,
    `1. When the client first sends a brief, ALWAYS ask 3-5 focused clarifying questions before generating any document. Your questions should fill the most critical gaps (target users, core features, integrations, timeline, constraints).`,
    `2. Once you have enough context from the client's answers, generate the document following the guidelines below.`,
    `3. Never generate a document on the first message — always ask questions first.`,
    ``,
    docGuide,
    ``,
    outputInstruction,
  ].join("\n");

  const messages: ConversationTurn[] = [
    { role: "user", content: system + "\n\n---\n\nClient brief:\n" + (description || summary) },
  ];

  // Append follow-up history if any
  for (const turn of history) {
    messages.push(turn);
  }

  return messages;
}

const inFlight = new Map<string, AbortController>();
const sseClients = new Map<string, Set<ServerResponse>>();

export function registerTicketRunRoutes(
  router: Router,
  db: Database.Database,
  createInvoker: InvokerFactory,
  reposDir: string,
): void {
  // Trigger a ticket pipeline run
  router.post("/api/tickets/:key/run", async (req, res, params) => {
    const repoPath = getProjectRepoPath(db, reposDir);
    if (!repoPath) {
      sendJson(res, 503, { error: "No project configured." });
      return;
    }

    const ticketKey = params.key!;
    const ticket = getTicket(db, ticketKey);
    if (!ticket) {
      sendJson(res, 404, { error: "Ticket not found" });
      return;
    }

    if (ticket.status === "done") {
      sendJson(res, 409, { error: "Ticket is already done" });
      return;
    }

    // Only one run per ticket at a time
    if (inFlight.has(ticketKey)) {
      sendJson(res, 409, { error: "A run is already in progress for this ticket" });
      return;
    }

    // Read optional modelId from body
    let modelId: string | null = null;
    try {
      const body = await readJson(req);
      if (body && typeof (body as Record<string, unknown>).modelId === "string") {
        modelId = (body as Record<string, unknown>).modelId as string;
      }
    } catch {
      // body is optional
    }

    const controller = new AbortController();
    inFlight.set(ticketKey, controller);

    const broadcast = (event: TicketRunEvent) => {
      const clients = sseClients.get(ticketKey);
      if (!clients) return;
      const data = `data: ${JSON.stringify(event)}\n\n`;
      for (const client of clients) {
        try {
          client.write(data);
        } catch {
          clients.delete(client);
        }
      }
    };

    runTicketPipeline(db, createInvoker, ticketKey, repoPath, modelId, broadcast, controller.signal)
      .catch(() => {})
      .finally(() => {
        inFlight.delete(ticketKey);
        // Close SSE connections
        const clients = sseClients.get(ticketKey);
        if (clients) {
          for (const client of clients) {
            try {
              client.end();
            } catch {
              /* ignore */
            }
          }
          sseClients.delete(ticketKey);
        }
      });

    sendJson(res, 200, { ticketKey, started: true });
  });

  // Generate document without a repo — for PRD/MOM/Quotation/Specs
  router.post("/api/tickets/:key/generate", async (req, res, params) => {
    const ticketKey = params.key!;
    const ticket = getTicket(db, ticketKey);
    if (!ticket) {
      sendJson(res, 404, { error: "Ticket not found" });
      return;
    }
    if (inFlight.has(ticketKey)) {
      sendJson(res, 409, { error: "Already running" });
      return;
    }

    const groqCred = getCredential(db, "groq");
    const groqKey = groqCred ? (JSON.parse(groqCred.value) as { key?: string }).key ?? null : null;
    if (!groqKey) {
      sendJson(res, 503, { error: "Groq API key not configured. Add it via Settings → Integrations." });
      return;
    }

    const controller = new AbortController();
    inFlight.set(ticketKey, controller);

    const broadcast = (event: TicketRunEvent) => {
      const clients = sseClients.get(ticketKey);
      if (!clients) return;
      const data = `data: ${JSON.stringify(event)}\n\n`;
      for (const client of clients) {
        try { client.write(data); } catch { clients.delete(client); }
      }
    };

    let history: ConversationTurn[] = [];
    try {
      const body = await readJson(req);
      if (Array.isArray((body as Record<string, unknown>)?.history)) {
        history = (body as Record<string, unknown>).history as ConversationTurn[];
      }
    } catch { /* no body */ }

    broadcast({ type: "stage_start", stage: "implement", ticket: getTicket(db, ticketKey)! });
    updateTicket(db, ticketKey, { status: "in_progress", stage: "implement" });

    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen/qwen3.6-27b",
        messages: buildMessages(ticket.summary ?? "", ticket.description ?? "", history),
        max_tokens: 4000,
        reasoning_effort: "none",
        temperature: 0.7,
      }),
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Groq ${r.status}: ${await r.text().catch(() => r.statusText)}`);
        const json = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
        return json.choices?.[0]?.message?.content ?? "";
      })
      .then((output) => {
        if (!output) {
          updateTicket(db, ticketKey, { status: "backlog", stage: null });
          broadcast({ type: "error", ticket: getTicket(db, ticketKey)!, text: "Model returned no response. Try again." });
          return;
        }
        updateTicket(db, ticketKey, { status: "done", stage: null, prDescription: output });
        broadcast({ type: "done", ticket: getTicket(db, ticketKey)! });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "generation failed";
        updateTicket(db, ticketKey, { status: "backlog", stage: null });
        broadcast({ type: "error", ticket: getTicket(db, ticketKey)!, text: msg });
      })
      .finally(() => {
        inFlight.delete(ticketKey);
        const clients = sseClients.get(ticketKey);
        if (clients) {
          for (const client of clients) { try { client.end(); } catch { /* ignore */ } }
          sseClients.delete(ticketKey);
        }
      });

    sendJson(res, 200, { ticketKey, started: true });
  });

  // Resolve a quick-win choice and re-run
  router.post("/api/tickets/:key/resolve", async (req, res, params) => {
    const ticketKey = params.key!;
    const ticket = getTicket(db, ticketKey);
    if (!ticket) {
      sendJson(res, 404, { error: "Ticket not found" });
      return;
    }

    if (!ticket.quickWinChoices) {
      sendJson(res, 400, { error: "No pending choices for this ticket" });
      return;
    }

    let body: unknown;
    try {
      body = await readJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON" });
      return;
    }

    const choiceIndex = (body as Record<string, unknown> | null)?.["choiceIndex"];
    if (typeof choiceIndex !== "number") {
      sendJson(res, 400, { error: "choiceIndex is required" });
      return;
    }

    let choices: Array<{ label: string; description: string; inject: string }>;
    try {
      choices = JSON.parse(ticket.quickWinChoices);
    } catch {
      sendJson(res, 500, { error: "Invalid choices data" });
      return;
    }

    if (choiceIndex < 0 || choiceIndex >= choices.length) {
      sendJson(res, 400, { error: "Invalid choiceIndex" });
      return;
    }

    const chosen = choices[choiceIndex]!;
    const newDescription = `${ticket.description}\n\n[Resolved] ${chosen.inject}`;

    updateTicket(db, ticketKey, {
      description: newDescription,
      quickWinChoices: null,
      quickWinAttempts: (ticket.quickWinAttempts ?? 0) + 1,
      status: "backlog",
      stage: null,
      needsHumanCategory: null,
      needsHumanReason: null,
    });

    // Trigger re-run
    const repoPath = getProjectRepoPath(db, reposDir);
    if (!repoPath) {
      sendJson(res, 200, { resolved: true, rerun: false, error: "No project configured" });
      return;
    }

    // Read optional modelId from body
    let modelId: string | null = null;
    if (typeof (body as Record<string, unknown>).modelId === "string") {
      modelId = (body as Record<string, unknown>).modelId as string;
    }

    if (inFlight.has(ticketKey)) {
      sendJson(res, 200, { resolved: true, rerun: false, error: "Run already in progress" });
      return;
    }

    const controller = new AbortController();
    inFlight.set(ticketKey, controller);

    const broadcast = (event: TicketRunEvent) => {
      const clients = sseClients.get(ticketKey);
      if (!clients) return;
      const data = `data: ${JSON.stringify(event)}\n\n`;
      for (const client of clients) {
        try {
          client.write(data);
        } catch {
          clients.delete(client);
        }
      }
    };

    runTicketPipeline(db, createInvoker, ticketKey, repoPath, modelId, broadcast, controller.signal)
      .catch(() => {})
      .finally(() => {
        inFlight.delete(ticketKey);
        const clients = sseClients.get(ticketKey);
        if (clients) {
          for (const client of clients) {
            try {
              client.end();
            } catch {
              /* ignore */
            }
          }
          sseClients.delete(ticketKey);
        }
      });

    sendJson(res, 200, { resolved: true, rerun: true });
  });

  // SSE stream for ticket progress
  router.get("/api/tickets/:key/stream", (req, res, params) => {
    const ticketKey = params.key!;
    const ticket = getTicket(db, ticketKey);

    if (!ticket) {
      sendJson(res, 404, { error: "Ticket not found" });
      return;
    }

    // Set SSE headers
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });

    // Send current state
    res.write(`data: ${JSON.stringify({ type: "current", ticket })}\n\n`);

    // Register client
    if (!sseClients.has(ticketKey)) {
      sseClients.set(ticketKey, new Set());
    }
    sseClients.get(ticketKey)!.add(res);

    // If no run in flight, close after sending current state
    if (!inFlight.has(ticketKey)) {
      res.write(`data: ${JSON.stringify({ type: "done", ticket })}\n\n`);
      res.end();
      sseClients.get(ticketKey)?.delete(res);
      return;
    }

    // Cleanup on disconnect
    req.on("close", () => {
      sseClients.get(ticketKey)?.delete(res);
      res.end();
    });
  });
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}
