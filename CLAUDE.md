# CLAUDE.md

## Project

**BIS (Bicol Oragon Scruteneering System)** is a dancesport competition scoring web app. It is an online system: one server, hosted with Docker behind Caddy over HTTPS, handles team registration and payments, the public pages and the running of the rounds. Staff use laptops and adjudicators use phones, all over the internet.

Read these first:
- [ROLES_README.md](docs/product/ROLES_README.md): roles, devices and result-sheet terms
- [BUILD_README.md](docs/build/BUILD_README.md): tech stack, architecture, data model and build phases

## Current phase

**Phases 1 to 3 are built, plus registration and payments:** the screens, the scoring engine (`packages/scoring`) and the backend (`backend/`, Fastify + SQLite). There is no offline mode: the venue server and the sync with the cloud were removed. See [ROADMAP.md](docs/build/ROADMAP.md) for what is next (testing and the pilot) and [deploy/README.md](deploy/README.md) for running the server.

Screens and hooks get all data through `frontend/src/api/`, which talks to the server. `frontend/src/mocks/` is sample data only: it runs the frontend tests and `pnpm dev:sample` / `pnpm build:sample` (the client preview). Never import from `mocks/` in a screen or hook, and never import `@bis/scoring` in a screen or hook; scoring runs on the server (only the sample data in `mocks/` uses it).

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
- Public site style (details in `DESIGN.md`):
  - Black hero and footer around a white page. Section titles are small, bold and uppercase over a 1px black rule; never oversized.
  - Gold is sparing: the one call-to-action (a gold cell or bar), small gold mono dates and numbers, and the hover state.
  - Hover is light: an arrow that turns gold and rotates, a gold border, a pale tint, or a photo going from black and white to colour. Never a solid black fill, blur, glass or a gradient wash.
  - Cards have a hairline border and an 8 to 12px radius, with one large figure (a day, a count). Photos only where a real one exists, one crop per image.
  - Avoid the stock layouts: numbered timelines with lines, three equal icon-and-text columns, centred bands, pastel-tinted cards, a pin icon on every row.
  - When the user calls a design AI slop, remove decoration and change the idea, don't add more.
  - Check every public change in a screenshot at 1280px and 390px before calling it done.
  - Glass is allowed in one place only: the shared `DarkPanel` (the dark status boxes on the scrutineer, adjudicator and public program screens). Use that component; do not write new blur or glass styles.
- Design for the device each role uses:
  - Adjudicator: phone, one hand, large touch targets (at least 56px)
  - Staff: laptop, dense but readable tables
  - Compere/venue screen: projector, very large high-contrast text
  - Public and team: mobile-first
- Make every screen responsive from the start, across all screen sizes (375px phones, tablets, 1280px laptops, 1920px venue screen). Don't wait to be asked.
  - Mobile and tablet means below `lg` (1024px). Staff and public navigation is a black header with a hamburger on the right and a right drawer; the athlete, coach and team links are a fixed strip under the navbar.
  - Toolbars: filters share one row (a single filter is full width) and the buttons wrap below at their natural width. Use `Toolbar` and `ToolbarActions`; never make a button full width.
  - Text sizes come from the tokens in `index.css`, which step up below 640px. Don't set a one-off mobile size.
  - Buttons and badges never wrap their text.
- Every screen needs empty, loading and error states. For loading, use a skeleton that matches the final layout's shape, built with the shared `Skeleton` or `SkeletonList` component. Don't use a plain spinner.
- New pages need no scroll handling (every page change scrolls to the top). Drawers and dialogs get their slide and fade from `Drawer`, `Dialog` and the animation tokens; use them, don't hand-roll an overlay.
- A competition always has a card photo. The form and the server both require one.

## Code rules

- Always reuse existing components. Search `components/ui/` and `features/` first. Create a new component only when no existing one fits, even with a variant or prop added.
- Do not add long comments. Keep comments short, and only where the code isn't obvious.
- Keep shared types in `packages/shared`. Don't redefine data shapes in the frontend.
- Screens never import from `mocks/` directly. Go through `api/` and the hooks in `hooks/`.
- Keep components small and organize them by feature (`features/<role>/`).
- Use the domain terms from ROLES_README (back number, recall, heat, X mark, placing, Skating System). Always say "adjudicator", never "judge", in UI text, code, routes and file names.
