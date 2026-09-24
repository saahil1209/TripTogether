'use client'

import { Lock, LockOpen, TriangleAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { lockDecisionAction, unlockDecisionAction } from '@/app/actions'
import { FitBadge } from '@/components/fit-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { formatRange } from '@/lib/dates'
import { rupees } from '@/lib/format'
import type { TripOption } from '@/lib/recommendations'
import { STAY_TIER_SHORT } from '@/lib/types'

/**
 * Locking is deliberately a two-step act with everything laid out first. A
 * decision that can be made by accident is a decision that will be reopened.
 */
export function LockInButton({
  organizerCode,
  option,
  objections,
}: {
  organizerCode: string
  option: TripOption
  objections: string[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const concerns = option.perPerson.filter((p) => p.status === 'compromise' || p.status === 'conflict')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Lock className="size-4" aria-hidden />
          Lock in {option.destination.name}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>Before you lock this in</DialogTitle>
        <DialogDescription>
          This ends the decision. Reactions freeze, and reopening it takes an explicit unlock
          from you.
        </DialogDescription>

        <dl className="mt-5 divide-y divide-line-soft rounded-xl border border-line">
          <Row term="Destination">{option.destination.name}, {option.destination.region}</Row>
          <Row term="Dates">
            {formatRange(option.start, option.end)} · {option.days} days
          </Row>
          <Row term="Budget, all-in">
            {rupees(option.costLow)}–{rupees(option.costHigh)} per person
          </Row>
          <Row term="Stay">{STAY_TIER_SHORT[option.tier]}</Row>
        </dl>

        <div className="mt-5">
          <p className="text-sm font-semibold text-ink">Where everyone lands</p>
          <ul className="mt-2 space-y-1.5">
            {option.perPerson.map((fit) => (
              <li key={fit.participantId} className="flex items-center justify-between gap-3">
                <span className="text-ink">{fit.name}</span>
                <FitBadge status={fit.status} />
              </li>
            ))}
          </ul>
        </div>

        {objections.length > 0 ? (
          <div className="mt-5 rounded-xl border border-clay/30 bg-clay-soft px-4 py-3.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-clay">
              <TriangleAlert className="size-4" aria-hidden />
              {objections.length === 1 ? 'One person' : `${objections.length} people`} said this
              doesn’t work for them
            </p>
            <p className="mt-1 text-clay/90">{objections.join(', ')}</p>
          </div>
        ) : null}

        {concerns.length > 0 ? (
          <div className="mt-4 rounded-xl bg-paper-deep px-4 py-3.5">
            <p className="text-sm font-semibold text-ink">Remaining concerns</p>
            <ul className="mt-1.5 space-y-1 text-sm text-ink-soft">
              {concerns.map((fit) => (
                <li key={fit.participantId}>
                  <span className="font-medium text-ink">{fit.name}:</span> {fit.mainReason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {option.smallestCompromise ? (
          <p className="mt-4 rounded-xl border border-emerald/25 bg-emerald-soft px-4 py-3 text-sm text-emerald-deep">
            Before you do: {option.smallestCompromise.change.toLowerCase()} — {option.smallestCompromise.effect.toLowerCase()}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 text-sm text-clay">{error}</p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="ghost">Not yet</Button>
          </DialogClose>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await lockDecisionAction(organizerCode, option.id)
                if (result.ok) {
                  setOpen(false)
                  router.refresh()
                } else setError(result.message ?? 'Could not lock this in.')
              })
            }
          >
            <Lock className="size-4" aria-hidden />
            {pending ? 'Locking…' : `Yes — we're going to ${option.destination.name}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-2.5">
      <dt className="w-32 shrink-0 text-sm text-ink-muted">{term}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  )
}

export function UnlockButton({ organizerCode }: { organizerCode: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <LockOpen className="size-4" aria-hidden />
          Unlock
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Reopen the decision?</DialogTitle>
        <DialogDescription>
          Reactions open again and the options are recalculated from everyone’s current answers.
          The task list stays as it is.
        </DialogDescription>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="ghost">Keep it locked</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await unlockDecisionAction(organizerCode)
                setOpen(false)
                router.refresh()
              })
            }
          >
            {pending ? 'Reopening…' : 'Reopen it'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
