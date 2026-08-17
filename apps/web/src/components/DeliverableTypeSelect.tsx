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
