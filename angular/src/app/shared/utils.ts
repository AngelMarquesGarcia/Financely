/**
 * Parses a money string (e.g. "22.50", "1234.5", "10") into integer cents.
 * Throws on negative, non-numeric, or NaN input. Empty/whitespace returns 0.
 */
export function parseMoney(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 0;
  const normalized = trimmed.replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error(`Invalid amount: "${input}"`);
  if (value < 0) throw new Error('Amount cannot be negative.');
  return Math.round(value * 100);
}

/** Formats integer cents as a plain decimal string (e.g. 2250 → "22.50"). No currency symbol. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}${whole}.${String(frac).padStart(2, '0')}`;
}

/**
 * Returns a near-black or white hex depending on the perceived luminance of the
 * given background color. Use for picking a readable text color on a colored chip.
 * Accepts "#rrggbb"; behavior on other formats is unspecified.
 */
export function contrastColor(hex: string): '#0f172a' | '#ffffff' {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.58 ? '#0f172a' : '#ffffff';
}
