export interface PaymentInstruction {
  label: string
  value: string
}

/**
 * Extract human-readable payment instructions from a verified Midtrans
 * notification payload. Defensive: handles the common async method shapes
 * (VA, cstore, echannel, QRIS) without assuming a single field layout.
 */
export function extractInstructions(providerData: unknown): PaymentInstruction[] {
  const d = (providerData ?? {}) as Record<string, unknown>
  const out: PaymentInstruction[] = []

  const vaNumbers = d.va_numbers as Array<{ bank?: string; va_number?: string }> | undefined
  if (Array.isArray(vaNumbers)) {
    for (const v of vaNumbers) {
      if (v && typeof v.va_number === 'string' && v.va_number) {
        out.push({ label: v.bank ? `Virtual Account ${v.bank.toUpperCase()}` : 'Virtual Account', value: v.va_number })
      }
    }
  }
  if (typeof d.permata_va_number === 'string' && d.permata_va_number) {
    out.push({ label: 'Virtual Account Permata', value: d.permata_va_number })
  }
  if (typeof d.payment_code === 'string' && d.payment_code) {
    out.push({ label: 'Payment Code', value: d.payment_code })
  }
  if (typeof d.bill_key === 'string' && d.bill_key) {
    out.push({ label: 'Bill Key', value: d.bill_key })
  }
  if (typeof d.biller_code === 'string' && d.biller_code) {
    out.push({ label: 'Biller Code', value: d.biller_code })
  }
  if (typeof d.qr_string === 'string' && d.qr_string) {
    out.push({ label: 'QR Code', value: d.qr_string })
  }
  if (typeof d.expiry_time === 'string' && d.expiry_time) {
    out.push({ label: 'Expiry', value: d.expiry_time })
  }
  return out
}
