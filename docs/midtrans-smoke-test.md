# Midtrans Snap — Sandbox Smoke Test Runbook

Proof target: **sandbox provider proof** (Snap token → payment → verified webhook → subscription activated → idempotent replay).

## Prerequisites

- `.env` has a sandbox server key (`SB-Mid-...`) and `MIDTRANS_IS_PRODUCTION=false`.
- Migrations applied: `DATABASE_URL=... npx drizzle-kit migrate --config apps/server/drizzle.config.ts`.
- Backend running: `npm run serve` (port 4319). Frontend: `npm run dev:web` (port 3000).
- Midtrans sandbox dashboard access (for the notification URL + method activation).
- A tunnel for real dashboard-delivered notifications (step 2 only): `ngrok http 4319` or `cloudflared tunnel --url http://localhost:4319`.

## 1. End-to-end payment (UI)

1. Register/login → go to `/checkout` → pick Starter or Pro.
2. Snap popup opens (sandbox). Complete payment with a sandbox test method:
   - Card: `4811 1111 1111 1114`, any future expiry, CVV `123`, 3DS password `112233`.
   - Other methods: use credentials from Midtrans "Testing Payment on Sandbox" docs.
3. On success the frontend polls `/api/subscriptions/active`, then shows the success screen.
4. Verify DB:
   ```bash
   psql -d sandwich -c "SELECT order_id, local_status, transaction_status, plan_slug, gross_amount FROM payments ORDER BY created_at DESC LIMIT 3;"
   psql -d sandwich -c "SELECT id, user_id, plan_slug, status, period_days, expires_at, started_at FROM subscriptions ORDER BY id DESC LIMIT 3;"
   ```

## 2. Real webhook via tunnel

1. Start tunnel: `ngrok http 4319`.
2. Midtrans sandbox dashboard → Settings → **Payment Notification URL** =
   `https://<tunnel-host>/api/midtrans/notification` (public HTTPS, no redirect).
3. Complete another payment end-to-end.
4. Confirm the backend received the notification: `payments` row has `local_status = paid`
   and the matching `subscriptions` row is active with `expires_at = started_at + 30 days`.

## 3. Webhook replay — idempotency

1. Grab a paid order id:
   ```bash
   ORDER_ID=$(psql -d sandwich -Atc "SELECT order_id FROM payments WHERE local_status='paid' ORDER BY created_at DESC LIMIT 1;")
   echo "$ORDER_ID"
   ```
2. Replay a signed settlement notification:
   ```bash
   MIDTRANS_SERVER_KEY=SB-Mid-server-... \
     /Users/adib/.agents/skills/integrate-midtrans-payments/scripts/replay_snap_webhook.sh \
     --target-url http://localhost:4319/api/midtrans/notification \
     --order-id "$ORDER_ID" \
     --gross-amount "50000.00" \
     --transaction-status settlement \
     --fraud-status accept \
     --payment-type bank_transfer
   ```
3. Re-run the exact same command. **`expires_at` must NOT extend again** (the monotonic
   guard makes a duplicate `paid` notification a no-op). Confirm with:
   ```bash
   psql -d sandwich -c "SELECT id, expires_at FROM subscriptions ORDER BY id DESC LIMIT 1;"
   ```

## 4. Signature rejection

Send a notification with a tampered `signature_key` and confirm the handler answers `401`:
```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://localhost:4319/api/midtrans/notification \
  -H 'Content-Type: application/json' \
  -d '{"order_id":"'$ORDER_ID'","status_code":"200","gross_amount":"50000.00","transaction_status":"settlement","signature_key":"deadbeef"}'
```
Expected: `401`, and the DB row unchanged.

## 5. Status polling / reconciliation

Confirm the backend can recover state without a webhook:
```bash
MIDTRANS_AUTH=$(printf '%s:' "$MIDTRANS_SERVER_KEY" | base64)
curl -sS "https://api.sandbox.midtrans.com/v2/$ORDER_ID/status" -H "Authorization: Basic $MIDTRANS_AUTH"
```
A status lookup **before** the customer picks a method returns 404/not-found — treat that
as "not attempted yet", not a failure.

## 6. Evidence to capture (per skill)

```text
Sandbox result:
- Product/method: Snap (full page)
- Project route or command: POST /api/midtrans/transaction, POST /api/midtrans/notification
- Provider endpoint/base URL: app.sandbox.midtrans.com
- Provider reference: (order_id / transaction_id from dashboard)
- Local order/payment state before: creating_payment → awaiting_payment
- Local order/payment state after: paid
- Callback/status evidence: notification logged, payments.local_status = paid
- Idempotency evidence: replay did not extend expires_at twice
- Redaction checked: no server key / PII in logs
- Remaining dashboard/activation steps: (payment methods active, notification URL set)
```
