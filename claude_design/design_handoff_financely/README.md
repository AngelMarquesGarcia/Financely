# Handoff: Financely — component library → Angular

## Overview
Financely is a personal-finance desktop app (single "Main" account, envelope-based
budgeting, movements/transactions, recurring "periodic" movements, grouped
"compound" movements, and an analytics dashboard with charts). This bundle is the
**UI component library and page layouts** for that app, built as high-fidelity
design references.

The task: **recreate these designs as Angular components** in the target codebase,
using its existing patterns (Angular components/templates, whatever styling
approach and chart/state libraries the app already uses). Match the visual design
pixel-for-pixel; do not ship the HTML files as-is.

---

## About the design files (read this first)

The files in `design_refs/` are **`.dc.html` design references** — not production
code, and **not** React/Angular source you can transpile.

- Each `.dc.html` is a self-contained, browser-openable prototype of one component
  or page. It renders through an internal preview runtime (`support.js` in the
  authoring tool). **You do not need that runtime and it is deliberately not
  included** — it is irrelevant to Angular.
- They are `.html` (not `.ts`) because they are **framework-agnostic visual specs**
  authored in a design tool, meant to be opened and looked at. Under the hood the
  preview runtime happens to use React to paint them, but they are not React
  component files — treat them as annotated HTML/CSS mockups with a small logic
  block that describes behavior.
- **How to read one:** see `HOW_TO_READ_DC.md`. Short version — the markup between
  `<x-dc>…</x-dc>` is the layout (all styling is inline CSS, so colors/spacing/
  fonts are literal and copyable); the `class Component extends DCLogic` block at
  the bottom describes state, computed values, and interaction behavior.

## Fidelity: **High-fidelity (hifi)**

Colors, typography, spacing, border-radius, shadows and interactions are final.
Recreate them exactly. All style values are inline in each file, so you can read
them off directly. The shared palette is also centralized in `finance-lib.js`
(the `T` tokens and `PALETTE` array) — see **Design Tokens** below.

---

## The data layer / API contract — `finance-lib.js`

`design_refs/finance-lib.js` is the **single most important file** for a developer.
Every component pulls its data and all money/date formatting from it. It contains:

- **Mock data** for a coherent dataset (Jan 2026, "Main" account): accounts,
  envelopes, categories, tags, movements, periodic movements, compound movements,
  period summaries, and chart data.
- **The real API contract.** Every mock getter is annotated with the exact
  `window.*` IPC method it stands in for, e.g.
  `window.movements.getAll(filter?)`, `window.periodSummaries.getByPeriod(...)`,
  `window.envelopes.getAll()`. Use these annotations to wire the Angular components
  to the real backend — the shapes in this file are the DTO shapes.
- **Formatters** you must replicate exactly:
  - `fmtMoney(cents, {sign})` — **European format**: comma decimal, thin-space
    (`\u202f`) thousands grouping, trailing `\u00a0€`, and a real minus sign
    (`\u2212`) for negatives. Money is **always integer cents**.
  - `fmtRelDate`, `fmtDate`, `fmtMonthYear` — "today" is pinned to **20 Jan 2026**
    for stable output; `month` is **0-indexed** everywhere (Date convention).
  - `moneyColor(cents)` — green positive / red negative / ink zero.
- **Chart aggregation logic** — `pieData`, `barData`, `lineData`, `donutSlices`,
  and the `CHART_VARS` metadata (which variables are money vs counts). Port these
  as a service; the charts are thin renderers over these functions.

Recommended first step in Angular: reproduce `finance-lib.js` as a typed data
service + formatting pipes, then build components against it.

---

## Design tokens

From `finance-lib.js` `T` (components inline these literals):

**Neutrals / text**
- ink `#1b2430` · inkSoft `#5b6472` · muted `#98a1b0` · faint `#c3cad4`
- line `#eceef2` · lineSoft `#f2f4f7`
- card `#ffffff` · canvas `#f5f6f8` (page background on the dashboard is `#eef0f3`)

**Semantic / accents**
- pos (income) `#1c8a4d` · neg (expense) `#d23b2b`
- blue `#2f6bf6` · indigo `#6b5cf5` · amber `#e8a33d`
- tints (7% bg washes): tintBlue `#eef3fe` · tintGreen `#eef7f1` ·
  tintIndigo `#f3f1fe` · tintAmber `#fbf4e7` · tintRed `#fcefed`

**Entity palette** (`PALETTE`, cycled for envelopes/categories/tags):
`#2f6bf6 #1c8a4d #d23b2b #6b5cf5 #e8a33d #0f9aa8 #d1478c #7a8b3a #b4632a #3b5b8c`

**Typography:** `Nunito` (Google Fonts), weights 400–900. Sizes range ~11px labels
→ 34px modal figures; read exact px per element off each file.

**Radius:** cards ~13–16px, modals ~18px, chips/pills fully rounded, buttons/
inputs ~9–10px.
**Shadows:** resting card `0 1px 2–3px rgba(20,30,50,.05)`; hover
`0 4px 16px rgba(20,30,50,.10)`; modal `0 24px 70px rgba(15,22,38,.32)`.
**Card left-accent stripe:** 4px colored `border-left` on stat cards.

---

## Components & pages

