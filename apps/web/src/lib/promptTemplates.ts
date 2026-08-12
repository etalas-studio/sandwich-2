export type PromptChipType = 'prd' | 'prototype' | 'quotation' | 'mom' | 'specs'

const TEMPLATES: Record<PromptChipType, string[]> = {
  prd: [
    'Bikinin PRD lengkap untuk project ini',
    'Tolong buatin PRD detail buat project ini',
    'Gue butuh PRD lengkap buat project ini',
    'Buatin dokumen PRD yang rapi untuk project ini',
  ],
  prototype: [
    'Bikinin prototype untuk project ini',
    'Tolong buatin prototype brief buat project ini',
    'Gue butuh prototype flow untuk project ini',
    'Buatin rancangan prototype untuk project ini',
  ],
  quotation: [
    'Bikinin quotation untuk project ini',
    'Tolong buatin quotation biaya buat project ini',
    'Gue butuh quotation estimasi buat project ini',
    'Buatin rincian quotation untuk project ini',
  ],
  mom: [
    'Bikinin notulen rapat dari transcript ini',
    'Tolong buatin MOM dari meeting ini',
    'Gue butuh ringkasan notulen dari rapat ini',
  ],
  specs: [
    'Bikinin specs dan task breakdown untuk fitur ini',
    'Tolong breakdown specs & task buat fitur ini',
    'Gue butuh technical specs untuk fitur ini',
  ],
}

export function randomPrompt(type: PromptChipType): string {
  const pool = TEMPLATES[type]
  return pool[Math.floor(Math.random() * pool.length)]
}
