import type { TicketType } from './localTickets'
import type { StringKey } from './i18n'

export const CHIPS: { labelKey: StringKey; type: TicketType; icon: string }[] = [
  { labelKey: 'chip_prd',       type: 'prd'       as TicketType, icon: 'solar:document-add-linear' },
  { labelKey: 'chip_prototype', type: 'prototype' as TicketType, icon: 'solar:widget-linear' },
  { labelKey: 'chip_quotation', type: 'quotation' as TicketType, icon: 'solar:dollar-minimalistic-linear' },
]
