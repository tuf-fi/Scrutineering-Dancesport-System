---
name: BIS Design System
description: Plain, exact and printable like a result sheet; black, brown and white with gold marking what matters.
colors:
  black: "#0e0c0a"
  white: "#ffffff"
  neutral-50: "#f7f6f5"
  neutral-100: "#efedeb"
  neutral-200: "#e2dfdc"
  neutral-300: "#cfcac5"
  neutral-500: "#7a736c"
  neutral-600: "#5c564f"
  neutral-700: "#433e39"
  neutral-900: "#171412"
  brown-50: "#f6f1ec"
  brown-100: "#e8dccf"
  brown-800: "#3b2819"
  brown-900: "#2b1d14"
  brown-950: "#1c130d"
  gold-50: "#fff8e1"
  gold-100: "#fdedb5"
  gold-300: "#f0c84f"
  gold-400: "#e4b22e"
  gold-500: "#c99a1b"
  gold-700: "#7f5e0d"
  success: "#2f7d4e"
  success-soft: "#e3f1e9"
  warning: "#b85c0a"
  warning-soft: "#fcebd9"
  danger: "#b3261e"
  danger-hover: "#9a1f19"
  danger-soft: "#fbe4e2"
typography:
  display:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.gold-400}"
    textColor: "{colors.black}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.gold-300}"
  button-primary-active:
    backgroundColor: "{colors.gold-500}"
  button-primary-xl:
    height: "64px"
    padding: "0 32px"
    typography: "{typography.title}"
  button-secondary:
    textColor: "{colors.brown-900}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  button-secondary-hover:
    backgroundColor: "{colors.brown-50}"
  button-ghost:
    textColor: "{colors.neutral-700}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  button-ghost-hover:
    backgroundColor: "{colors.neutral-100}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  button-danger-hover:
    backgroundColor: "{colors.danger-hover}"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.neutral-900}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.lg}"
    padding: "20px"
  badge:
    backgroundColor: "{colors.neutral-100}"
    textColor: "{colors.neutral-700}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  badge-brown:
    backgroundColor: "{colors.brown-900}"
    textColor: "{colors.white}"
  table-header:
    backgroundColor: "{colors.neutral-50}"
    textColor: "{colors.neutral-600}"
    typography: "{typography.label}"
    padding: "12px 16px"
  table-row-highlight:
    backgroundColor: "{colors.gold-50}"
  dialog:
    backgroundColor: "{colors.white}"
    textColor: "{colors.neutral-900}"
    rounded: "{rounded.lg}"
    padding: "24px"
  toast:
    backgroundColor: "{colors.brown-950}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
---

# Design System: BIS

## Overview

**Creative North Star: "The Result Sheet"**

BIS looks like the paper it replaces: the printed "Qualified Solos for the final" sheet, with its heavy header band, hairline rules and columns of back numbers. Numbers come first. Counts, cutoffs, ties and placings are shown plainly and are never hidden behind decoration. The system is flat, exact and printable, so the same screen can be glanced at on an adjudicator's phone, read across a scrutineer's laptop, or projected for a crowd.

Black, brown and white carry the structure. Gold is the one voice: it marks the single action that matters, the active tab, an approved or highlighted row. Its rarity is the point. Controls are precise and sturdy: clear edges, confident sizes, nothing ornamental, so a wrong tap is hard to make and a wrong value is easy to spot.

No role has a priority layout. Every screen works from 375px phones to a 1920px venue screen, and each role's sizes are tuned for its own device.

**Key Characteristics:**
- Flat surfaces with hairline borders; one shadow, reserved for overlays.
- Mono type for numbers and labels, sans for everything else.
- One gold action per screen.
- Status colors only for payment, round and connection state.
- Works offline: all fonts and assets are bundled.

## Colors

A warm-black and white base, brown for dark and secondary surfaces, and gold as the single accent. Neutrals carry a faint brown tint so they sit with the brown without turning beige.

