import { Card, CardBody, SectionTitle } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { type ISODate, formatRange, monthName, monthOf } from '@/lib/dates'
import type { DayCoverage, PersonAvailability } from '@/lib/stats'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * Everyone's availability, in the open.
 *
 * Only rendered once results are published. Before that it would be exactly the
 * anchoring the product is built to avoid — you would see what everyone else
 * said before deciding what you say.
 */
export function AvailabilityBoard({
  coverage,
  availability,
  chosen,
  context = 'decided',
}: {
  coverage: DayCoverage[]
  availability: PersonAvailability[]
  /** The window to outline on the calendar. */
  chosen?: { start: ISODate; end: ISODate } | null
  /** Changes the copy: a locked decision reads differently from a shortlist. */
  context?: 'decided' | 'published'
}) {
  const decided = context === 'decided'
  const months = new Map<string, DayCoverage[]>()
  for (const day of coverage) {
    const key = day.date.slice(0, 7)
    const list = months.get(key)
    if (list) list.push(day)
    else months.set(key, [day])
  }

  const total = coverage[0]?.total ?? 0
  const inChosen = (date: ISODate) =>
    Boolean(chosen && date >= chosen.start && date <= chosen.end)

  return (
    <Card>
      <CardBody className="space-y-6">
        <div>
          <h2 className="text-xl">When everyone could travel</h2>
          <p className="mt-1 text-ink-soft">
            {decided
              ? 'Now that it\u2019s decided, here is what everybody actually said.'
              : 'Everyone has answered, so here is the full picture.'}{' '}
            Darker means more people free.
          </p>
        </div>

        <div className="space-y-6">
          {[...months.entries()].map(([key, days]) => {
            const first = days[0]!
            const lead = (new Date(`${first.date}T00:00:00Z`).getUTCDay() + 6) % 7
            return (
              <section key={key}>
                <h3 className="text-sm font-semibold text-ink">
                  {monthName(monthOf(first.date))} {first.date.slice(0, 4)}
                </h3>
                <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden>
                  {WEEKDAYS.map((d, i) => (
                    <span key={`${d}${i}`} className="py-1 text-center text-xs text-ink-muted">
                      {d}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: lead }, (_, i) => <span key={`pad${i}`} />)}
                  {days.map((day) => (
                    <div
                      key={day.date}
                      title={`${day.date}: ${day.free} of ${day.total} free`}
                      className={cn(
                        'flex aspect-square flex-col items-center justify-center rounded-lg border text-sm',
                        shade(day.free, day.total),
                        inChosen(day.date) && 'ring-2 ring-ink ring-offset-1',
                      )}
                    >
                      <span className="font-medium leading-none">
                        {Number(day.date.slice(8, 10))}
                      </span>
                      <span className="mt-0.5 text-[0.625rem] leading-none opacity-70">
                        {day.free}
                      </span>
                      <span className="sr-only">
                        {day.free} of {day.total} people free
                        {inChosen(day.date)
                          ? decided ? ', part of the chosen trip' : ', part of the leading option'
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
          <span className="font-medium text-ink">Free that day:</span>
          {[0, Math.ceil(total / 2), total].filter((v, i, a) => a.indexOf(v) === i).map((n) => (
            <span key={n} className="inline-flex items-center gap-1.5">
              <span className={cn('size-3.5 rounded border', shade(n, total))} />
              {n} of {total}
            </span>
          ))}
          {chosen ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3.5 rounded border border-line ring-2 ring-ink ring-offset-1" />
              {decided ? 'the trip' : 'the leading option'}
            </span>
          ) : null}
        </div>

        <div className="border-t border-line-soft pt-5">
          <SectionTitle>Person by person</SectionTitle>
          <ul className="mt-3 divide-y divide-line-soft">
            {availability.map((person) => (
              <li key={person.participantId} className="flex flex-wrap gap-x-4 gap-y-1 py-2.5">
                <span className="w-24 shrink-0 font-medium text-ink">{person.name}</span>
                <span className="flex-1 text-ink-soft">
                  {person.ranges.length > 0 ? person.ranges.join(', ') : 'No days available'}
                </span>
                <span className="text-sm text-ink-muted">
                  {person.daysFree} day{person.daysFree === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
          {chosen ? (
            <p className="mt-3 text-sm text-ink-muted">
              {decided
                ? `The trip runs ${formatRange(chosen.start, chosen.end)}.`
                : `The leading option runs ${formatRange(chosen.start, chosen.end)}.`}
            </p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  )
}

/** Five steps of green, so the calendar reads at a glance. */
function shade(free: number, total: number): string {
  if (total === 0 || free === 0) return 'border-line bg-card text-ink-muted'
  const ratio = free / total
  if (ratio === 1) return 'border-emerald bg-emerald text-white'
  if (ratio >= 0.75) return 'border-emerald/60 bg-emerald/70 text-white'
  if (ratio >= 0.5) return 'border-emerald/40 bg-emerald/40 text-emerald-deep'
  return 'border-emerald/25 bg-emerald-soft text-emerald-deep'
}
