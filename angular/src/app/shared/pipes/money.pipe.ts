import { Pipe, PipeTransform } from '@angular/core';
import { formatCents } from '../utils';

/** Renders integer cents as "1234.56 €". Pass `withSymbol: false` to omit the symbol. */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(cents: number | null | undefined, withSymbol = true): string {
    if (cents == null || !Number.isFinite(cents)) return '—';
    const formatted = formatCents(cents);
    return withSymbol ? `${formatted} €` : formatted;
  }
}
