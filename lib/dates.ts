/**
 * Plain ISO date (YYYY-MM-DD) helpers. No timezone maths anywhere in this app:
 * a trip date is a calendar date, not an instant, so we treat it as a string.
 */

export type ISODate = string

const DAY_MS = 86_400_000

export function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

export function toUTC(date: ISODate): number {
  return Date.parse(`${date}T00:00:00Z`)
}

export function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTC(toUTC(date) + days * DAY_MS)
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS)
}

/** Inclusive range: rangeDays('2025-10-18', '2025-10-20') -> 3 dates. */
export function rangeDays(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = []
  const n = daysBetween(start, end)
  for (let i = 0; i <= n; i++) out.push(addDays(start, i))
  return out
}

/** A trip window of `length` days starting on `start`, inclusive of both ends. */
export function windowDays(start: ISODate, length: number): ISODate[] {
  return rangeDays(start, addDays(start, length - 1))
}

export function monthOf(date: ISODate): number {
  return Number(date.slice(5, 7))
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? ''
}

/** "18–22 Oct" / "30 Oct – 2 Nov" */
export function formatRange(start: ISODate, end: ISODate): string {
  const sd = Number(start.slice(8, 10))
  const ed = Number(end.slice(8, 10))
  const sm = monthName(monthOf(start)).slice(0, 3)
  const em = monthName(monthOf(end)).slice(0, 3)
  return sm === em ? `${sd}–${ed} ${sm}` : `${sd} ${sm} – ${ed} ${em}`
}

export function formatDay(date: ISODate): string {
  const d = new Date(`${date}T00:00:00Z`)
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]
  return `${weekday} ${d.getUTCDate()} ${monthName(d.getUTCMonth() + 1).slice(0, 3)}`
}

/** "28 Sep 2026" — for deadlines shown on their own. */
export function formatDate(date: ISODate): string {
  const day = Number(date.slice(8, 10))
  return `${day} ${monthName(monthOf(date)).slice(0, 3)} ${date.slice(0, 4)}`
}
