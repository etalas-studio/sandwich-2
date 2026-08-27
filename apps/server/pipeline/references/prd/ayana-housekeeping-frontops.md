# Serenity Ops Platform — PRD

Prepared by: Etalas · Date: 11 May 2026 · Version: Draft v0.1

## 1. Executive Summary

Luxury hospitality lives or dies on operational consistency. A guest who reports a broken air conditioner expects it fixed within the hour, not after three phone calls and a shift handover that loses the request. For a five-star property, every delay in housekeeping or front-office coordination is a direct hit to the brand experience guests are paying a premium for.

The property currently uses a legacy PMS module for room status and a WhatsApp group for everything else: complaint handoffs, task assignments, maintenance requests, and shift handovers. The PMS module works fine as a data-entry tool for check-in/check-out and housekeeping status, but it was never built as a command center. Anything that needs cross-department coordination happens verbally or over WhatsApp, which means requests get lost, status updates lag behind reality, and there's no record of who was responsible for what.

What the property needs is a single operations platform that gives every department the same real-time picture, replaces verbal handoffs with a system record, and lets management see response times instead of guessing at them.

## 2. Strategic Context

### 2.1 Luxury Hospitality Trend

- **Real-time personalization.** Guests increasingly expect staff to know their preferences without being asked twice, which requires that preference data be visible to whoever is handling their request, not locked in one department's notebook.
- **Mobile-first operations.** Housekeeping and engineering staff work the floor, not a desk, so any operations tool has to work well on a phone, not just a back-office terminal.
- **SLA-driven workflow.** Leading properties are moving away from "best effort" response times toward explicit, tracked service-level targets per request type.
- **Data-driven decision making.** GMs increasingly expect a dashboard, not a end-of-month report, to know where operational bottlenecks are happening.

### 2.2 Serenity Resort's Competitive Imperative

- Guest expectations at this price point have risen faster than the property's internal tooling has kept up.
- The resort has grown from 80 to 140 rooms over three years, and the WhatsApp-based coordination model that worked at 80 rooms is now visibly breaking down.
- Labor costs make double-entry (writing something on paper, then re-entering it into the PMS) an expense the property can no longer justify.

## 3. As-Is Process Overview

**Guest complaint handling (today)**

1. Guest calls the front desk or tells a staff member directly.
2. Front desk staff writes the complaint on a paper log and calls the relevant department (housekeeping, engineering) by phone or radio.
3. The department handles it and reports back verbally, usually to whoever answers the phone next, not necessarily the person who logged it.
4. Front desk manually updates the guest, if they remember to follow up.

**Pain points:** requests get lost between shifts, there's no timestamp on when a complaint was actually resolved, and front desk has no way to see a complaint's status without calling the department directly.

**Daily housekeeping operations (today)**

1. Housekeeping supervisor prints a room list each morning from the PMS.
2. Rooms are assigned to staff verbally at the morning briefing.
3. Staff mark rooms as clean by telling the supervisor, who updates the PMS at the end of a round, not in real time.

**Pain points:** front desk sees stale room status for hours at a time, which delays check-ins, and there's no visibility into which staff member actually cleaned a given room if something is later found wrong.

## 4. Target Personas

| Persona | Key Goals | Pain Points | Device/Environment |
|---|---|---|---|
| Housekeeping Staff | Get room assignments quickly, mark rooms done without paperwork | Manual reporting to supervisor delays status updates | Mobile phone, hallway/room, spotty WiFi |
| Front Desk Agent | See real-time room and complaint status | Has to call departments directly for any status update | Desktop at the front counter |
| Engineering/Maintenance | Get maintenance requests with enough detail to act immediately | Requests arrive secondhand via front desk, missing details | Mobile phone, on the move around the property |
| Housekeeping Supervisor | Assign and track tasks across a shift | No visibility into progress until staff report back in person | Tablet, walking the floor |
| GM / Ops Director | See response-time and SLA performance across departments | No dashboard; performance visibility only comes from anecdotes and complaints | Desktop/laptop, office |

## 5. Detailed Problem Statement

- **Operational inefficiency.** Requests routed by phone or verbally require someone to be available to answer, and get re-explained multiple times before reaching the right person.
- **Training complexity.** New staff have to learn an informal, undocumented process that varies by shift and by who happens to be on duty.
- **Delayed resolution.** Without a shared queue, urgent requests can sit unnoticed if the person who received the call gets pulled into something else.
- **Manual handover risk.** Shift handovers rely on a verbal briefing or a handwritten note, so open tasks are sometimes simply forgotten between shifts.
- **Limited visibility.** Management only learns about a slow response when a guest complains about it, not from the system itself.
- **No SLA enforcement.** There's no defined response-time target per request type, so "urgent" and "routine" get treated the same depending on who happens to pick it up.

## 6. Future-State Vision

Imagine this: a guest calls the front desk about a leaking faucet. The agent logs it in Serenity Ops in under 15 seconds → the system immediately routes it to the on-duty engineering staff member closest to that room, with an SLA countdown attached → engineering marks it resolved from their phone, which updates the guest's record and notifies the front desk automatically, all without a single phone call between departments.

This is Serenity Ops — fast, connected, and accountable by design.

## 7. Functional Requirements (Detailed)

### 7.1 Complaints & Requests

- Log a guest complaint or request from any device, tagged by category (housekeeping, engineering, F&B, other).
- Auto-route to the relevant department queue based on category.
- Attach an SLA timer per category (e.g. urgent maintenance: 30 minutes; routine housekeeping request: 2 hours).
- Front desk and the requesting guest's profile both show live status.

