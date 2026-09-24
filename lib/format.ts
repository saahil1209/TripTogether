/** ₹22,600 */
export function rupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

/** ₹22.6k — for tight spaces like option cards. */
export function rupeesShort(amount: number): string {
  const n = Math.round(amount)
  if (n < 1000) return `₹${n}`
  const k = n / 1000
  return `₹${k % 1 === 0 ? k : k.toFixed(1)}k`
}

export function hoursLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  const whole = Math.floor(hours)
  const half = hours - whole >= 0.5
  return `${whole}${half ? '.5' : ''} hrs`
}

const WORDS = ['no one', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

export function countWord(n: number): string {
  return WORDS[n] ?? String(n)
}

/** "two participants" / "one participant" — group-facing copy never uses names. */
export function participantsWord(n: number): string {
  return `${countWord(n)} participant${n === 1 ? '' : 's'}`
}

/** "Riya, Karan and Aisha" */
export function joinNames(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]!
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`
}

/** "one participant's" / "two participants'" */
export function participantsPossessive(n: number): string {
  return n === 1 ? "one participant's" : `${countWord(n)} participants'`
}
