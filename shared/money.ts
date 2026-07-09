/**
 * Sign-aware money helpers for CSV import/export. The renderer's `parseMoney`/`formatCents`
 * (`angular/src/app/shared/utils.ts`) reject negatives; these carry the sign explicitly because a CSV
 * `quantity` column encodes income/expense as a single signed decimal. Usable from the backend via
 * `@shared/money`.
 */

/**
 * Parses a signed decimal money string into integer cents plus a sign. Tolerates a comma decimal
 * separator (es-ES) and a thousands separator when both are present. Throws on non-numeric input.
 * The magnitude is not range-checked here — callers validate `quantityCents > 0`.
 */
export function parseSignedMoney(input: string): { quantityCents: number; isPositive: boolean } {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Empty amount');
  const isPositive = !trimmed.startsWith('-');

  let unsigned = trimmed.replace(/^[+-]/, '');
  if (unsigned.includes(',') && unsigned.includes('.')) {
    // Both present: assume ',' is the thousands separator and '.' the decimal → drop commas.
    unsigned = unsigned.replace(/,/g, '');
  } else if (unsigned.includes(',')) {
    // Only a comma: it is the decimal separator.
    unsigned = unsigned.replace(',', '.');
  }

  const value = Number(unsigned);
  if (!Number.isFinite(value)) throw new Error(`Invalid amount: "${input}"`);
  return { quantityCents: Math.round(value * 100), isPositive };
}

/** Formats integer cents + sign as a signed decimal string (e.g. `2250, false` → `"-22.50"`). */
export function formatSignedMoney(cents: number, isPositive: boolean): string {
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const sign = isPositive ? '' : '-';
  return `${sign}${whole}.${String(frac).padStart(2, '0')}`;
}
