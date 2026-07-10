/** Converts a Date (or ISO string) to a local YYYY-MM-DD string (timezone-stable). */
export function dateToISO(d: Date | unknown): string {
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  // IPC structured-clone may strip the Date prototype — fall back to string slice
  return String(d).substring(0, 10);
}

/** Parses a YYYY-MM-DD string as a local-midnight Date (timezone-stable). */
export function isoToDate(s: string): Date {
  return new Date(s + 'T00:00:00');
}
