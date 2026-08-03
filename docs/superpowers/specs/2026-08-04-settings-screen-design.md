# Settings Screen Design

Written 4 August 2026. UI-only implementation — no backend API changes.

## Scope

A single Settings screen with three stacked sections: Blocklist, Credentials, and Account. This is a frontend-only task using the existing design system and mock data where backend endpoints don't exist yet.

## Layout

### Navigation

- "Settings" nav item in the Sidebar navigates to `/settings` route
- Uses the same ambient background and card wrapper pattern as the main overview page

### Page Structure

```
┌─────────────────────────────────────────────────┐
│ Header: "Settings"                              │
│ Subtitle: date + optional context               │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ Blocklist                              [+ Add]│ │
│ │ ─────────────────────────────────────────── │ │
│ │ db/migrate/*    Never run migrations   [Agent]│ │
│ │ auth/**         Auth logic is critical [Human]│ │
│ │ ...                                          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Credentials                            [+ Add]│ │
│ │ ─────────────────────────────────────────── │ │
│ │ DATABASE_URL    Added 2 days ago        [Update]│
│ │ API_KEY          Not yet provided       [Add] │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Account                                      │ │
│ │ ─────────────────────────────────────────── │ │
│ │ Username    jane_doe                         │ │
│ │ Email       jane@example.com                 │ │
│ │ Password    ••••••••••           [Change]    │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

Each section is a card (`ds-card-outer` / `ds-card-inner`) with consistent padding and spacing.

## Section 1: Blocklist

### Header

- Title: "Blocklist"
- Count badge: shows number of entries (e.g., "5 entries")
- "Add entry" button (primary style)

### Content

List of blocklist entries. Each row shows:

| Element | Style | Notes |
|---------|-------|-------|
| Pattern | Monospace, `text-white/80` | e.g., `db/migrate/*` |
| Reason | Regular text, `text-white/50 font-light` | Secondary, shorter |
| Source badge | Badge component | `Agent` (warning color) or `Human` (default muted) |
| Delete button | Ghost icon button, visible on row hover | Red on hover |

### Add Entry

- Opens a modal dialog
- Form fields:
  - Pattern (text input, required)
  - Reason (text input, required)
- Source is always `Human` for manually added entries
- Save/Cancel buttons

### Delete Entry

- Confirmation: inline or modal? (Suggest: inline removal with undo toast, or simple confirm dialog)
- For simplicity in UI-only phase: immediate removal, no confirm

## Section 2: Credentials

### Header

- Title: "Credentials"
- Count badge: shows number of credentials
- "Add credential" button (primary style)

### Content

List of credential names. Each row shows:

| Element | Style | Notes |
|---------|-------|-------|
| Name | Monospace, `text-white/80` | e.g., `DATABASE_URL` |
| Timestamp | `text-white/40 text-xs` | "Added 2 days ago" or "Updated 5 minutes ago" |
| Action button | Secondary button | "Update" if exists, "Add" if not yet provided |

### Add/Update Credential

- Opens a modal dialog
- Form fields:
  - Name (text input, required, monospace)
  - Value (password input, masked, required)
- Value is NEVER displayed after saving — only the name and timestamp
- Save/Cancel buttons

### Security Note

No "reveal" functionality. Values are secrets. The UI only proves that a value exists (timestamp) without ever showing it.

## Section 3: Account

### Header

- Title: "Account"
- No action button

### Content

Two-column layout (label : value):

| Field | Display | Editable? |
|-------|---------|-----------|
| Username | Plain text | No (single account, Phase 1) |
| Email | Plain text | No (Phase 1 scope) |
| Password | Masked placeholder `••••••••` | "Change password" button |

### Change Password

- Opens a modal dialog
- Form fields:
  - Current password (password input, required)
  - New password (password input, required)
  - Confirm password (password input, must match new)
- Save/Cancel buttons
- Validation: new password must differ from current, confirm must match

## Data Sources (UI-Only Phase)

### Mock Data

Until backend endpoints exist, use mock data in the component:

```typescript
// Mock blocklist
const mockBlocklist = [
  { id: '1', pattern: 'db/migrate/*', reason: 'Never run migrations autonomously', source: 'agent' },
  { id: '2', pattern: 'auth/**', reason: 'Authentication logic is security-critical', source: 'human' },
  { id: '3', pattern: '.env', reason: 'Environment files may contain secrets', source: 'agent' },
]

// Mock credentials (names only, no values)
const mockCredentials = [
  { name: 'DATABASE_URL', updatedAt: '2026-08-02T10:30:00Z' },
  { name: 'OPENAI_API_KEY', updatedAt: '2026-08-01T14:20:00Z' },
]

// Mock account
const mockAccount = {
  username: 'jane_doe',
  email: 'jane@example.com',
}
```

### Future API Integration

The component should accept props or fetch from an API hook that can be swapped later:

- `GET /api/blocklist` → list entries
- `POST /api/blocklist` → add entry
- `DELETE /api/blocklist/:id` → remove entry
- `GET /api/credentials` → list names (never values)
- `POST /api/credentials` → upsert credential
- `GET /api/account` → get username/email
- `POST /api/account/password` → change password

These endpoints do NOT exist yet — the UI uses mock data for now.

## Components

### New Files

| File | Purpose |
|------|---------|
| `web/src/components/Settings.tsx` | Main settings page component (no `pages/` directory exists) |
| `web/src/components/BlocklistSection.tsx` | Blocklist card with add/delete |
| `web/src/components/CredentialsSection.tsx` | Credentials card with add/update |
| `web/src/components/AccountSection.tsx` | Account card with password change |
| `web/src/components/Modal.tsx` | Reusable modal dialog (new component) |

### Modified Files

| File | Change |
|------|--------|
| `web/src/App.tsx` | Add route state for Settings page |
| `web/src/components/Sidebar.tsx` | Connect Settings nav item to navigate |

### Shared Patterns

- Use existing `ds-card-outer` / `ds-card-inner` wrapper pattern
- Use design system colors, typography, and spacing
- Match the modal pattern from `TicketDetail.tsx` (backdrop + panel)

## Out of Scope

- Backend API implementation
- Real data persistence
- Username/email editing
- VCS configuration (not built yet)
- Engine configuration (file-based, would need API first)
- Lane rules, limits configuration (file-based)
