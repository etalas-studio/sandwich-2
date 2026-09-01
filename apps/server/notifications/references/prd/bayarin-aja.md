# Product Requirements Document

Project Name: Bayarin Aja · Version: 1.0 · Last Updated: 9 January 2026 · Prepared by: Etalas Product Team

## 1. Overview

**Context:** C2C marketplace deals in Indonesia (secondhand goods, freelance gigs, small custom orders) mostly happen through direct bank transfer, with trust built entirely on chat history and seller reviews. There's no built-in protection for either side.

**Problem:**

- Buyers send full payment upfront with no guarantee the item ships, and scam reports on social media are common.
- Sellers who ship first sometimes never get paid, especially for high-value items.
- Existing escrow apps in the market charge fees close to 5-8%, which is too high for casual sellers doing a few transactions a month.
- None of the popular options handle disputes well; buyers and sellers are left to argue in a chat thread with no neutral party.

**Solution:** Build a peer-to-peer escrow platform where:

1. A buyer initiates a deal and funds are held by Bayarin Aja, not released to the seller.
2. The seller ships the item and marks it as sent.
3. The buyer confirms receipt, which releases the held funds to the seller.
4. If something goes wrong, either party can open a dispute and an admin reviews the evidence before deciding.

## 2. Goals and Success Metrics

| Goal | Metric |
|---|---|
| Give both sides confidence to transact with strangers | 90%+ of transactions complete without a dispute |
| Keep fees low enough for casual sellers | Platform fee capped at 2% per transaction |
| Resolve disputes fast enough to keep trust | Median dispute resolution time under 48 hours |
| Reach a usable volume in the first quarter | 1,000 completed transactions within 90 days of launch |

## 3. User Roles

1. Buyer
2. Seller
3. Admin (dispute resolution)

### 3.1 User Journey

**Buyer**

1. Create a deal by entering the item, price, and seller's username.
2. Fund the deal via bank transfer or e-wallet; the system confirms and marks funds as held.
3. Wait for the seller to mark the item as shipped, and receive a notification when that happens.
4. Confirm receipt once the item arrives, which releases the funds to the seller.
5. Leave a rating for the seller. (Review & Rating — optional.)

**Seller**

1. Accept an incoming deal request from a buyer.
2. Ship the item and mark the deal as shipped, optionally attaching a tracking number.
3. Get notified once the buyer confirms receipt and funds are released to their balance.
4. Withdraw the released balance to a linked bank account.

### 3.2 Admin Dashboard

- Verification Panel
- Transaction Ledger
- Dispute Center
- Analytics

## 4. Features & Tasks (Detailed by Flow)

**Flow A — Deal Creation & Funding**

- **Task: Create a deal**
  - **Context:** A buyer needs a structured way to propose a transaction instead of just sending money directly to the seller.
  - **Problem:** Without a formal deal record, there's no shared reference point if something goes wrong later.
  - **DoD:** Deal record includes item description, agreed price, and seller username; deal status starts as "pending funding."

- **Task: Fund the deal**
  - **Context:** The buyer needs to move money into escrow so the seller has confidence to ship.
  - **Problem:** If funds aren't verifiably held, the seller has no more assurance than a normal direct transfer.
  - **DoD:** Payment is confirmed via bank/e-wallet webhook; deal status updates to "funded" and both parties are notified.

**Flow B — Shipping & Confirmation**

- **Task: Mark as shipped**
  - **Context:** The seller needs to signal that their side of the deal is done.
  - **Problem:** Without this step, the buyer has no visibility into whether the item is on the way.
  - **DoD:** Deal status updates to "shipped"; optional tracking number field is saved and shown to the buyer.

- **Task: Confirm receipt**
  - **Context:** The buyer needs to trigger the fund release once they've verified the item.
  - **Problem:** Funds should never release automatically without buyer confirmation, or the escrow protection is meaningless.
  - **DoD:** Deal status updates to "completed"; held funds move to the seller's available balance within the same transaction.

**Exceptions**

**Buyer Doesn't Confirm Receipt?**
- If 7 days pass after "shipped" with no buyer action and no dispute opened, funds auto-release to the seller.
- Buyer receives a reminder notification on day 5.

