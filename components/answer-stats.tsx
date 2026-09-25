import { CalendarDays, Compass, HandCoins, ShieldAlert, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, SectionTitle } from '@/components/ui/card'
import { rupees } from '@/lib/format'
import type { GroupStats } from '@/lib/stats'

/** What the group actually said, in numbers. Shown only after publication. */
export function AnswerStats({ stats }: { stats: GroupStats }) {
  const { budget } = stats

  return (
    <Card>
      <CardBody className="space-y-6">
        <div>
          <h2 className="text-xl">By the numbers</h2>
          <p className="mt-1 text-ink-soft">
            Everything the decision was built from, now that it is made.
          </p>
        </div>

        <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          <Figure icon={Users} label="Responses">
            {stats.respondedCount} of {stats.participantCount}
            <Sub>
              {stats.deeperPassCount > 0
                ? `${stats.deeperPassCount} also answered the optional questions`
                : 'Core questions only'}
            </Sub>
          </Figure>

          <Figure icon={CalendarDays} label="Days everyone could travel">
            {stats.daysEveryoneFree} of {stats.windowDays}
            <Sub>
              {stats.daysEveryoneFree === 0
                ? 'No single day worked for the whole group'
                : `${Math.round((stats.daysEveryoneFree / stats.windowDays) * 100)}% of the window`}
            </Sub>
          </Figure>

          <Figure icon={HandCoins} label="Budget ceiling">
            {rupees(budget.ceiling)}
            <Sub>
              {budget.spread > 0
                ? `Maximums ranged ${rupees(budget.lowest)}–${rupees(budget.highest)}, median ${rupees(budget.median)}`
                : 'Everyone set the same maximum'}
            </Sub>
          </Figure>

          <Figure icon={ShieldAlert} label="Hard no's">
            {stats.dealBreakers.reduce((sum, d) => sum + d.count, 0)}
            <Sub>
              {stats.dealBreakers.length === 0
                ? 'Nobody ruled anything out'
                : `${stats.dealBreakers.length} different constraint${stats.dealBreakers.length === 1 ? '' : 's'}`}
            </Sub>
          </Figure>
        </dl>

        {stats.topVibes.length > 0 ? (
          <div>
            <SectionTitle>What mattered most</SectionTitle>
            <ul className="mt-2.5 space-y-2">
              {stats.topVibes.map((vibe) => (
                <li key={vibe.value} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm text-ink">{vibe.label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper-deep">
                    <span
                      className="block h-full rounded-full bg-emerald"
                      style={{ width: `${(vibe.count / stats.respondedCount) * 100}%` }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right text-sm text-ink-muted">
                    {vibe.count} {vibe.count === 1 ? 'person' : 'people'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-sm text-ink-muted">
              Counting only each person&rsquo;s single top pick. Including second and third
              choices: {stats.vibes.map((v) => `${v.label} (${v.count})`).join(', ')}.
            </p>
          </div>
        ) : null}

        {stats.dealBreakers.length > 0 ? (
          <div>
            <SectionTitle>What was ruled out</SectionTitle>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {stats.dealBreakers.map((d) => (
                <Badge key={d.value} tone="clay">
                  {d.label}
                  <span className="opacity-70">· {d.count}</span>
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <SectionTitle>Travelling from</SectionTitle>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {stats.cities.map((c) => (
              <Badge key={c.value} tone="neutral">
                <Compass className="size-3" aria-hidden />
                {c.label}
                {c.count > 1 ? <span className="opacity-70">· {c.count}</span> : null}
              </Badge>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

function Figure({
  icon: Icon, label, children,
}: { icon: typeof Users; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card px-4 py-3.5">
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-[0.1em] text-ink-muted">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 font-display text-2xl text-ink">{children}</dd>
    </div>
  )
}

function Sub({ children }: { children: React.ReactNode }) {
  return <span className="mt-0.5 block font-sans text-xs font-normal text-ink-muted">{children}</span>
}
