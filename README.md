# SANDWICH

From a messy brief to an execution-ready spec. One pipeline — PRD, prototype, MOM, quotation — not five separate tools.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, TypeScript, `node:http` |
| **Database** | PostgreSQL + Drizzle ORM |
| **Frontend** | React 19, Vite, Tailwind CSS 4 |
| **AI** | Pi SDK (OpenCode), Groq (fallback) |
| **Payment** | Midtrans Snap |
| **Deploy** | Railway |

## Project Structure

```
sandwich-2/
├── apps/
│   ├── server/          # Backend API server (port 4319)
│   │   ├── auth/        # Authentication (scrypt password hashing, sessions)
│   │   ├── db/          # Database layer
│   │   │   ├── schema.ts          # Drizzle schema (all tables)
│   │   │   ├── connection.ts       # PostgreSQL connection pool
│   │   │   ├── repo/              # Repository modules
│   │   │   └── drizzle/           # Auto-generated migrations
│   │   ├── pipeline/    # Midtrans, integrations
│   │   └── routes/      # API route handlers
│   └── web/             # Frontend React app (Vite dev on port 3000)
│       └── src/
│           ├── components/  # AuthGate, Dashboard, CheckoutPage, LandingPage, SharePage
│           ├── hooks/       # useAuth, useSubscription, useUsage
│           ├── api/         # API client functions (conversations, attachments, preferences)
│           └── lib/         # i18n, conversations, promptTemplates, promptChips
├── docs/superpowers/   # Design specs & implementation plans
└── .env                # Environment variables (gitignored)
```

## Quick Start

### Prerequisites

- **Node.js** 20+
- **PostgreSQL** 16 (installed via Homebrew on macOS)
- **npm**

### 1. Clone & Install

```bash
git clone https://github.com/etalas-studio/sandwich-2.git
cd sandwich-2
npm install          # installs backend + frontend deps
```

### 2. PostgreSQL Setup

```bash
# Install PostgreSQL (macOS)
brew install postgresql@16

# Start the service
brew services start postgresql@16

# Create the database
createdb sandwich

# Verify it's running
psql -d sandwich -c "SELECT 1"
```

### 3. Environment Variables

Create `.env` in the project root:

```env
# ─── Server ───
PORT=4319
DATABASE_URL=postgresql://localhost:5432/sandwich
TRUSTED_HOSTS=localhost

# Set to PRODUCTION for real Midtrans payments. Anything else uses simulation.
ENVIRONMENT=development

# ─── AI Engine (OpenCode / Pi SDK) ───
OPENCODE_API_KEY=your-opencode-key
OPENCODE_PROVIDER=opencode-go       # Pi provider id
OPENCODE_MODEL=deepseek-v4-pro      # main doc-generation model
# GROQ_API_KEY=your-groq-key        # fallback engine (text + whisper)

# ─── Attachment extraction ───
OPENCODE_VISION_PROVIDER=opencode           # provider for image vision
OPENCODE_VISION_MODEL=gemini-3.5-flash-lite # image model
OCR_LANGS=eng                               # OCR fallback (eng+ind for Indonesian)
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3   # audio model

# ─── Midtrans (optional) ───
MIDTRANS_SERVER_KEY=your-server-key
MIDTRANS_CLIENT_KEY=your-client-key
MIDTRANS_IS_PRODUCTION=false    # sandbox by default

# ─── Attachments (Cloudflare R2) ───
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=sandwich-attachments
R2_PUBLIC_URL=                  # optional public base URL; if empty, presigned URLs are used
```

### 4. Run Database Migrations

```bash
DATABASE_URL=postgresql://localhost:5432/sandwich \
  npx drizzle-kit migrate --config apps/server/drizzle.config.ts
```

### 5. Start Development Servers

You need **two terminals**:

**Terminal 1 — Backend API (port 4319):**
```bash
npm run serve
```

**Terminal 2 — Frontend (port 3000):**
```bash
npm run dev:web
```

Open `http://localhost:3000` in your browser.

## Database

### Schema

9 tables managed by Drizzle ORM (`apps/server/db/schema.ts`):

| Table | Purpose |
|-------|---------|
| `users` | User accounts (auth) |
| `sessions` | Session tokens (7-day expiry) |
| `conversations` | Briefs/chats + generated documents (PRD, prototype, MOM, etc.) |
| `chat_messages` | Per-conversation message history |
| `attachments` | Uploaded file metadata (bytes live in Cloudflare R2) |
| `payments` | Midtrans payment records |
| `subscriptions` | User plan subscriptions (starter/pro) |
| `usage` | Monthly brief quota tracking |
| `user_preferences` | Key-value settings (language, etc.) |

