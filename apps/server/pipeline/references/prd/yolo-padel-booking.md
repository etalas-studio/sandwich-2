# Product Requirements Document (PRD)

Project Name: YOLO Padel Booking · Prepared For: YOLO Padel · Prepared By: Etalas · Version: 1.0 · Date: 20 April 2026

## 1. Overview

YOLO Padel runs 4 padel venues across Jakarta and Tangerang, with a total of 14 courts and a pro shop at each location. Right now customers book by calling or WhatsApping the front desk, which caps how many bookings a venue can handle during peak evening hours. The new platform lets a customer pick a location, pick an available time slot, enter their contact details, choose a payment method, pay, and receive a confirmation, all without a phone call.

The rollout happens in two phases. Phase 1 integrates with Playtomic, the third-party platform YOLO Padel already uses for court exposure and availability management, so bookings made on the new site sync into the same system staff already monitor. Phase 2 migrates court and booking data fully in-house, which unlocks a loyalty program, membership tiers, and custom pricing rules that Playtomic's API doesn't currently support.

## 2. Business Requirements

| Requirement | Details |
|---|---|
| Multi-location support | Customers can browse and book courts across all 4 venues from one site |
| Phase 1 third-party integration | Availability and booking sync with Playtomic in real time |
| Custom payment UI | Payment happens in an in-page modal, no redirect to an external checkout page |
| Phase 2 data ownership plan | Court, booking, and customer data migrate to YOLO Padel's own database once loyalty features are needed |
| Fraud / double-booking prevention | A slot is locked the moment a customer selects it, before payment starts |
| Revenue channels | Court bookings plus pro-shop equipment rental add-ons at checkout |
| Customer retention strategy | Automated WhatsApp reminders and a post-Phase-2 loyalty program |

## 3. Functionality Requirements

### 3.1 End-User Website

1. **Site & Court Selection**
   - Show all 4 venues with a map view and distance from the customer's location.
   - Display real-time court availability pulled from the Playtomic API.
2. **Booking Flow**
   - Customer picks a date, time slot, and court type (indoor/outdoor).
   - Slot locks for 5 minutes once selected, so no other customer can book it during checkout.
3. **User Information Capture**
   - Name and phone number are mandatory; email is optional.
   - Returning customers can skip this step if they're logged in.
4. **Payment Process**
   - Supports QRIS, bank transfer, and major e-wallets, all inside the in-page modal.
   - No redirect to an external payment page at any point.
5. **Confirmation & Notifications**
   - Confirmation sent via WhatsApp and email, including venue address, court number, and time.
   - A reminder is sent 2 hours before the booking.

### 3.2 Admin Dashboard

1. **Slot Management**
   - View and manually block slots for maintenance or private events.
2. **Booking Management**
   - See all bookings per venue per day, with the ability to cancel or reschedule on a customer's behalf.
3. **Payment Management**
   - View payment status per booking and issue refunds for cancellations.
4. **User Management**
   - Search customer booking history by phone number.
5. **API Integration Controls**
   - Manually trigger a re-sync with Playtomic if availability looks out of date.

## 4. User Experience (UX) Requirements

| Area | UX Goals |
|---|---|
| Website | Mobile-first, loads in under 2 seconds on a 4G connection |
| Booking Flow | Max 4 steps from landing on the site to a confirmed slot selection |
| Payment | In-page modal only, to reduce drop-off from redirects |
| Notifications | Sent within seconds of a confirmed payment |
| Admin Dashboard | Simple enough for front-desk staff with no technical background to use without training |

## 5. Scope

**In Scope (Phase 1)**

- Customer-facing booking website across all 4 venues.
- Real-time availability integration with Playtomic.
- Payment gateway integration with a custom in-page UI.
- Admin dashboard for slot, booking, and payment management.
- Automated WhatsApp and email confirmations.

**Out of Scope (Phase 1)**

- YOLO Padel's own booking engine (still relies on Playtomic in phase 1).
- Loyalty program, membership tiers, and VIP pricing.
- Multi-language support (Bahasa Indonesia only for phase 1).
- In-app upselling (equipment rental, coaching sessions).

## 6. Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Playtomic API returns stale availability, causing double-bookings | High | Real-time API sync plus an immediate slot lock the moment a customer selects a time |
| Payment confirms on the gateway side but doesn't update the booking status | Medium | Payment status check with automatic retry, and a manual confirmation fallback in the admin dashboard |
| Playtomic API goes down during peak booking hours | High | Graceful error handling with a backup manual booking form staff can use to take bookings by phone |

## 7. Success Metrics

- 90%+ of bookings complete without any manual staff intervention.
- 99.5% uptime for the booking and payment flow during venue operating hours.
- Double-booking incidents stay under 0.5% of total bookings per month.
- Conversion rate from "started a booking" to "paid" stays above 60%.
