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
    fontSize: "clamp(1.625rem, 1.3rem + 1vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  small:
    fontFamily: "Manrope Variable, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.45
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
    textColor: "{colors.neutral-900}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 20px"
  button-secondary-hover:
    backgroundColor: "{colors.neutral-50}"
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
    backgroundColor: "{colors.neutral-50}"
    textColor: "{colors.neutral-900}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 14px"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.lg}"
    padding: "20px"
  badge:
    textColor: "{colors.neutral-600}"
    typography: "{typography.small}"
  table-header:
    backgroundColor: "{colors.white}"
    textColor: "{colors.neutral-600}"
    typography: "{typography.small}"
    padding: "12px 16px 12px 0"
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
- Mono type for numbers and data, sans for everything else.
- One gold action per screen.
- Status colors only for payment, round and connection state.
- Works offline: all fonts and assets are bundled.

## Colors

A warm-black and white base, brown for dark and secondary surfaces, and gold as the single accent. Neutrals carry a faint brown tint so they sit with the brown without turning beige.

### Primary
- **Podium Gold** (#e4b22e, `gold-400`): Primary button fill and the main call to action. Always carries Ink Black text. Hover Pale Gold (#f0c84f, `gold-300`), pressed Aged Gold (#c99a1b, `gold-500`).
- **Brass Text** (#7f5e0d, `gold-700`): Gold used as text on white, such as a status word. Never use a gold fill as text on white.
- **Winner Tint** (#fff8e1, `gold-50`) and **Gold Wash** (#fdedb5, `gold-100`): highlighted table rows (ties at a recall cutoff).
- **Focus Gold** (#c99a1b, `gold-500`): the 2px focus ring on every focusable element.

### Secondary
- **Espresso** (#2b1d14, `brown-900`): dark surfaces and the toast ground.
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
- **Display** (600, fluid 1.375rem to 1.625rem, 1.2, -0.02em): page titles.
- **Title** (600, 1rem, 1.4, -0.01em): section headings and dialog titles.
- **Body** (400, 0.875rem, 1.55): paragraphs and form text. Keep lines near 65ch.
- **Small** (500 to 600, 0.75rem, 1.5): table cells, field labels, hints, tabs, buttons. Table headers use 0.6875rem. Do not enlarge this scale; type was reduced twice on request.
- **Label** (mono, 500, 0.75rem, 0.08em): short data labels only. Numbers in tables and meta lines use mono with `tabular-nums`.

### Named Rules
**The No Costume Rule.** Mono is for numbers and data, not for decoration: no uppercase mono eyebrows, headers or badges. No label sits above a heading; the heading carries itself.

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
- **Shape:** 8px radius, semibold, 40px tall by default (32 small, 44 large, 64 extra large with 24px labels for adjudicator phones).
- **Primary:** Podium Gold fill with Ink Black text, `0 16px` padding. Hover Pale Gold, pressed Aged Gold.
- **Secondary:** 1px Soft Rule border with Charcoal Brown text; hover fills Table Bone.
- **Ghost:** Slate Taupe text; hover fills Pale Stone.
- **Danger:** Alert Red fill with white text; hover `#9a1f19`.
- **Disabled:** 40% opacity, no pointer.

### Inputs / Fields
- **Style:** Table Bone fill, 1px Soft Rule border, 8px radius, 40px tall. A visible label always sits above; a placeholder never replaces it.
- **Focus:** fill turns white, border shifts to Charcoal Brown and the gold focus ring appears.
- **Error:** Alert Red border with the message below in red (role alert). Hints use Muted Taupe.
- **Disabled:** Pale Stone fill.

### Cards / Containers
- **Corner Style:** 12px. **Background:** white. **Border:** 1px Hairline. **Shadow:** none. **Padding:** 20px. Never nest a card inside a card.

### Tables
- A plain contained surface: 1px Hairline border, 12px radius, a white header with small muted labels over a hairline, hairline rules between rows and a soft hover. Names read at full strength, supporting columns (venue, username) in Muted Taupe. Numbers are mono and right-aligned. No date tiles, chips or other decoration on rows. Highlight rows with Winner Tint (ties at the cutoff). Loading shows skeleton rows of the same shape; empty shows the empty state.
- **Every table and list paginates, at most 10 rows a page, with the pager always shown.** The footer reads "Showing 1–10 of 33" on the left and the pager on the right; it returns to page 1 when a filter or search changes.
- **Row actions** are icon buttons (edit, delete, and others such as reset password), 32px, muted until hovered; delete turns Alert Red. Rows are not clickable except where a row opens a read-only view (Payments drawer, Rankings); editing is only through the edit icon.

### Status
- A dot and a word in the status color, no fill and no pill. Tones: neutral, gold, success, warning, danger. Never stack more than a few in one row.

### Tabs
- Underline style: active tab has a 2px gold underline and Charcoal text; inactive text is Muted Taupe. An optional count follows the label in small muted mono. Arrow keys move selection. A large variant (56px tall) serves adjudicator phones.

### Dialog
- Built on Radix Dialog (focus trap, scroll lock, Esc, portal). 12px radius, max 28 to 32rem wide, hidden scrollbar, plain 50% black backdrop with no blur. A title and one-line description with a close button at the top-right, the form below, and the actions in a Table Bone footer bar under a hairline, right-aligned. Creating and editing a record (competition, staff account, adjudicator) happens in this modal on the list page, never on a separate page.

### Drawer
- Off-canvas panel from the right edge (max 36rem, full width on phones), built on Radix Dialog like Dialog, with the same plain 50% black backdrop. Title and status under it, close button top-right, hidden-scrollbar body, and a footer bar pinned to the bottom for decisions (Payments: Reject and Approve). Opens from a table row click; the table stays the list.

### Toast
- Built on Sonner, styled with project tokens: Deep Roast fill with white text, bottom-centred, 4s. `toast.success` turns the fill green and `toast.error` red.

### Staff sidebar
- From laptop width, fixed to the viewport (the page never scrolls it): 15rem, collapsible to a 4.5rem icon rail, remembered on the device. The surface is flat Table Bone with hairline rules, no cards. The logo is centred at the top with the collapse button at its top-right (above the logo in the collapsed rail). Between two hairlines under it, the signed-in person: initials avatar on the left, name over role on the right. Each section has a Lucide icon (18px, 1.75 stroke) and a label. The current section is a white row with a hairline border and a gold icon; the rest are Muted Taupe with a soft hover. Collapsed, labels stay in the page for screen readers and a dark tooltip shows beside the icon on hover and focus. Under a hairline at the bottom: the connection status as a plain dot and word (Confirm Green online, Caution Orange offline) and Sign out in Alert Red. On laptops there is no top bar; those controls live in the sidebar. Below laptop width the sidebar is replaced by a top bar (logo, status, sign out) over a scrolling strip of text tabs.

### Filters
- Filters are selects with a visible label, not button groups, and their options carry no counts. A list's toolbar reads left to right: search, the select filters, then the page's primary action pushed to the far right of the same row, level with the inputs. The two-option view switch on the adjudicators page is the only toggle-button group left (36px, 8px radius, the chosen option fills Charcoal Brown); gold stays reserved for the one primary action.

### Pagination
- A circular pager: a round bordered arrow, the page numbers as round buttons with the current page filled Charcoal Brown, then the next arrow. Long runs collapse with an ellipsis around the current page. On phones it reads "Page 2 of 6" between the two arrows.

### Avatars
- Overlapping initials circles for a solo dancer or a couple (36px; 56px on a profile), tinted Brown Mist and Pale Stone with a white ring. There are no photos yet.

### Ranking rows
- Rank in mono (top three at full strength, the rest muted), competitor with their club underneath, then competitions and points right-aligned in mono. Equal points share a rank and the next rank is skipped. Whole rows open the competitor's page.

### Page header
- Display title, optional description, actions on the right. No label above the title.

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
- **Don't** nest cards inside cards or wrap every item in a card; rule content with hairlines instead.
- **Don't** put an eyebrow or kicker above a heading, or set mono uppercase as decoration.
- **Don't** use green, orange or red as decoration.
- **Don't** use placeholder text in place of a label.
- **Don't** use low-contrast text or a beige palette.
- **Don't** load fonts or assets from a CDN; BIS must work offline.
- **Don't** say "judge"; say "adjudicator".
