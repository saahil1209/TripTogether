'use client'

import { Check, ChevronRight, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { saveDeeperAction } from '@/app/actions'
import { SwitchParticipant } from '@/components/switch-participant'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import type { DraftPreferences } from '@/lib/schemas'
import {
  COMFORT_LABELS, COMFORT_LEVELS, FLEXIBILITIES, FLEXIBILITY_LABELS,
  PACES, PACE_LABELS, PRIORITIES, PRIORITY_LABELS,
} from '@/lib/types'
import type { ComfortLevel, Flexibility, Pace, Priority } from '@/lib/types'

export function SubmittedState({
  inviteCode,
  name,
  respondedCount,
  participantCount,
  published,
  deeperDone,
  initial,
}: {
  inviteCode: string
  name: string
  respondedCount: number
  participantCount: number
  published: boolean
  deeperDone: boolean
  initial: DraftPreferences
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(deeperDone)
  const [pending, start] = useTransition()
  const [draft, setDraft] = useState<DraftPreferences>(initial)
  const remaining = Math.max(0, participantCount - respondedCount)

  function save() {
    start(async () => {
      const result = await saveDeeperAction(inviteCode, draft)
      if (result.ok) {
        setDone(true)
        setOpen(false)
        router.refresh()
      }
    })
  }

  function togglePriority(priority: Priority) {
    const current = draft.priorities ?? []
    const next = current.includes(priority)
      ? current.filter((p) => p !== priority)
      : current.length >= 3
        ? current
        : [...current, priority]
    setDraft({ ...draft, priorities: next })
  }

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-5 pb-24 sm:px-8">
      <main className="pt-20">
        <div className="rise flex size-12 items-center justify-center rounded-full bg-emerald-soft">
          <Check className="size-6 text-emerald" aria-hidden />
        </div>
        <h1 className="rise mt-6 text-3xl sm:text-4xl" style={{ animationDelay: '60ms' }}>
          That’s you in, {name}.
        </h1>
        <p className="rise mt-3 text-ink-soft" style={{ animationDelay: '110ms' }}>
          {published
            ? 'The results are ready for the whole group.'
            : remaining === 0
              ? 'Everyone has responded. The organizer can publish the results now.'
              : `${respondedCount} of ${participantCount} have responded. You’ll see the options once everyone’s in.`}
        </p>

        {published ? (
          <div className="rise mt-7 flex flex-wrap gap-3" style={{ animationDelay: '160ms' }}>
            <Button asChild size="lg">
              <Link href={`/trip/${inviteCode}/results`}>
                See the options
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        ) : (
          <p className="mt-7 rounded-xl bg-paper-deep px-4 py-3 text-sm text-ink-soft">
            Nothing is shown to anyone until the whole group has answered — so nobody’s answers
            nudge anybody else’s.
          </p>
        )}

        {/* Optional deeper pass. Skippable by design: the core pass is what counts. */}
        {!done ? (
          <Card className="mt-10">
            <CardBody>
              <h2 className="text-xl">Want to sharpen it?</h2>
              <p className="mt-2 text-ink-soft">
                Four more questions, entirely optional. They only affect how options are
                ranked — none of it can override anything you already told us.
              </p>

              {!open ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button onClick={() => setOpen(true)}>Answer them</Button>
                  <Button variant="ghost" onClick={() => setDone(true)}>
                    Skip
                  </Button>
                </div>
              ) : (
                <div className="mt-6 space-y-7">
                  <ChoiceRow<Pace>
                    label="What pace suits you?"
                    options={PACES}
                    labels={PACE_LABELS}
                    value={draft.pace ?? null}
                    onChange={(pace) => setDraft({ ...draft, pace })}
                  />
                  <ChoiceRow<ComfortLevel>
                    label="Where would you want to stay?"
                    options={COMFORT_LEVELS}
                    labels={COMFORT_LABELS}
                    value={draft.comfortLevel ?? null}
                    onChange={(comfortLevel) => setDraft({ ...draft, comfortLevel })}
                  />

                  <fieldset>
                    <legend className="text-sm font-medium text-ink">
                      Your top three priorities
                    </legend>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {PRIORITIES.map((priority) => {
                        const on = (draft.priorities ?? []).includes(priority)
                        return (
                          <button
                            key={priority}
                            type="button"
                            aria-pressed={on}
                            onClick={() => togglePriority(priority)}
                            className={cn(
                              'rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
                              on
                                ? 'border-emerald bg-emerald-soft text-emerald-deep'
                                : 'border-line bg-card text-ink hover:border-ink/25',
                            )}
                          >
                            {PRIORITY_LABELS[priority]}
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>

                  <ChoiceRow<Flexibility>
                    label="How flexible are you overall?"
                    options={FLEXIBILITIES}
                    labels={FLEXIBILITY_LABELS}
                    value={draft.flexibility ?? null}
                    onChange={(flexibility) => setDraft({ ...draft, flexibility })}
                  />

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={save} disabled={pending}>
                      {pending ? 'Saving…' : 'Save these too'}
                    </Button>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                      Not now
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        ) : null}

        <div className="mt-10 border-t border-line pt-6">
          <p className="text-sm text-ink-soft">
            Changed your mind about something? Editing your answers recalculates the options for
            everyone.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Button asChild variant="outline" size="sm">
              <Link href={`/join/${inviteCode}?edit=1`}>
                <Pencil className="size-4" aria-hidden />
                Edit my answers
              </Link>
            </Button>
            <SwitchParticipant inviteCode={inviteCode} name={name} />
          </div>
        </div>
      </main>
    </div>
  )
}

function ChoiceRow<T extends string>({
  label, options, labels, value, onChange,
}: {
  label: string
  options: readonly T[]
  labels: Record<T, string>
  value: T | null
  onChange: (value: T) => void
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={cn(
              'rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
              value === option
                ? 'border-emerald bg-emerald-soft text-emerald-deep'
                : 'border-line bg-card text-ink hover:border-ink/25',
            )}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
