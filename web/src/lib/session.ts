// Auto-login with guest credentials so API session works
export async function ensureSession(): Promise<void> {
  try {
    const check = await fetch('/api/auth/me', { credentials: 'include' })
    const body = await check.json() as { state?: string }
    if (body.state === 'authenticated') return
    await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'sandwich', password: 'sandwich' }),
    })
  } catch { /* ignore */ }
}
