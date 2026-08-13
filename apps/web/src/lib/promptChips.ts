import type { ConversationType } from './conversations'
import type { StringKey } from './i18n'

export const CHIPS: { labelKey: StringKey; type: ConversationType; icon: string }[] = [
  { labelKey: 'chip_prd',       type: 'prd'       as ConversationType, icon: 'solar:document-add-linear' },
  { labelKey: 'chip_prototype', type: 'prototype' as ConversationType, icon: 'solar:widget-linear' },
  { labelKey: 'chip_quotation', type: 'quotation' as ConversationType, icon: 'solar:dollar-minimalistic-linear' },
]
