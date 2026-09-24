'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { switchParticipantAction } from '@/app/actions'
import { cn } from '@/lib/cn'

/** For the shared phone, or the wrong name tapped by mistake. */
export function SwitchParticipant({
  inviteCode, name, className,
}: { inviteCode: string; name: string; className?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await switchParticipantAction(inviteCode)
          router.refresh()
        })
      }
      className={cn(
        'text-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline disabled:opacity-60',
        className,
      )}
    >
      {pending ? 'Switching…' : `Not ${name}?`}
    </button>
  )
}
