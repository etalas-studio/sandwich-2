# Prototype Pipeline Design

## Overview

Standalone multi-page prototype generation pipeline. Users submit a brief (plus logo and color palette via upload/URL/description), the AI generates a complete multi-page static prototype (landing page + dashboard + module pages with CRUD), files are stored in PostgreSQL, served via a public shareable link, and previewed live in the dashboard iframe.

## Scope

- **Standalone** — not connected to the existing PRD/ticket pipeline.
- **No code editor** — users iterate via chat, not direct file editing.
- **Multi-page static files** — no build step, no sandbox. HTML/CSS/JS served directly.

## Flow

```
1. User clicks "New Prototype" in dashboard
2. Fills brief: description + logo (upload/URL/description) + color palette (hex/URL/description)
3. AI generates multi-page static files via Pi SDK
4. Files stored in PostgreSQL (prototype_files table)
5. Preview in dashboard iframe (live, reload on regenerate)
6. Shareable public link (/p/:shareId) for clients
7. Revision: user chats → AI edits existing files → preview updates
```

## Output Requirements (prompt-enforced)

The generated prototype MUST include:

1. **Landing page** — end-user focused, non-technical copywriting, benefit-oriented
2. **Dashboard** — rich metrics/charts (Chart.js via CDN), business-friendly summary, metrics relevant to brief requirements
3. **Client color palette** — applied via CSS variables
4. **Client logo** — embedded in header/favicon
5. **All modules/menus** — each with complete CRUD (list + create form + edit + delete), using localStorage for simulated data persistence

## Folder Structure

```
apps/server/prototype/
  schema.ts        ← prototype + prototype_files Drizzle tables
  prompts.ts       ← prototype-specific prompt guides
  engine.ts        ← AI generation via Pi SDK (writes files)
  storage.ts       ← store/read files to PostgreSQL
  routes.ts        ← API endpoints
```

## Database Schema

Two new tables:

### `prototypes`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text (UUID) PK | |
| `user_id` | text FK → users.id | |
| `share_id` | text UNIQUE | random token for public link |
| `name` | text | |
| `brief` | text | original brief |
| `logo_data` | text nullable | base64 or URL |
| `palette` | text nullable | JSON array of hex colors |
| `status` | text | generating/done/failed |
| `created_at` | text | |
| `updated_at` | text | |

### `prototype_files`
| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `prototype_id` | text FK → prototypes.id | |
| `path` | text | e.g. "index.html", "css/styles.css" |
| `content` | text | file content |
| `created_at` | text | |
| UNIQUE(prototype_id, path) | | |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/prototypes` | Yes | Create prototype + start generation |
| `GET` | `/api/prototypes` | Yes | List user's prototypes |
| `GET` | `/api/prototypes/:id` | Yes | Get prototype detail |
| `POST` | `/api/prototypes/:id/regenerate` | Yes | Chat iteration → regenerate/update files |
| `GET` | `/p/:shareId` | **No** | Serve prototype (public share link) |
| `GET` | `/p/:shareId/*path` | **No** | Serve individual prototype files |

## Generation Engine (Pi SDK)

Uses the existing Pi SDK (`@earendil-works/pi-coding-agent`) with tools `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`.

Flow:
1. Build system prompt with prototype requirements + client brief + palette + logo
2. Instruct agent to create files in a workspace directory
3. Agent writes HTML/CSS/JS files via `write` tool
4. Read generated files from workspace
5. Store each file in `prototype_files` table
6. Clean up workspace

## Frontend Changes

- Dashboard: "New Prototype" button + prototype list
- New `PrototypeView` component: brief form (description + logo upload/URL/description + palette input), preview iframe, chat iteration panel
- Reuse `useSubscription` for plan gating

## Error Handling

- Generation failure → `prototypes.status = 'failed'`, error message returned
- Missing files → 404 on serve
- Empty brief → 400 validation error

## Testing

- Unit: storage.ts (store/read files), prompts.ts (includes all requirements)
- Integration: create prototype → generate → files stored → serve → share link
- Manual: full flow in browser

## Out of Scope

- Code editor
- Sandboxed build/execution
- Versioning/rollback (chat history is enough for iteration)
- Custom domains
- Production-grade CRUD backend (simulated via localStorage)
