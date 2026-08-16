# Deliverable Type Select (Base UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native `<select>` "Auto" deliverable selector with a Base UI `Select` component in LandingPage and Dashboard.

**Architecture:** Add a shadcn-style wrapper (`ui/select.tsx`) around `@base-ui/react/select`, then a small controlled `DeliverableTypeSelect` component holding the five deliverable options. LandingPage and Dashboard render `DeliverableTypeSelect` instead of the native `<select>`. State (`pendingType`) and server payloads are unchanged.

**Tech Stack:** React 19, TypeScript, Base UI (`@base-ui/react` v1.6.0), lucide-react, Vitest + Testing Library.

## Global Constraints

- Only the **"Auto" deliverable selector** is replaced. The `DocumentsPanel.tsx` version selector stays native.
- Backend/API is untouched — the same string values are sent (`""` = Auto, then `prd` / `quotation` / `prototype` / `specs`).
- `pendingType` state and its semantics stay identical.
- No `Combobox` / type-ahead.
- All paths are relative to the repo root unless noted.

---

### Task 1: Base UI Select wrapper

**Files:**
- Create: `apps/web/src/components/ui/select.tsx`

**Interfaces:**
- Consumes: `@base-ui/react/select`, `@/lib/utils` (`cn`), `lucide-react` (`CheckIcon`).
- Produces (named exports): `Select`, `SelectTrigger`, `SelectValue`, `SelectIcon`, `SelectContent`, `SelectItem`, `SelectItemIndicator`, `SelectItemText`.

- [ ] **Step 1: Create `apps/web/src/components/ui/select.tsx`**

```tsx
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

function Select<Value>(props: SelectPrimitive.Root.Props<Value>) {
  return <SelectPrimitive.Root {...props} />
}

function SelectTrigger({
  className,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "inline-flex items-center gap-1 outline-none cursor-pointer",
        className
      )}
      {...props}
    />
  )
}

function SelectValue({ ...props }: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectIcon({ className, ...props }: SelectPrimitive.Icon.Props) {
  return (
    <SelectPrimitive.Icon
      data-slot="select-icon"
      className={cn("transition-transform data-open:rotate-180", className)}
      {...props}
    />
  )
}

function SelectContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "z-50 max-h-[var(--available-height)] min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-y-auto rounded-lg bg-[#111113] p-1 text-white shadow-md ring-1 ring-white/10 outline-none",
            className
          )}
          {...props}
        />
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default select-none items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-xs outline-none data-highlighted:bg-white/10 data-selected:font-medium",
        className
      )}
      {...props}
    >
      <SelectItemText>{children}</SelectItemText>
      <SelectItemIndicator className="absolute right-2 flex items-center justify-center">
        <CheckIcon className="size-3.5" />
      </SelectItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectItemIndicator({
  className,
  ...props
}: SelectPrimitive.ItemIndicator.Props) {
  return (
    <SelectPrimitive.ItemIndicator
      data-slot="select-item-indicator"
      className={cn("", className)}
      {...props}
    />
  )
}

function SelectItemText({ ...props }: SelectPrimitive.ItemText.Props) {
  return <SelectPrimitive.ItemText data-slot="select-item-text" {...props} />
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: exit code `0` (no output).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/select.tsx
git commit -m "feat: add Base UI select wrapper"
```

---

### Task 2: DeliverableTypeSelect component (TDD)

**Files:**
- Create: `apps/web/src/components/DeliverableTypeSelect.tsx`
- Test: `apps/web/src/components/DeliverableTypeSelect.test.tsx`

**Interfaces:**
- Consumes: `Select`, `SelectTrigger`, `SelectValue`, `SelectIcon`, `SelectContent`, `SelectItem` from `./ui/select`; `ChevronDownIcon` from `lucide-react`.
- Produces: `DeliverableTypeSelect` — props `{ value: string; onChange: (v: string) => void }`, named export from `apps/web/src/components/DeliverableTypeSelect.tsx`.

- [ ] **Step 1: Write the failing test** — create `apps/web/src/components/DeliverableTypeSelect.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeliverableTypeSelect } from './DeliverableTypeSelect'

describe('DeliverableTypeSelect', () => {
  it('renders the Auto label for empty value', () => {
    render(<DeliverableTypeSelect value="" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Auto')
  })

  it('renders the label for a selected deliverable', () => {
    render(<DeliverableTypeSelect value="prd" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('PRD')
  })

  it('emits the chosen value when an option is selected', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<DeliverableTypeSelect value="" onChange={onChange} />)

    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: 'PRD' }))

    expect(onChange).toHaveBeenCalledWith('prd')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/DeliverableTypeSelect.test.tsx`
