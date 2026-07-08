import { BasicSummary, CompoundMovementT, MovementT, PeriodT } from '@shared/types';
import { compoundMovementRepository } from '../repository/compound-movement-repository.service';
import { movementRepository } from '../repository/movement-repository.service';

/**
 * Compound re-attribution for period statistics (Phase 2, decisions D1/D4/D6/D14). Produces the
 * "compound-adjusted" aggregates for a period without ever touching the ending-balance chain: a
 * compound with an owner month has its children's stats pulled out of the months they physically sit
 * in and collapsed into the owner month (a cancelable set as one net movement; a grouping as its
 * individual children). Only ever active for compounds with an owner month set.
 *
 * Level rules: at ACCOUNT level (envelopeId = null) both grouping and cancelable compounds
 * re-attribute; at ENVELOPE level only cancelable ones do (a grouping's children keep counting in
 * their real envelope, D4).
 */

type Contribution = { amountCents: number; isPositive: boolean };

/** A movement's amount at a given level: its full amount at account level, its envelope share otherwise. */
function amountAtLevel(m: MovementT, envelopeId: number | null): number {
  if (envelopeId == null) return m.quantityCents;
  return m.envelopeIdMap.get(envelopeId) ?? 0;
}

function aggregate(contribs: Contribution[]): BasicSummary {
  let totalIncomeCents = 0;
  let incomeCount = 0;
  let totalExpenseCents = 0;
  let expenseCount = 0;
  for (const c of contribs) {
    if (c.isPositive) {
      totalIncomeCents += c.amountCents;
      incomeCount++;
    } else {
      totalExpenseCents += c.amountCents;
      expenseCount++;
    }
  }
  const movementCount = contribs.length;
  return {
    movementCount,
    totalIncomeCents,
    totalExpenseCents,
    cashFlowCents: totalIncomeCents - totalExpenseCents,
    avgIncomeCents: incomeCount !== 0 ? totalIncomeCents / incomeCount : 0,
    avgExpenseCents: expenseCount !== 0 ? totalExpenseCents / expenseCount : 0,
    avgMovementAmountCents:
      movementCount !== 0 ? (totalIncomeCents + totalExpenseCents) / movementCount : 0,
  };
}

function equalSummary(a: BasicSummary, b: BasicSummary): boolean {
  return (
    a.movementCount === b.movementCount &&
    a.totalIncomeCents === b.totalIncomeCents &&
    a.totalExpenseCents === b.totalExpenseCents &&
    a.cashFlowCents === b.cashFlowCents &&
    a.avgIncomeCents === b.avgIncomeCents &&
    a.avgExpenseCents === b.avgExpenseCents &&
    a.avgMovementAmountCents === b.avgMovementAmountCents
  );
}

/** Whether a compound re-attributes statistics at the given level (D4/D6). Requires an owner month. */
function reattributesAtLevel(compound: CompoundMovementT, envelopeId: number | null): boolean {
  if (compound.ownerYear == null || compound.ownerMonth == null) return false;
  return envelopeId == null || compound.isCancelable;
}

/**
 * Compound-adjusted aggregates for a period — with and without anomalies — or `null` when no compound
 * affects this period (so the caller stores nulls and the display falls back to the raw figures).
 * `rawMovements` are the period's movements at this level (as `calculatePeriodSummary` fetched them).
 */
export function computeCompoundAdjusted(
  period: PeriodT,
  rawMovements: MovementT[],
): { adjusted: BasicSummary; adjustedWithoutAnomalies: BasicSummary } | null {
  const env = period.envelopeId;
  const compoundCache = new Map<number, CompoundMovementT | undefined>();
  const getCompound = (id: number): CompoundMovementT | undefined => {
    if (!compoundCache.has(id)) compoundCache.set(id, compoundMovementRepository.getById(id));
    return compoundCache.get(id);
  };

  // Compounds anchored to this period that re-attribute at this level (their injection lands here).
  const ownedHere = compoundMovementRepository
    .getOwnedInPeriod(period.accountId, period.year, period.month)
    .filter((c) => reattributesAtLevel(c, env) && ownsEnvelope(c, env));

  // Children physically present here whose compound re-attributes at this level (pulled out).
  const reattributedChildIds = new Set<number>();
  for (const m of rawMovements) {
    if (m.parentId == null) continue;
    const c = getCompound(m.parentId);
    if (c && reattributesAtLevel(c, env)) reattributedChildIds.add(m.id);
  }

  if (ownedHere.length === 0 && reattributedChildIds.size === 0) return null;

  const build = (excludeAnomalous: boolean): Contribution[] => {
    const contribs: Contribution[] = [];
    // Keep every raw movement except the ones re-attributed away/collapsed.
    for (const m of rawMovements) {
      if (excludeAnomalous && m.isAnomalous) continue;
      if (reattributedChildIds.has(m.id)) continue;
      contribs.push({ amountCents: amountAtLevel(m, env), isPositive: m.isPositive });
    }
    // Inject each owned compound's collapsed figure into this (owner) period.
    for (const c of ownedHere) {
      const children = movementRepository
        .getByParent(c.id)
        .filter((ch) => !(excludeAnomalous && ch.isAnomalous));
      if (children.length === 0) continue;
      if (c.isCancelable) {
        let net = 0;
        for (const ch of children) net += (ch.isPositive ? 1 : -1) * amountAtLevel(ch, env);
        if (net !== 0) contribs.push({ amountCents: Math.abs(net), isPositive: net > 0 });
      } else {
        for (const ch of children) {
          contribs.push({ amountCents: amountAtLevel(ch, env), isPositive: ch.isPositive });
        }
      }
    }
    return contribs;
  };

  const adjusted = aggregate(build(false));
  const adjustedWithoutAnomalies = aggregate(build(true));

  // No net effect (e.g. a single-month grouping whose children never leave the owner month) → null.
  const rawContribs = (excludeAnomalous: boolean) =>
    rawMovements
      .filter((m) => !(excludeAnomalous && m.isAnomalous))
      .map((m) => ({ amountCents: amountAtLevel(m, env), isPositive: m.isPositive }));
  if (
    equalSummary(adjusted, aggregate(rawContribs(false))) &&
    equalSummary(adjustedWithoutAnomalies, aggregate(rawContribs(true)))
  ) {
    return null;
  }

  return { adjusted, adjustedWithoutAnomalies };
}

/** At envelope level a cancelable compound only injects into its own (single, shared) envelope. */
function ownsEnvelope(compound: CompoundMovementT, envelopeId: number | null): boolean {
  if (envelopeId == null) return true;
  const children = movementRepository.getByParent(compound.id);
  if (children.length === 0) return false;
  return [...children[0].envelopeIdMap.keys()][0] === envelopeId;
}
