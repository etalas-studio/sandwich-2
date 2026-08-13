import type { Database } from "../db/connection.js";
import type { ServerResponse } from "node:http";
import type { Router } from "../router.js";
import { getConversation, updateConversation, type Conversation } from "../db/conversations.js";
import {
  addChatMessage,
  createMessage,
  getMessages,
  getMessageHistory,
  deleteMessage,
} from "../db/repo/chat-messages.js";
import { authenticateRequest } from "../auth/middleware.js";
import { sendJson, sendCaughtError, readJsonBody } from "../http-utils.js";

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

export interface ConversationRunEvent {
  type: "stage_start" | "stage_end" | "output" | "error" | "done";
  stage?: string;
  text?: string;
  conversation?: Conversation;
}

type Role = "system" | "user" | "assistant";
type ConversationTurn = { role: Role; content: string };

function buildMessages(history: ConversationTurn[]): ConversationTurn[] {
  const brief = history
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n")
    .toLowerCase();

  const isFlow = brief.includes("user flow") || brief.includes("alur");
  const isTech =
    brief.includes("technical") || brief.includes("teknis") || brief.includes("specs");
  const isQuotation =
    brief.includes("quotation") ||
    brief.includes("quote") ||
    brief.includes("penawaran") ||
    brief.includes("harga");
  const isPrototype =
    brief.includes("prototype") ||
    brief.includes("landing") ||
    brief.includes("ui") ||
    brief.includes("design") ||
    brief.includes("html");

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

  return [{ role: "system", content: system }, ...history];
}

const inFlight = new Map<string, AbortController>();
const sseClients = new Map<string, Set<ServerResponse>>();

// ── Engine selection ─────────────────────────────────────────────────────────
// OpenCode (Pi SDK) is primary. Groq is dev fallback.
// Owner sets via env vars — users never pick.

function getEngine(): "opencode" | "groq" | null {
  if (process.env.OPENCODE_API_KEY) return "opencode";
  if (process.env.GROQ_API_KEY) return "groq";
  return null;
}

async function runWithGroq(
  history: ConversationTurn[],
  signal: AbortSignal,
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY!;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "qwen/qwen3.6-27b",
      messages: buildMessages(history),
      max_tokens: 4000,
      reasoning_effort: "none",
      temperature: 0.7,
    }),
    signal,
  });
  if (!res.ok) {
    throw new Error(
      `Groq ${res.status}: ${await res.text().catch(() => res.statusText)}`,
    );
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

async function runWithOpenCode(
  history: ConversationTurn[],
  signal: AbortSignal,
): Promise<string> {
  // Dynamic import Pi SDK — only loaded when OpenCode is configured
  const pi = await import("@earendil-works/pi-coding-agent");

  const modelRuntime = await pi.ModelRuntime.create({
    modelsPath: null,
  });

  const model = modelRuntime.getModel("opencode-go", "gpt-5.1"); // defaults to latest
  if (!model) throw new Error("OpenCode model not available");

  const { session } = await pi.createAgentSession({
    cwd: process.cwd(),
    model: model as any,
    modelRuntime: modelRuntime as any,
    tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
    sessionManager: pi.SessionManager.inMemory(),
    settingsManager: pi.SettingsManager.inMemory({
      compaction: { enabled: false },
    }),
  });

  let responseText = "";
  let errorMessage = "";

  session.subscribe((event: any) => {
    if (signal.aborted) return;

    if (
      event.type === "message_update" &&
      event.assistantMessageEvent?.type === "text_delta"
    ) {
      responseText += event.assistantMessageEvent.delta;
      return;
    }

    if (event.type === "agent_end") {
      if (!errorMessage && typeof event.errorMessage === "string" && event.errorMessage) {
        errorMessage = event.errorMessage;
      }
      if (!responseText) {
        const messages = event.messages;
        if (Array.isArray(messages)) {
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg?.role === "assistant" || msg?.type === "assistant") {
              const content = msg.content;
              if (Array.isArray(content)) {
                for (const block of content) {
                  if (block?.type === "text" && block.text) responseText += block.text;
                }
              } else if (typeof content === "string") {
                responseText = content;
              } else if (typeof msg.text === "string") {
                responseText = msg.text;
              }
              if (responseText) break;
            }
          }
        }
      }
    }
  });

  const messages = buildMessages(history);
  const prompt = messages
    .map((m) => {
      if (m.role === "system") return m.content;
      return `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`;
    })
    .join("\n\n");

  try {
    await session.prompt(prompt);
    await new Promise((r) => setTimeout(r, 100));
    session.dispose();

    if (!responseText && errorMessage) {
      throw new Error(errorMessage);
    }
    return responseText;
  } catch (err) {
    session.dispose();
    throw err;
  }
}

