# Reservo — Product Requirements Document

Updated: 2 February 2026

## 1. Problem & Objective Clarification

**Problem.** The restaurant group currently runs its table reservations through a third-party vendor at $1,400 per outlet per month across 12 outlets, which adds up to roughly $16,800 a month. Beyond the cost, every menu or floor-plan change has to go through the vendor's support queue, and the group's own POS and CRM data live in a separate system that the vendor doesn't expose. Front-of-house staff say the vendor's tablet app is slow during peak hours, and the group has no way to customize the guest-facing booking page to match their brand.

**Objective.** Build an in-house, API-first reservation platform, fully integrated with the group's existing POS and CRM, to:

1. Cut monthly reservation-tooling cost by at least 70% within the first year.
2. Reduce average table-turn confirmation time from 45 seconds to under 15 seconds.
3. Give the group full ownership of guest data, synced directly into the CRM instead of exported manually.
4. Let outlet managers customize floor plans and booking rules without vendor support tickets.

**Scope Boundaries.** This platform covers reservations, waitlist, and table management for all 12 outlets, serving front-of-house staff (about 60% of daily usage) and guests booking online (the remaining 40%). Payment processing and inventory management are explicitly out of scope for this phase; the group will keep using its existing POS for both. The guest-facing booking widget is the primary focus of phase one — the internal floor-plan editor is used as-is from the existing system's export format until phase two.

**Success Metrics.**

- Reservation-tooling spend drops by 70%+ within 12 months of full rollout, verified against finance's monthly vendor invoice.
- Table-turn confirmation time under 15 seconds, measured via the same POS event log used today.
- Guest no-show rate stays flat or improves, measured over a 90-day post-launch window against the prior 90 days.

## 2. User Personas & Journeys

**Host / Front-of-house staff.** Works a floor tablet during a loud, fast-paced dinner service, often juggling three or four things at once.

- Main task: seat walk-ins and confirmed reservations, manage the waitlist.
- Key journey steps: ① check waitlist ② assign table ③ confirm seating ④ update table status.
- Pain point: the current vendor app takes several seconds to refresh the floor view, which is long enough to seat a guest at an already-occupied table.
- Edge cases: a party of 12 with no matching table combination, a walk-in arriving when the floor shows fully booked, and continuing to seat guests when the internet connection drops.

**Guest.** Books a table from their phone, usually while deciding where to eat that night.

- Main task: find an available slot and confirm a reservation.
- Key journey steps: ① pick outlet ② pick time and party size ③ confirm booking ④ receive reminder.
- Pain point: the current booking page redirects to a generic vendor domain that doesn't feel like the restaurant's own site.
- Edge cases: booking for a party size larger than any single table, and canceling or rebooking within two hours of the reservation time.

**User Stories (Examples)**

- As a host, I want the floor view to update within a second of a status change, so I never double-seat a table.
- As a guest, I want to book directly from the restaurant's own website, so the experience feels consistent with the brand.
- As an outlet manager, I want to adjust table combinations myself, so I don't have to file a support ticket for a floor-plan change.

We still need to validate the group-booking flow (parties larger than 10) with front-of-house staff through a short workshop before finalizing its design.

## 3. Feature Enhancements

| Epic | Enhancement | Priority | Notes |
|---|---|---|---|
| Reservations | Real-time table assignment | P0 | Parity requirement for migration |
| Reservations | Guest-facing branded booking widget | P0 | Replaces vendor's generic page |
| Waitlist | SMS wait-time updates | P1 | Adds value over current vendor |
| Floor Management | Self-service floor-plan editor | P1 | Removes support-ticket dependency |
| CRM | Guest profile sync (visit history, preferences) | P0 | Required for CRM integration goal |
| Reporting | Outlet-level occupancy dashboard | P2 | Nice-to-have, can follow in phase two |

**Detailed view**

| Epic | Enhancement | Priority | Rationale | Acceptance Criteria | Dependencies |
|---|---|---|---|---|---|
| Reservations | Real-time table assignment | P0 | Staff cannot seat guests reliably without live floor state | Floor status updates propagate to all connected tablets within 1 second | POS event stream |
| Reservations | Guest-facing branded booking widget | P0 | Removes reliance on vendor domain and improves brand consistency | Widget embeds on the group's own site and completes a booking end-to-end | Outlet availability API |
| CRM | Guest profile sync | P0 | Group currently has no direct access to guest reservation history | Every completed reservation writes a guest record to the CRM within 5 minutes | CRM write API |

## 4. Technical Considerations

**Architecture.** REST API backend with a WebSocket channel for real-time floor updates to tablets.

**Performance.** Target response time under 300ms for table-assignment actions; support at least 200 concurrent tablet sessions across all outlets during peak hours.

**Availability.** 99.9% uptime target; deployed across two regions so a single-region outage doesn't take down reservations group-wide.

**Usability & Accessibility.** Interface in English and Bahasa Indonesia; tablet app optimized for 10-inch touchscreens used at host stands.

**Integrations.** Two-way sync with the existing POS (table status, order linkage) and one-way write to the CRM (guest profile and visit history).

**Security & Compliance.** TLS 1.3 for all traffic; follows OWASP Top-10 guidance for the guest-facing booking widget; guest PII stored per the group's existing data-retention policy.

**Scalability.** Designed to handle a 3x increase in outlet count without a backend redesign.

**Logging & Monitoring.** Every reservation and table-status change is logged with outlet ID and timestamp for support and analytics.

**Migration Strategy.** Dual-write with the current vendor for two weeks, pilot the new system at two outlets for four weeks, then cut over the remaining ten outlets over two weeks.

**Open Technical Items.** Final decision on whether the floor-plan editor supports drag-and-drop table merging in phase one or phase two — decide by week 3.

**Assumptions.** POS vendor provides a stable webhook for order-to-table linkage; outlet managers are available for floor-plan data migration during the pilot phase.

**Risks & Mitigations**

| Risk | Mitigation |
|---|---|
| POS integration delays block the pilot | Start POS API integration work in parallel with UI development, not after |
| Staff resist a new tablet app mid-migration | Run the pilot at the two lowest-traffic outlets first and gather feedback before wider rollout |

## Appendices

- **Glossary:** "Table combination" refers to merging adjacent tables to seat larger parties; "cut-over" refers to the final switch from the vendor system to the in-house platform.
- **References:** OWASP Top-10, WCAG 2.1 AA checklist for the guest-facing widget.
- **Visual notes:** Floor-plan wireframes and the current 12-outlet architecture diagram are not yet attached — final versions to be added before development kickoff.
