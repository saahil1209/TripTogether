import { ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { InvalidLink } from '@/components/invalid-link'
import { LockInButton, UnlockButton } from '@/components/lock-in'
import { OptionCard } from '@/components/option-card'
import { ReactionBar, ReactionTally } from '@/components/reaction-bar'
import { TripLocked } from '@/components/trip-locked'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Wordmark } from '@/components/wordmark'
import { formatDate } from '@/lib/dates'
import { joinNames } from '@/lib/format'
import type { TripOption } from '@/lib/recommendations'
import type { ReactionValue } from '@/lib/schemas'
import { currentParticipantId } from '@/lib/session'
import {
  loadTripByInvite, lockedOption, reactionsFrozen, recommendationFor,
} from '@/lib/trips'

export const metadata = { title: 'Decide — TripTogether' }
export const dynamic = 'force-dynamic'

const EMPTY_TALLY: Record<ReactionValue, number> = { love: 0, happy: 0, could: 0, no: 0 }

export default async function DecidePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const state = await loadTripByInvite(code)

  if (!state) return <InvalidLink title="This link doesn’t work" />

  const { trip, participants } = state
  const participantId = await currentParticipantId(trip.id)
  const isOrganizer = Boolean(participantId) && participantId === trip.organizerParticipantId
  const people = participants.map((p) => ({ id: p.id, name: p.name }))

  if (!trip.publishedAt) {
    return (
      <Shell tripName={trip.name}>
        <Card>
          <CardBody>
            <h1 className="text-3xl">Nothing to decide yet</h1>
            <p className="mt-3 text-ink-soft">
              The options haven’t been published. Once the organizer publishes them, everyone
              reacts here and one gets locked in.
            </p>
            <Button asChild className="mt-5" variant="outline">
              <Link href={`/join/${code}`}>Back to your answers</Link>
            </Button>
          </CardBody>
        </Card>
      </Shell>
    )
  }

  /* A locked trip is served from its snapshot, not recomputed. */
  const locked = lockedOption(state)
  if (locked) {
    return (
      <Shell tripName={trip.name}>
        <TripLocked
          inviteCode={code}
          option={locked}
          people={people}
          youId={participantId}
          tasks={state.tasks.map((t) => ({
            id: t.id,
            label: t.label,
            ownerParticipantId: t.ownerParticipantId,
            done: t.done,
          }))}
          organizerControls={isOrganizer ? <UnlockButton organizerCode={trip.organizerCode} /> : null}
        />
      </Shell>
    )
  }

  const recommendation = recommendationFor(state)
  const frozen = reactionsFrozen(state)

  if (recommendation.options.length === 0) {
    return (
      <Shell tripName={trip.name}>
        <Card>
          <CardBody>
            <h1 className="text-3xl">{recommendation.headline}</h1>
            <p className="mt-3 text-ink-soft">{recommendation.detail}</p>
          </CardBody>
        </Card>
      </Shell>
    )
  }

  const tallies = new Map(
    recommendation.options.map((option) => {
      const counts = { ...EMPTY_TALLY }
      for (const reaction of state.reactions) {
        if (reaction.optionId === option.id) counts[reaction.reaction] += 1
      }
      return [option.id, counts]
    }),
  )

  const suggestion = suggest(recommendation.options, tallies)

  return (
    <Shell tripName={trip.name}>
      <header>
        <h1 className="text-4xl">Let’s settle it</h1>
        <p className="mt-3 text-ink-soft">
          React once to each option. You can change your mind until it’s locked — after that it
          holds, which is the whole point.
        </p>
        {trip.decisionDeadline ? (
          <p className="mt-3 text-sm text-ink-muted">
            {frozen
              ? `Reactions froze on ${formatDate(trip.decisionDeadline)}. What’s below is final.`
              : `Reactions freeze on ${formatDate(trip.decisionDeadline)}.`}
          </p>
        ) : null}
      </header>

      {suggestion ? (
        <Card className="border-emerald/30 bg-emerald-soft">
          <CardBody>
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-deep">
              <Sparkles className="size-4" aria-hidden />
              Where the group is landing
            </p>
            <p className="mt-1.5 text-emerald-deep/90">{suggestion.reason}</p>
          </CardBody>
        </Card>
      ) : null}

      {recommendation.options.map((option, index) => {
        const counts = tallies.get(option.id) ?? EMPTY_TALLY
        const objectors = state.reactions
          .filter((r) => r.optionId === option.id && r.reaction === 'no')
          .map((r) => people.find((p) => p.id === r.participantId)?.name ?? 'Someone')

        return (
          <OptionCard
            key={option.id}
            option={option}
            index={index}
            youId={participantId}
            you={option.perPerson.find((p) => p.participantId === participantId) ?? null}
          >
            <div className="space-y-3 border-t border-line-soft pt-5">
              <ReactionTally counts={counts} total={participants.length} />

              {participantId ? (
                <ReactionBar
                  inviteCode={code}
                  optionId={option.id}
                  current={
                    (state.reactions.find(
                      (r) => r.optionId === option.id && r.participantId === participantId,
                    )?.reaction as ReactionValue | undefined) ?? null
                  }
                  frozen={frozen}
                />
              ) : (
                <p className="rounded-xl bg-paper-deep px-4 py-3 text-sm text-ink-soft">
                  <Link href={`/join/${code}`} className="font-medium text-ink underline underline-offset-4">
                    Pick your name
                  </Link>{' '}
                  to react to this.
                </p>
              )}

              {objectors.length > 0 ? (
                <p className="text-sm text-clay">
                  {joinNames(objectors)} said this doesn’t work for them.
                </p>
              ) : null}

              {isOrganizer ? (
                <div className="pt-1">
                  <LockInButton
                    organizerCode={trip.organizerCode}
                    option={option}
                    objections={objectors}
                  />
                </div>
              ) : null}
            </div>
          </OptionCard>
        )
      })}

      {!isOrganizer ? (
        <Card>
          <CardBody>
            <Badge tone="neutral">Waiting on the organizer</Badge>
            <p className="mt-3 text-ink-soft">
              Once everyone has reacted, the organizer locks one in — and that’s the trip.
            </p>
          </CardBody>
        </Card>
      ) : null}
    </Shell>
  )
}