Expected: FAIL — `Cannot find module './DeliverableTypeSelect'`.

- [ ] **Step 3: Implement `apps/web/src/components/DeliverableTypeSelect.tsx`**

```tsx
import { ChevronDownIcon } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

const DELIVERABLE_TYPES = [
  { value: '', label: 'Auto' },
  { value: 'prd', label: 'PRD' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'prototype', label: 'Prototype' },
  { value: 'specs', label: 'Specs' },
] as const

const LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  DELIVERABLE_TYPES.map((t) => [t.value, t.label]),
)

export function DeliverableTypeSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
      <SelectTrigger className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-white border border-white/15">
        <SelectValue>{(v) => LABEL_BY_VALUE[v as string] ?? 'Auto'}</SelectValue>
        <SelectIcon>
          <ChevronDownIcon className="size-3" />
        </SelectIcon>
      </SelectTrigger>
      <SelectContent>
        {DELIVERABLE_TYPES.map((t) => (
          <SelectItem key={t.value || 'auto'} value={t.value}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/DeliverableTypeSelect.test.tsx`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/DeliverableTypeSelect.tsx apps/web/src/components/DeliverableTypeSelect.test.tsx
git commit -m "feat: add DeliverableTypeSelect component"
```

---

### Task 3: Integrate into LandingPage and Dashboard

**Files:**
- Modify: `apps/web/src/components/LandingPage.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `DeliverableTypeSelect` (named export from `./DeliverableTypeSelect`).

- [ ] **Step 1: Edit `apps/web/src/components/LandingPage.tsx`**

Add the import right after the existing `PLANS_META` import:

```tsx
import { PLANS_META } from '../lib/plans'
import { DeliverableTypeSelect } from './DeliverableTypeSelect'
```

Replace the deliverable selector block (exact old text below) with the new single component:

Old:
```tsx
                {/* deliverable selector */}
                <div className="flex items-center gap-2 px-5 pt-5 pb-2">
                  <select
                    value={pendingType}
                    onChange={(e) => setPendingType(e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    <option value="">Auto</option>
                    <option value="prd">PRD</option>
                    <option value="quotation">Quotation</option>
                    <option value="prototype">Prototype</option>
                    <option value="specs">Specs</option>
                  </select>
                </div>
```

New:
```tsx
                {/* deliverable selector */}
                <div className="flex items-center gap-2 px-5 pt-5 pb-2">
                  <DeliverableTypeSelect value={pendingType} onChange={setPendingType} />
                </div>
```

- [ ] **Step 2: Edit `apps/web/src/components/Dashboard.tsx`**

Add the import right after the existing `DocumentsPanel` import:

```tsx
import DocumentsPanel from './DocumentsPanel'
import { DeliverableTypeSelect } from './DeliverableTypeSelect'
```

Replace the deliverable selector block (exact old text below) with the new single component:

Old:
```tsx
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <select
          value={pendingType}
          onChange={(e) => setPendingType(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <option value="">Auto</option>
          <option value="prd">PRD</option>
          <option value="quotation">Quotation</option>
          <option value="prototype">Prototype</option>
          <option value="specs">Specs</option>
        </select>
```

New:
```tsx
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <DeliverableTypeSelect value={pendingType} onChange={setPendingType} />
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: exit code `0`.

- [ ] **Step 4: Run the component test**

Run: `cd apps/web && npx vitest run src/components/DeliverableTypeSelect.test.tsx`
Expected: PASS — 3 tests passed.

> Note: `src/components/LoginForm.test.tsx` has 6 pre-existing failures (missing `LanguageProvider` wrapper). They are unrelated to this work and can be ignored.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/LandingPage.tsx apps/web/src/components/Dashboard.tsx
git commit -m "feat: use DeliverableTypeSelect in LandingPage and Dashboard"
```

---

### Manual verification (optional)

Start the dev servers and open `http://localhost:3000`:

```bash
npm run serve        # backend :4319
npm run dev:web      # frontend :3000
```

Confirm: the "Auto" pill opens a dark dropdown listing Auto / PRD / Quotation / Prototype / Specs; selecting one updates the pill text; submitting a brief still sends the same deliverable value as before.
