# BIS Frontend Build Guide

This guide covers building the BIS frontend step by step: every screen for every role, using sample data, with no backend. It turns **Phase 1** of [BUILD_README.md](BUILD_README.md) into a plan you can work through. Roles and terms come from [ROLES_README.md](ROLES_README.md).

**Goal:** a clickable app the client can walk through and approve. Later, when the backend exists, you replace the sample data with real API calls and leave the screens as they are.

## Step 0: Set up the tools

| Tool | Use |
| --- | --- |
| Node.js 20+ and **pnpm** | Run the monorepo with workspaces |
| **Vite + React + TypeScript** | The frontend |
| **Tailwind CSS v4** (`@tailwindcss/vite`) | Styling |
| **React Router** | Pages and per-role routes |
| **TanStack Query** | Data fetching. Points at sample data now and the real API later |
| **Zustand** | Small client state: signed-in user, role, online status |
| **Vitest + Testing Library** | Component tests |
| **Impeccable** | Design commands and slop checks (see [CLAUDE.md](CLAUDE.md)) |

## Step 1: Set up the repository

Use the existing `scrutineering-system` folder as the repository root. Run these commands inside it:

```bash
git init
pnpm init
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "frontend"
  - "backend"
  - "packages/*"
```

Create the frontend and the shared package:

```bash
pnpm create vite frontend --template react-ts
mkdir -p packages/shared/src
cd frontend
pnpm add react-router @tanstack/react-query zustand
pnpm add -D tailwindcss @tailwindcss/vite vitest @testing-library/react jsdom
```

Leave `backend/` and `packages/scoring` until later phases.

## Step 2: Shared types (`packages/shared`)

Write the TypeScript types for the data model before you build any screen, so the sample data and the real API later use the same shapes.

```
packages/shared/src/
  types.ts      Competition, Event, Competitor, Entry, Club, Payment,
                Adjudicator, Panel, Round, Heat, Mark, Result,
                PointsRow, RankingPoint, StaffUser, AuditEntry
  enums.ts      Role, PaymentStatus, RoundType, AgeGroup, Class, Discipline
```

Key enums:

- `Role`: admin, secretariat, scrutineer, chairperson, adjudicator, mc, club, public
- `PaymentStatus`: unpaid, for_checking, approved, rejected, paid_at_venue
- `RoundType`: round_1, round_2, quarter_final, semi_final, final
- `Discipline`: latin, standard

## Step 3: Design foundation

Do this before you build screens, so every screen shares the same look.

1. Install Impeccable and run `/impeccable init` to set up the project's design context.
2. In Tailwind's `@theme`, define the design tokens: colors (neutral scale, one accent color, success, warning and danger), font family, type scale, spacing, radius and shadows.
3. Build the base components in `frontend/src/components/ui/`:

| Component | Notes |
| --- | --- |
| Button | primary, secondary, ghost and danger variants; sm, md, lg and xl sizes (xl for adjudicator phones) |
| Input, Select, Textarea | Always use a visible label; a placeholder does not replace it |
| Card, Table | Table with sticky header, row hover and an empty state |
| Badge | Payment status, round status, online/offline |
| Dialog, Toast | Confirmations and "Submitted" feedback |
| Tabs, PageHeader, EmptyState, Skeleton | Shared page building blocks |

4. Run `/impeccable document` to record the system in `DESIGN.md`.

## Step 4: Sample data layer

Keep sample data behind a small API layer, so you change only one folder when the backend is ready.

```
frontend/src/
  mocks/
    data/        competitions.ts, events.ts, competitors.ts, marks.ts ...
    api.ts       Functions that return sample data after a short fake delay
  api/
    index.ts     Re-exports mocks/api.ts now; real fetch calls later
  hooks/
    useEvents.ts, useRound.ts ...   TanStack Query hooks that call api/
```

- Base the sample data on a real event, such as E47 Junior I E1 Cha Cha Cha with 7 adjudicators (A to G) and 30+ solos, so the screens look real.
- Fake real-time updates with a timer that adds adjudicator submissions one at a time. Socket.IO will replace it in Phase 3.
- Add a toggle that switches the online/offline indicator between online and offline.

## Step 5: App shell and sign-in

1. **Sign-in page:** staff sign in with a username and password. Adjudicators use a separate PIN sign-in page.
2. **Role switcher (dev only):** a hidden menu that switches the current role, so you can test each role's screens quickly.
3. **Layout per role:**
   - Staff (admin, secretariat, scrutineer, chairperson): sidebar and top bar on a laptop.
   - Adjudicator: full-screen mobile layout with no sidebar.
   - MC/venue screen: full-screen, very large text.
   - Public and club: top navigation, mobile-first.
4. **Online/offline indicator:** shown in the top bar on every staff screen.
5. **Route guards:** each role sees only its own routes.

Route map:

```
/login                       Staff sign-in
/adjudicator                 Adjudicator PIN sign-in
/admin/*                     Admin
/secretariat/*               Secretariat
/scrutineer/*                Scrutineer (+ chairperson view)
/mc                          MC / venue screen
/print/*                     Print pages (no layout chrome)
/club/*                      Club portal
/                            Public site
```

