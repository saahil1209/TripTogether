'use client'

import { Check, Heart, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { type ISODate, addDays, monthName, monthOf, rangeDays } from '@/lib/dates'
import type { DayState } from '@/lib/types'

const MODES = [
  { id: 'can', label: 'Can go', Icon: Check, chip: 'bg-card text-ink border-line', on: 'bg-ink text-paper border-ink' },
  { id: 'prefer', label: 'Prefer', Icon: Heart, chip: 'bg-card text-ink border-line', on: 'bg-emerald text-white border-emerald' },
  { id: 'cant', label: "Can't go", Icon: X, chip: 'bg-card text-ink border-line', on: 'bg-clay text-white border-clay' },
] as const satisfies readonly { id: DayState; label: string; Icon: typeof Check; chip: string; on: string }[]

const DAY_STYLES: Record<DayState, string> = {
  can: 'bg-card text-ink border-line hover:border-ink/30',
  prefer: 'bg-emerald text-white border-emerald',
  cant: 'bg-clay-soft text-clay border-clay/40 line-through',
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export interface AvailabilityValue {
  cantGo: ISODate[]
  preferDates: ISODate[]
}

/**
 * Days start as "can go", so the only thing anyone has to do is mark the days
 * they can't. Painting a range works by dragging, or by tapping each day.
 */
export function AvailabilityCalendar({
  windowStart,
  windowEnd,
  value,
  onChange,
}: {
  windowStart: ISODate
  windowEnd: ISODate
  value: AvailabilityValue
  onChange: (next: AvailabilityValue) => void
}) {
  const [mode, setMode] = useState<DayState>('cant')
  const painting = useRef(false)

  const cant = useMemo(() => new Set(value.cantGo), [value.cantGo])
  const prefer = useMemo(() => new Set(value.preferDates), [value.preferDates])

  const days = useMemo(() => rangeDays(windowStart, windowEnd), [windowStart, windowEnd])

  const months = useMemo(() => {
    const grouped = new Map<string, ISODate[]>()
    for (const day of days) {
      const key = day.slice(0, 7)
      const list = grouped.get(key)
      if (list) list.push(day)
      else grouped.set(key, [day])
    }
    return [...grouped.entries()]
  }, [days])

  const stateOf = useCallback(
    (day: ISODate): DayState => (cant.has(day) ? 'cant' : prefer.has(day) ? 'prefer' : 'can'),
    [cant, prefer],
  )

  const apply = useCallback(
    (day: ISODate, next: DayState) => {
      if (stateOf(day) === next) return
      const nextCant = new Set(cant)
      const nextPrefer = new Set(prefer)
      nextCant.delete(day)
      nextPrefer.delete(day)
      if (next === 'cant') nextCant.add(day)
      if (next === 'prefer') nextPrefer.add(day)
      onChange({
        cantGo: days.filter((d) => nextCant.has(d)),
        preferDates: days.filter((d) => nextPrefer.has(d)),
      })
    },
    [cant, days, onChange, prefer, stateOf],
  )

  const counts = {
    can: days.filter((d) => stateOf(d) === 'can').length,
    prefer: prefer.size,
    cant: cant.size,
  }

  return (
    <div
      onPointerUp={() => { painting.current = false }}
      onPointerLeave={() => { painting.current = false }}
    >
      <div role="group" aria-label="What are you marking?" className="flex gap-2">
        {MODES.map(({ id, label, Icon, chip, on }) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => setMode(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors',
              mode === id ? on : chip,
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2.5 text-sm text-ink-muted">
        Everything starts as <span className="font-medium text-ink">can go</span>. Tap or drag
        across the days you want to change.
      </p>

      <div className="mt-5 space-y-6">
        {months.map(([key, monthDays]) => {
          const first = monthDays[0]!
          // Monday-first grid.
          const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
          return (
            <section key={key}>
              <h3 className="text-sm font-semibold text-ink">
                {monthName(monthOf(first))} {first.slice(0, 4)}
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
                {monthDays.map((day) => {
                  const state = stateOf(day)
                  const label = MODES.find((m) => m.id === state)!.label
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-label={`${day}: ${label}`}
                      aria-pressed={state !== 'can'}
                      onPointerDown={(event) => {
                        painting.current = true
                        event.currentTarget.releasePointerCapture(event.pointerId)
                        apply(day, mode)
                      }}
                      onPointerEnter={() => {
                        if (painting.current) apply(day, mode)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          apply(day, mode)
                        }
                      }}
                      className={cn(
                        'aspect-square rounded-lg border text-sm font-medium transition-colors select-none touch-none',
                        DAY_STYLES[state],
                      )}
                    >
                      {Number(day.slice(8, 10))}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <p className="mt-5 text-sm text-ink-soft" role="status" aria-live="polite">
        {counts.can} day{counts.can === 1 ? '' : 's'} you can go
        {counts.prefer > 0 ? `, ${counts.prefer} you'd prefer` : ''}
        {counts.cant > 0 ? `, ${counts.cant} you can't` : ''}.
      </p>
    </div>
  )
}

/** Marks everything outside the given range as a can't-go day. */
export function availableOnly(
  windowStart: ISODate,
  windowEnd: ISODate,
  from: ISODate,
  to: ISODate,
): ISODate[] {
  const ok = new Set(rangeDays(from, to))
  return rangeDays(windowStart, windowEnd).filter((d) => !ok.has(d))
}

export { addDays }