### Making Schema Changes

1. Edit `apps/server/db/schema.ts`
2. Generate migration:
   ```bash
   DATABASE_URL=postgresql://localhost:5432/sandwich \
     npx drizzle-kit generate --config apps/server/drizzle.config.ts
   ```
3. Apply migration:
   ```bash
   DATABASE_URL=postgresql://localhost:5432/sandwich \
     npx drizzle-kit migrate --config apps/server/drizzle.config.ts
   ```

### Query Pattern

All DB functions are async. Use Drizzle query API:

```typescript
import { eq } from "drizzle-orm";
import { users } from "./schema.js";

// Select
const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);

// Insert
await db.insert(users).values({ id, username, email, ... });

// Update
await db.update(users).set({ username: "new" }).where(eq(users.id, id));

// Delete
await db.delete(users).where(eq(users.id, id));

// Transaction
await db.transaction(async (tx) => {
  await tx.insert(users).values(...);
  await tx.insert(subscriptions).values(...);
});
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:web` | Start Vite dev server (port 3000) |
| `npm run serve` | Start backend API (port 4319) |
| `npm run build` | Build TypeScript + Vite for production |
| `npm run start` | Build + serve (production) |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run test suite |
| `npm run format` | Format code with Prettier |
| `npm run lint` | Lint with ESLint |
| `npm run roadmap:generate` | Rebuild `ROADMAP.md` from `registry/roadmap.json` |
| `npm run roadmap:check` | Verify `ROADMAP.md` is in sync with the registry (CI/pre-commit) |

See [`ROADMAP.md`](./ROADMAP.md) for planned work. It is generated — edit
`registry/roadmap.json` and regenerate.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/me` | No | Current session status |
| `POST` | `/api/auth/register` | No | Create account |
| `POST` | `/api/auth/login` | No | Login |
| `POST` | `/api/auth/logout` | No | Logout |
| `GET` | `/api/conversations` | Yes | List the user's conversations |
| `POST` | `/api/conversations` | Yes | Create conversation |
| `GET` | `/api/conversations/:id` | Yes | Get conversation |
| `PUT` | `/api/conversations/:id` | Yes | Update conversation |
| `PATCH` | `/api/conversations/:id` | Yes | Lightweight update (feedback, pin, unread) |
| `DELETE` | `/api/conversations/:id` | Yes | Delete conversation |
| `POST` | `/api/conversations/:id/generate` | Yes | Start AI generation |
| `GET` | `/api/conversations/:id/stream` | Yes | SSE stream for generation progress |
| `GET` | `/api/conversations/:id/messages` | Yes | Message history |
| `POST` | `/api/conversations/:id/share` | Yes | Create share link |
| `POST` | `/api/conversations/:id/unshare` | Yes | Revoke share link |
| `GET` | `/api/share/:token` | No | Public read-only share view |
| `POST` | `/api/attachments` | Yes | Upload attachment (multipart) |
| `GET` | `/api/usage` | Yes | Monthly usage + plan limit |
| `GET` | `/api/subscriptions/active` | Yes | Active plan (expiry-aware) |
| `GET` | `/api/preferences/:key` | Yes | Get a user preference |
| `PUT` | `/api/preferences/:key` | Yes | Set a user preference |
| `GET` | `/api/midtrans/config` | Yes | Midtrans client config |
| `POST` | `/api/midtrans/transaction` | Yes | Create Snap transaction (`planSlug`; server-side price) |
| `POST` | `/api/midtrans/notification` | No | Midtrans payment webhook (activates subscription) |
| `GET` | `/api/account` | Yes | User account info |
| `PUT` | `/api/account/password` | Yes | Change password |
| `POST` | `/api/purge` | Yes | Delete all data (dev only) |

## User Flow

```
Landing page
  → Click "START NOW" / pricing CTA
  → Register page ("Buat akun dulu...")
  → Checkout (plan picker with landing page card design)
  → Midtrans Snap payment popup
  → Dashboard
    → Create brief (PRD, prototype, MOM, quotation)
    → AI generates output (Pi SDK / Groq)
    → Chat follow-ups
    → Download Markdown
```

## Deployment (Railway)

1. Set `DATABASE_URL` to Railway PostgreSQL connection string
2. Set `NODE_ENV=production`
3. Build command: `npm run build`
4. Start command: `npm run start`

## License

Private — Etalas Studio
