# Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add end-to-end request tracing (Honeycomb + OpenTelemetry) to the backend and error capture (Sentry) to the frontend so any bug in the chat/generate/prototype flow can be pinpointed to the exact layer without manual debugging.

**Architecture:** The backend instruments every HTTP handler, AI engine call, DB write, and SSE broadcast as OTel spans exported to Honeycomb via OTLP. The frontend initialises Sentry once in `layout.tsx` and captures the `x-trace-id` response header from the backend so frontend errors can link to the backend trace that caused them.

**Tech Stack:** `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/api`, `@sentry/nextjs`

## Global Constraints

- Node.js ≥ 22 (already in use)
- Next.js 15 / React 19 (already in use)
- Do not add any new runtime deps to `apps/web` beyond `@sentry/nextjs`
- Do not add any new runtime deps to root beyond the four OTel packages listed above
- OTel SDK **must** be the very first import in `web-server.ts` — before `dotenv/config`
- All Honeycomb env vars prefixed `OTEL_`; all Sentry env vars prefixed `SENTRY_` or `NEXT_PUBLIC_SENTRY_`
- Span names follow OTel semantic conventions where one exists; otherwise use `sandwich.*` prefix

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `apps/server/otel.ts` | Create | OTel SDK init + `startSpan` helper |
| `apps/server/web-server.ts` | Modify | Import `./otel.js` as first line |
| `apps/server/http-utils.ts` | Modify | Attach `x-trace-id` to every response |
| `apps/server/routes/conversation-run.ts` | Modify | Span around generate handler, AI engine, DB write, SSE broadcast |
| `apps/web/sentry.client.config.ts` | Create | Sentry browser SDK init |
| `apps/web/sentry.server.config.ts` | Create | Sentry server SDK init |
| `apps/web/next.config.ts` | Modify | Wrap with `withSentryConfig` |
| `apps/web/src/components/TraceInit.tsx` | Create | Client component that stores `x-trace-id` from responses |
| `apps/web/src/app/layout.tsx` | Modify | Render `<TraceInit />` |
| `.env.example` | Modify | Document required env vars |

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json` (root)
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install backend OTel packages**

```bash
npm install \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/api
```

- [ ] **Step 2: Install frontend Sentry package**

```bash
npm --prefix apps/web install @sentry/nextjs
```

- [ ] **Step 3: Verify installs**

```bash
node -e "require('@opentelemetry/api')" && echo "OTel OK"
cd apps/web && node -e "require('@sentry/nextjs')" && echo "Sentry OK"
```

Expected: both lines print OK.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json apps/web/package.json apps/web/package-lock.json
git commit -m "chore(obs): install OTel and Sentry dependencies"
```

---

## Task 2: Backend OTel SDK init

**Files:**
- Create: `apps/server/otel.ts`
- Modify: `apps/server/web-server.ts` (add import as line 1)
- Modify: `apps/server/http-utils.ts` (attach `x-trace-id` header)

**Interfaces:**
- Produces: `startSpan(name, attrs, fn)` exported from `apps/server/otel.ts` — used in Tasks 3 and 4

- [ ] **Step 1: Create `apps/server/otel.ts`**

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const exporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'https://api.honeycomb.io/v1/traces',
  headers: {
    'x-honeycomb-team': process.env.OTEL_EXPORTER_OTLP_HEADERS_API_KEY ?? '',
  },
});

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'sandwich-backend',
  traceExporter: exporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();
process.on('SIGTERM', () => { void sdk.shutdown(); });

export const tracer = trace.getTracer('sandwich');

export async function startSpan<T>(
  name: string,
  attrs: Record<string, string | number | boolean>,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    span.setAttributes(attrs);
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      span.end();
    }
  });
}
```

- [ ] **Step 2: Add OTel import as first line of `apps/server/web-server.ts`**

Open the file. The current first line is `import "dotenv/config";`. Insert before it:

```typescript
import './otel.js';
```

Result — the first two lines become:
```typescript
import './otel.js';
import "dotenv/config";
```

Leave the rest of the file unchanged.

- [ ] **Step 3: Attach `x-trace-id` to HTTP responses in `apps/server/http-utils.ts`**

Read the file first to find the `sendJson` function signature. Then add these two lines inside `sendJson`, immediately before the `res.writeHead(...)` call:

```typescript
import { trace } from '@opentelemetry/api';

