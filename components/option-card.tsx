import { CalendarDays, ChevronDown, Lightbulb, MapPin, Wallet } from 'lucide-react'
import { AlignmentMatrix } from '@/components/alignment-matrix'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, SectionTitle } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { formatRange } from '@/lib/dates'
import { rupees } from '@/lib/format'
import type { PersonFit, TripOption } from '@/lib/recommendations'
import { STAY_TIER_SHORT, VIBE_LABELS } from '@/lib/types'

const ROLE_LABEL = {
  best: 'Best overall fit',
  lowest_friction: 'Lowest friction',
  different_vibe: 'Different vibe',
} as const

export function OptionCard({
  option,
  you,
  youId,
  index,
  children,
}: {
  option: TripOption
  you?: PersonFit | null
  youId?: string | null
  index: number
  children?: React.ReactNode
}) {
  const { destination: dest, counts } = option
  const fitCount = counts.strong + counts.good
  const total = option.perPerson.length

  return (
    <Card className="rise overflow-hidden" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="border-b border-line bg-paper-deep/60 px-5 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {option.role ? (
            <Badge tone={option.role === 'best' ? 'emerald' : 'sky'}>{ROLE_LABEL[option.role]}</Badge>
          ) : null}
          <Badge tone="outline">
            {counts.strong > 0 ? `${counts.strong} strong` : `${fitCount} workable`} of {total}
          </Badge>
          {counts.compromise > 0 ? (
            <Badge tone="amber">
              {counts.compromise} compromis{counts.compromise === 1 ? 'e' : 'es'}
            </Badge>
          ) : null}
        </div>
      </div>

      <CardBody className="space-y-5">
        <header>
          <h2 className="text-3xl">{dest.name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
            <MapPin className="size-3.5" aria-hidden />
            {dest.region}
          </p>
          <p className="mt-3 text-ink-soft">{dest.blurb}</p>
        </header>

        <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          <Metric icon={CalendarDays} label="Dates">
            {formatRange(option.start, option.end)}
            <span className="block text-xs font-normal text-ink-muted">
              {option.days} days, {option.nights} nights
            </span>
          </Metric>
          <Metric icon={Wallet} label="All-in, per person">
            {option.costLow === option.costHigh
              ? rupees(option.costHigh)
              : `${rupees(option.costLow)}–${rupees(option.costHigh)}`}
            <span className="block text-xs font-normal text-ink-muted">
              Approximate, travel included
            </span>
          </Metric>
          <Metric icon={MapPin} label="Stay">
            {STAY_TIER_SHORT[option.tier]}
            <span className="block text-xs font-normal text-ink-muted">
              {dest.stayTypes[option.tier]}
            </span>
          </Metric>
        </dl>

        <div className="flex flex-wrap gap-1.5">
          {dest.vibes.map((vibe) => (
            <Badge key={vibe} tone="neutral">{VIBE_LABELS[vibe]}</Badge>
          ))}
        </div>

        <div>
          <SectionTitle>Where everyone stands</SectionTitle>
          <AlignmentMatrix className="mt-2.5" fits={option.perPerson} youId={youId} />
        </div>

        <div className="rounded-xl bg-paper-deep px-4 py-3.5">
          <SectionTitle>The trade-off</SectionTitle>
          <p className="mt-1.5 text-ink-soft">{option.explanation.tradeOff}</p>
        </div>

        {option.smallestCompromise ? (
          <div className="rounded-xl border border-emerald/25 bg-emerald-soft px-4 py-3.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-deep">
              <Lightbulb className="size-4" aria-hidden />
              One change makes this work better for everyone
            </p>
            <p className="mt-1.5 text-emerald-deep/90">
              {option.smallestCompromise.change}. {option.smallestCompromise.effect}
            </p>
          </div>
        ) : null}

        {you ? <PersonalView you={you} destinationName={dest.name} /> : null}

        <details className="group rounded-xl border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink">
            The full reasoning
            <ChevronDown
              className="size-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <dl className="space-y-4 border-t border-line px-4 py-4">
            <Reason term="Why this?" detail={option.explanation.whyThis} />
            <Reason term="Who does it suit?" detail={option.explanation.whoItSuits} />
            <Reason term="Who has concerns?" detail={option.explanation.whoHasConcerns} />
            <Reason term="What's the trade-off?" detail={option.explanation.tradeOff} />
            <Reason term="Can it be solved?" detail={option.explanation.canItBeSolved} />
          </dl>
        </details>

        {children}
      </CardBody>
    </Card>
  )
}

function Metric({
  icon: Icon, label, children,
}: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card px-4 py-3.5">
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-[0.1em] text-ink-muted">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 font-medium text-ink">{children}</dd>
    </div>
  )
}

function Reason({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-ink">{term}</dt>
      <dd className="mt-1 text-ink-soft">{detail}</dd>
    </div>
  )
}

/** The one part of the page that is allowed to be specific about one person. */
function PersonalView({ you, destinationName }: { you: PersonFit; destinationName: string }) {
  const works = you.pluses.slice(0, 2)
  const consider = you.issues.filter((i) => i.severity !== 'hard').slice(0, 2)
  const blocking = you.issues.filter((i) => i.severity === 'hard')

  return (
    <div className={cn('rounded-xl border px-4 py-4', blocking.length > 0 ? 'border-clay/30 bg-clay-soft/50' : 'border-line bg-card')}>
      <SectionTitle>For you</SectionTitle>
      <div className="mt-2.5 space-y-3">
        {works.length > 0 ? (
          <div>
            <p className="text-sm font-semibold text-ink">Why this works for you</p>
            <ul className="mt-1 space-y-0.5 text-ink-soft">
              {works.map((plus) => <li key={plus.kind + plus.personal}>{plus.personal}.</li>)}
            </ul>
          </div>
        ) : null}

        {consider.length > 0 ? (
          <div>
            <p className="text-sm font-semibold text-ink">One thing to consider</p>
            <ul className="mt-1 space-y-0.5 text-ink-soft">
              {consider.map((issue) => <li key={issue.kind + issue.personal}>{issue.personal}.</li>)}
            </ul>
          </div>
        ) : null}

        {blocking.length > 0 ? (
          <div>
            <p className="text-sm font-semibold text-clay">This one doesn’t work for you</p>
            <ul className="mt-1 space-y-0.5 text-clay/90">
              {blocking.map((issue) => <li key={issue.kind + issue.personal}>{issue.personal}.</li>)}
            </ul>
          </div>
        ) : null}

        {consider.length === 0 && blocking.length === 0 ? (
          <p className="text-ink-soft">
            Nothing in your answers is working against {destinationName}.
          </p>
        ) : null}
      </div>
    </div>
  )
}
