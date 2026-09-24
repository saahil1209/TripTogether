import { InvalidLink } from '@/components/invalid-link'
import { JoinFlow } from '@/components/join-flow'
import { NamePicker } from '@/components/name-picker'
import { SubmittedState } from '@/components/submitted-state'
import { currentParticipantId } from '@/lib/session'
import { draftFor, loadTripByInvite, responseFor, submittedResponses } from '@/lib/trips'

export const metadata = { title: 'Your preferences — TripTogether' }
export const dynamic = 'force-dynamic'

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const { code } = await params
  const { edit } = await searchParams
  const state = await loadTripByInvite(code)

  if (!state) {
    return (
      <InvalidLink
        title="This invite link doesn’t work"
        body="It may have been mistyped or the trip may have been removed. Ask whoever shared it to send it again."
      />
    )
  }

  const participantId = await currentParticipantId(state.trip.id)
  const participant = state.participants.find((p) => p.id === participantId)

  if (!participant) {
    return (
      <NamePicker
        inviteCode={code}
        tripName={state.trip.name}
        people={state.participants.map((p) => ({ id: p.id, name: p.name }))}
      />
    )
  }

  const response = responseFor(state, participant.id)
  const submitted = response?.status === 'submitted'

  if (submitted && !edit) {
    return (
      <SubmittedState
        inviteCode={code}
        name={participant.name}
        respondedCount={submittedResponses(state).length}
        participantCount={state.participants.length}
        published={Boolean(state.trip.publishedAt)}
        deeperDone={response?.deeperDone ?? false}
        initial={draftFor(state, participant.id)}
      />
    )
  }

  return (
    <JoinFlow
      inviteCode={code}
      windowStart={state.trip.windowStart}
      windowEnd={state.trip.windowEnd}
      tripLengthDays={state.trip.tripLengthDays}
      initialDraft={draftFor(state, participant.id)}
      initialStep={edit ? 0 : (response?.step ?? 0)}
      participantName={participant.name}
    />
  )
}