// Inside sendJson, before res.writeHead:
const activeSpan = trace.getActiveSpan();
const traceId = activeSpan?.spanContext().traceId;
```

Then add `...(traceId ? { 'x-trace-id': traceId } : {})` to the headers object passed to `writeHead`. The exact edit depends on the current shape of `sendJson` — read the file, identify the `writeHead` call, and merge the header in without breaking the existing signature.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/server/otel.ts apps/server/web-server.ts apps/server/http-utils.ts
git commit -m "feat(obs): initialise OpenTelemetry SDK, attach x-trace-id to all responses"
```

---

## Task 3: Instrument the generate + AI engine path

**Files:**
- Modify: `apps/server/routes/conversation-run.ts`

**Interfaces:**
- Consumes: `startSpan` from `'../otel.js'`

The generate route fires a detached async IIFE (`void (async () => { ... })()`). Wrap the key sub-steps so Honeycomb shows: `sandwich.generate` → `sandwich.ai.run` → `sandwich.db.write_message` → `sandwich.sse.broadcast`.

- [ ] **Step 1: Add import**

At the top of `apps/server/routes/conversation-run.ts`, add:

```typescript
import { startSpan } from '../otel.js';
```

- [ ] **Step 2: Wrap the entire detached IIFE body in `sandwich.generate`**

Inside the `void (async () => { ... })()` block, wrap everything (the try/catch/finally) in:

```typescript
await startSpan(
  'sandwich.generate',
  {
    'sandwich.conversation_id': conversationId,
    'sandwich.stage': String(conversation.pipelineStage ?? 'unknown'),
    'sandwich.engine': engine ?? 'none',
  },
  async () => {
    try {
      // ... existing try body unchanged ...
    } catch (err) {
      // ... existing catch unchanged ...
    }
    // Note: closeInFlight moves to the finally of startSpan's wrapper below
  },
);
```

Keep `closeInFlight(conversationId)` in a `finally` block wrapping the `startSpan` call.

- [ ] **Step 3: Wrap the AI `run()` call in `sandwich.ai.run`**

Locate `const output = await run()` (or equivalent). Replace with:

```typescript
const output = await startSpan(
  'sandwich.ai.run',
  {
    'sandwich.engine': engine ?? 'none',
    'sandwich.pending_type': pendingType ?? 'none',
  },
  () => run(),
);
```

- [ ] **Step 4: Wrap `addChatMessage` in `sandwich.db.write_message`**

Locate the `await addChatMessage(db, { conversationId, role: 'assistant', content: chatOutput ... })` call. Replace with:

```typescript
await startSpan(
  'sandwich.db.write_message',
  { 'sandwich.conversation_id': conversationId, 'db.operation': 'insert' },
  () => addChatMessage(db, { conversationId, role: 'assistant', content: chatOutput, documentId: documentRef?.id ?? null }),
);
```

- [ ] **Step 5: Wrap the final `broadcast` in `sandwich.sse.broadcast`**

Locate the `broadcast({ type: 'done', ... })` call. Replace with:

```typescript
await startSpan(
  'sandwich.sse.broadcast',
  { 'sandwich.conversation_id': conversationId, 'sandwich.event_type': 'done' },
  async () => { broadcast({ type: 'done', text: chatOutput, conversation: updatedConversation!, document: documentRef ?? undefined }); },
);
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/server/routes/conversation-run.ts
git commit -m "feat(obs): span generate handler, AI engine call, DB write, SSE broadcast"
```

---

## Task 4: Instrument user message creation

**Files:**
- Modify: `apps/server/routes/conversation-run.ts` (message POST handler only)

**Interfaces:**
- Consumes: `startSpan` from `'../otel.js'` (already imported in Task 3)

- [ ] **Step 1: Wrap `createMessage` in the message POST handler**

In `router.post("/api/conversations/:id/messages", ...)`, inside the try block, wrap the `createMessage(...)` call:

