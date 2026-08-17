import { apiUrl } from './base'

export interface PaymentDetails {
  orderId: string
  localStatus: string
  transactionStatus: string
  grossAmount: string
  paymentType: string | null
  fraudStatus: string | null
  providerData: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface VerifyResult {
  orderId: string
  localStatus: string
  transactionStatus: string
  active: boolean
}

export async function verifyPayment(orderId: string): Promise<VerifyResult> {
  const res = await fetch(apiUrl('/api/midtrans/verify'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderId }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<VerifyResult>
}

export async function getPayment(orderId: string): Promise<PaymentDetails> {
  const res = await fetch(apiUrl(`/api/payments/${encodeURIComponent(orderId)}`), {
    credentials: 'include',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<PaymentDetails>
}
