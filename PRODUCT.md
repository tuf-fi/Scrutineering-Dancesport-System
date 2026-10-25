# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Everyone who touches a dancesport competition in the Bicol region, each on their own device:

- **Admin** (online laptop): manages competitions, staff, adjudicator panels, the points table, and checks entry payments.
- **Secretariat** (laptop): events, competitors, back numbers, scratches, schedule, heat and recall printouts.
- **Scrutineer** and **Chairperson of Adjudicators** (laptop): run rounds, watch adjudicators submit live, resolve ties at the recall cutoff, approve and publish results.
- **Adjudicators** (phone, usually 7 and up to 10, lettered A to J): mark X for recalls in early rounds, place finalists 1st to 6th or 7th.
- **MC / announcer** (laptop or venue screen): reads recalls, finalists and results from last place up.
- **Clubs and coaches** (phone or laptop, online): register dancers, pay entry fees outside BIS, upload proof of payment.
- **Public** (phone): parents, fans, competitors; browse results, history and rankings.

No single role takes priority. Each role is served on its own device, and every screen must also work at any screen size.

## Product Purpose

BIS (Bicol Information Scrutineering System) runs the scoring of dancesport competitions. It replaces paper and spreadsheets: adjudicators submit marks from phones, the scrutineer sees them arrive in real time, the Skating System produces the placings, and approved results go to the venue screen, printouts and the public site. It is an online system: one server handles registration, payments, public results and the running of the rounds, with staff on laptops and adjudicators on phones over the internet. Success is a correct, trusted result published quickly, with no way for a mis-tap or a lost connection to change the outcome unnoticed.

## Positioning

Built for the Bicol competition circuit and the way these events actually run: online, with adjudicators on their own phones, real event sheets (E47-style "Qualified for the next round"), manual payment checking through GCash, Maya and bank transfer, and WDSF-style Skating System scoring.

## Operating Context

- Competition day: staff laptops with a browser and internet, and up to 10 adjudicator phones signed in with a 6-digit PIN over mobile data or any Wi-Fi with internet. There is no separate venue network. Marks are held on the phone and resent if the connection drops.
- Before the event: clubs register and pay online; the admin approves payments; the secretariat assigns back numbers and builds the schedule and program.
- Paper is the fallback: printable blank adjudicator mark sheets, and A4 printouts that match the existing result sheets.
- Event sheets carry: event number, date, location, organizer, executor (scrutineer), grade (age group, class, dance), discipline, adjudicators by letter, then back number, name and club per competitor, with solo counts.

## Capabilities and Constraints

- Screens get data through `frontend/src/api/`, which talks to the server (Fastify + SQLite, scoring in `packages/scoring`). Sample data in `frontend/src/mocks/` serves the tests and the client preview only.
- TypeScript strict, React + Vite, React Router, TanStack Query, Zustand, Tailwind v4, Vitest. Shared types in `packages/shared`.
- Fonts and assets are bundled, with no CDN dependencies, so screens load fast and look the same on a slow connection.
- Domain terms: back number, recall, heat, X mark, placing, Skating System, majority, scratch. Always "adjudicator", never "judge".
- Payments are checked manually by the admin; BIS never handles card details or money.
- Many dancers are minors: collect only the fields needed (Data Privacy Act of 2012).
- Product name in the UI: Bicol Information Scrutineering System, short form BIS. The supplied logo reads "Bicol Oragon Scrutineering System"; the user chose the docs' wording.

## Brand Commitments

- Palette is binding: brown, black, white and gold. The supplied logo (`BIS-logo.jpg`, black ground with metallic copper, silver, red, navy and green) does not drive the palette.
- Adjudicators are always "adjudicators".

## Evidence on Hand

- `BIS-logo.jpg`: logo on black.
- `printed-result.jpg`: a real printed "Qualified Solos for the final" sheet, E47, JUN 1 - E1 Latin, Sorsogon Provincial Gymnasium, 10/Oct/2026, organizer and executor "BN IT Scrutineer", 6 solos of a total of 21, with back numbers 60 to 219.
- No client testimonials, rankings data, fee amounts, bank or wallet details, or a points table approved by the client yet. The points table in ROLES_README is a suggestion awaiting approval. Do not invent these.

## Product Principles

1. **A result must be provably correct.** Counts, cutoffs, ties and placings are shown plainly and never hidden behind styling.
2. **Prevent the mistake, then confirm.** Marking is blocked until valid (exact recall count, each placing used once); irreversible actions (submit, approve, publish) ask for confirmation.
3. **Say what is happening.** Connection state is always visible: connected or not, saved or sent, waiting or submitted.
4. **Each role gets a screen built for its device**, and every screen still holds up at any size.
5. **Match the paper.** Printouts and terms follow the existing result sheets, so officials recognise them.

## Accessibility & Inclusion

- Adjudicator touch targets at least 56px; text legible in bright venue lighting and on a projector.
- Keyboard navigation and visible focus on every screen.
- Every screen has empty, loading and error states.
