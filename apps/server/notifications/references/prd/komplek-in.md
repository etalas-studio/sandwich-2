# Product Requirements Document (PRD)

Project Name: Komplek.in · Version: 1.0 · Last Updated: 14 March 2026 · Prepared by: Etalas Product Team

## 1. Purpose

Komplek.in is a digital platform that helps residential communities manage monthly dues, donations, and shared expenses without relying on a WhatsApp group and a spreadsheet. It gives the community treasurer a single place to record who has paid, send reminders automatically, and publish a transparent ledger that any resident can check at any time. For residents, it replaces the awkward routine of asking a neighbor for a bank transfer confirmation with a simple app that shows their payment history and any open community fundraiser.

## 2. Background & Problem Statement

Most residential associations (RT/RW) in Indonesia still track dues and donations manually. A treasurer keeps a notebook or an Excel file, collects proof-of-transfer screenshots over WhatsApp, and reads them out loud during monthly meetings. This works for a street of 20 households; it breaks down once a complex grows past 100.

Four problems come up again and again when we talked to treasurers:

- **Manual reconciliation takes hours.** Matching bank transfers to the right household by nickname or transfer note is error-prone, and treasurers redo it every month.
- **No shared visibility.** Residents don't know if a payment actually went through, so they message the treasurer directly to ask, which adds to the workload instead of reducing it.
- **Donations are hard to track separately from dues.** When a fundraiser for a broken gate or a security guard's bonus comes up, treasurers juggle a second notebook and residents can't see how much has been collected.
- **Handover between treasurers loses history.** When the treasurer role rotates each year, the new treasurer usually starts from a half-updated spreadsheet with no full audit trail.

## 3. Proposed Solution

Komplek.in gives every complex an admin panel for the treasurer and a resident-facing app for households. The treasurer sets up the fee schedule once (monthly dues amount, due date, optional per-block variation), and the system tracks who has paid, who is late, and by how much, without any manual entry beyond confirming a bank transfer.

Residents get a lightweight view: their own payment history, a running balance for the household, and any active donation campaign with a progress bar. When a payment is confirmed, the resident gets a WhatsApp notification automatically, so they don't need to check the app to know their payment went through.

Because every transaction is logged with a timestamp and the confirming admin's name, a treasurer handover becomes a matter of transferring an account, not retyping a spreadsheet.

## 4. Goals and Objectives

- Reduce the treasurer's monthly reconciliation time from hours to under 30 minutes.
- Give every resident real-time visibility into their own payment status without asking the treasurer.
- Provide a transparent, exportable ledger for both dues and donations.
- Preserve a full audit trail across treasurer handovers.
- Automate payment reminders so late payments drop without the treasurer sending individual messages.

## 5. Target Users

### 5.1 Primary Users

- **Treasurer / Admin** — manages the fee schedule, confirms incoming transfers, and publishes the ledger. Usually a resident volunteer, not a finance professional, so the admin panel needs to stay simple.
- **Resident (head of household)** — pays dues, views their own payment history, and contributes to donation campaigns.

### 5.2 Secondary Users

- **RT/RW Head** — doesn't do daily admin work but checks the summary dashboard before community meetings and needs export-ready reports.
- **Security guard coordinator** — occasionally requests a specific donation campaign (e.g. a bonus fund) and needs to see how much has been collected without full admin access.

## 6. Product Features & Detailed Requirements

### 6.1 Admin Panel

- Set up the fee schedule (monthly amount, due date, optional per-block or per-house-type variation).
- View a dashboard of paid, unpaid, and overdue households for the current month.
- Confirm a payment manually by matching a bank transfer to a household, with the option to attach a screenshot as proof.
- Create a donation campaign with a name, target amount, and end date.
- Export the ledger (dues and donations) as a spreadsheet for a given period.

### 6.2 Resident App

- View personal payment history and current balance.
- See due date and amount for the current month, with a one-tap "mark as paid" that notifies the admin to confirm.
- Browse active donation campaigns and see the live progress bar.
- Receive a WhatsApp notification when a payment is confirmed or when a due date is approaching.

### 6.3 Onboarding Flow

1. RT/RW head registers the complex and invites the treasurer as the first admin.
2. Treasurer imports the household list (name, block/unit number, phone number) via a spreadsheet template.
3. Each household receives an invite link via WhatsApp to activate their resident account.
4. Treasurer sets the current month's fee schedule; the system starts tracking from that cycle onward.

## 7. Success Criteria

- 80% of households in a pilot complex are actively using the app within 60 days of launch.
- Treasurer reconciliation time drops by at least 70% compared to their prior manual process.
- Fewer than 5% of residents contact the treasurer directly to ask about payment status after month two.

## 8. Risks & Mitigation Plan

| Risk | Mitigation Strategy |
|---|---|
| Older residents are uncomfortable with an app-only flow | Keep a manual "mark as paid by admin" path so the treasurer can record cash or offline payments without the resident touching the app |
| Treasurer forgets to confirm payments promptly, causing residents to distrust the system | Send the treasurer a daily digest of pending confirmations |
| Bank transfer notes don't match resident names, making confirmation slow | Let residents attach their own transfer proof in-app with a note, so the admin only needs to verify rather than search |

## 9. Future Roadmap Ideas

- Direct bank/e-wallet integration to auto-confirm payments without manual matching.
- Multi-complex support for property management companies overseeing several RT/RW areas.
- A simple expense-tracking module so the treasurer can log outgoing costs, not just incoming dues.
