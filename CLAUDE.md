# CLAUDE.md

## Project

**BIS (Bicol Information Scrutineering System)** is a dancesport competition scoring web app. It runs offline at the venue on a local server and online on a cloud server, which handles registration, payments and public results.

Read these first:
- [ROLES_README.md](ROLES_README.md): roles, devices and result-sheet terms
- [BUILD_README.md](BUILD_README.md): tech stack, architecture, data model and build phases
- [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md): step-by-step frontend build (current focus)

## Current phase

**Phases 1 to 3 are built:** the screens, the scoring engine (`packages/scoring`) and the venue backend (`backend/`, Fastify + SQLite). See [ROADMAP.md](ROADMAP.md) for what is next (offline safety, cloud sync, registration and payments) and [VENUE.md](VENUE.md) for running it.

Screens and hooks get all data through `frontend/src/api/`, which talks to the venue server. `frontend/src/mocks/` is sample data only: it runs the frontend tests and `pnpm dev:sample` / `pnpm build:sample` (the client preview). Never import from `mocks/` in a screen or hook, and never import `@bis/scoring` in a screen or hook; scoring runs on the server (only the sample data in `mocks/` uses it).

When a function is added to the server, add it to `API_FUNCTIONS` in `packages/shared/src/api.ts`, give it a role in `backend/src/registry.ts`, and add its client function in `frontend/src/api/client.ts` (and a sample version in `mocks/api.ts` if screens use it). Tests fail if these drift.

## Stack

- pnpm monorepo: `frontend/`, `backend/`, `packages/shared`, `packages/scoring`
- TypeScript everywhere (strict mode)
- React + Vite, React Router, TanStack Query, Zustand
- Tailwind CSS v4
- Vitest + Testing Library
- Backend: Node 24, Fastify, SQLite (better-sqlite3) with Drizzle, Socket.IO

## Design rules

- Use **Impeccable** (https://impeccable.style/) for all design work.
  - Install in Claude Code: `/plugin marketplace add pbakaus/impeccable`, then install it from `/plugin`.
  - Run `/impeccable init` once per project. Use `shape` for new screens; `critique` and `audit` to review; `polish`, `typeset`, `layout` and `distill` to refine.
  - Record design decisions in `DESIGN.md` with `/impeccable document`, and follow that file.
- Always make **modern, sleek, aesthetic, clean and consistent** designs when building UI.
- Reuse the design tokens and the components in `components/ui/`. Don't use one-off colors, sizes or styles.
- Avoid AI slop: no beige palettes, no cards inside cards, no stacks of badges, no placeholder-only form labels and no low-contrast text.
- Design for the device each role uses:
  - Adjudicator: phone, one hand, large touch targets (at least 56px)
  - Staff: laptop, dense but readable tables
  - MC/venue screen: projector, very large high-contrast text
  - Public and club: mobile-first
- Make every screen responsive from the start, across all screen sizes (375px phones, tablets, 1280px laptops, 1920px venue screen). Don't wait to be asked.
- Every screen needs empty, loading and error states. For loading, use a skeleton that matches the final layout's shape, built with the shared `Skeleton` component. Don't use a plain spinner.

## Code rules

- Always reuse existing components. Search `components/ui/` and `features/` first. Create a new component only when no existing one fits, even with a variant or prop added.
- Do not add long comments. Keep comments short, and only where the code isn't obvious.
- Keep shared types in `packages/shared`. Don't redefine data shapes in the frontend.
- Screens never import from `mocks/` directly. Go through `api/` and the hooks in `hooks/`.
- Keep components small and organize them by feature (`features/<role>/`).
- Use the domain terms from ROLES_README (back number, recall, heat, X mark, placing, Skating System). Always say "adjudicator", never "judge", in UI text, code, routes and file names.
