'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { identifyAction } from '@/app/actions'
import { cn } from '@/lib/cn'
import { joinNames } from '@/lib/format'

/**
 * The whole of "signing in". No account, no email — the invite link plus one
 * tap. Deliberately shows no indication of who has already responded.
 */
export function NamePicker({
  inviteCode,
  tripName,
  people,
}: {
  inviteCode: string
  tripName: string
  people: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function pick(id: string) {
    setSelected(id)
    setError(null)
    start(async () => {
      const result = await identifyAction(inviteCode, id)
      if (result.ok) router.refresh()
      else {
        setSelected(null)
        setError(result.message ?? 'Could not continue.')
      }
    })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-16 sm:px-8">
      <main className="flex flex-1 flex-col justify-center pt-16">
        <p className="rise text-sm font-medium uppercase tracking-[0.16em] text-emerald">
          {tripName}
        </p>
        <h1 className="rise mt-4 text-3xl sm:text-4xl" style={{ animationDelay: '60ms' }}>
          Who are you?
        </h1>
        <p className="rise mt-3 text-ink-soft" style={{ animationDelay: '110ms' }}>
          You’re planning a trip with {joinNames(people.map((p) => p.name))}.
        </p>

        <div className="rise mt-8 space-y-2" style={{ animationDelay: '160ms' }}>
          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              disabled={pending}
              onClick={() => pick(person.id)}
              className={cn(
                'w-full rounded-xl border px-5 py-4 text-left text-lg font-medium transition-colors disabled:opacity-60',
                selected === person.id
                  ? 'border-emerald bg-emerald-soft text-emerald-deep'
                  : 'border-line bg-card text-ink hover:border-ink/25',
              )}
            >
              {person.name}
              {selected === person.id ? (
                <span className="ml-2 text-sm font-normal text-emerald">Opening your form…</span>
              ) : null}
            </button>
          ))}
        </div>

        {error ? (
          <p role="alert" className="mt-5 rounded-xl bg-clay-soft px-4 py-3 text-sm text-clay">
            {error}
          </p>
        ) : null}

        <p className="mt-8 text-sm text-ink-muted">
          Takes about 90 seconds. It saves as you go, so you can stop and come back.
        </p>
      </main>
    </div>
  )
}
