'use client'

import { ArrowLeft, ArrowRight, Check, Cloud, CloudOff, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { saveDraftAction, submitResponseAction } from '@/app/actions'
import { AvailabilityCalendar } from '@/components/availability-calendar'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Progress } from '@/components/ui/progress'
import { SwitchParticipant } from '@/components/switch-participant'
import { cn } from '@/lib/cn'
import { formatRange } from '@/lib/dates'
import { rupees } from '@/lib/format'
import type { DraftPreferences } from '@/lib/schemas'
import {
  CITIES, CITY_LABELS, DEAL_BREAKERS, DEAL_BREAKER_LABELS, VIBES, VIBE_LABELS,
} from '@/lib/types'
import type { DealBreakerId, Vibe } from '@/lib/types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const STEP_TITLES = [
  'Where are you travelling from?',
  'When can you travel?',
  'What can you spend?',
  'What kind of trip?',
  'What would make this a no?',
  'One last look',
]

export function PreferenceFlow({
  inviteCode,
  windowStart,
  windowEnd,
  tripLengthDays,
  initialDraft,
  initialStep,
  participantName,
  onSubmitted,
}: {
  inviteCode: string
  windowStart: string
  windowEnd: string
  tripLengthDays: number
  initialDraft: DraftPreferences
  initialStep: number
  participantName: string
  onSubmitted: () => void
}) {
  const [draft, setDraft] = useState<DraftPreferences>(initialDraft)
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 0), STEP_TITLES.length - 1))
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(draft)

  /* Autosave every change, so closing the tab never loses an answer. */
  const scheduleSave = useCallback(
    (next: DraftPreferences, atStep: number) => {
      latest.current = next
      setSaveState('saving')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        const result = await saveDraftAction(inviteCode, latest.current, atStep)
        setSaveState(result.ok ? 'saved' : 'error')
        if (!result.ok) setError(result.message ?? null)
      }, 500)
    },
    [inviteCode],
  )

  const update = useCallback(
    (patch: DraftPreferences) => {
      setError(null)
      setDraft((prev) => {
        const next = { ...prev, ...patch }
        scheduleSave(next, step)
        return next
      })
    },
    [scheduleSave, step],
  )

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  // Moving between questions should move the screen reader too.
  useEffect(() => { headingRef.current?.focus() }, [step])

  const problem = useMemo(() => stepProblem(step, draft), [step, draft])

  async function goNext() {
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    if (step < STEP_TITLES.length - 1) {
      const nextStep = step + 1
      setStep(nextStep)
      scheduleSave(latest.current, nextStep)
      return
    }

    setSubmitting(true)
    if (timer.current) clearTimeout(timer.current)
    const saved = await saveDraftAction(inviteCode, latest.current, STEP_TITLES.length)
    if (!saved.ok) {
      setSubmitting(false)
      setError(saved.message ?? 'Could not save your answers.')
      return
    }
    const result = await submitResponseAction(inviteCode)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.message ?? 'Some answers are still missing.')
      return
    }
    onSubmitted()
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-10 bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto max-w-xl px-5 pt-5 sm:px-8">
          <div className="flex items-center justify-between text-sm text-ink-muted">
            <span>
              Question {step + 1} of {STEP_TITLES.length}
            </span>
            <SaveIndicator state={saveState} />
          </div>
          {step === 0 ? (
            <div className="mt-1">
              <SwitchParticipant inviteCode={inviteCode} name={participantName} />
            </div>
          ) : null}
          <Progress
            className="mt-2.5"
            value={step + 1}
            max={STEP_TITLES.length}
            label="Progress through the questions"
          />
        </div>
      </div>

      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-40 pt-8 sm:px-8">
        <h1
          ref={headingRef}
          tabIndex={-1}
          key={step}
          className="rise text-3xl outline-none sm:text-4xl"
        >
          {STEP_TITLES[step]}
        </h1>

        <div className="mt-7">
          {step === 0 ? <CityStep draft={draft} update={update} /> : null}
          {step === 1 ? (
            <DatesStep
              draft={draft}
              update={update}
              windowStart={windowStart}
              windowEnd={windowEnd}
              tripLengthDays={tripLengthDays}
            />
          ) : null}
          {step === 2 ? <BudgetStep draft={draft} update={update} /> : null}
          {step === 3 ? <VibesStep draft={draft} update={update} /> : null}
          {step === 4 ? <DealBreakersStep draft={draft} update={update} /> : null}
          {step === 5 ? <ReviewStep draft={draft} windowStart={windowStart} windowEnd={windowEnd} /> : null}
        </div>

        {error ? (
          <p role="alert" className="mt-6 rounded-xl bg-clay-soft px-4 py-3 text-sm text-clay">
            {error}
          </p>
        ) : null}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-4 sm:px-8">
          <Button
            type="button"
            variant="ghost"
            onClick={() => { setError(null); setStep((s) => Math.max(0, s - 1)) }}
            disabled={step === 0 || submitting}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Button>
          <Button type="button" className="flex-1" size="lg" onClick={goNext} disabled={submitting}>
            {submitting ? 'Sending…' : step === STEP_TITLES.length - 1 ? 'Submit my answers' : 'Next'}
            {!submitting && step < STEP_TITLES.length - 1 ? (
              <ArrowRight className="size-4" aria-hidden />
            ) : null}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- per step */

