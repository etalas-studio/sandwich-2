# Deliverable Type Select (Base UI) Design

## Overview

Replace the native HTML `<select>` "Auto" deliverable selector (Auto / PRD / Quotation / Prototype / Specs) with a Base UI `Select` component. The version selector in `DocumentsPanel` stays native (out of scope).

## Scope

- Replace the deliverable selector in **two** places only:
  - `apps/web/src/components/LandingPage.tsx`
  - `apps/web/src/components/Dashboard.tsx`
- Keep `pendingType` state semantics unchanged: `""` means **Auto**, other values are `prd` / `quotation` / `prototype` / `specs`.
- Backend/API is untouched — the same string values are sent to the server.

## Frontend

### New file: `src/components/ui/select.tsx`

Shadcn-style wrapper around Base UI `@base-ui/react/select`, following the existing pattern in `button.tsx` / `dialog.tsx` / `dropdown-menu.tsx`.

Exports: `Select`, `SelectTrigger`, `SelectValue`, `SelectIcon`, `SelectContent`, `SelectItem`, `SelectItemIndicator`, `SelectItemText`.

Popup/list styling follows the app's dark theme (consistent with `dropdown-menu.tsx`).

### New file: `src/components/DeliverableTypeSelect.tsx`

- Constant `DELIVERABLE_TYPES` with five options:
  - `Auto` → `""`
  - `PRD` → `prd`
  - `Quotation` → `quotation`
  - `Prototype` → `prototype`
  - `Specs` → `specs`
- Controlled component: props `value: string`, `onChange: (v: string) => void`.
- Normalizes Base UI's `null` value to `""` so **Auto** remains the default/fallback.
- Trigger rendered as a pill with a chevron (matching the current look); dark popup list.

### Edits

- `LandingPage.tsx` — remove the native `<select>` block, render:
  ```tsx
  <DeliverableTypeSelect value={pendingType} onChange={setPendingType} />
  ```
- `Dashboard.tsx` — same replacement.

## Data Flow

`pendingType` state stays in the parent → passed as `value` prop → user picks an option → Base UI `onValueChange` → `onChange(v ?? "")` → `setPendingType`. The server keeps receiving the same values as before (`""` or a deliverable slug).

## Edge Cases

- Empty string (`""`) is the value for **Auto**. It is handled with an explicit label lookup (not the `items` prop) so it is never mistaken for "no value".
- `null` from Base UI (no selection) is normalized to `""`.

## Testing

- Add `DeliverableTypeSelect.test.tsx` (Vitest + Testing Library):
  - renders all five options
  - selecting an option emits the correct value via `onChange`
  - `null`/empty selection normalizes to `""`
- Existing tests do not touch this selector (only `LoginForm.test.tsx` exists among component tests).

## Out of Scope

- `DocumentsPanel.tsx` version selector (stays native).
- Searchable/type-ahead (`Combobox`) behavior.
- Backend/API changes.
