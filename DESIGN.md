# BIS Design System

Tokens live in `frontend/src/index.css` under `@theme`. Components live in `frontend/src/components/ui/`. Use these; don't add one-off colors, sizes or styles.

## Palette

Brown, black, white and gold. Gold is the single accent.

| Role | Tokens | Use |
| --- | --- | --- |
| Black | `black`, `neutral-900` | Text, strongest surfaces |
| Neutrals | `neutral-50` to `neutral-800` | Borders, table headers, secondary text. Faint brown tint, not beige |
| White | `#fff` | Page and surface background |
| Brown | `brown-50` to `brown-950` | Dark surfaces (venue screen, nav), secondary buttons, toasts |
| Gold | `gold-50` to `gold-700` | Primary action, active tab, highlights |
| Status | `success`, `warning`, `danger` (+ `-soft`) | Payment and round state only |

Rules:
- Gold fills (`gold-300`/`400`) always carry black text. Gold as text on white uses `gold-700`.
- Use gold sparingly: one primary action per screen, the active tab, highlighted rows.
- Warning is orange, kept clearly apart from gold.

## Type

- `font-sans` Manrope, for UI and headlines.
- `font-mono` JetBrains Mono, for back numbers, counts, eyebrows and badges. Pair with `tabular-nums` in tables.
- Scale: `text-display` (2.25rem), `text-title` (1.5rem), `text-body` (1rem), `text-small` (0.875rem), `text-label` (0.75rem, uppercase mono).
- Fonts are bundled with `@fontsource`, so the app works offline at the venue.

## Shape and depth

- Radius: `rounded-sm` 4px, `rounded-md` 8px, `rounded-lg` 12px.
- Surfaces are flat with hairline borders (`border-neutral-200`). The only shadow is `shadow-overlay`, for dialogs and toasts.

## Components

| Component | Notes |
| --- | --- |
| Button | `primary`, `secondary`, `ghost`, `danger`. Sizes `sm` 36px, `md` 44px, `lg` 48px, `xl` 64px (adjudicator phones, over the 56px minimum) |
| Input, Select, Textarea | Visible label always; hint or error text linked with `aria-describedby` |
| Card | Hairline border, no shadow. Don't nest cards |
| Table | Sticky header, row hover, skeleton rows via `loading`, empty state via `empty`, `rowClassName` for highlights |
| Badge | Tones `neutral`, `gold`, `brown`, `success`, `warning`, `danger`; optional dot |
| Dialog | Native `<dialog>`, closes on backdrop click and Esc, hidden scrollbar |
| Toast | `useToast().show(message, tone)`; mount `ToastViewport` once |
| Tabs | Arrow-key navigation; `large` for phones |
| PageHeader, EmptyState, Skeleton | Shared page building blocks |

## Behaviour

- Every screen needs empty, loading (matching-shape `Skeleton`) and error states.
- Focus ring is a 2px gold outline on every focusable element.
- Motion is short and respects `prefers-reduced-motion`.
- Scrollbars are hidden inside dialogs, tables and tab strips (`.no-scrollbar`) while content still scrolls.
