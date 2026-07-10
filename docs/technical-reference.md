# Financely — Technical Reference

Low-level companion to [functional-overview.md](./functional-overview.md): data flow, schema, and the
non-obvious algorithms. Read the overview first for the *why*; this is the *how*.

## Architecture & data flow

Three mini-projects: `angular/` (renderer), `electron/` (main), `shared/` (types + IPC contract).

```
Angular component → ElectronService (RxJS) → window.* (contextBridge) →
ipcRenderer.invoke → ipcMain.handle → handler → service → repository → SQLite (better-sqlite3, sync)
```

- **Wire types vs domain classes:** `shared/types.ts` holds flat DTOs (`MovementT`, …) that cross IPC
  by structured clone. `shared/domain.ts` holds classes with behavior (`Movement`, `Period`, …), each
  with `static from(dto)`. **Handlers are the only conversion boundary** — they map T→class on the way
  in; services never see wire types for entities; structured clone serializes classes back out.
- **Errors:** services throw `AppError(AppErrorCode.X)` (message === code, survives IPC); `ipcHandle`
  normalizes SQLite errors; the renderer's `ErrorTextService` resolves codes to text (i18n seam).
- **Money/date:** integer cents; dates stored as ISO `YYYY-MM-DD` text, converted Date↔ISO in the
  repository (TZ-stable via local components). Month comparisons use `strftime('%m')−1` (0-indexed).

## Schema (tables → key columns)

- `accounts(id, name UNIQUE, description, is_default, starting_balance)`
- `envelopes(id, name UNIQUE, account_id→accounts CASCADE, is_default, starting_balance, budget_cents, max_savings_cents, overflows_to→envelopes SET NULL)`
- `categories(id, name UNIQUE, color, emoji, envelope_id→envelopes SET NULL, is_default)`
- `movements(id, account_id, name, concept, quantity_cents, isPositive, date, category_id, additional_notes, template_id→periodic SET NULL, is_tentative, is_anomalous, parent_id→compound SET NULL)`
- `movement_envelope(movement_id→movements CASCADE, envelope_id, amount_cents>0, PK(movement,envelope))` — **the split allocation**; every movement has ≥1 row summing to `quantity_cents`.
- `tags(id, type, name, color, UNIQUE(type,name))`, `movement_tags(movement_id, tag_id)`
- `compound_movements(id, account_id CASCADE, name, is_cancelable, owner_year, owner_month, is_anomalous, notes)`
- `periodic_movements(id, account_id CASCADE, name UNIQUE, quantity_cents, isPositive, day_of_month 1-31, category_id, active, start_year/month, last_created_year/month)` + `periodic_movement_envelope` (default split) + `periodic_movement_tags`
- `transfers(id, from_envelope_id, to_envelope_id, account_id, quantity_cents>0, date, is_auto, notes)`
- `period_summaries(account_id, envelope_id, year, month, …aggregates…, ending_balance_cents, net_transfers_cents, budget_cents, max_savings_cents, notes, dirty_state, tentative, + without_anom_* (7), + compound_adj_* (7), + compound_adj_wo_anom_* (7))`

Partial unique indexes enforce single defaults (`uq_account_default` global, `uq_envelope_default` per
account, `uq_category_default` global). Migrations: a `meta.schema_version` + ordered `if (current < N)`
blocks applied at startup (`ensureSchema`, non-destructive).

## Period summary engine

Identity: `(accountId, envelopeId|null, year, month)`. Stored, not derived. Four stat views live in one
row: base (all-inclusive), `withoutAnomalies`, `compoundAdjusted`, `compoundAdjustedWithoutAnomalies`
(each `null` when it would equal the base). Only the **base** feeds balances.

**Ending-balance chain:** `ending(P) = ending(P−1) + cashFlow(P) + netTransfers(P)`; the first period
anchors on the envelope's (or account's) `startingBalance`.

**Dirty-state machine** (`CLEAN | MODIFIED | DIRTY`):
- `MODIFIED` = aggregates need recompute from movements; `DIRTY` = aggregates fine, only ending-balance
  needs re-chaining from a dirtied predecessor.
- A mutation marks its period `MODIFIED` and every later period of the same envelope `DIRTY`.
- On read, `getByPeriod` cleans lazily: recurse to the previous period first, recompute a `MODIFIED`
  period's aggregates, then re-chain a `DIRTY` period's ending balance. Empty periods self-delete.

**Snapshots:** `budget/maxSavings` are copied onto the summary at creation and frozen on recompute;
editing an envelope re-stamps the current month only.