## Step 6: Admin screens

- [ ] Competitions: list, create and edit (name, date, venue, organizer)
- [ ] Staff accounts: list, add, assign a role, reset a password
- [ ] Adjudicators and panels: add adjudicators with a letter, generate a PIN per competition, assign a panel to each event
- [ ] Points table: editable table (1st = 10 down to semi-final = 1)
- [ ] Payment checking: a queue filtered by status. Each payment shows the club, dancers and events, amount due, the amount and reference number the club entered, and the screenshot, with Approve/Reject buttons and a required reason when rejecting

## Step 7: Secretariat screens

- [ ] Events list (E1 to E100+): number, age group, class, discipline, dances, solo or couple, entry count
- [ ] Event detail: entries, scratch toggle, payment status per entry
- [ ] Competitors: search, add, import (CSV upload UI), assign back numbers
- [ ] Late entries and cash payments ("Paid at venue")
- [ ] Schedule: order of events and rounds
- [ ] Buttons to print heat and recall lists (these open the print pages)

## Step 8: Adjudicator screens (phone)

Design these one-handed at 375px wide. Make buttons at least 56px tall.

- [ ] PIN sign-in with a large keypad
- [ ] "Waiting for next round" screen
- [ ] **X marking:** grid of back numbers, tap to toggle X, live counter "8 of 12 marked"; the Submit button stays disabled until the count matches the recall number exactly
- [ ] **Final placing:** assign 1st to 6th or 7th; each place can be used only once; reorder easily
- [ ] Multi-dance rounds: tabs for each dance
- [ ] Confirm, then a large, clear **"Submitted"** screen
- [ ] A "Saved, sending…" state for when Wi-Fi drops (visual only for now)

## Step 9: Scrutineer screens

- [ ] Rounds dashboard: current event, round, heats and status
- [ ] Heat setup: split competitors into heats
- [ ] **Live submission board:** a grid of adjudicators A to J showing waiting, marking and submitted; flag a phone that has gone quiet
- [ ] Recall table: X count per competitor, sorted, with a cutoff line at the recall number and ties at the cutoff highlighted
- [ ] Tie resolution: choose to recall more or fewer; chairperson confirmation step
- [ ] **Skating System table:** placings matrix, majority columns and final places (show static sample results for now; the real engine comes in Phase 2)
- [ ] Approve and publish buttons with a confirmation dialog
- [ ] Chairperson view: the same screens, read-only, plus "Confirm tie decision"

## Step 10: MC / venue screen

- [ ] Large-text, high-contrast display for a projector
- [ ] Modes: next event call, recalled numbers, finalists, results from last place up (reveal one place at a time)
- [ ] Keyboard controls (arrow keys or space) to step through announcements

## Step 11: Printouts

Use plain HTML pages with A4 print CSS (`@page { size: A4; margin: 12mm; }`). They print from any browser or save as PDF.

- [ ] Heat lists
- [ ] "Qualified for the next round" list (match the E47 sheet layout)
- [ ] Scores sheet with every adjudicator's marks
- [ ] Final results, with spaces for the scrutineer and chairperson to sign
- [ ] Blank adjudicator mark sheets for the paper fallback

## Step 12: Public site

Build this mobile-first. Later it also serves the venue guest Wi-Fi.

- [ ] Home: live and latest results
- [ ] Competitions: past events, then events, then results per event
- [ ] Competitor profile: history and points
- [ ] Rankings: filter by age group, class and discipline (for example Junior I E1 Latin)

## Step 13: Club portal

- [ ] Club sign-up and sign-in
- [ ] Dancers: add and edit; collect only the fields needed (Data Privacy Act, since many dancers are minors)
- [ ] Register dancers to events with a running fee total
- [ ] Payment page: GCash, Maya and bank details, an upload for the screenshot, and fields for the reference number and amount
- [ ] Payment status list with badges, and the reason shown when a payment is rejected

## Step 14: Polish and client walkthrough

1. Run `/impeccable audit` and `/impeccable critique` on each role's screens, then `/impeccable polish`.
2. Check every screen for empty, loading and error states.
3. Check responsive widths: 375px (phones), 1280px (laptops) and 1920px (venue screen).
4. Check accessibility: keyboard navigation, focus rings and contrast.
5. Deploy a static preview (for example Vercel or Netlify) and walk the client through each role's flow. Collect feedback before you start Phase 2.

## Next steps

After the client approves the screens:

- **Phase 2:** build `packages/scoring` and replace the static Skating System sample with real calculations.
- **Phase 3:** build `backend/` and change `src/api/index.ts` from mocks to real fetch calls and Socket.IO.

## Suggested folder layout for `frontend/`

```
frontend/src/
  app/            Router, providers, layouts per role
  components/ui/  Base design-system components
  features/
    admin/  secretariat/  adjudicator/  scrutineer/
    mc/  print/  public/  club/
  hooks/          TanStack Query hooks
  api/            API boundary (mocks now, real later)
  mocks/          Sample data
  stores/         Zustand stores (auth, connection)
  lib/            Small helpers (formatting, back numbers)
```
