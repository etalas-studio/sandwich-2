import posthog from 'posthog-js'

/**
 * PostHog analytics — client-side only. Disabled unless NEXT_PUBLIC_POSTHOG_KEY is
 * set at build time (see root .env.example). Every call below is a safe no-op
 * in local dev / when analytics is not configured.
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST

let initialized = false

export function initPostHog(): void {
  if (initialized || !KEY) return
  posthog.init(KEY, {
    api_host: HOST || 'https://us.i.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') ph.debug()
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