### Primary
- **Podium Gold** (#e4b22e, `gold-400`): Primary button fill and the main call to action. Always carries Ink Black text. Hover Pale Gold (#f0c84f, `gold-300`), pressed Aged Gold (#c99a1b, `gold-500`).
- **Brass Text** (#7f5e0d, `gold-700`): Gold used as text or eyebrow labels on white. Never use a gold fill as text on white.
- **Winner Tint** (#fff8e1, `gold-50`) and **Gold Wash** (#fdedb5, `gold-100`): highlighted table rows (ties at a recall cutoff), the "for checking" badge.
- **Focus Gold** (#c99a1b, `gold-500`): the 2px focus ring on every focusable element.

### Secondary
- **Espresso** (#2b1d14, `brown-900`): secondary button outline and text, brown badges, dark surfaces.
- **Deep Roast** (#1c130d, `brown-950`): toasts, the venue screen and navigation grounds.
- **Cocoa Line** (#3b2819, `brown-800`): secondary button border.
- **Brown Mist** (#f6f1ec, `brown-50`) and **Brown Fog** (#e8dccf, `brown-100`): secondary button hover and pressed fills.

### Neutral
- **Ink Black** (#0e0c0a, `black`): text on gold, the darkest ground.
- **Charcoal Brown** (#171412, `neutral-900`): body text.
- **Slate Taupe** (#433e39, `neutral-700`), **Muted Taupe** (#5c564f, `neutral-600`): secondary text, table header text.
- **Quiet Stone** (#7a736c, `neutral-500`): disabled text and the smallest captions.
- **Hairline** (#e2dfdc, `neutral-200`): borders on cards and tables. **Soft Rule** (#cfcac5, `neutral-300`): input borders. **Table Bone** (#f7f6f5, `neutral-50`), **Pale Stone** (#efedeb, `neutral-100`): sticky table header, hover and ghost fills.
- **White** (#ffffff): page and surface ground.

### Status
- **Confirm Green** (#2f7d4e) on **Green Wash** (#e3f1e9): approved, submitted.
- **Caution Orange** (#b85c0a) on **Orange Wash** (#fcebd9): offline, warning. Kept clearly apart from gold.
- **Alert Red** (#b3261e) on **Red Wash** (#fbe4e2): rejected, errors, destructive actions.

### Named Rules
**The One Voice Rule.** Gold marks one thing at a time: the primary action, the active tab, or a highlighted row. If two golds compete on a screen, one is wrong.

**The Black-on-Gold Rule.** Gold fills always carry Ink Black text, never white. Gold text on white uses Brass Text (`gold-700`).

**The Status Only Rule.** Green, orange and red mean state (payment, round, connection, error). They are never decoration.

## Typography

**Display Font:** Manrope Variable (with system-ui, sans-serif)
**Body Font:** Manrope Variable
**Label/Mono Font:** JetBrains Mono Variable (with ui-monospace, monospace)

**Character:** Manrope is clear and geometric, readable at phone size and on a projector. JetBrains Mono gives numbers an even rhythm and the metadata a printed-sheet feel.

### Hierarchy
- **Display** (700, 2.25rem, 1.1, -0.02em): page titles.
- **Title** (700, 1.5rem, 1.2, -0.01em): dialog titles, empty-state headings, the adjudicator Submit button.
- **Body** (400, 1rem, 1.5): paragraphs and form text. Keep lines near 65ch.
- **Small** (500 to 600, 0.875rem, 1.4): table cells, field labels, hints, tabs.
- **Label** (mono, 500, 0.75rem, 0.08em, uppercase): eyebrows, table headers, badges. Numbers in tables use mono with `tabular-nums`.

### Named Rules
**The Mono Numbers Rule.** Back numbers, X counts, placings, prices and event numbers are always mono and tabular so columns line up.

## Layout

Fluid and mobile-first. Pages are a single column that opens into a wider content area on laptops, with generous padding (16px on phones). Spacing runs on the 4px Tailwind scale, with 16px and 24px as the common steps. Tables scroll inside their own container and never push the page sideways. Roles differ in density, not in structure: adjudicator screens use large targets (at least 56px), staff screens use dense readable tables, the venue screen scales type up for 1920px and distance.

## Elevation & Depth

Flat by default. Depth comes from hairline borders and tonal fills (Table Bone, Pale Stone), not shadows. The only shadow is the overlay shadow, used on dialogs and toasts.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 12px 32px -8px rgb(14 12 10 / 0.35)`): dialogs and toasts only. Dialog backdrop is 60% black.

### Named Rules
**The Flat-By-Default Rule.** Cards, tables and inputs never carry a shadow.

## Shapes

Gently squared. Small elements (badges) use 4px, controls 8px, containers 12px. Borders are 1px hairlines. Status dots are the only circles. There are no pill shapes and no decorative clipping.

## Components

### Buttons
- **Shape:** 8px radius, semibold, 44px tall by default (36 small, 48 large, 64 extra large for adjudicator phones).
- **Primary:** Podium Gold fill with Ink Black text, `0 16px` padding. Hover Pale Gold, pressed Aged Gold.
- **Secondary:** Cocoa Line border with Espresso text; hover fills Brown Mist.
- **Ghost:** Slate Taupe text; hover fills Pale Stone.
- **Danger:** Alert Red fill with white text; hover `#9a1f19`.
- **Disabled:** 40% opacity, no pointer.

### Inputs / Fields
- **Style:** white fill, 1px Soft Rule border, 8px radius, 44px tall. A visible label always sits above; a placeholder never replaces it.
- **Focus:** border shifts to Espresso and the gold focus ring appears.
- **Error:** Alert Red border with the message below in red (role alert). Hints use Muted Taupe.
- **Disabled:** Pale Stone fill.

### Cards / Containers
- **Corner Style:** 12px. **Background:** white. **Border:** 1px Hairline. **Shadow:** none. **Padding:** 20px. Never nest a card inside a card.

### Tables
- Sticky header on Table Bone with mono uppercase labels. Row hover on Table Bone. Rows separated by faint rules. Highlight rows with Winner Tint (ties at the cutoff). Loading shows skeleton rows of the same shape; empty shows the empty state.

### Badges
- Mono uppercase label, 4px radius, optional status dot. Tones: neutral, gold, brown, success, warning, danger.

### Tabs
- Underline style: active tab has a 2px gold underline and Charcoal text; inactive text is Muted Taupe. Arrow keys move selection. A large variant (56px tall) serves adjudicator phones.

### Dialog
- Native dialog, 12px radius, 24px padding, max 32rem wide, hidden scrollbar, backdrop at 60% black. Actions right-aligned.

### Toast
- Deep Roast fill with white text, bottom-centred, 4s, tap to dismiss. Success and danger tones swap the fill.

### Page header
- Optional gold-700 mono eyebrow, Display title, optional description, a hairline underneath, actions on the right.

## Do's and Don'ts

### Do:
- **Do** use one gold primary action per screen.
- **Do** put black text on every gold fill.
- **Do** set numbers in mono with tabular figures.
- **Do** give every field a visible label.
- **Do** give every screen empty, loading (skeleton matching the final layout) and error states.
- **Do** keep touch targets at 56px or more for adjudicators.
- **Do** keep motion short and honour `prefers-reduced-motion`.
- **Do** hide scrollbars inside dialogs, tables and tab strips while content still scrolls.

### Don't:
- **Don't** use gold as text on white; use `gold-700`.
- **Don't** add shadows to cards, tables or inputs.
- **Don't** nest cards inside cards or stack many badges in one row.
- **Don't** use green, orange or red as decoration.
- **Don't** use placeholder text in place of a label.
- **Don't** use low-contrast text or a beige palette.
- **Don't** load fonts or assets from a CDN; BIS must work offline.
- **Don't** say "judge"; say "adjudicator".
