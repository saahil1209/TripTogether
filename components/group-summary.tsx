import { CalendarRange, HandCoins, Scale, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, SectionTitle } from '@/components/ui/card'
import { formatRange } from '@/lib/dates'
import { participantsWord, rupees } from '@/lib/format'
import type { FairnessFlag, GroupBoundaries, WhyNot } from '@/lib/recommendations'
import { VIBE_LABELS } from '@/lib/types'

/** Group boundaries: the shape of the space every option has to fit inside. */
export function GroupSummary({
  boundaries,
  fairness,
  namesAllowed = false,
}: {
  boundaries: GroupBoundaries
  fairness: FairnessFlag[]
  /** The organizer's private view may name people; the group view may not. */
  namesAllowed?: boolean
}) {
  return (
    <Card>
      <CardBody className="space-y-5">
        <div>
          <SectionTitle>What you all agree on</SectionTitle>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {boundaries.sharedVibes.length > 0 ? (
              boundaries.sharedVibes.map((vibe) => (
                <Badge key={vibe} tone="emerald">{VIBE_LABELS[vibe]}</Badge>
              ))
            ) : (
              <p className="text-ink-soft">
                No single vibe has a majority — this group wants different trips.
              </p>
            )}
            {boundaries.splitVibes.map((vibe) => (
              <Badge key={vibe} tone="amber">{VIBE_LABELS[vibe]} · one person</Badge>
            ))}
          </div>
        </div>

        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          <Boundary icon={CalendarRange} label="Dates that work for everyone">
            {boundaries.workableWindows.length === 0 ? (
              <span className="text-clay">No window works for everyone yet</span>
            ) : (
              <>
                {formatRange(boundaries.workableWindows[0]!.start, boundaries.workableWindows[0]!.end)}
                {boundaries.workableWindows.length > 1 ? (
                  <span className="block text-xs font-normal text-ink-muted">
                    and {boundaries.workableWindows.length - 1} other window
                    {boundaries.workableWindows.length > 2 ? 's' : ''}
                  </span>
                ) : (
                  <span className="block text-xs font-normal text-ink-muted">
                    The only window of this length
                  </span>
                )}
              </>
            )}
          </Boundary>

          <Boundary icon={HandCoins} label="Realistic budget ceiling">
            {rupees(boundaries.budgetCeiling)} all-in
            <span className="block text-xs font-normal text-ink-muted">
              {boundaries.budgetCeilingIsBinding
                ? 'The lowest maximum in the group — the number that actually binds'
                : 'Everyone set the same maximum'}
            </span>
          </Boundary>
        </div>

        {boundaries.hardNos.length > 0 ? (
          <div>
            <SectionTitle>Hard no’s</SectionTitle>
            <ul className="mt-2.5 space-y-1.5">
              {boundaries.hardNos.map((no) => (
                <li key={no.id} className="flex items-start gap-2 text-ink-soft">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-clay" aria-hidden />
                  <span>
                    {no.label}
                    <span className="text-ink-muted"> — {participantsWord(no.count)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {boundaries.notes.length > 0 ? (
          <div>
            <SectionTitle>What that adds up to</SectionTitle>
            <ul className="mt-2.5 space-y-1.5 text-ink-soft">
              {boundaries.notes.map((note) => (
                <li key={note} className="border-l-2 border-line pl-3">{note}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {fairness.length > 0 ? (
          <div className="rounded-xl border border-amber/30 bg-amber-soft px-4 py-3.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber">
              <Scale className="size-4" aria-hidden />
              Worth watching
            </p>
            <ul className="mt-1.5 space-y-1 text-amber/90">
              {fairness.map((flag) => (
                <li key={flag.participantId}>
                  {namesAllowed ? flag.detail : `${flag.constraint}.`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}

function Boundary({
  icon: Icon, label, children,
}: { icon: typeof CalendarRange; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.1em] text-ink-muted">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-1 font-medium text-ink">{children}</p>
    </div>
  )
}

export function WhyNotList({ items }: { items: WhyNot[] }) {
  if (items.length === 0) return null
  return (
    <Card>
      <CardBody>
        <SectionTitle>Why not…</SectionTitle>
        <dl className="mt-3 space-y-4">
          {items.map((item) => (
            <div key={item.destinationId}>
              <dt className="font-display text-lg text-ink">{item.name}</dt>
              <dd className="mt-0.5 text-ink-soft">{item.reason}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  )
}
