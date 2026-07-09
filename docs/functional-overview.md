# Financely — Functional Overview

A local, single-user desktop budgeting app (Angular + Electron + SQLite). One `.sqlite` file per
install; no network. This document is the high-level map of **what exists, what its rules are, and
what happens automatically vs. by hand**. For internals see [technical-reference.md](./technical-reference.md).

## Core conventions

- **Money:** integer cents everywhere. Never floats.
- **Month-oriented:** a movement has an exact date, but aggregation is by **month**. The date is
  mostly ordering/metadata; the "period" is `(account, envelope, year, month)`.
- **Real vs. statistical:** balances and cash flow always reflect *real* money. Anomaly and compound
  features only re-slice the *displayed statistics* — they never move money.
- **Defaults:** every account has one non-deletable default envelope; there is one default category
  and one default account. Deleting an entity reassigns or cascades rather than orphaning.

---

## Entities & features

### Account
The top-level money pool; owns envelopes (and, through them, movements).
- **Rules:** unique name; exactly one default account; a `startingBalance`; can't delete the default.
- **Automatic:** creating an account auto-creates its non-deletable default envelope. Deleting an
  account cascades → envelopes → movements → allocations/tags.
- **Manual:** CRUD, `setDefault`, view aggregate stats (`getStats`: totals, balance, envelope count,
  with an anomaly-excluded income/expense variant).

### Envelope
A named bucket inside an account ("Food", "Savings"). Every movement lives in ≥1 envelope.
- **Fields:** `startingBalance`, optional `budgetCents` (monthly spending cap), optional
  `maxSavingsCents` (savings cap), optional `overflowsTo` (redirect target).
- **Rules:** unique name; one default per account; can't delete/update the default. Deleting a
  non-default envelope reassigns its movements to the account default (in a transaction).
- **Automatic — overflow redirect:** when income lands and the envelope's running balance exceeds
  `maxSavings + budget`, the surplus is auto-transferred to `overflowsTo` (or the account default).
  Triggered by income create/confirm and upward income edits. No cascade (the target isn't re-checked).
- **Manual:** CRUD, `setDefault`, set caps/budget/overflow.

### Category
Mandatory "what kind" label on a movement ("Groceries", "Rent"). Flat (no subcategories yet).
- **Fields:** `color`, `emoji`, optional link to an envelope, `isDefault`.
- **Rules:** unique name; one global default; deleting a non-default reassigns its movements to the
  default. Can't delete the default or the last default.
- **Manual only.** No automatic categorization (rules engine deferred).

### Tag
Optional free "context" label ("Japan trip"), orthogonal to category; many per movement.
- **Rules:** `UNIQUE(type, name)`. N:M with movements.
- **Automatic:** unknown tags are auto-created during import.
- **Manual:** CRUD, attach/detach, filter/aggregate by tag.

### Movement
The atomic income/expense record.
- **Fields:** name, bank `concept`, `quantityCents`, `isPositive`, date, category, notes, plus
  `envelopeIdMap` (per-envelope split), `templateId` (periodic origin), `isTentative`, `isAnomalous`,
  `parentId` (compound).
- **Split:** a movement can be split across several envelopes; the allocations must sum to its amount.
  A normal movement is a single-entry split.
- **Anomalous:** a user flag ("bought a car") that excludes it from "without anomalies" statistics —
  never from balances.
- **Automatic:** every create/update/delete keeps the affected period summaries current (see below).
- **Manual:** CRUD, bulk delete, name autocomplete, rich filtering (date/amount/text/tags/category/
  envelope/sign), mark anomalous, confirm (if tentative).

### Transfer
A first-class envelope→envelope move within one account.
- **Rules:** same account, distinct envelopes, positive amount. Moves no real cash — affects each
  envelope's running balance (`netTransfers`) but never income/expense/cash-flow.
- **Automatic:** the overflow redirect creates transfers flagged `isAuto`.
- **Manual:** create/delete manual transfers.

### Periodic movement (recurring template)
A blueprint that generates real movements over time. Not itself a movement.
- **Fields:** amount, sign, `dayOfMonth`, category, `envelopeIdMap` (default split), tags, `active`,
  a start anchor, and a generation cursor.
- **Automatic — generation:** on app startup, every active template generates the **tentative**
  instances it's overdue for (each past month, plus the current month once its day has arrived; never
  future). Idempotent via the cursor. `dayOfMonth` is clamped to the month's length. Tags are copied
  onto each instance.
- **Manual:** CRUD; pause/reactivate (reactivating snaps the cursor to now — the dormant gap is not
  back-filled); "instantiate this month early" and "add an extra instance" (both born **confirmed**).
  Can't delete a template that still has generated instances.

### Tentative / confirmed
Generated instances are born **tentative** (provisional, unreviewed); manual movements are confirmed.
- **Rule (reconcile-first):** a *confirmed* movement can't be created in a month while the account's
  **previous** month still holds any tentative — you must review last month first.
- **Manual — confirm:** clears the flag; overflow redirect (deferred while tentative) fires on confirm.
- Tentative amounts still count in balances; a period is flagged `tentative` for display only.

