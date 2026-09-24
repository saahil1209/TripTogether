'use client'

import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useOptimistic, useTransition } from 'react'
import { setTaskDoneAction, setTaskOwnerAction } from '@/app/actions'
import { CopyButton } from '@/components/copy-button'
import { AlignmentMatrix } from '@/components/alignment-matrix'
import { Card, CardBody, SectionTitle } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { formatRange } from '@/lib/dates'
import { rupees } from '@/lib/format'
import type { TripOption } from '@/lib/recommendations'
import { STAY_TIER_SHORT } from '@/lib/types'

export interface TaskItem {
  id: string
  label: string
  ownerParticipantId: string | null
  done: boolean
}

export function TripLocked({
  inviteCode,
  option,
  people,
  tasks,
  youId,
  organizerControls,
}: {
  inviteCode: string
  option: TripOption
  people: { id: string; name: string }[]
  tasks: TaskItem[]
  youId: string | null
  organizerControls?: React.ReactNode
}) {
  const summary = whatsappSummary(option, tasks, people)

  return (
    <div className="space-y-6">
      <Card className="rise overflow-hidden">
        <div className="bg-emerald px-6 py-8 text-center text-white">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-white/80">
            It’s decided
          </p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl">You have a trip 🎉</h1>
          <p className="mt-4 font-display text-2xl">{option.destination.name}</p>
          <p className="mt-1 text-white/90">
            {formatRange(option.start, option.end)} · {option.days} days
          </p>
        </div>

        <CardBody className="space-y-5">
          <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
            <Fact label="Where">{option.destination.name}, {option.destination.region}</Fact>
            <Fact label="Budget, all-in">
              {rupees(option.costLow)}–{rupees(option.costHigh)}
              <span className="block text-xs font-normal text-ink-muted">per person, approximate</span>
            </Fact>
            <Fact label="Stay">{STAY_TIER_SHORT[option.tier]}</Fact>
          </dl>

          <div>
            <SectionTitle>Where everyone landed</SectionTitle>
            <AlignmentMatrix className="mt-2.5" fits={option.perPerson} youId={youId} />
          </div>

          {organizerControls ? (
            <div className="flex justify-end border-t border-line-soft pt-4">{organizerControls}</div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-xl">Who’s doing what</h2>
          <p className="mt-1 text-ink-soft">
            One owner per job. Tap a name to hand it over.
          </p>
          <TaskList inviteCode={inviteCode} tasks={tasks} people={people} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-xl">Paste this into the group chat</h2>
          <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-line bg-paper-deep px-4 py-3.5 font-sans text-sm text-ink-soft">
            {summary}
          </pre>
          <CopyButton
            value={summary}
            className="mt-3"
            label="Copy the summary"
            copiedLabel="Copied — go paste it"
          />
        </CardBody>
      </Card>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card px-4 py-3.5">
      <dt className="text-xs uppercase tracking-[0.1em] text-ink-muted">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{children}</dd>
    </div>
  )
}

function TaskList({
  inviteCode, tasks, people,
}: { inviteCode: string; tasks: TaskItem[]; people: { id: string; name: string }[] }) {
  const router = useRouter()
  const [, start] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(
    tasks,
    (current: TaskItem[], patch: { id: string } & Partial<TaskItem>) =>
      current.map((task) => (task.id === patch.id ? { ...task, ...patch } : task)),
  )

  return (
    <ul className="mt-4 space-y-2">
      {optimistic.map((task) => (
        <li key={task.id} className="rounded-xl border border-line px-4 py-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={task.done}
              aria-label={`Mark "${task.label}" as ${task.done ? 'not done' : 'done'}`}
              onClick={() =>
                start(async () => {
                  setOptimistic({ id: task.id, done: !task.done })
                  await setTaskDoneAction(inviteCode, task.id, !task.done)
                  router.refresh()
                })
              }
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                task.done ? 'border-emerald bg-emerald text-white' : 'border-line hover:border-ink/30',
              )}
            >
              {task.done ? <Check className="size-3.5" aria-hidden /> : null}
            </button>

            <div className="min-w-0 flex-1">
              <p className={cn('font-medium text-ink', task.done && 'text-ink-muted line-through')}>
                {task.label}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {people.map((person) => {
                  const owns = task.ownerParticipantId === person.id
                  return (
                    <button
                      key={person.id}
                      type="button"
                      aria-pressed={owns}
                      onClick={() =>
                        start(async () => {
                          const next = owns ? null : person.id
                          setOptimistic({ id: task.id, ownerParticipantId: next })
                          await setTaskOwnerAction(inviteCode, task.id, next)
                          router.refresh()
                        })
                      }
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                        owns
                          ? 'border-emerald bg-emerald-soft text-emerald-deep'
                          : 'border-line text-ink-muted hover:border-ink/25 hover:text-ink',
                      )}
                    >
                      {person.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function whatsappSummary(
  option: TripOption,
  tasks: TaskItem[],
  people: { id: string; name: string }[],
): string {
  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.name ?? 'unassigned'
  return [
    `IT'S DECIDED 🎉 ${option.destination.name}, ${formatRange(option.start, option.end)}`,
    ``,
    `📍 ${option.destination.name}, ${option.destination.region}`,
    `📅 ${option.days} days, ${formatRange(option.start, option.end)}`,
    `💰 About ${rupees(option.costLow)}–${rupees(option.costHigh)} each, all-in including travel`,
    `🛏 ${STAY_TIER_SHORT[option.tier]}`,
    ``,
    `Who's doing what:`,
    ...tasks.map((task) => `• ${task.label} — ${nameOf(task.ownerParticipantId)}`),
    ``,
    `Decided with TripTogether — no more polls.`,
  ].join('\n')
}