function stepProblem(step: number, draft: DraftPreferences): string | null {
  if (step === 0 && !draft.fromCity) return 'Pick the city you’ll be travelling from.'
  if (step === 2) {
    if (!draft.maxBudget) return 'Give us your all-in maximum. It’s the one number that has to be right.'
    if (draft.comfortableBudget && draft.comfortableBudget > draft.maxBudget) {
      return 'Your comfortable budget can’t be higher than your maximum.'
    }
  }
  if (step === 3 && !draft.topVibe) return 'Pick at least one, then choose which matters most.'
  if (step === 4 && draft.dealBreakers?.includes('long_travel') && !draft.maxTravelHours) {
    return 'How many hours is too many?'
  }
  return null
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return <span className="text-ink-muted/60">Autosaves as you go</span>
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Saving
      </span>
    )
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-clay">
        <CloudOff className="size-3.5" aria-hidden />
        Not saved
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-emerald">
      <Cloud className="size-3.5" aria-hidden />
      Saved
    </span>
  )
}

interface StepProps {
  draft: DraftPreferences
  update: (patch: DraftPreferences) => void
}

function CityStep({ draft, update }: StepProps) {
  return (
    <div>
      <p className="text-ink-soft">
        This decides what the trip actually costs you and how long you spend getting there.
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {CITIES.map((city) => (
          <button
            key={city}
            type="button"
            aria-pressed={draft.fromCity === city}
            onClick={() => update({ fromCity: city })}
            className={cn(
              'rounded-xl border px-4 py-4 text-left text-base font-medium transition-colors',
              draft.fromCity === city
                ? 'border-emerald bg-emerald-soft text-emerald-deep'
                : 'border-line bg-card text-ink hover:border-ink/25',
            )}
          >
            {CITY_LABELS[city]}
          </button>
        ))}
      </div>
    </div>
  )
}

function DatesStep({
  draft, update, windowStart, windowEnd, tripLengthDays,
}: StepProps & { windowStart: string; windowEnd: string; tripLengthDays: number }) {
  return (
    <div>
      <p className="text-ink-soft">
        The trip is {tripLengthDays} days somewhere in {formatRange(windowStart, windowEnd)}. Mark
        the days you genuinely can’t make — those are treated as hard limits.
      </p>
      <div className="mt-6">
        <AvailabilityCalendar
          windowStart={windowStart}
          windowEnd={windowEnd}
          value={{ cantGo: draft.cantGo ?? [], preferDates: draft.preferDates ?? [] }}
          onChange={(next) => update(next)}
        />
      </div>
    </div>
  )
}

