'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { reactAction } from '@/app/actions'
import { cn } from '@/lib/cn'
import type { ReactionValue } from '@/lib/schemas'

export const REACTIONS = [
  { id: 'love', emoji: '❤️', label: 'Love it', on: 'border-emerald bg-emerald-soft text-emerald-deep' },
  { id: 'happy', emoji: '👍', label: 'Happy', on: 'border-sky bg-sky-soft text-sky' },
  { id: 'could', emoji: '🤔', label: 'Could do it', on: 'border-amber bg-amber-soft text-amber' },
  { id: 'no', emoji: '❌', label: 'Doesn’t work for me', on: 'border-clay bg-clay-soft text-clay' },
] as const satisfies readonly { id: ReactionValue; emoji: string; label: string; on: string }[]

export function ReactionBar({
  inviteCode,
  optionId,
  current,
  frozen,
}: {
  inviteCode: string
  optionId: string
  current: ReactionValue | null
  frozen: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [value, setValue] = useState<ReactionValue | null>(current)
  const [error, setError] = useState<string | null>(null)

  function choose(next: ReactionValue) {
    if (frozen) return
    const previous = value
    setValue(next)
    setError(null)
    start(async () => {
      const result = await reactAction(inviteCode, optionId, next)
      if (result.ok) router.refresh()
      else {
        setValue(previous)
        setError(result.message ?? 'Could not save that.')
      }
    })
  }

  return (
    <div className="rounded-xl border border-line bg-paper-deep/50 p-3">
      <p className="px-1 text-sm font-medium text-ink">
        {frozen ? 'Reactions are closed' : value ? 'Your reaction' : 'Where do you stand?'}
      </p>
      <div role="group" aria-label="Your reaction to this option" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {REACTIONS.map((reaction) => {
          const active = value === reaction.id
          return (
            <button
              key={reaction.id}
              type="button"
              aria-pressed={active}
              disabled={frozen || pending}
              onClick={() => choose(reaction.id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition-colors disabled:opacity-60',
                active ? reaction.on : 'border-line bg-card text-ink-soft hover:border-ink/25',
              )}
            >
              <span aria-hidden className="text-lg leading-none">{reaction.emoji}</span>
              {reaction.label}
            </button>
          )
        })}
      </div>
      {!frozen ? (
        <p className="mt-2 px-1 text-xs text-ink-muted">
          You can change this until the decision is locked.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 px-1 text-sm text-clay">{error}</p>
      ) : null}
    </div>
  )
}

export function ReactionTally({
  counts, total,
}: { counts: Record<ReactionValue, number>; total: number }) {
  const voted = REACTIONS.reduce((sum, r) => sum + counts[r.id], 0)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
      {REACTIONS.map((reaction) => (
        <span key={reaction.id} className="inline-flex items-center gap-1.5 text-ink-soft">
          <span aria-hidden>{reaction.emoji}</span>
          <span className="font-medium text-ink">{counts[reaction.id]}</span>
          <span className="sr-only">{reaction.label}</span>
        </span>
      ))}
      <span className="text-ink-muted">
        {voted} of {total} reacted
      </span>
    </div>
  )
}