### 7.2 Room / Task Assignment

- Supervisors assign rooms or tasks to specific staff from a live board, not a printed list.
- Staff mark tasks as in-progress or done directly from their phone.
- Room status updates propagate to the PMS and front desk view in real time.

### 7.3 Handover & Communication

- End-of-shift view shows every open task, auto-carried into the next shift's queue.
- Supervisors can add a note to any task for the next shift to see.
- No task can be silently dropped; anything still open at shift end is flagged.

### 7.4 Reporting & Analytics

- Dashboard of average response time per category, per department, per shift.
- SLA breach report, filterable by date range and department.
- Staff-level completion counts for performance review purposes.

### 7.5 Scope & Boundaries

**In-Scope**

- Bi-directional integration with the existing PMS for room status, so both systems always agree.
- Complaint and maintenance request logging, routing, and SLA tracking.
- Mobile app for housekeeping and engineering staff.
- Management dashboard with response-time and SLA analytics.

**Out of Scope**

- Guest-facing app or portal (guests interact only through staff, not directly with the system) in this phase.
- POS or billing integration, unless a future phase specifically requires linking maintenance costs to guest folios.
- Multi-property support (this phase covers Serenity Resort's single property only).

## 8. Non-Functional Requirements (Expanded)

- **Performance:** Task status updates must reflect across all connected devices within 3 seconds.
- **Reliability:** 99.5% uptime target, with an offline-capable mobile app that queues updates until connectivity returns.
- **Security:** Role-based access control per department, full audit logging on every status change, encryption in transit and at rest.
- **Localization:** English and Bahasa Indonesia at launch, with the data model built to support additional languages later.
- **Scalability:** Architecture supports scaling to additional properties in a future phase without a redesign, even though phase 1 covers one property.

## 9. Implementation Roadmap

| Phase | Deliverables |
|---|---|
| Phase 1 (MVP) | Complaint/request logging, routing, SLA timers, mobile app for housekeeping and engineering, PMS integration for room status |
| Phase 2 | Full analytics dashboard, shift handover automation, staff performance reporting |
| Phase 3 | Multi-property support and AI-assisted routing based on historical response patterns |

## 10. Change Management Plan

- **Stakeholder buy-in:** Run an early demo with department heads (housekeeping supervisor, chief engineer, front office manager) before full rollout.
- **Training sessions:** Hands-on training per role, run separately for housekeeping, engineering, and front desk, since each group's workflow differs.
- **Phased rollout:** Start with housekeeping and front desk only for two weeks, then bring engineering in once the first workflow is stable.
- **Feedback loop:** Weekly check-ins with department heads for the first month post-launch to catch workflow gaps early.

## 11. Governance & Maintenance

- The Front Office Manager is the single point of accountability for the platform on the client side.
- Change requests post-launch go through the Front Office Manager to Etalas, rather than individual staff raising requests directly.
- Analytics are reviewed monthly by the GM and department heads to catch recurring SLA issues.

## 12. Risks & Mitigation (Detailed)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Staff resist moving off WhatsApp, which is familiar | Medium | High | Keep the mobile app as simple as WhatsApp to use, and run a phased rollout starting with the most receptive department |
| PMS integration proves more limited than expected | Medium | Medium | Confirm the PMS vendor's API capabilities during discovery, before committing to a bi-directional sync design |
| Poor WiFi coverage in some hallways disrupts real-time updates | High | Medium | Build the mobile app with offline queuing so actions sync once connectivity returns |

## 13. Success Measurement Framework

- **Operational KPIs:** average complaint response time, SLA breach rate per department.
- **Guest/Customer Experience KPIs:** guest complaint recurrence rate (same issue reported twice).
- **Adoption Metrics:** percentage of staff actively using the mobile app within 30 days of rollout.
- **Business Metrics:** reduction in guest-service-related negative reviews over the first two quarters post-launch.

## 14. Pre-Workshop User Confirmation Questions

**A. Business Goals & Success Metrics (Strategic)**
- What does management consider the single biggest operational pain point today: response time, visibility, or accountability?
- Is there a target guest-satisfaction score improvement tied to this project?

**B. Process Understanding & Current Gaps**
- How many guest requests and maintenance tickets does the property handle on an average day, and during peak season?
- What time of day sees the highest volume of requests, and does staffing already flex around that?

**C. User Roles & Permissions**
- Who currently has authority to reassign a task from one staff member to another mid-shift?
- Are there guest data fields (preferences, past complaints) that should be restricted to certain roles only?

**D. Integration Requirements**
- Does the PMS vendor support a bi-directional API, or only read-only access to room status?
- Is there a data residency requirement given the property's guest data policies?

**E. UX & Mobile Considerations**
- Which areas of the property have known WiFi dead zones that the offline mode needs to account for?
- Do any staff need the interface in a language beyond English and Bahasa Indonesia?

**F. Notifications & Escalations**
- What should trigger an automatic escalation to a supervisor: an SLA breach, or a specific request category regardless of time?
- Do staff prefer push notifications, SMS, or both for urgent requests?

## Appendix — Vocabulary / Glossary

| Term/Abbreviation | Full Form | Description |
|---|---|---|
| PMS | Property Management System | The existing system used for reservations, check-in/out, and room status |
| SLA | Service Level Agreement | The target response/resolution time attached to a request category |
| F&B | Food & Beverage | Department handling in-room dining and restaurant requests |
| GM | General Manager | The property's senior operational decision-maker |