**Seller Fails to Ship?**
- If 3 days pass after funding with no "shipped" update, the buyer can request a refund.
- Refund requires seller confirmation or escalates to admin review after 24 hours.

## 5. Buyer/Seller Dashboard (matrix fitur per role)

| Feature | Buyer | Seller |
|---|---|---|
| Create deal | ✓ | ✗ |
| Fund deal | ✓ | ✗ |
| Mark as shipped | ✗ | ✓ |
| Confirm receipt | ✓ | ✗ |
| Open dispute | ✓ | ✓ |
| Withdraw balance | ✗ | ✓ |

**Main Data Points:** deal status, held amount, counterparty username, shipping/tracking info, dispute status if any.

## 6. Admin Dashboard

| Feature | Description |
|---|---|
| Verification Panel | Review new seller identity documents before they can accept deals above a threshold |
| Transaction Ledger | Full record of every deal's fund movement, searchable by user or date |
| Dispute Center | Queue of open disputes with evidence submitted by both parties |
| Analytics | Volume, dispute rate, and average resolution time over time |

## 7. System Architecture Overview

| Component | Stack |
|---|---|
| Frontend | Next.js |
| Backend/API | Node.js (Express) |
| Database | PostgreSQL |
| Auth | Firebase Auth |
| File Storage | AWS S3 |
| Payment Gateway | Midtrans |
| Notifications | WhatsApp Business API |
| Hosting | AWS (ECS + RDS) |

## 8. Integration Touchpoints

| Integration | Purpose | Direction | Notes |
|---|---|---|---|
| Midtrans | Fund escrow and release payouts | Webhook | Handles both bank transfer and e-wallet funding |
| WhatsApp Business API | Deal status notifications | Outbound | Buyer and seller both opt in during onboarding |
| KTP verification service | Identity check for sellers | Outbound | Required before a seller can accept deals above Rp 2,000,000 |

## 9. Data Models (MVP Level)

**Deal**
id, buyer_id, seller_id, item_description, amount, status, tracking_number, created_at, completed_at

**User**
id, name, phone_number, role, verification_status, balance

**Dispute**
id, deal_id, opened_by, reason, evidence_urls, status, resolved_at

## 10. MVP Scope Clarification

| Feature | Included in MVP? |
|---|---|
| Deal creation and funding | ✓ |
| Ship and confirm-receipt flow | ✓ |
| Dispute center (manual admin review) | ✓ |
| Seller identity verification | ✓ |
| In-app chat between buyer and seller | ✗ |
| Multi-item cart / bulk deals | ✗ |
| Automated dispute resolution (AI-assisted) | ✗ |

## 11. Suggested Estimation Breakdown Format

| Task | Subtasks | Estimation (days) |
|---|---|---|
| Deal creation & funding | Deal model, payment webhook, status flow | x |
| Shipping & confirmation flow | Status transitions, notifications, auto-release job | x |
| Dispute center | Evidence upload, admin review UI, resolution flow | x |
| Admin dashboard | Verification panel, ledger, analytics | x |

## 12. Non-Functional Requirements

| Area | Details |
|---|---|
| Performance | Deal status updates reflect within 2 seconds of a webhook event |
| Security | All payment data handled via Midtrans; no card numbers stored on our servers |
| Reliability | 99.5% uptime target for the funding and release flows |
| Audit Logs | Every fund movement logged with actor, timestamp, and reason |
| Uptime | Monitored via a dedicated status page, alerts on any downtime over 5 minutes |

## 13. Proposal Narrative (for Business Team)

Bayarin Aja lets two strangers complete a deal online without either one taking on all the risk. The buyer's money sits safely with us until they confirm the item arrived as promised, and the seller only ships once that money is already secured. We keep the fee low enough that casual sellers doing a handful of deals a month can actually afford to use it, and when something does go wrong, a real admin steps in to look at the evidence and make a call, rather than leaving two strangers to argue it out over chat.

## 14. Branding Note

"Bayarin Aja" is colloquial Indonesian for "just go ahead and pay," which is meant to read as reassuring rather than transactional. It's easy to say out loud and matches the casual tone of the C2C marketplace audience it targets. Alternative names considered: "AmanBayar," "Escrowin," and "Titip Uang" — all were set aside for sounding either too formal or too close to existing fintech brand names.
