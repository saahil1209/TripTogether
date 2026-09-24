import { ArrowRight, Lock } from 'lucide-react'
import Link from 'next/link'
import { GroupSummary, WhyNotList } from '@/components/group-summary'
import { InvalidLink } from '@/components/invalid-link'
import { OptionCard } from '@/components/option-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Wordmark } from '@/components/wordmark'
import { formatRange } from '@/lib/dates'
import { joinNames } from '@/lib/format'
import { currentParticipantId } from '@/lib/session'
import { loadTripByInvite, missingNames, recommendationFor, submittedResponses } from '@/lib/trips'

export const metadata = { title: 'The options — TripTogether' }
export const dynamic = 'force-dynamic'

export default async function ResultsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const state = await loadTripByInvite(code)

  if (!state) {
    return (
      <InvalidLink
        title="This link doesn’t work"
        body="Ask whoever shared it to send it again."
      />
    )
  }

  const { trip } = state
  const participantId = await currentParticipantId(trip.id)
  const responded = submittedResponses(state)
  const missing = missingNames(state)

  /* No anchoring: the results exist only once the organizer publishes them. */
  if (!trip.publishedAt) {
    const youResponded = responded.some((r) => r.participantId === participantId)
    return (
      <Shell tripName={trip.name}>
        <Card>
          <CardBody>
            <h1 className="text-3xl">Not ready yet</h1>
            <p className="mt-3 text-ink-soft">
              {responded.length} of {state.participants.length} have responded. The options appear
              here the moment the organizer publishes them — which keeps anyone’s half-formed
              answers from steering everybody else’s.
            </p>
            {!youResponded ? (
              <Button asChild className="mt-5">
                <Link href={`/join/${code}`}>
                  Put your answers in
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            ) : (
              <p className="mt-5 rounded-xl bg-paper-deep px-4 py-3 text-sm text-ink-soft">
                Yours are in. Nothing else for you to do until this is published.
              </p>
            )}
          </CardBody>
        </Card>
      </Shell>
    )
  }

  const recommendation = recommendationFor(state)
  const you = participantId

  return (
    <Shell tripName={trip.name}>
      <header>
        <h1 className="text-4xl">{recommendation.headline}</h1>
        <p className="mt-3 text-ink-soft">{recommendation.detail}</p>
        <p className="mt-3 text-sm text-ink-muted">
          {trip.tripLengthDays} days in {formatRange(trip.windowStart, trip.windowEnd)} · built
          from {responded.length} of {state.participants.length} sets of answers
        </p>
        {missing.length > 0 ? (
          <p className="mt-4 rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber">
            Published after the deadline without {joinNames(missing)}. Their constraints are not in
            any of this — if they join later, the options can change.
          </p>
        ) : null}
      </header>

      <GroupSummary boundaries={recommendation.boundaries} fairness={recommendation.fairness} />

      {recommendation.state === 'ok' ? (
        <>
          {recommendation.options.map((option, index) => (
            <OptionCard
              key={option.id}
              option={option}
              index={index}
              youId={you}
              you={option.perPerson.find((p) => p.participantId === you) ?? null}
            />
          ))}

          <WhyNotList items={recommendation.whyNot} />

          <Card>
            <CardBody className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl">Ready to settle it?</h2>
                <p className="mt-1 text-ink-soft">
                  Everyone reacts once per option, then the organizer locks one in.
                </p>
              </div>
              <Button asChild size="lg" className="shrink-0">
                <Link href={`/trip/${code}/decide`}>
                  <Lock className="size-4" aria-hidden />
                  Go and decide
                </Link>
              </Button>
            </CardBody>
          </Card>
        </>
      ) : (
        <Card>
          <CardBody>
            <Badge tone="amber">Nothing workable yet</Badge>
            <h2 className="mt-3 text-2xl">{recommendation.headline}</h2>
            <p className="mt-2 text-ink-soft">{recommendation.detail}</p>
            {recommendation.dateFix ? (
              <p className="mt-4 rounded-xl border border-emerald/25 bg-emerald-soft px-4 py-3.5 text-emerald-deep">
                {recommendation.dateFix.description}
              </p>
            ) : null}
            <p className="mt-4 text-sm text-ink-muted">
              Changing one answer may be all it takes. Whoever’s constraint is named above can
              revisit theirs, and this recalculates straight away.
            </p>
          </CardBody>
        </Card>
      )}

      {recommendation.state !== 'ok' ? <WhyNotList items={recommendation.whyNot} /> : null}
    </Shell>
  )
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
