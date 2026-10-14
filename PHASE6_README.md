# Phase 6: Registration and Payments

Goal: clubs register and pay before the event, the admin confirms payments by hand, and the organizer keeps only what it needs about people. BIS never handles card details or money. See [PHASE5_README.md](PHASE5_README.md) for the cloud server this runs on and [BUILD_README.md](BUILD_README.md#payment-system-checked-manually-by-the-admin) for the payment flow.

## Status: built, except email

Much of the club side came with Phase 3 (sign-up, dancers, entries, payment proof, approve or reject with a logged reason). This phase replaced what was still faked and added what the roadmap asked for.

| Item | Status |
| --- | --- |
| Club sign-up, sign-in, dancers, entries, total fee | Done in Phase 3; entry now needs fees to be set |
| Fees and payment details set by the organizer | Done (admin screen **Fees and payment details**) |
| Proof of payment kept privately | Done: only admins and the club that sent it see the image |
| Admin approves or rejects, logged with name and time | Done in Phase 3 |
| Only paid entries can dance | Done: a round will not start while an entry of its event is unpaid |
| Club password change, and a temporary password from an admin | Done |
| Privacy: consent, notice, erasure, retention | Done |
| Remove the fake payment details and fees | Done (they now come from settings; only the sample data has examples) |
| Emails to clubs when a payment is approved or rejected | **Not done: channel to decide** |

Tests added: 12 backend (`accounts.test.ts`), 6 frontend. Suites: 192 backend, 243 frontend, 50 scoring.

## Decisions

1. **Fees and payment details are the organizer's to set, not built in.** They are saved on the cloud (admin only) and travel to the venue with the competition download, because late entries at the venue need the fees. Until fees are saved, clubs cannot enter events and late entries are refused. A venue cannot change them.
2. **Payment proofs stay in the database.** The roadmap said private files; keeping the image in the payment row means every backup and restore carries it with no second folder to forget. It is never sent to a venue or listed publicly, and the secretariat sees that a proof exists but not the image.
3. **Only paid entries dance, by two guards.** The download takes only approved or cash-paid entries, and at the venue a round refuses to start while any entry of its event is unpaid (the message says how many). The way round it is to record the payment or scratch the entry, which is logged. There is no separate "exception" switch; an admin approving the payment is the exception and it leaves a record.
4. **Privacy.** Clubs must agree to the privacy notice to sign up (the time is stored). Birth dates are not collected. Payment proofs are deleted 90 days after the competition, by a daily job online and by a button on the Clubs screen. A club that asks to be forgotten has its contact person, email, mobile number, login and proofs erased; its name and dancers stay because published results refer to them. Erasing is refused while a payment is waiting to be checked.
5. **Forgotten passwords go through an admin.** There is no email to send a reset link, so an admin gives a temporary password and passes it on.

## Decide: how clubs hear about a payment decision

Today a club sees the new status and the rejection reason when it opens Payments. Email or SMS needs a sender and costs money. Options:

- **Email through the host's SMTP or a mail service**: cheapest; needs a sender address and a few settings.
- **SMS**: reaches phones, which most coaches check first; costs per message in the Philippines.
- **Facebook Messenger or Viber**: needs business accounts and approvals.

Until this is chosen, tell clubs outside BIS (a message from the organizer) when a rejection needs a fix.

## What was built

- `backend/src/paymentSettings.ts`, `services/accounts.ts`: fees and methods, password change and reset, account erasure, proof retention.
- Migration `0004`: when each club agreed to the privacy notice.
- Admin screens **Fees and payment details** and **Clubs**; club **Account** screen; public **Privacy notice** at `/privacy`.
- The download from the cloud carries the payment settings to the venue.

## Not done

- Email or other messages to clubs (above).
- A club cannot erase itself; it asks the organizer.
- Receipt images are not checked beyond being an image under 3 MB.
- Rate limiting of sign-in attempts exists; there is no account lock-out or two-step sign-in.
- Real use of the online server with real clubs: that is Phase 7.