/**
 * The option with no ❌ and the most ❤️ + 👍. A suggestion, not a verdict: the
 * organizer still has to choose and confirm.
 */
function suggest(
  options: TripOption[],
  tallies: Map<string, Record<ReactionValue, number>>,
): { option: TripOption; reason: string } | null {
  const scored = options
    .map((option) => ({ option, counts: tallies.get(option.id) ?? EMPTY_TALLY }))
    .filter(({ counts }) => counts.love + counts.happy + counts.could + counts.no > 0)

  if (scored.length === 0) return null

  const clean = scored.filter(({ counts }) => counts.no === 0)
  if (clean.length === 0) {
    return {
      option: scored[0]!.option,
      reason: 'Every option has at least one ❌ so far. A single change to one of them may be all it takes — see the suggested compromises above.',
    }
  }

  const best = clean.sort(
    (a, b) =>
      b.counts.love + b.counts.happy - (a.counts.love + a.counts.happy) ||
      b.counts.love - a.counts.love ||
      a.option.id.localeCompare(b.option.id),
  )[0]!

  const positives = best.counts.love + best.counts.happy
  return {
    option: best.option,
    reason: `${best.option.destination.name} has no ❌ and ${positives} ${positives === 1 ? 'person is' : 'people are'} positive about it. That makes it the one to lock in unless someone speaks up.`,
  }
}

function Shell({ tripName, children }: { tripName: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-5 pb-24 sm:px-8">
      <header className="flex items-center justify-between py-7">
        <Wordmark />
        <span className="max-w-[45%] truncate text-sm text-ink-muted">{tripName}</span>
      </header>
      <main className="space-y-6">{children}</main>
    </div>
  )
}