```typescript
const message = await startSpan(
  'sandwich.db.create_message',
  {
    'sandwich.conversation_id': params.id ?? '',
    'db.operation': 'insert',
    'sandwich.role': 'user',
  },
  () => createMessage(db, {
    conversationId: params.id!,
    userId: auth.userId,
    content: body.content.trim(),
    attachmentIds,
  }),
);
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/routes/conversation-run.ts
git commit -m "feat(obs): span user message creation"
```

---

## Task 5: Sentry frontend setup

**Files:**
- Create: `apps/web/sentry.client.config.ts`
- Create: `apps/web/sentry.server.config.ts`
- Modify: `apps/web/next.config.ts`
- Create: `apps/web/src/components/TraceInit.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Create `apps/web/sentry.client.config.ts`**

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  integrations: [],
});
```

- [ ] **Step 2: Create `apps/web/sentry.server.config.ts`**

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
  tracesSampleRate: 0,
});
```

- [ ] **Step 3: Wrap `apps/web/next.config.ts` with `withSentryConfig`**

Read `apps/web/next.config.ts` first. Then add at the top:

```typescript
import { withSentryConfig } from '@sentry/nextjs';
```

And wrap the default export:

```typescript
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
```

- [ ] **Step 4: Create `apps/web/src/components/TraceInit.tsx`**

```typescript
'use client';
import { useEffect } from 'react';

export default function TraceInit() {
  useEffect(() => {
    const orig = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const res = await orig(input, init);
      const traceId = res.headers.get('x-trace-id');
      if (traceId) (window as any).__lastTraceId = traceId;
      return res;
    };
  }, []);
  return null;
}
```

- [ ] **Step 5: Add `<TraceInit />` to `apps/web/src/app/layout.tsx`**

Import it:
```typescript
import TraceInit from '../components/TraceInit';
```

Render it inside `<body>`, after `<AppEffects />`:
```tsx
<AppEffects />
<TraceInit />
```

- [ ] **Step 6: Build the web app**

```bash
npm --prefix apps/web run build 2>&1 | tail -20
```

Expected: build succeeds. Sentry source-map upload warnings are fine without a token.

- [ ] **Step 7: Commit**

```bash
git add apps/web/sentry.client.config.ts apps/web/sentry.server.config.ts apps/web/next.config.ts apps/web/src/components/TraceInit.tsx apps/web/src/app/layout.tsx
git commit -m "feat(obs): initialise Sentry on frontend, store x-trace-id from backend"
```

---

## Task 6: Document env vars

**Files:**
- Modify: `.env.example` (create if missing)

- [ ] **Step 1: Append env vars to `.env.example`**

```bash
cat >> .env.example << 'EOF'

# ── Observability ─────────────────────────────────────────────────────────────
# Backend — OpenTelemetry → Honeycomb
OTEL_SERVICE_NAME=sandwich-backend
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io/v1/traces
OTEL_EXPORTER_OTLP_HEADERS_API_KEY=your-honeycomb-api-key

# Frontend — Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz
SENTRY_ENVIRONMENT=production
SENTRY_ORG=your-sentry-org
SENTRY_PROJECT=sandwich-frontend
EOF
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(obs): document Honeycomb and Sentry env vars"
```

---

## Task 7: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin worktree-feat+observability
```

- [ ] **Step 2: Open PR**

```bash
gh pr create \
  --title "feat(obs): add OTel tracing (Honeycomb) + Sentry frontend errors" \
  --body "$(cat <<'EOF'
## Summary
- Backend: OTel SDK starts before all other imports; spans cover the full path: HTTP → generate → AI engine → DB write → SSE broadcast
- Frontend: Sentry init in Next.js layout; \`x-trace-id\` from every backend response stored in \`window.__lastTraceId\` so frontend error reports can reference the backend trace
- All config via env vars; \`.env.example\` updated

## How to verify
1. Set \`OTEL_EXPORTER_OTLP_HEADERS_API_KEY\` and start the server — send a chat message — Honeycomb shows a \`sandwich.generate\` trace with child spans
2. Set \`NEXT_PUBLIC_SENTRY_DSN\` — trigger a frontend throw — Sentry captures it with env and release

## Env vars required
See \`.env.example\` — all prefixed \`OTEL_\` (backend) or \`SENTRY_\`/\`NEXT_PUBLIC_SENTRY_\` (frontend)
EOF
)"
```
