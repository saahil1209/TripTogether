'use client'

import { useRouter } from 'next/navigation'
import { PreferenceFlow } from '@/components/preference-flow'
import type { DraftPreferences } from '@/lib/schemas'

export function JoinFlow(props: {
  inviteCode: string
  windowStart: string
  windowEnd: string
  tripLengthDays: number
  initialDraft: DraftPreferences
  initialStep: number
  participantName: string
}) {
  const router = useRouter()
  return <PreferenceFlow {...props} onSubmitted={() => router.refresh()} />
}
