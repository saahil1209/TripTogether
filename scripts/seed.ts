/**
 * Creates both demo trips and prints the links.
 *   npm run db:seed
 */
import { closeDb } from '@/lib/db'
import { seedDemo } from '@/lib/demo/seed'

const base = process.env.BASE_URL ?? 'http://localhost:3000'

const demo = await seedDemo()

const lines = [
  '',
  '  Demo trips created.',
  '',
  `  1. ${demo.complete.name}  (all five have responded)`,
  `     Organizer  ${base}/trip/${demo.complete.organizerCode}/organizer`,
  `     Group link ${base}/join/${demo.complete.inviteCode}`,
  '',
  `  2. ${demo.partial.name}  (only three of five have responded)`,
  `     Organizer  ${base}/trip/${demo.partial.organizerCode}/organizer`,
  `     Group link ${base}/join/${demo.partial.inviteCode}`,
  '',
  '  Open an organizer link to see the dashboard and the early picture.',
  '',
]

console.log(lines.join('\n'))

await closeDb()