## Split allocations

A movement's envelopes live in `movement_envelope` as `{envelopeId → amountCents}` (`envelopeIdMap` in
memory). Invariant `sum(amounts) == quantity_cents` (enforced in service). A split movement therefore
belongs to **several** envelope-periods — `Movement.getPeriods()` returns one per allocation, and each is
touched on mutation.

## Overflow redirect

On income into a capped envelope: `threshold = maxSavings + (budget ?? 0)`;
`excess = endingBalance(period) − threshold`. If `excess > 0`, auto-create a transfer of `excess` from
the envelope to `overflowsTo` (or the account default), flagged `isAuto`, dated the 1st of the month.
Uses the period's frozen snapshot, not live envelope values. Fired only for confirmed income; transfers
never trigger it (no cascade). Not reversed when the source income later shrinks.

## Periodic generation

Cursor = `(lastCreatedYear, lastCreatedMonth)` (null ⇒ nothing generated). `generateDueForAll` (startup)
walks each active template from `cursor+1` (or the start anchor) forward while `≤ current month`,
generating one instance per month; the current month is skipped until `now ≥ expectedDate`. Instances
are **tentative**, route through `movementService.create` (so summaries/overflow apply), and copy the
template's tags. `expectedDate(y,m)` clamps `dayOfMonth` to the month length. Reactivation sets the
cursor to now (no back-fill). Early/additional instantiation is **confirmed** and rejects future dates.

**Reconcile-first guard:** `create`/`confirm` of a *confirmed* movement asserts the account's previous
month holds no tentative (`hasTentativeInAccountMonth`), else `MOVEMENT_PREVIOUS_MONTH_TENTATIVE`.

## Compound re-attribution

Invariant **D1**: a compound never touches balances/`netTransfers`/overflow — only the two
`compound_adj_*` stat mirrors. `computeCompoundAdjusted(period, rawMovements)` → `{adjusted,
adjustedWithoutAnomalies} | null`:
- `reattributesAtLevel(c, envelopeId) = c.hasOwnerMonth() && (envelopeId == null || c.isCancelable)` —
  at account level both grouping and cancelable re-attribute; at envelope level only cancelable (a
  grouping's children keep counting in their real envelope, D4).
- `getOwnedInPeriod(acct,y,m)` finds compounds anchored here; inject their children — a cancelable set
  as **one net** contribution (skipped if net 0), a grouping as **each child individually** (`amount =
  full at account level, envelope share otherwise`).
- Children physically in this period whose compound re-attributes are **removed** from the raw set.
- Computed twice (with/without anomalous); returns `null` when equal to the raw aggregates.

**Cross-period propagation:** owner-month stats depend on children in other months, so any child
mutation (`movement.service` update/delete → `touchCompoundOwner`) or membership/attribute change
(`compound.service` → `refreshCompoundStats`) re-marks the owner periods `MODIFIED` (stats-only).

## Import / export (CSV)

Columns: `name, concept, quantity, date, account, category, envelope, tags, notes, anomalous, template,
group`. `quantity` = signed decimal (comma or dot). `date` = `YYYY-MM-DD` or `YYYY-MM` (→ day 01).
Envelope split = `Food:12.50|Fun:3.00`. Tags = `type/name` items joined by `|` (backslash-escapes
`| : /`). `account` is written on export, ignored on import (imports go to the chosen account).

- **`previewImport`** is pure (persists nothing) → `{drafts, issues}`. Informational issues
  (category/envelope fallback, tag-will-create, template/group unresolved) keep the row; blocking issues
  (missing name/concept, bad amount/date, split-sum mismatch) drop it.
- **`commitImport`** is one transaction reusing `movementService.create`; all-or-nothing; refused if the
  account has tentatives.
- **Backup** uses better-sqlite3's online backup API; **restore** validates then ATTACH-copies in place
  (not a file swap); a non-Financely DB is rejected (`RESTORE_INVALID_FILE`).

## Key invariants

- `sum(movement_envelope.amount) == movement.quantity_cents`.
- `ending(P) = ending(P−1) + cashFlow(P) + netTransfers(P)`; balances identical with/without any
  compound or anomaly flag (D1).
- One default per scope (partial unique indexes). Compound: ≥2 members, one account, cancelable ⇒ one
  envelope, `ownerMonth` ∈ member months or null.
- Transfers net to zero across an account (internal), so they never affect cash flow — only per-envelope balance.