Three of these are full pages; the rest are components. Each file's `data-props`
block (documented in `HOW_TO_READ_DC.md`) lists its props with types and defaults.

### Pages
- **DashboardPage** — top-level dashboard. Page bg `#eef0f3`, `min-width:1200px`,
  centered `max-width:1440px`. Layout: 5-column `StatCard` row → 3-column middle
  row (`PeriodSummaryCard` · `PieChart` · a "Tentative & upcoming" card wrapping
  `PeriodicList`) → bottom row (`MovementListV1` · `BarChart`, 1fr / 2.1fr). Stat
  cards are account-level totals; clicking one opens a per-envelope modal.
- **SearchResultsPage** — search/filter results view (results list + summary).
- **ComponentGallery** — an index page showcasing every component; useful as a
  visual checklist of what to build, not a shipped screen.

### Cards & summaries
- **StatCard** — the workhorse metric card. Props: `type`
  (`simple`|`calculated`|`collapsible`), `title`, `modalTitle`, `accent`, `icon`,
  `sublabel`, `valueCents`, `signed`, `neutralValue`, `footnote`, `rows`.
  `calculated` opens a breakdown modal on click; `collapsible` expands inline.
  Left-accent stripe tinted from `accent`.
- **BasicSummaryCard** — read-only summary of an arbitrary movement selection (a
  tag, category, or text search). Prop: `variant`. Backed by
  `getFilterSummary(filter).aggregate.summary` — note: NOT a money pool (no
  budget/transfers/ending balance).
- **PeriodSummaryCard** — an envelope's (or the account's) period rollup. Prop:
  `view` (`single` envelope vs `multi`-envelope table). This IS a money pool:
  budget, transfers, ending balance, etc.

### Movements (transactions)
- **MovementListV1** / **MovementListV2** — two list treatments (compact vs
  richer rows). Read off both and pick per the app's density needs.
- **MovementDetail** — full detail of one movement. Prop: `movementId`. Shows
  envelope split map, category, tags, notes, tentative/anomalous flags.

### Periodic (recurring)
- **PeriodicList** — list of recurring movements; on the dashboard filtered to
  tentative/upcoming. Prop: `periodicId` (highlight).
- **PeriodicDetail** — one periodic movement with a 12-month status calendar
  (`received`/`tentative`/`cancelled`/`pending`/`early`). Prop: `periodicId`.
- **PeriodicForm** — create/edit form. Prop: `mode`.

### Compound (grouped movements)
- **CompoundDetail** — a group (e.g. "Japan trip") with an indigo header band and
  its child movements. Prop: `compoundId`.
- **CompoundForm** — create/edit a compound group.

### Charts (thin renderers over `finance-lib.js`)
- **PieChart** — a VAR split into slices by a GROUP (donut geometry via
  `donutSlices`). Prop: `useFilters`.
- **BarChart** — a VAR, stack-partitioned by a DIVIDER, one bar per TIMEFRAME
  instance (`barData`). Prop: `useFilters`.
- **LineChart** — a VAR over a TIMEFRAME, no divider (`lineData`). Prop:
  `useFilters`.
  Each chart has a selector UI (VAR / GROUP-or-DIVIDER / TIMEFRAME). `useFilters`
  toggles between the parent selection and the chart's own filtered query.

### Navigation, filters, selectors
- **NavbarV1** / **NavbarV2** — two top-nav treatments. V2 has inline
  account/period selectors that dim when "Other Filters" are active. Includes a
  "show anomalies" toggle.
- **FiltersModal** — the full filter builder (date range, envelopes, categories,
  tags, amount, flags).
- **MultiEntitySelector** — reusable multi-select dropdown. Props: `entity`
  (envelopes/categories/tags/…), `allowAll`, `hideLabel`, `hideNote`, `label`.

### Primitives
- **TagChip** — pill for a tag. Props: `label`, `color`, `emoji`, `removable`,
  `onRemove`.

---

## Interactions & behavior
Behavior is described in each file's logic block. Key patterns:
- **StatCard** `calculated`: click → modal (backdrop click / × closes;
  `stopPropagation` on the panel). `collapsible`: click → inline expand with a
  rotating chevron.
- **Charts:** selector controls re-aggregate live; `useFilters` swaps the source
  movement set.
- **Modals** (StatCard, FiltersModal, forms): `fcFade`/`fcPop` keyframe entrances,
  fixed full-screen backdrop `rgba(20,26,38,.34)` + `backdrop-filter:blur(2px)`.
- **Cards:** hover lift (`translateY(-1px)` + deeper shadow) on clickable cards.

## State management
Per-component local UI state (modal open, expanded, selector choices) as shown in
each logic block. App-level state (current account, selected period, active
filters, "show anomalies") is shared — see NavbarV2/FiltersModal — and in the real
app comes from the `window.*` services listed in `finance-lib.js`. Model these as
Angular services/signals.

## Assets
No raster/vector assets — all UI is CSS. Icons are emoji (category emojis live in
`CATEGORIES` in `finance-lib.js`). Font: Nunito via Google Fonts.

## Files in this bundle
- `design_refs/*.dc.html` — 22 component/page design references
- `design_refs/finance-lib.js` — data layer, API contract, formatters, chart logic
- `HOW_TO_READ_DC.md` — how to read a `.dc.html` file
- `PROJECT_STATE.txt` — inventory + what to re-download later
