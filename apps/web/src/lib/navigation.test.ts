import { describe, it, expect } from 'vitest'
import { getActiveNav, NAV_ITEMS } from './navigation'

describe('getActiveNav', () => {
  it('returns overview for /overview', () => {
    expect(getActiveNav('/overview')).toBe('overview')
  })

  it('returns tickets for /tickets', () => {
    expect(getActiveNav('/tickets')).toBe('tickets')
  })

  it('returns tickets for /tickets/any-subpath', () => {
    expect(getActiveNav('/tickets/RCH-101')).toBe('tickets')
  })

  it('returns integrations for /integrations', () => {
    expect(getActiveNav('/integrations')).toBe('integrations')
  })

  it('returns settings for /settings', () => {
    expect(getActiveNav('/settings')).toBe('settings')
  })

  it('returns overview for unknown paths', () => {
    expect(getActiveNav('/something-else')).toBe('overview')
  })

  it('returns overview for root /', () => {
    expect(getActiveNav('/')).toBe('overview')
  })
})

describe('NAV_ITEMS', () => {
  it('has exactly the expected five entries', () => {
    expect(NAV_ITEMS).toHaveLength(5)
    expect(NAV_ITEMS.map((i) => i.id)).toEqual([
      'overview',
      'tickets',
      'integrations',
      'users',
      'settings',
    ])
  })
})
