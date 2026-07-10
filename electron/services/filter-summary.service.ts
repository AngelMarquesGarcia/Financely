import {
  BasicSummary,
  FilterSummaryEntry,
  FilterSummaryT,
  MovementFilter,
  MovementT,
} from '@shared/types';
import { movementRepository } from '../repository/movement-repository.service';
import { computeBasicSummary } from './basic-summary';

type YM = { year: number; month: number };

/**
 * Computes on-the-fly summaries for an arbitrary MovementFilter over a month-granular interval. Unlike
 * PeriodSummary these are never stored — they cover tags, categories, accounts-as-filter, and any ad-hoc
 * filter. The interval is taken from `filter.date` (snapped to whole months). Amounts follow the filter:
 * per-envelope partials when it targets a single envelope, full movement amounts otherwise.
 *
 * NOTE: this reuses `getAllMovements` + `computeBasicSummary` in memory. A direct SQL SUM/COUNT (à la
 * accountService.getStats) would be faster if this ever shows up hot; kept simple for now.
 */
export class FilterSummaryService {
  generateFilterSummary(filter: MovementFilter): FilterSummaryT {
    const { from, to } = this.resolveInterval(filter);
    const aggEnvelopeId = filter.envelopeId ?? null;

    // One fetch for the whole (snapped) interval; bucket in memory by month.
    const intervalMovs = movementRepository.getAllMovements({
      ...filter,
      date: { from: monthStart(from), to: monthEnd(to) },
    });
    const buckets = this.bucketByMonth(intervalMovs);

    const children = this.monthsBetween(from, to).map((ym) =>
      this.buildEntry(buckets.get(key(ym)) ?? [], aggEnvelopeId, filter, ym, ym),
    );
    const aggregate = this.buildEntry(intervalMovs, aggEnvelopeId, filter, from, to);

    return { filters: filter, aggregate, children };
  }

  /** One entry (all-inclusive + anomaly-stripped mirror + tentative flag) for a movement bucket. */
  private buildEntry(
    movements: MovementT[],
    envelopeId: number | null,
    baseFilter: MovementFilter,
    from: YM,
    to: YM,
  ): FilterSummaryEntry {
    const date = { from: monthStart(from), to: monthEnd(to) };

    const summary = computeBasicSummary(movements, envelopeId);
    summary.filters = { ...baseFilter, date, includeAnomalies: true };

    // Mirror the stored-summary convention: null when the slice holds no anomalous movement (the two
    // views coincide), so callers fall back to the all-inclusive figures.
    const nonAnomalous = movements.filter((m) => !m.isAnomalous);
    let summaryWithoutAnomalies: BasicSummary | null = null;
    if (nonAnomalous.length !== movements.length) {
      summaryWithoutAnomalies = computeBasicSummary(nonAnomalous, envelopeId);
      summaryWithoutAnomalies.filters = { ...baseFilter, date, includeAnomalies: false };
    }

    return { summary, summaryWithoutAnomalies, tentative: movements.some((m) => m.isTentative) };
  }

  /** The interval from `filter.date`, defaulting to the current month; inverted ranges clamp to `from`. */
  private resolveInterval(filter: MovementFilter): { from: YM; to: YM } {
    const now = new Date();
    const current: YM = { year: now.getFullYear(), month: now.getMonth() };
    const from = filter.date?.from ? ymFromISO(filter.date.from) : current;
    const to = filter.date?.to ? ymFromISO(filter.date.to) : from;
    return ymBefore(to, from) ? { from, to: from } : { from, to };
  }

  private bucketByMonth(movements: MovementT[]): Map<string, MovementT[]> {
    const map = new Map<string, MovementT[]>();
    for (const m of movements) {
      const d = m.date instanceof Date ? m.date : new Date(m.date as unknown as string);
      const k = key({ year: d.getFullYear(), month: d.getMonth() });
      let arr = map.get(k);
      if (!arr) {
        arr = [];
        map.set(k, arr);
      }
      arr.push(m);
    }
    return map;
  }

  private monthsBetween(from: YM, to: YM): YM[] {
    const out: YM[] = [];
    let { year, month } = from;
    while (year < to.year || (year === to.year && month <= to.month)) {
      out.push({ year, month });
      if (++month > 11) {
        month = 0;
        year++;
      }
    }
    return out;
  }
}

function key(ym: YM): string {
  return `${ym.year}-${ym.month}`;
}

function ymFromISO(iso: string): YM {
  const [y, m] = iso.split('-').map(Number);
  return { year: y, month: m - 1 };
}

function monthStart(ym: YM): string {
  return `${ym.year}-${String(ym.month + 1).padStart(2, '0')}-01`;
}

function monthEnd(ym: YM): string {
  const lastDay = new Date(ym.year, ym.month + 1, 0).getDate();
  return `${ym.year}-${String(ym.month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function ymBefore(a: YM, b: YM): boolean {
  return a.year < b.year || (a.year === b.year && a.month < b.month);
}

export const filterSummaryService = new FilterSummaryService();