export function registerConversationRunRoutes(
  router: Router,
  db: Database,
): void {
  // Persist a user message (+ optional attachments).
  router.post("/api/conversations/:id/messages", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const conversation = await getConversation(db, params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      sendJson(res, 404, { error: "Conversation not found" });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as {
      content?: string;
      attachmentIds?: string[];
    } | null;
    if (!body || typeof body.content !== "string" || !body.content.trim()) {
      sendJson(res, 400, { error: "content is required" });
      return;
    }

    const attachmentIds = Array.isArray(body.attachmentIds)
      ? body.attachmentIds.filter((x) => typeof x === "string")
      : [];

    try {
      const message = await createMessage(db, {
        conversationId: params.id!,
        userId: auth.userId,
        content: body.content.trim(),
        attachmentIds,
      });
      sendJson(res, 201, message);
    } catch (err) {
      sendCaughtError(res, err, "message creation");
    }
  });

  // Generate the assistant reply — reads history from the DB.
  router.post("/api/conversations/:id/generate", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const conversationId = params.id!;
    const conversation = await getConversation(db, conversationId);
    if (!conversation || conversation.userId !== auth.userId) {
      sendJson(res, 404, { error: "Conversation not found" });
      return;
    }

    // Idempotent — if already running, just return success.
    if (inFlight.has(conversationId)) {
      sendJson(res, 200, { conversationId, started: true });
      return;
    }

    const body = (await readJsonBody(req).catch(() => null)) as {
      regenerate?: boolean;
    } | null;

    // For a regenerate, drop the previous assistant reply so we re-run the
    // last user turn cleanly instead of double-stacking assistant messages.
    let history = await getMessageHistory(db, conversationId);
    if (body?.regenerate && history.length > 0) {
      const last = history[history.length - 1]!;
      if (last.role === "assistant") {
        await deleteMessage(db, last.id);
        history = history.slice(0, -1);
      }
    }

    const engine = getEngine();
    if (!engine) {
      sendJson(res, 503, {
        error:
          "No AI engine configured. Set OPENCODE_API_KEY or GROQ_API_KEY env var.",
      });
      return;
    }

    const controller = new AbortController();
    inFlight.set(conversationId, controller);

    const broadcast = (event: ConversationRunEvent) => {
      const clients = sseClients.get(conversationId);
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

    broadcast({
      type: "stage_start",
      stage: "generate",
      conversation: (await getConversation(db, conversationId))!,
    });
    await updateConversation(db, conversationId, {
      status: "in_progress",
      stage: "generate",
    });

    const turns: ConversationTurn[] = history.map((m) => ({
      role: m.role as Role,
      content: m.content,
    }));

    const useOpenCode = engine === "opencode";
    const hasGroqFallback = !!process.env.GROQ_API_KEY;

    const run = useOpenCode
      ? () =>
          runWithOpenCode(turns, controller.signal).catch((err) => {
            if (hasGroqFallback) {
              console.log(
                `OpenCode failed, falling back to Groq: ${err instanceof Error ? err.message : "unknown"}`,
              );
              return runWithGroq(turns, controller.signal);
            }
            throw err;
          })
      : () => runWithGroq(turns, controller.signal);

    run()
      .then(async (output) => {
        if (!output) {
          await updateConversation(db, conversationId, {
            status: "backlog",
            stage: null,
          });
          broadcast({
            type: "error",
            conversation: (await getConversation(db, conversationId))!,
            text: "Model returned no response. Try again.",
          });
          return;
        }
        await updateConversation(db, conversationId, {
          status: "done",
          stage: null,
          output,
        });
        await addChatMessage(db, {
          conversationId,
          role: "assistant",
          content: output,
        });
        broadcast({
          type: "done",
          conversation: (await getConversation(db, conversationId))!,
        });
      })
      .catch(async (err) => {
        const msg = err instanceof Error ? err.message : "generation failed";
        await updateConversation(db, conversationId, {
          status: "backlog",
          stage: null,
        });
        broadcast({
          type: "error",
          conversation: (await getConversation(db, conversationId))!,
          text: msg,
        });
      })
      .finally(() => {
        inFlight.delete(conversationId);
        const clients = sseClients.get(conversationId);
        if (clients) {
          for (const client of clients) {
            try {
              client.end();
            } catch {
              /* ignore */
            }
          }
          sseClients.delete(conversationId);
        }
      });

    sendJson(res, 200, { conversationId, started: true });
  });

  // Message history (with attachments).
  router.get("/api/conversations/:id/messages", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const conversation = await getConversation(db, params.id!);
    if (!conversation || conversation.userId !== auth.userId) {
      sendJson(res, 404, { error: "Conversation not found" });
      return;
    }
    sendJson(res, 200, await getMessages(db, params.id!));
  });

  // SSE stream for generation progress.
  router.get("/api/conversations/:id/stream", async (req, res, params) => {
    const auth = await authenticateRequest(db, req);
    if (!auth) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const conversationId = params.id!;
    const conversation = await getConversation(db, conversationId);
    if (!conversation || conversation.userId !== auth.userId) {
      sendJson(res, 404, { error: "Conversation not found" });
      return;
    }

    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });

    res.write(
      `data: ${JSON.stringify({ type: "current", conversation })}\n\n`,
    );

    if (!sseClients.has(conversationId)) {
      sseClients.set(conversationId, new Set());
    }
    sseClients.get(conversationId)!.add(res);

    if (!inFlight.has(conversationId)) {
      res.write(
        `data: ${JSON.stringify({ type: "done", conversation })}\n\n`,
      );
      res.end();
      sseClients.get(conversationId)?.delete(res);
      return;
    }

    req.on("close", () => {
      sseClients.get(conversationId)?.delete(res);
      res.end();
    });
  });
}
