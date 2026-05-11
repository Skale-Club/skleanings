/**
 * Advance a YYYY-MM-DD date by intervalDays.
 * For monthly subscriptions (intervalDays=30), uses calendar-month addition
 * with end-of-month clamping to prevent drift (Jan 31 → Feb 28 → Mar 31).
 * For weekly (7) and biweekly (14): simple day addition.
 */
export function advanceDate(currentDate: string, intervalDays: number): string {
  const d = new Date(currentDate + "T00:00:00Z");
  if (intervalDays === 30) {
    const originalDay = d.getUTCDate();
    d.setUTCMonth(d.getUTCMonth() + 1);
    if (d.getUTCDate() !== originalDay) {
      d.setUTCDate(0); // clamp to last day of previous month
    }
  } else {
    d.setUTCDate(d.getUTCDate() + intervalDays);
  }
  return d.toISOString().slice(0, 10);
}
