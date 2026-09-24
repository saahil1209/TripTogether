import { CheckCircle2, Circle, Eye, Lock, PartyPopper } from 'lucide-react'
import Link from 'next/link'
import { GroupSummary, WhyNotList } from '@/components/group-summary'
import { InvalidLink } from '@/components/invalid-link'
import { OptionCard } from '@/components/option-card'
import { PublishButton, UnpublishButton } from '@/components/publish-button'
import { ReminderMessage, ShareLink } from '@/components/share-link'
import { TripSettings } from '@/components/trip-settings'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, SectionTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Wordmark } from '@/components/wordmark'
import { formatDate, formatRange } from '@/lib/dates'
import {
  canPublish, deadlinePassed, everyoneResponded, hasResponded, loadTripByOrganizer,
  missingNames, recommendationFor, submittedResponses,
} from '@/lib/trips'

export const metadata = { title: 'Organizer — TripTogether' }
export const dynamic = 'force-dynamic'

export default async function OrganizerPage({
  params, searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ new?: string; demo?: string }>
}) {
  const { code } = await params
  const { new: isNew, demo } = await searchParams
  const state = await loadTripByOrganizer(code)

  if (!state) {
    return (
      <InvalidLink
        title="This organizer link doesn’t work"
        body="Organizer links are private and separate from the link you share with the group. Check you’ve used the right one."
      />
    )
  }

  const { trip, participants } = state
  const responded = submittedResponses(state)
  const missing = missingNames(state)
  const complete = everyoneResponded(state)
  const overdue = deadlinePassed(trip)
  const publishable = canPublish(state)
  const published = Boolean(trip.publishedAt)
  const recommendation = recommendationFor(state)

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-5 pb-24 sm:px-8">
      <header className="flex items-center justify-between py-7">
        <Wordmark />
        <Badge tone="outline">
          <Eye className="size-3.5" aria-hidden />
          Organizer only
        </Badge>
      </header>

      <main className="space-y-6">
        <div>
          <h1 className="text-4xl">{trip.name}</h1>
          <p className="mt-2 text-ink-soft">
            {trip.tripLengthDays} days somewhere in {formatRange(trip.windowStart, trip.windowEnd)}
            {trip.responseDeadline ? ` · answers wanted by ${formatDate(trip.responseDeadline)}` : ''}
          </p>
        </div>

        {isNew || demo ? (
          <div className="rise rounded-card border border-emerald/25 bg-emerald-soft px-5 py-4">
            <p className="flex items-center gap-2 font-medium text-emerald-deep">
              <PartyPopper className="size-4" aria-hidden />
              {demo ? 'Demo trip loaded' : 'Your trip is live'}
            </p>
            <p className="mt-1 text-emerald-deep/90">
              {demo
                ? 'Five friends, five sets of answers, already submitted. Everything below is what Riya would see.'
                : 'Share the link below. You won’t need to chase anyone through a spreadsheet — this page tracks it.'}
            </p>
            <p className="mt-2 text-sm text-emerald-deep/80">
              Bookmark this page: it’s your private organizer link and it’s the only way back in.
            </p>
          </div>
        ) : null}

        {/* ------------------------------------------------------- sharing */}
        <Card>
          <CardBody className="space-y-5">
            <div>
              <SectionTitle>The link everyone else uses</SectionTitle>
              <p className="mt-1.5 text-sm text-ink-soft">
                One link for the whole group. Each person picks their own name — no accounts.
              </p>
              <ShareLink className="mt-3" path={`/join/${trip.inviteCode}`} />
            </div>

            {!complete ? (
              <div className="border-t border-line-soft pt-5">
                <SectionTitle>A nudge you can paste</SectionTitle>
                <div className="mt-3">
                  <ReminderMessage
                    path={`/join/${trip.inviteCode}`}
                    tripName={trip.name}
                    missing={missing}
                    deadline={trip.responseDeadline ? formatDate(trip.responseDeadline) : null}
                  />
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>

        {/* ------------------------------------------------- participation */}
        <Card>
          <CardBody>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl">
                {responded.length} of {participants.length} responded
              </h2>
              <span className="text-sm text-ink-muted">
                {complete
                  ? 'Everyone is in'
                  : `${missing.length} to go before the group picture is complete`}
              </span>
            </div>
            <Progress
              className="mt-3"
              value={responded.length}
              max={participants.length}
              label="Responses received"
            />

            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {participants.map((person) => {
                const done = hasResponded(state, person.id)
                return (
                  <li
                    key={person.id}
                    className="flex items-center gap-2.5 rounded-xl border border-line px-3.5 py-2.5"
                  >
                    {done ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald" aria-hidden />
                    ) : (
                      <Circle className="size-4 shrink-0 text-ink-muted/50" aria-hidden />
                    )}
                    <span className={done ? 'text-ink' : 'text-ink-muted'}>{person.name}</span>
                    <span className="sr-only">{done ? 'has responded' : 'has not responded yet'}</span>
                  </li>
                )
              })}
            </ul>

            {overdue && !complete ? (
              <p className="mt-4 rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber">
                The deadline has passed. You can publish now — the results will say who didn’t
                respond and that their constraints aren’t included.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <TripSettings
          organizerCode={code}
          locked={Boolean(trip.lockedAt)}
          published={published}
          initial={{
            name: trip.name,
            windowStart: trip.windowStart,
            windowEnd: trip.windowEnd,
            tripLengthDays: trip.tripLengthDays,
            responseDeadline: trip.responseDeadline,
            decisionDeadline: trip.decisionDeadline,
          }}
          people={participants.map((p) => ({
            id: p.id,
            name: p.name,
            hasResponded: hasResponded(state, p.id),
          }))}
        />

        {/* ------------------------------------------------ early picture */}
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-2xl">
              {published ? 'What the group can see' : complete ? 'The full picture' : 'The early picture'}
            </h2>
            {published ? (
              <Badge tone="emerald">Published</Badge>
            ) : complete ? (
              <Badge tone="sky">Based on all {participants.length} responses</Badge>
            ) : (
              <Badge tone="amber">
                Based on {responded.length} of {participants.length} responses — this will change
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm text-ink-muted">
            {published
              ? 'Everyone with the group link can see this.'
              : complete
                ? 'Only you can see this until you publish it.'
                : 'Only you can see this. Nobody else sees anything until you publish — and these options will move as the rest come in.'}
          </p>

          <div className="mt-4 space-y-5">
            {recommendation.state === 'waiting' ? (
              <Card>
                <CardBody>
                  <h3 className="text-xl">{recommendation.headline}</h3>
                  <p className="mt-1.5 text-ink-soft">{recommendation.detail}</p>
                </CardBody>
              </Card>
            ) : (
              <>
                <Card>
                  <CardBody>
                    <h3 className="text-xl">{recommendation.headline}</h3>
                    <p className="mt-1.5 text-ink-soft">{recommendation.detail}</p>
                  </CardBody>
                </Card>

                <GroupSummary
                  boundaries={recommendation.boundaries}
                  fairness={recommendation.fairness}
                  namesAllowed
                />

                {recommendation.options.map((option, index) => (
                  <OptionCard key={option.id} option={option} index={index} />
                ))}

                <WhyNotList items={recommendation.whyNot} />
              </>
            )}
          </div>
        </section>

        {/* ------------------------------------------------------ publish */}
        <Card>
          <CardBody>
            {published ? (
              <>
                <h2 className="text-xl">Results are with the group</h2>
                <p className="mt-1.5 text-ink-soft">
                  Everyone can see the options and react. When the group has settled, you lock it in.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href={`/trip/${trip.inviteCode}/decide`}>
                      <Lock className="size-4" aria-hidden />
                      Go to the decision
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/trip/${trip.inviteCode}/results`}>See the group view</Link>
                  </Button>
                  {!trip.lockedAt ? <UnpublishButton organizerCode={code} /> : null}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl">Publish to the group</h2>
                <p className="mt-1.5 text-ink-soft">
                  This is the moment everyone else first sees anything. Until then nobody can be
                  nudged by anybody else’s answers.
                </p>
                <div className="mt-4">
                  <PublishButton
                    organizerCode={code}
                    enabled={publishable}
                    blockedReason={
                      responded.length < 2
                        ? 'At least two people need to respond first.'
                        : `Waiting on ${missing.length} more ${missing.length === 1 ? 'response' : 'responses'}${
                          trip.responseDeadline ? `, or until ${formatDate(trip.responseDeadline)} passes` : ''}.`
                    }
                  />
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </main>
    </div>
  )
}
