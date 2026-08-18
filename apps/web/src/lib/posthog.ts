import posthog from 'posthog-js'

/**
 * PostHog analytics — client-side only. Disabled unless VITE_POSTHOG_KEY is
 * set at build time (see root .env.example). Every call below is a safe no-op
 * in local dev / when analytics is not configured.
 */

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined

let initialized = false

export function initPostHog(): void {
  if (initialized || !KEY) return
  posthog.init(KEY, {
    api_host: HOST || 'https://us.i.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.debug()
    },
  })
  initialized = true
}

export function trackPostHog(event: string, properties?: Record<string, unknown>): void {
  if (!initialized) return
  posthog.capture(event, properties)
}

export function identifyPostHog(id: string, properties?: Record<string, unknown>): void {
  if (!initialized) return
  posthog.identify(id, properties)
}