function BudgetStep({ draft, update }: StepProps) {
  const [comfortableTouched, setComfortableTouched] = useState(
    draft.comfortableBudget !== undefined && draft.comfortableBudget !== draft.maxBudget,
  )

  return (
    <div>
      <p className="text-ink-soft">
        Per person, all-in — stay, food, activities and getting there from your city.
      </p>

      <div className="mt-7 space-y-6">
        <Field
          label="My absolute maximum"
          htmlFor="maxBudget"
          hint="A hard limit. Nothing above this will ever be shown to the group as workable for you."
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">₹</span>
            <Input
              id="maxBudget"
              type="number"
              inputMode="numeric"
              min={1000}
              step={1000}
              className="pl-8 text-lg"
              value={draft.maxBudget ?? ''}
              onChange={(event) => {
                const value = event.target.value ? Number(event.target.value) : undefined
                update({
                  maxBudget: value,
                  ...(comfortableTouched ? {} : { comfortableBudget: value }),
                })
              }}
            />
          </div>
        </Field>

        <Field
          label="What I’d be comfortable spending"
          htmlFor="comfortableBudget"
          hint="Optional. Going above this is a compromise, not a blocker — which is exactly how it gets treated."
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">₹</span>
            <Input
              id="comfortableBudget"
              type="number"
              inputMode="numeric"
              min={1000}
              step={1000}
              className="pl-8 text-lg"
              value={draft.comfortableBudget ?? ''}
              onChange={(event) => {
                setComfortableTouched(true)
                update({ comfortableBudget: event.target.value ? Number(event.target.value) : undefined })
              }}
            />
          </div>
        </Field>

        {draft.maxBudget ? (
          <p className="rounded-xl bg-paper-deep px-4 py-3 text-sm text-ink-soft">
            We’ll only show you trips that come in under {rupees(draft.maxBudget)} all-in.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function VibesStep({ draft, update }: StepProps) {
  const picked: Vibe[] = useMemo(
    () => (draft.topVibe ? [draft.topVibe, ...(draft.otherVibes ?? [])] : (draft.otherVibes ?? [])),
    [draft.topVibe, draft.otherVibes],
  )

  function toggle(vibe: Vibe) {
    const isPicked = picked.includes(vibe)
    const next = isPicked ? picked.filter((v) => v !== vibe) : [...picked, vibe]
    if (next.length > 3) return
    update({ topVibe: next[0], otherVibes: next.slice(1) })
  }

  function makeTop(vibe: Vibe) {
    update({ topVibe: vibe, otherVibes: picked.filter((v) => v !== vibe) })
  }

  return (
    <div>
      <p className="text-ink-soft">Pick up to three, then tell us which one matters most.</p>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {VIBES.map((vibe) => {
          const isPicked = picked.includes(vibe)
          return (
            <button
              key={vibe}
              type="button"
              aria-pressed={isPicked}
              disabled={!isPicked && picked.length >= 3}
              onClick={() => toggle(vibe)}
              className={cn(
                'rounded-xl border px-4 py-5 text-base font-medium transition-colors disabled:opacity-40',
                isPicked
                  ? 'border-emerald bg-emerald-soft text-emerald-deep'
                  : 'border-line bg-card text-ink hover:border-ink/25',
              )}
            >
              {VIBE_LABELS[vibe]}
            </button>
          )
        })}
      </div>

      {picked.length > 0 ? (
        <fieldset className="mt-8 rounded-xl border border-line bg-card p-5">
          <legend className="px-1 text-sm font-medium text-ink">Which one matters most?</legend>
          <div className="mt-2 space-y-1">
            {picked.map((vibe) => (
              <label
                key={vibe}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-paper-deep"
              >
                <input
                  type="radio"
                  name="topVibe"
                  aria-label={`${VIBE_LABELS[vibe]} matters most`}
                  className="size-4 accent-[#0e7a63]"
                  checked={draft.topVibe === vibe}
                  onChange={() => makeTop(vibe)}
                />
                <span className="text-ink">{VIBE_LABELS[vibe]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  )
}

function DealBreakersStep({ draft, update }: StepProps) {
  const chosen = draft.dealBreakers ?? []

  function toggle(dealBreaker: DealBreakerId) {
    const next = chosen.includes(dealBreaker)
      ? chosen.filter((d) => d !== dealBreaker)
      : [...chosen, dealBreaker]
    update({
      dealBreakers: next,
      ...(next.includes('long_travel') ? {} : { maxTravelHours: null }),
    })
  }

  return (
    <div>
      <p className="text-ink-soft">
        Only pick something you genuinely won’t compromise on. Anything here becomes a hard
        limit that no amount of enthusiasm from anyone else can override.
      </p>

      <div className="mt-6 space-y-2">
        {DEAL_BREAKERS.map((dealBreaker) => {
          const isChosen = chosen.includes(dealBreaker)
          return (
            <div key={dealBreaker}>
              <button
                type="button"
                aria-pressed={isChosen}
                onClick={() => toggle(dealBreaker)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors',
                  isChosen
                    ? 'border-clay/50 bg-clay-soft text-clay'
                    : 'border-line bg-card text-ink hover:border-ink/25',
                )}
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-md border',
                    isChosen ? 'border-clay bg-clay text-white' : 'border-line',
                  )}
                  aria-hidden
                >
                  {isChosen ? <Check className="size-3.5" /> : null}
                </span>
                <span className="font-medium">{DEAL_BREAKER_LABELS[dealBreaker]}</span>
              </button>

              {dealBreaker === 'long_travel' && isChosen ? (
                <div className="mt-2 rounded-xl border border-line bg-card px-4 py-3">
                  <label htmlFor="maxTravelHours" className="text-sm font-medium text-ink">
                    More than how many hours each way?
                  </label>
                  <Input
                    id="maxTravelHours"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={48}
                    className="mt-2 w-32"
                    value={draft.maxTravelHours ?? ''}
                    onChange={(event) =>
                      update({ maxTravelHours: event.target.value ? Number(event.target.value) : null })
                    }
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <Field
        className="mt-6"
        label="Anything else? (optional)"
        htmlFor="dealBreakerNote"
        hint="Free text. Only you and the organizer see this."
      >
        <textarea
          id="dealBreakerNote"
          rows={3}
          maxLength={500}
          className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-ink placeholder:text-ink-muted/70 focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
          placeholder="I can't do 5am flights, I'll fall asleep by lunch."
          value={draft.dealBreakerNote ?? ''}
          onChange={(event) => update({ dealBreakerNote: event.target.value || null })}
        />
      </Field>
    </div>
  )
}

function ReviewStep({
  draft, windowStart, windowEnd,
}: { draft: DraftPreferences; windowStart: string; windowEnd: string }) {
  const cantCount = draft.cantGo?.length ?? 0
  const rows: { label: string; value: string }[] = [
    { label: 'Travelling from', value: draft.fromCity ? CITY_LABELS[draft.fromCity] : '—' },
    {
      label: 'Dates',
      value: cantCount === 0
        ? `Any dates in ${formatRange(windowStart, windowEnd)}`
        : `${cantCount} day${cantCount === 1 ? '' : 's'} marked can't go${
          draft.preferDates?.length ? `, ${draft.preferDates.length} preferred` : ''}`,
    },
    { label: 'Maximum, all-in', value: draft.maxBudget ? rupees(draft.maxBudget) : '—' },
    {
      label: 'Comfortable',
      value: draft.comfortableBudget ? rupees(draft.comfortableBudget) : '—',
    },
    { label: 'Matters most', value: draft.topVibe ? VIBE_LABELS[draft.topVibe] : '—' },
    {
      label: 'Also on your list',
      value: draft.otherVibes?.length ? draft.otherVibes.map((v) => VIBE_LABELS[v]).join(', ') : 'Nothing else',
    },
    {
      label: 'Hard no’s',
      value: draft.dealBreakers?.length
        ? draft.dealBreakers
          .map((d) =>
            d === 'long_travel' && draft.maxTravelHours
              ? `Travel over ${draft.maxTravelHours} hrs each way`
              : DEAL_BREAKER_LABELS[d],
          )
          .join(', ')
        : 'None',
    },
  ]

  return (
    <div>
      <p className="text-ink-soft">
        Nobody else sees your individual answers — only what they add up to across the group.
      </p>
      <dl className="mt-6 divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-card">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-4 px-5 py-3.5">
            <dt className="w-36 shrink-0 text-sm text-ink-muted">{row.label}</dt>
            <dd className="text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
      {draft.dealBreakerNote ? (
        <p className="mt-4 rounded-xl bg-paper-deep px-4 py-3 text-sm text-ink-soft">
          “{draft.dealBreakerNote}”
        </p>
      ) : null}
    </div>
  )
}