### Compound movement
A lightweight grouping of existing movements (they keep their `parentId`). **Never moves money** —
it only re-attributes the group's *statistics* into one owner month.
- **Two shapes:** *grouping* (a trip — children stay individually canonical) and *cancelable* (a
  dinner repaid by Bizums — the group's **net** is treated as one movement; requires one shared envelope).
- **Owner month:** where the group's stats collapse to. Defaults to the earliest member's month;
  user-overridable to any member month, or `null` (no re-attribution).
- **Anomaly inheritance:** an anomalous compound forces all children anomalous; a child can't opt out
  while the parent is anomalous.
- **Rules:** ≥2 members, all same account; members can't be split/periodic/tentative/already-grouped.
- **Automatic:** dropping below 2 members auto-dissolves the compound (survivor un-parented). Any
  membership/attribute change refreshes the affected periods' compound-adjusted statistics.
- **Manual:** create (from existing and/or on-the-spot movements), add/remove members, edit, delete
  (with or without deleting members).

### Period summary (the aggregation engine)
A stored monthly snapshot per `(account, envelope, year, month)`: totals, averages, count, cash flow,
`endingBalance`, `netTransfers`, budget/savings snapshots, notes, plus three alternate stat views
(without-anomalies, compound-adjusted, compound-adjusted-without-anomalies).
- **Ending-balance chain:** `ending(P) = ending(P−1) + cashFlow(P) + netTransfers(P)`, anchored on the
  first period's starting balance.
- **Automatic:** created on first activity in a period, updated on movement/transfer changes, deleted
  when a period's last movement and transfer are gone. Past-period edits mark later periods dirty; the
  chain recomputes lazily on read. Budget/savings caps are **snapshotted** per month (past months stay
  frozen; editing an envelope re-stamps the current month).
- **Manual:** edit the `notes` field (the only user-editable field).

### Filter summary
On-the-fly `BasicSummary` for an **arbitrary** movement filter over a month-range — computed, never
stored (used when the selection isn't a clean whole-envelope-month). Carries no balance/budget fields.

### Import / Export / Backup
- **Import (CSV, own format):** create-only, all-or-nothing, with a read-only **preview** first.
  Unmatched category → *Uncategorized*, unmatched envelope → *Unassigned* (both flagged); unknown tags
  auto-created; rows with bad amount/date/name or split-sum mismatch are excluded and reported.
  Refused if the target account has tentatives. *(Bank-CSV column mapping and dedup are not built.)*
- **Export (CSV):** reuses the current movement filter; UTF-8 BOM; refused if any selected movement is
  tentative.
- **Backup / restore:** whole-database, all-or-nothing; restore validates the file first and rejects a
  non-Financely DB.

### Settings
`useDefaultDate` / `defaultDate`, color palette, category-icon list. Stored via electron-store (not SQLite).

---

## What happens automatically (triggers → effect)

| Trigger | Automatic effect |
|---|---|
| Create account | Default envelope created |
| Movement create/update/delete | Affected period summary created/updated/deleted; later periods marked dirty |
| Read a dirty period | Ending-balance chain recomputed lazily |
| Income create / confirm / raised | Over-cap surplus auto-transferred to overflow target |
| App startup | Overdue periodic instances generated (tentative) |
| Confirm a tentative | Flag cleared; deferred overflow applied |
| Envelope budget/cap edited | Current-month summary snapshot re-stamped |
| Compound drops below 2 members | Auto-dissolves |
| Anomalous compound | All children forced anomalous |
| Import unknown tag | Tag auto-created |

Everything else — categorizing, assigning envelopes, confirming, creating compounds/transfers/
templates, marking anomalies, importing/exporting — is **manual**.

---

## Known issues

- **Summary-less movements throw on edit/delete:** single `update`/`delete` mark the period dirty
  unconditionally, so a movement whose period has no summary (seed/legacy data) throws. `deleteMany`
  guards; the single paths don't.
- **Cross-period edits leave the old period stale:** editing a movement's date/envelope dirties only
  the new period, not the one it left.
- **Auto-overflow is one-way:** lowering or deleting the income that caused an auto-transfer does not
  reverse it — the surplus stays moved.
- **Reconcile-first guard is local:** it only checks the immediately previous month, so a tentative
  with an empty/confirmed month after it doesn't block later confirmed entry.
- **Account-level summaries aren't auto-maintained:** only envelope-level periods are created from
  activity (account-level rollups exist in the model but nothing triggers them).
- **Minor:** envelope snapshot re-stamp touches only the current month (not future existing months);
  `getAvailableBudget` returns 0 for an unbudgeted envelope; the movement create path (movement +
  summary + overflow) isn't a single transaction; the import file picker opens before the tentative
  guard; `computeCompoundAdjusted` is N+1-ish (fine at current scale).

---

## Deferred (decided-but-not-built)

- **Rules engine** — auto-categorization/assignment, tentative inbox from rules, preview, priority,
  rule-from-movement. (The tentative/confirm plumbing already exists.)
- **Bank-CSV import** — column mapping, duplicate detection, reconciliation, per-bank profiles, drag-drop.
- **Visualizations** — treemap, Sankey, balance line, heatmap, stacked bars, waterfall (Plotly). *This
  and the general frontend consolidation are the current next step.*
- **Statistics/forecast** — auto-anomaly detection (>2σ), end-of-month forecast, savings goals, budget alerts.
- **Envelope extras** — notional vs. real balance, exclude-envelope-from-total, month-close snapshots/rollover.
- **Data/model** — audit log / soft delete, subcategories (`parent_id`), possible category↔tag unification.
- **Bulk "edit this month's movements by day only".**
