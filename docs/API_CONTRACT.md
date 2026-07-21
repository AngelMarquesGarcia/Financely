# Financely — IPC API Contract

This document is the exhaustive, frontend-facing contract for every method the Electron main
process exposes to the Angular renderer. It exists so the frontend work that's about to start can
be planned against a precise picture of what the backend actually offers today — every method,
its parameters, its return value, when to call it, and every error it can throw.

For the *why* behind these entities and rules, read [functional-overview.md](./functional-overview.md)
first. For internal algorithms (dirty-state machine, compound re-attribution, periodic generation),
read [technical-reference.md](./technical-reference.md). This document only covers the **wire
contract** — what crosses the IPC boundary.

## How to read this document

- Each method is documented as it is called from the renderer: `window.<surface>.<method>(...)`.
  Every call returns a `Promise` (it's `ipcRenderer.invoke` underneath), even where the table below
  just shows the resolved type for brevity.
- **Source of truth locations:** channel names in
  [`electron/ipc/channels.ts`](../electron/ipc/channels.ts), renderer-facing signatures in
  [`electron/preload.ts`](../electron/preload.ts), the documented interfaces in
  [`shared/interfaces.ts`](../shared/interfaces.ts), wire DTOs in
  [`shared/types.ts`](../shared/types.ts), error codes in
  [`shared/error-codes.ts`](../shared/error-codes.ts).
- **Money:** every `*Cents` field is an integer number of cents. Never floats.
- **Dates:** `Date` objects cross the IPC boundary as real JS `Date` instances (structured clone
  supports `Date` and `Map` natively — the preload layer passes them through untouched). Always
  send actual `Date`/`Map` objects, not ISO strings or plain objects, or validation will reject them
  (`*_DATE_INVALID`, `*_ENVELOPE_REQUIRED`, etc., since a plain object fails `instanceof Map` checks).
- **Month indexing:** `month` fields are **0-indexed** (`Date.getMonth()` convention, 0 = January).
  Add 1 when displaying.
- **`envelopeIdMap` / split allocations:** a real `Map<number, number>` of `envelopeId → amountCents`.
  A non-split movement still uses a one-entry map. Entries must be positive integers and sum exactly
  to the movement's `quantityCents`.

## Error handling contract

Every handler is wrapped in `ipcHandle` ([`electron/ipc/ipc-utils.ts`](../electron/ipc/ipc-utils.ts)):

- Services throw `new AppError(AppErrorCode.X)` — the error's `message` **is** the code string, so
  it survives serialization across IPC intact. On the renderer, a rejected promise's `.message` is
  one of the `AppErrorCode` values below (see [`shared/error-codes.ts`](../shared/error-codes.ts)).
- A raw `better-sqlite3` constraint failure (`UNIQUE`/`SQLITE_CONSTRAINT` in the message, e.g. a
  duplicate `name` the service itself didn't pre-check, or a foreign key pointing at a row that
  doesn't exist) is normalized to `CONSTRAINT_VIOLATION`.
  everything else uncaught becomes `UNKNOWN`.
- The frontend's `ErrorTextService` maps every `AppErrorCode` to human-readable text (i18n seam) —
  new backend error codes must be added there too.
- Below, each method's **Errors** list is only the codes explicitly thrown by that call path; a
  malformed/nonexistent foreign key that isn't explicitly validated will surface as
  `CONSTRAINT_VIOLATION` instead (noted inline where relevant).

## Table of contents

1. [Movements](#movements-windowmovements)
2. [Periodic movements](#periodic-movements-windowperiodicmovements)
3. [Transfers](#transfers-windowtransfers)
4. [Compound movements](#compound-movements-windowcompoundmovements)
5. [Categories](#categories-windowcategories)
6. [Accounts](#accounts-windowaccounts)
7. [Envelopes](#envelopes-windowenvelopes)
8. [Tags](#tags-windowtags)
9. [Settings](#settings-windowsettings)
10. [Period summaries](#period-summaries-windowperiodsummaries)
11. [Import / Export](#import--export-windowimportexport)
12. [Database](#database-windowdatabase)

---

## Movements (`window.movements`)

The atomic income/expense record. See [`MovementT`](../shared/types.ts).

### `create(name, concept, quantityCents, isPositive, date, categoryId, envelopeIdMap, additionalNotes, isAnomalous)`
`movement:create`

- **What it does:** Creates a movement (manual, confirmed, non-periodic, non-compound). Validates
  the split, resolves the movement's account to the app's default account (there is no `accountId`
  parameter on this call — every manually-created movement goes to the default account), creates or
  dirties every affected envelope-period, and — for confirmed income — fires the overflow-redirect
  check on each affected period.
- **Returns:** `Promise<number | bigint>` — the new movement's id.
- **Use when:** Any manual movement entry (income or expense) from a form.
- **Errors:**
  - `MOVEMENT_NAME_REQUIRED` — blank/whitespace name.
  - `MOVEMENT_AMOUNT_INVALID` — `quantityCents` not a positive integer.
  - `MOVEMENT_DATE_INVALID` — `date` isn't a valid `Date`.
  - `MOVEMENT_CATEGORY_REQUIRED` — `categoryId` not a positive integer.
  - `MOVEMENT_ENVELOPE_REQUIRED` — `envelopeIdMap` is empty or not a `Map`.
  - `MOVEMENT_SPLIT_ENVELOPE_INVALID` — a map key isn't a positive integer.
  - `MOVEMENT_SPLIT_AMOUNT_INVALID` — a map value isn't a positive integer.
  - `MOVEMENT_SPLIT_SUM_MISMATCH` — allocations don't sum to `quantityCents`.
  - `MOVEMENT_PREVIOUS_MONTH_TENTATIVE` — the default account's previous month still has an
    unreviewed tentative movement (reconcile-first guard; this call is always "confirmed" — there is
    no way to create a tentative movement through this channel, only via periodic generation/import).
  - `CONSTRAINT_VIOLATION` — `categoryId`/envelope ids don't reference existing rows (FK failure;
    not pre-validated here, unlike the periodic-template path).
- **Notes:** There is no way to target a non-default account or create a split/anomalous *tentative*
  movement through this call — those paths (periodic instantiation, import, compound children) go
  through `MovementService.create`'s extra internal parameters, which aren't exposed over this channel.

### `getAll(filter?)`
`movement:getAll`

- **What it does:** Lists movements, optionally filtered.
- **Parameters:** `filter?: MovementFilter` — `accountId`, `date: {from?, to?}` (ISO strings),
  `amount: {from?, to?}` (cents), `text: {query, condition: 'contains'|'startsWith'|'endsWith'|'exact', field: 'name'|'concept'|'notes'|'all'}`,
  `tags: {ids, matchAll}`, `categoryId`, `envelopeId`, `isPositive`. Omit for all movements.
  **Do not set** `includeAnomalies` — it's stamped by the backend on computed summaries, not a query
  filter; it's part of the shared type only as a cache-key label.
- **Returns:** `Promise<MovementT[]>`.
- **Use when:** Any movement list/table view, with or without the filter panel active.
- **Errors:** none thrown directly (an invalid filter shape is simply ignored/produces no matches at
  the SQL layer).

### `getById(id)`
`movement:getById`

- **Returns:** `Promise<MovementT | undefined>` — `undefined` if not found (no throw).
- **Use when:** Loading a single movement for a detail view or edit form.

### `update(movement)`
`movement:update`

- **What it does:** Full-object update. Re-validates name/amount/date/split. If the movement is a
  compound child, re-checks it still satisfies membership invariants (can't opt out of an anomalous
  parent, can't become split, can't change envelope under a cancelable compound). Recomputes every
  period the movement's old *and* new split touch; re-chains later balances only if amount, sign,
  month, or split actually changed (a metadata-only edit — category, notes, anomalous flag — refreshes
  the period's mirror without re-chaining). Re-checks overflow redirect if the stored movement is
  confirmed positive income. Refreshes the parent compound's owner-month stats if parented.
- **⚠️ Known discrepancy:** the handler ([`electron/ipc/movements.handler.ts`](../electron/ipc/movements.handler.ts))
  calls `movementService.update(...)` as a statement, **discarding the returned boolean** — the IPC
  call always resolves to `undefined`, not the `boolean` the `Movements` interface declares. Do not
  branch on this call's resolved value; refetch (`getById`/`getAll`) to confirm the write.
- **Errors:**
  - `MOVEMENT_NAME_REQUIRED`, `MOVEMENT_AMOUNT_INVALID`, `MOVEMENT_DATE_INVALID`,
    `MOVEMENT_ENVELOPE_REQUIRED`, `MOVEMENT_SPLIT_ENVELOPE_INVALID`, `MOVEMENT_SPLIT_AMOUNT_INVALID`,
    `MOVEMENT_SPLIT_SUM_MISMATCH` — same validation as `create`.
  - `COMPOUND_ANOMALY_CHILD_CONFLICT` — tried to un-flag `isAnomalous` while the parent compound is anomalous.
  - `COMPOUND_CHILD_SPLIT` — tried to turn a compound child into a multi-envelope split.
  - `COMPOUND_CANCELABLE_MULTI_ENVELOPE` — tried to change a cancelable-compound child's envelope.
- **Known issue (see functional-overview):** if the movement's *stored* period has no summary row
  (seed/legacy data), the dirty-mark call throws — this path isn't guarded like `deleteMany` is.

### `delete(id)`
`movement:delete`

- **What it does:** Deletes the movement. Marks its (still-existing) periods dirty. If it was a
  compound child, dissolves the compound if membership drops below 2, and refreshes owner-month stats.
- **Returns:** `Promise<boolean>`.
- **Errors:** `MOVEMENT_NOT_FOUND`.

### `deleteMany(ids)`
`movement:deleteMany`

- **What it does:** Atomic bulk delete (single transaction). Guards missing summaries (unlike the
  single-`delete` path). Handles compound dissolution/owner-refresh for every affected parent.
- **Returns:** `Promise<number>` — rows actually removed.
- **Use when:** Multi-select delete from a movements list.
- **Errors:** `MOVEMENT_ID_INVALID` — `ids` isn't an array of positive integers.

### `confirm(id)`
`movement:confirm`

- **What it does:** Clears `isTentative` on a generated periodic instance the user has reviewed.
  Re-checks the reconcile-first guard (previous month must not still hold a tentative). Refreshes
  only the period's `tentative` display flag (no aggregate recompute). If the movement is income,
  fires the previously-deferred overflow redirect now that it's confirmed.
- **Returns:** `Promise<boolean>`.
- **Use when:** User approves a row in the "review tentative movements" inbox/list.
- **Errors:**
  - `MOVEMENT_NOT_FOUND`.
  - `MOVEMENT_NOT_TENTATIVE` — already confirmed.
  - `MOVEMENT_PREVIOUS_MONTH_TENTATIVE`.

### `suggestNames(prefix, limit?)`
`movement:suggestNames`

- **Returns:** `Promise<string[]>` — distinct movement names matching `prefix`, alphabetical,
  capped at `limit` (repository default applies if omitted).
- **Use when:** Autocomplete on the movement name field.

### `getFilterSummary(filter)`
`movement:getFilterSummary`

- **What it does:** Computes an on-the-fly `BasicSummary` (cash flow, totals, averages, count) for an
  **arbitrary** filter over a month-granular interval derived from `filter.date` (defaults to the
  current month). Never stored — recomputed every call. Unlike `PeriodSummaryT` it carries no
  balance/budget/transfer fields, since a filter slice (e.g. "movements tagged Japan trip") isn't
  necessarily a whole envelope-month.
- **Parameters:** `filter: MovementFilter` (same shape as `getAll`'s filter).
- **Returns:** `Promise<FilterSummaryT>` — `{ filters, aggregate: FilterSummaryEntry, children: FilterSummaryEntry[] }`,
  where `aggregate` covers the whole interval and `children` is one entry per month, chronological.
  Each `FilterSummaryEntry` is `{ summary, summaryWithoutAnomalies: BasicSummary | null, tentative: boolean }`.
- **Use when:** Any ad-hoc slice that isn't a clean whole-envelope-month — tag views, category
  breakdowns, cross-account filters, the movements-list filter panel's summary strip.

---

## Periodic movements (`window.periodicMovements`)

Recurring-movement templates. See [`PeriodicMovementT`](../shared/types.ts).

### `create(template, tagIds)`
`periodic:create`

- **What it does:** Creates a template. Validates name/amount/day-of-month/references, rejects a
  duplicate name. `id`, `active` (forced `true`), `startYear`/`startMonth` (now), and the generation
  cursor (`null`) are backend-managed — omit them from `template`.
- **Parameters:** `template: Omit<PeriodicMovementT, 'id'|'active'|'lastCreatedYear'|'lastCreatedMonth'|'startYear'|'startMonth'>`, `tagIds: number[]`.
- **Returns:** `Promise<number | bigint>` — new template id.
- **Errors:**
  - `PERIODIC_NAME_REQUIRED` — blank name.
  - `PERIODIC_NAME_DUPLICATE` — another template already has this name.
  - `PERIODIC_AMOUNT_INVALID` — `quantityCents` not a positive integer.
  - `PERIODIC_DAY_INVALID` — `dayOfMonth` outside `[1, 31]`.
  - `PERIODIC_ACCOUNT_REQUIRED` — `accountId` invalid **or doesn't reference an existing account**
    (existence is actually checked here, unlike plain `movement:create`).
  - `PERIODIC_CATEGORY_REQUIRED` — same, for `categoryId`.
  - `PERIODIC_ENVELOPE_REQUIRED` — split empty, or an envelope id doesn't exist.
  - `MOVEMENT_SPLIT_AMOUNT_INVALID` / `MOVEMENT_SPLIT_SUM_MISMATCH` — split validation, same rules as movements.

### `getAll()`
`periodic:getAll` — `Promise<PeriodicMovementT[]>`.

### `getById(id)`
`periodic:getById` — `Promise<PeriodicMovementT | undefined>`.

### `getTagsForPeriodicMovement(id)`
`periodic:getTags` — `Promise<TagT[]>` — the template's default tag set (copied onto every generated instance).

### `update(template, tagIds)`
`periodic:update`

- **What it does:** Same validation as `create`, plus existence and duplicate-name-on-rename checks.
  Replaces the template's tag set with `tagIds`.
- **Returns:** `Promise<boolean>`.
- **Errors:** Same as `create`, plus `PERIODIC_NOT_FOUND` if `template.id` doesn't exist.

### `delete(id)`
`periodic:delete`

- **What it does:** Hard-deletes the template. Refuses if it has ever generated any instance — use
  `setActive(id, false)` to pause instead; history-preserving.
- **Returns:** `Promise<boolean>`.
- **Errors:** `PERIODIC_NOT_FOUND`, `PERIODIC_DELETE_HAS_INSTANCES`.

### `setActive(id, active)`
`periodic:setActive`

- **What it does:** Pauses/reactivates generation. Reactivating (`active: true`) **snaps the cursor
  to the current month** — the dormant gap is never back-filled.
- **Returns:** `Promise<boolean>`.
- **Errors:** `PERIODIC_NOT_FOUND`.

### `runDue()`
`periodic:runDue`

- **What it does:** Frontend-triggered catch-up: generates every overdue **tentative** instance
  across all active templates (past months in full; the current month only once `dayOfMonth` has
  arrived; future months never). Idempotent via each template's cursor. Normally invoked once on app
  startup, but is callable any time (e.g. a manual "refresh" action).
- **Returns:** `Promise<number>` — total instances created across all templates.
- **Errors:** none (a template with a bad reference would already have failed validation at create/update time).

### `instantiateCurrentMonthEarly(id, date?, amountCents?, envelopeIdMap?)`
`periodic:instantiateCurrentCurrent` *(channel: `periodic:instantiateCurrent`)*

- **What it does:** Creates this month's instance early, born **confirmed** (not tentative). If the
  cursor already covers the current month (i.e. it was already auto-generated), refuses — there's
  nothing left to create early.
- **Parameters:** `date` defaults to now; `amountCents` overrides the template default for this
  instance only; `envelopeIdMap` overrides the default split (**required** if you're also overriding
  `amountCents` on a multi-envelope template — see errors).
- **Returns:** `Promise<number | bigint>` — new movement id.
- **Errors:**
  - `PERIODIC_NOT_FOUND`.
  - `MOVEMENT_DATE_INVALID` — `date` not a valid `Date`.
  - `PERIODIC_DATE_FUTURE` — `date` is after now.
  - `PERIODIC_ALREADY_INSTANTIATED` — this month's instance already exists.
  - `MOVEMENT_SPLIT_SUM_MISMATCH` — `amountCents` given without `envelopeIdMap` on a template whose
    default split has more than one envelope (the backend can't auto-derive new per-envelope shares).
  - Plus any error `movement:create`'s underlying validation can raise (split/date/etc., via the
    resolved instance).

### `createAdditionalInstance(id, date, amountCents?, envelopeIdMap?)`
`periodic:createAdditional`

- **What it does:** Creates an *extra* confirmed instance for an arbitrary past/current date —
  does **not** advance the generation cursor, so it's safe to call repeatedly (e.g. "I paid the gym
  twice this month").
- **Returns:** `Promise<number | bigint>` — new movement id.
- **Errors:** `PERIODIC_NOT_FOUND`, `MOVEMENT_DATE_INVALID`, `PERIODIC_DATE_FUTURE`,
  `MOVEMENT_SPLIT_SUM_MISMATCH` (same multi-envelope caveat as above).

---

## Transfers (`window.transfers`)

Envelope→envelope internal moves. Never touch income/expense/cash-flow. See [`TransferT`](../shared/types.ts).

### `create(fromEnvelopeId, toEnvelopeId, quantityCents, date, notes?)`
`transfer:create`

- **What it does:** Creates a **manual** transfer (`isAuto` is always `false` on this channel — auto
  transfers only come from the overflow redirect, never from user action). Touches both envelopes'
  periods (one loses, one gains).
- **Returns:** `Promise<number | bigint>` — new transfer id.
- **Use when:** User manually moves money between envelopes of the same account (e.g. "move €50 from
  Food to Savings").
- **Errors:**
  - `TRANSFER_SAME_ENVELOPE` — source and destination are the same envelope.
  - `TRANSFER_AMOUNT_INVALID` — `quantityCents` not a positive integer.
  - `TRANSFER_DATE_INVALID` — `date` not a valid `Date`.
  - `ENVELOPE_NOT_FOUND` — either envelope id doesn't exist.
  - `TRANSFER_CROSS_ACCOUNT` — the envelopes belong to different accounts.

### `getAll()`
`transfer:getAll` — `Promise<TransferT[]>` — every transfer (manual and auto).

### `getForEnvelope(envelopeId)`
`transfer:getForEnvelope` — `Promise<TransferT[]>` — transfers where this envelope is source or destination.

### `delete(id)`
`transfer:delete`

- **What it does:** Deletes the transfer, refreshes both periods' `netTransfers`.
- **Returns:** `Promise<boolean>`.
- **Errors:** `TRANSFER_NOT_FOUND`.
- **Note:** deleting a transfer created by the auto-overflow redirect does **not** reverse the
  original surplus movement — it's a one-way effect (see functional-overview known issues).

---

## Compound movements (`window.compoundMovements`)

Lightweight statistical grouping of existing movements — never moves money. Two shapes: *grouping*
(children stay individually canonical) and *cancelable* (the group's net counts as one movement).
See [`CompoundMovementT`](../shared/types.ts) and the design-decision record
[`CompoundMovement-spec.md`](./CompoundMovement-spec.md).

### `create(fields, existingChildIds, newChildren)`
`compound:create`

- **What it does:** Creates a compound from ≥2 children — any mix of existing movement ids and
  brand-new on-the-spot movements. All children are forced onto one account (the first existing
  child's account, or the app default if only new children are given). A cancelable compound
  additionally requires every child to share one envelope. Atomic (single transaction).
- **Parameters:**
  - `fields: NewCompoundFields` — `{ name, isCancelable, isAnomalous, notes, ownerYear?, ownerMonth? }`.
    Omit `ownerYear`/`ownerMonth` (`undefined`) to default the owner month to the earliest child's
    month; pass both as `null` for "no re-attribution"; pass both set to pin an explicit owner month
    (must equal one of the children's months).
  - `existingChildIds: number[]` — ids of pre-existing movements to fold in.
  - `newChildren: NewCompoundChild[]` — movements to create fresh as members (single-envelope only,
    non-tentative; see [`NewCompoundChild`](../shared/types.ts)).
- **Returns:** `Promise<number | bigint>` — new compound id.
- **Errors:**
  - `COMPOUND_NAME_REQUIRED`.
  - `COMPOUND_TOO_FEW_CHILDREN` — fewer than 2 children total.
  - `MOVEMENT_NOT_FOUND` — an `existingChildIds` entry doesn't exist.
  - `COMPOUND_CROSS_ACCOUNT` — an existing child isn't on the resolved account.
  - `COMPOUND_CHILD_SPLIT` — an existing (or new) child has more than one envelope.
  - `COMPOUND_CHILD_PERIODIC` — an existing child was generated from a periodic template.
  - `COMPOUND_CHILD_TENTATIVE` — an existing child is still tentative (confirm it first).
  - `COMPOUND_CHILD_ALREADY_PARENTED` — an existing child already belongs to another compound.
  - `COMPOUND_CANCELABLE_MULTI_ENVELOPE` — `isCancelable: true` but children don't share one envelope.
  - `COMPOUND_OWNER_MONTH_INVALID` — an explicit owner month/year isn't among the children's months
    (or only one of the pair is `null`).
  - `MOVEMENT_DATE_INVALID` — a `newChildren` entry has an invalid date.
  - Plus any `movement:create`-style validation error for each `newChildren` entry (name/amount/split/etc.).

### `getAll()`
`compound:getAll` — `Promise<CompoundMovementT[]>`.

### `getById(id)`
`compound:getById` — `Promise<CompoundMovementT | undefined>`.

### `getChildren(id)`
`compound:getChildren` — `Promise<MovementT[]>` — every member movement.

### `addMember(compoundId, movementId)`
`compound:addMember`

- **What it does:** Links an already-existing, unattached movement into the compound. Forces it
  anomalous if the compound is anomalous. Refreshes the compound's owner-month stats.
- **Returns:** `Promise<void>`.
- **Errors:** `COMPOUND_NOT_FOUND`, `MOVEMENT_NOT_FOUND`, plus the same eligibility errors as `create`
  (`COMPOUND_CROSS_ACCOUNT`, `COMPOUND_CHILD_SPLIT`, `COMPOUND_CHILD_PERIODIC`,
  `COMPOUND_CHILD_TENTATIVE`, `COMPOUND_CHILD_ALREADY_PARENTED`, and — if cancelable —
  `COMPOUND_CANCELABLE_MULTI_ENVELOPE` when the movement's envelope doesn't match the existing members'.

### `createMember(compoundId, child)`
`compound:createMember`

- **What it does:** Creates a brand-new movement directly as a compound member.
- **Returns:** `Promise<number | bigint>` — new movement id.
- **Errors:** `COMPOUND_NOT_FOUND`, `COMPOUND_CHILD_SPLIT`, `MOVEMENT_DATE_INVALID`,
  `COMPOUND_CANCELABLE_MULTI_ENVELOPE` (cancelable envelope mismatch), plus standard movement validation.

### `removeMember(compoundId, movementId)`
`compound:removeMember`

- **What it does:** Un-parents one member. If membership then drops below 2, the whole compound
  **auto-dissolves** (the lone survivor, if any, is also un-parented and keeps its own `isAnomalous`
  value). If the removed member was the owner-month anchor, re-anchors to the new earliest month.
- **Returns:** `Promise<void>`.
- **Errors:** `COMPOUND_NOT_FOUND`, `MOVEMENT_NOT_FOUND`, `COMPOUND_CHILD_NOT_MEMBER` (movement isn't
  actually a member of this compound).

### `update(compound)`
`compound:update`

- **What it does:** Updates `name`/`notes`/`isCancelable`/`isAnomalous`/owner month. `accountId` is
  immutable (silently kept at its stored value regardless of what's passed). Newly-anomalous forces
  all children anomalous. Refreshes both the (possibly changed) owner-month periods and children's periods.
- **Returns:** `Promise<boolean>`.
- **Errors:** `COMPOUND_NOT_FOUND`, `COMPOUND_NAME_REQUIRED`, `COMPOUND_CANCELABLE_MULTI_ENVELOPE`
  (turning `isCancelable` on when children don't share an envelope), `COMPOUND_OWNER_MONTH_INVALID`.

### `delete(id, deleteChildren)`
`compound:delete`

- **What it does:** Deletes the compound row. `deleteChildren: true` also deletes every member
  movement (through the normal movement-delete path); `false` leaves them as ordinary, un-parented
  movements (each keeping its own `isAnomalous` flag). Refreshes the former owner-month stats either way.
- **Returns:** `Promise<boolean>`.
- **Errors:** `COMPOUND_NOT_FOUND`.

---

## Categories (`window.categories`)

Mandatory "what kind" label. Flat (no subcategories). See [`CategoryT`](../shared/types.ts).

### `create(name, color?, emoji?, envelopeId?)`
`category:create` — `Promise<number | bigint>`.
- **Errors:** `CATEGORY_NAME_REQUIRED`.

### `getAll()`
`category:getAll` — `Promise<CategoryT[]>` (includes `movementCount` per category).

### `getById(id)`
`category:getById` — `Promise<CategoryT | undefined>`.

### `update(category)`
`category:update` — `Promise<boolean>`.
- **Errors:** `CATEGORY_NAME_REQUIRED`. (Unlike envelopes, updating the **default** category's
  fields — e.g. renaming "Uncategorized" — is allowed; only *deleting* it is blocked.)

### `delete(id)`
`category:delete`

- **What it does:** Reassigns every movement in this category to the default category, then deletes
  it (one transaction).
- **Returns:** `Promise<boolean>`.
- **Errors:** `CATEGORY_DELETE_DEFAULT` (this category is the default — can't delete it),
  `CATEGORY_NO_DEFAULT` (no default category exists to reassign into — should not occur in practice
  since one default is always seeded/enforced).

### `setDefault(id)`
`category:setDefault` — `Promise<void>`. Flips the single global default to `id` (partial unique index enforces exactly one).

---

## Accounts (`window.accounts`)

The top-level money pool. See [`AccountT`](../shared/types.ts).

### `create(name, description?, startingBalance?)`
`account:create`

- **What it does:** Creates the account **and** auto-creates its non-deletable default envelope
  (named the same as the account), in one transaction.
- **Returns:** `Promise<number | bigint>` — new account id.
- **Errors:** `ACCOUNT_NAME_REQUIRED`. (A duplicate name surfaces as `CONSTRAINT_VIOLATION` — not pre-checked.)

### `getAll()`
`account:getAll` — `Promise<AccountT[]>`.

### `getById(id)`
`account:getById` — `Promise<AccountT | undefined>`.

### `update(account)`
`account:update` — `Promise<boolean>`.
- **Errors:** `ACCOUNT_NAME_REQUIRED`. (Renaming/editing the default account itself is allowed —
  only its *deletion* is blocked; contrast with envelopes, where the default is fully update-locked.)

### `delete(id)`
`account:delete`

- **What it does:** Deletes the account. **Cascades**: its envelopes, their movements, allocations,
  and tag links all go with it (`ON DELETE CASCADE` in the schema) — this is destructive and has no
  undo beyond a full database restore.
- **Returns:** `Promise<boolean>`.
- **Errors:** `ACCOUNT_DELETE_DEFAULT` — can't delete the default account (set another one as default first).

### `setDefault(id)`
`account:setDefault` — `Promise<void>`.

### `getStats()`
`account:getStats`

- **What it does:** Aggregate stats across **all** accounts combined (SQL aggregates, no N+1).
- **Returns:** `Promise<AccountStats>` — `{ totalIncomeCents, totalExpenseCents, totalIncomeWithoutAnomaliesCents, totalExpenseWithoutAnomaliesCents, balanceCents, envelopeCount }`. `balanceCents` is always all-inclusive (anomalies never affect real balances).
- **Use when:** A dashboard/overview header showing whole-app totals.

---

## Envelopes (`window.envelopes`)

A named bucket inside an account. See [`EnvelopeT`](../shared/types.ts).

### `create(name, accountId, startingBalance?, budgetCents?, maxSavingsCents?, overflowsTo?)`
`envelope:create`

- **Returns:** `Promise<number | bigint>` — new envelope id.
- **Errors:**
  - `ENVELOPE_NAME_REQUIRED`.
  - `ENVELOPE_ACCOUNT_REQUIRED` — `accountId` falsy (`0`/`null`/`undefined`). **Note:** a positive but
    nonexistent `accountId` is *not* caught here — it surfaces as `CONSTRAINT_VIOLATION` (FK failure).
  - `ENVELOPE_BUDGET_NEGATIVE` — `budgetCents` given and negative.
  - `ENVELOPE_MAXSAVINGS_NEGATIVE` — `maxSavingsCents` given and negative.

### `getAll()`
`envelope:getAll` — `Promise<EnvelopeT[]>`.

### `getById(id)`
`envelope:getById` — `Promise<EnvelopeT | undefined>`.

### `update(envelope)`
`envelope:update`

- **What it does:** Updates an envelope's fields. On success, re-stamps the budget/max-savings
  snapshot onto the **current month's** summary only (past months stay frozen at their old cap;
  future existing months are *not* retroactively re-stamped either — see functional-overview known issues).
- **Returns:** `Promise<boolean>`.
- **Errors:**
  - `ENVELOPE_NAME_REQUIRED`.
  - `ENVELOPE_UPDATE_DEFAULT` — **the default envelope cannot be updated at all** (any field), unlike
    the default account/category which allow field edits.
  - `ENVELOPE_BUDGET_NEGATIVE`, `ENVELOPE_MAXSAVINGS_NEGATIVE`.
  - `ENVELOPE_OVERFLOWS_TO_SELF` — `overflowsTo === envelope.id`.

### `delete(id)`
`envelope:delete`

- **What it does:** Reassigns every movement allocation from this envelope to the account's default
  envelope (one transaction), then deletes it. Refreshes the default envelope's affected periods
  (create-or-dirty) so the redirected money shows up immediately, and drops the deleted envelope's
  own now-orphaned summary rows.
- **Returns:** `Promise<boolean>`.
- **Errors:**
  - `ENVELOPE_DELETE_DEFAULT` — can't delete an account's default envelope.
  - `ENVELOPE_NO_ACCOUNT` — envelope has no resolvable account (data-integrity edge case).
  - `ENVELOPE_ACCOUNT_NO_DEFAULT` — the account has no default envelope to reassign into (should not occur normally).

### `setDefault(id)`
`envelope:setDefault` — `Promise<void>`. One default per account (partial unique index).

---

## Tags (`window.tags`)

Optional free "context" label, many-per-movement. See [`TagT`](../shared/types.ts).

### `create(type, name, color)`
`tag:create` — `Promise<number | bigint>`.
- **Errors:** `TAG_TYPE_REQUIRED`, `TAG_NAME_REQUIRED`. A duplicate `(type, name)` pair surfaces as `CONSTRAINT_VIOLATION`.

### `getAll()`
`tag:getAll` — `Promise<TagT[]>`.

### `getById(id)`
`tag:getById` — `Promise<TagT | undefined>`.

### `update(tag)`
`tag:update` — `Promise<boolean>`.
- **Errors:** `TAG_TYPE_REQUIRED`, `TAG_NAME_REQUIRED`.

### `delete(id)`
`tag:delete` — `Promise<boolean>`. No existence check — deleting a nonexistent id resolves normally with no effect (repository-level no-op, not an error).

### `addToMovement(tagId, movementId)`
`tag:addToMovement` — `Promise<void>`. Idempotent N:M link insert.

### `removeFromMovement(tagId, movementId)`
`tag:removeFromMovement` — `Promise<void>`.

### `getForMovement(movementId)`
`tag:getForMovement` — `Promise<TagT[]>` — tags on one movement.

### `getForMovements(movementIds)`
`tag:getForMovements`

- **Returns:** `Promise<Record<number, TagT[]>>` — bulk read; **movement ids with zero tags are
  absent from the result object** (not present as an empty array) — check with `in` / `?.` accordingly.
- **Use when:** Rendering tag chips across a movements list without N+1 calls.

---

## Settings (`window.settings`)

App preferences, stored via `electron-store` (**not** SQLite — survives a DB wipe/restore). See
[`AppSettings`](../shared/types.ts).

### `getAll()`
`settings:get` — `Promise<AppSettings>` — `{ useDefaultDate, defaultDate, colorOrder, categoryIcons }`. Defaults are seeded from [`shared/defaults.ts`](../shared/defaults.ts) on first read.

### `save(partial)`
`settings:set`

- **What it does:** Merges `partial` into the stored settings, key by key (unspecified keys untouched).
- **Parameters:** `partial: Partial<AppSettings>`.
- **Returns:** `Promise<void>`.
- **Errors:** none — no validation is performed on the values (e.g. `colorOrder` isn't checked
  against the actual palette).

---

## Period summaries (`window.periodSummaries`)

Stored monthly `(account, envelope|null, year, month)` snapshots — the aggregation engine. Normally
**fully automatic**: created/updated/deleted as a side effect of movement/transfer mutations (see
functional-overview's automatic-effects table). The methods below are the direct read/write surface;
several are for advanced/maintenance use rather than routine UI flows. See [`PeriodSummaryT`](../shared/types.ts).

### `create(period)`
`periodSummary:create`

- **What it does:** Manually builds and inserts a summary for a period **from its existing
  movements/transfers**. This is *not* how summaries normally come into being (that's automatic via
  `periodTouched` on every movement/transfer write) — this channel exists for maintenance/backfill
  scenarios, not routine frontend flows.
- **Parameters:** `period: PeriodT` — `{ accountId, envelopeId, year, month }`.
- **Returns:** `Promise<number | bigint>`.
- **Errors:**
  - `INCORRECT_PARAMETERS` — a summary for this period already exists, **or** the period has no
    movements and no transfers to summarize (nothing to build).
  - `ACCOUNT_NOT_FOUND`, `ENVELOPE_NOT_FOUND` — bad ids.

### `upsert(summary)`
`periodSummary:upsert`

- **What it does:** Inserts or overwrites a summary **verbatim** — the full `PeriodSummaryT` object
  you pass is stored as-is, with **no recomputation or validation** of the aggregates against actual
  movement data. Matches on `(accountId, envelopeId, year, month)`.
- **Returns:** `Promise<number | bigint>` (insert path) — the update path resolves `1` regardless of the row's actual id.
- **Use with care:** a caller supplying stale/wrong aggregate figures will silently corrupt that
  period's displayed stats and the downstream ending-balance chain until the next automatic recompute.

### `getAll()`
`periodSummary:getAll`

- **What it does:** Returns every period summary, lazily cleaning any that are `MODIFIED`/`DIRTY`
  in place first (see the dirty-state machine in technical-reference.md). A summary that turns out to
  be an orphan (its last movement was deleted) self-deletes during cleaning and is simply omitted —
  not reported as an error.
- **Returns:** `Promise<PeriodSummaryT[]>`.

### `getLatest(envelopeId)`
`periodSummary:getLatest`

- **Returns:** `Promise<PeriodSummaryT | undefined>` — the envelope's most recent summary, cleaned.
  `undefined` when the envelope has no summary yet (no activity) — callers should fall back to the
  envelope's `startingBalance` in that case.
- **Use when:** Showing an envelope's current balance/stats card.

### `getByPeriod(accountId, envelopeId, year, month)`
`periodSummary:getByPeriod`

- **Returns:** `Promise<PeriodSummaryT>` — cleaned on read if dirty.
- **Use when:** A specific month view for an account or envelope (`envelopeId: null` = account-level rollup).
- **Errors:** `PERIODSUMMARY_NOT_FOUND` — no summary exists for this period (no activity, or it's an
  orphan that just self-deleted while cleaning).

### `update(summary)`
`periodSummary:update`

- **What it does:** Raw overwrite of a period summary row with whatever full `PeriodSummaryT` you
  pass — same "no recompute, no validation" caveat as `upsert`. **This is also the only way to edit
  the user-facing `notes` field** (there is no dedicated notes-only channel despite
  `PeriodSummaryService.editNotes()` existing internally — it isn't wired to any IPC channel): fetch
  the summary via `getByPeriod`, mutate `.notes` client-side, and send the whole object back through
  `update`.
- **Returns:** `Promise<boolean>`.

### `delete(accountId, envelopeId, year, month)`
`periodSummary:delete`

- **What it does:** Deletes the summary row directly. Normally summaries self-delete when their last
  movement/transfer is gone (via the automatic path) — this is a manual/maintenance escape hatch,
  not a routine action (deleting a summary that still has underlying activity will just have it
  recreated on the next `periodTouched`).
- **Returns:** `Promise<boolean>`.

---

## Import / Export (`window.importExport`)

CSV import/export of movements (Financely's own light format — not bank-CSV column mapping, which
is deferred). See [`MovementDraftT` / `ImportResultT`](../shared/types.ts) and the format spec in
technical-reference.md.

### `previewImport(targetAccountId)`
`importExport:preview`

- **What it does:** Opens a native file picker (anchored to the calling window), reads the chosen
  CSV, and parses it into committable drafts **without persisting anything**. Unmatched
  category/envelope names fall back to the defaults (flagged as informational issues); unknown tags
  are flagged `id: null` (created only at commit); rows with a missing name/concept, bad amount/date,
  or split-sum mismatch are dropped from `drafts` and reported as blocking issues.
- **Returns:** `Promise<ImportResultT | null>` — `{ drafts: MovementDraftT[], issues: ImportIssueT[] }`,
  or `null` if the user cancelled the file picker.
- **Use when:** The user picks "Import CSV" — always show the preview/issues UI before calling `commitImport`.
- **Errors:**
  - `IMPORT_ACCOUNT_HAS_TENTATIVE` — the target account still has unreviewed tentative movements.
    Note the ordering (see functional-overview known issues): the native file picker opens *before*
    this guard runs (the guard is the first thing `previewImport` checks, but the IPC handler already
    opened the dialog and read the file by the time it calls into the service) — so the user can pick
    a file only to have it immediately rejected. Confirm/clear tentatives before offering the import flow.
  - `IMPORT_MISSING_COLUMNS` — the CSV lacks one of the required columns (`concept`, `quantity`, `date`).

### `commitImport(drafts, targetAccountId)`
`importExport:commit`

- **What it does:** Persists the (possibly user-edited) preview drafts as real movements, in one
  all-or-nothing transaction, oldest-first (keeps the reconcile-first guard chain sane). Auto-creates
  any `id: null` tags. Re-attaches `templateName`/`groupName` by name **only if they still exist** —
  membership invariants (D2/D6/D12) are *not* re-validated for compound re-attachment on import.
- **Returns:** `Promise<number>` — movements created.
- **Errors:** `IMPORT_ACCOUNT_HAS_TENTATIVE` (re-checked at commit time too).

### `exportMovements(filter?)`
`importExport:export`

- **What it does:** Serializes movements matching `filter` (omit = all) to CSV (UTF-8 with BOM, for
  Excel compatibility), then opens a native save dialog. The CSV is built **before** the dialog opens
  (so a tentative-in-selection rejection surfaces before the user picks a save location).
- **Returns:** `Promise<string | null>` — the written file path, or `null` if the user cancelled the save dialog.
- **Errors:** `EXPORT_CONTAINS_TENTATIVE` — any movement in the selection is still tentative (confirm
  or exclude it first).

---

## Database (`window.database`)

Whole-database backup/restore, plus two **dev/testing-only** actions. `dropAllTables` and
`seedExampleData` must never be surfaced as normal user-facing actions in the shipped UI.

### `backup()`
`database:backup`

- **What it does:** Opens a native save dialog, then writes a full backup via better-sqlite3's
  online backup API (safe while the app is running/writing).
- **Returns:** `Promise<string | null>` — the written path, or `null` if the user cancelled.
- **Errors:** `BACKUP_FAILED` — the underlying backup call threw (disk full, permissions, etc.).

### `restore()`
`database:restore`

- **What it does:** Opens a native open dialog, validates the chosen file actually looks like a
  Financely database (has the expected `meta`/`movements` tables), then **replaces ALL current data**
  in place (ATTACH + transaction copy — the live connection is never swapped, so cached repository
  handles stay valid). All-or-nothing.
- **Returns:** `Promise<boolean>` — `true` if restored, `false` if the user cancelled the file picker.
- **Errors:** `RESTORE_INVALID_FILE` — the chosen file isn't a recognizable Financely database.
- **⚠️ Destructive:** irreversibly overwrites every table's current contents. The UI must confirm with
  the user before calling this.

### `dropAllTables()`
`database:dropAllTables` — **TESTING/DEV ONLY.**

- **What it does:** Drops every data table, then immediately recreates an empty schema with the
  minimal seeded defaults (default account/envelope/category) so the app stays functional.
- **Returns:** `Promise<void>`.
- **⚠️ Destructive and irreversible** (short of a prior backup). Must not be reachable from normal
  end-user UI.

### `seedExampleData()`
`database:seedExampleData` — **TESTING/DEV ONLY.**

- **What it does:** Ensures the schema exists, inserts the sample/demo dataset (categories, tags,
  envelopes, movements, periodic templates) via raw SQL, then backfills period summaries for the
  seeded movements (the raw-SQL insert bypasses the normal `periodTouched` hook, so this step is
  required for the seeded data to show up in any summary view).
- **Returns:** `Promise<void>`.
- **Note:** Uses `INSERT OR IGNORE` for most rows, so calling it again after data already exists is
  mostly a no-op for pre-existing names, but will still insert net-new movement rows each time
  (movements have no natural dedup key) — don't expose as a repeatable "reset demo" action without
  a `dropAllTables()` first.
