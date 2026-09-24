'use client'

import { EyeOff, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { publishResultsAction, unpublishResultsAction } from '@/app/actions'
import { Button } from '@/components/ui/button'

export function PublishButton({
  organizerCode,
  enabled,
  blockedReason,
}: {
  organizerCode: string
  enabled: boolean
  blockedReason: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <Button
        size="lg"
        disabled={!enabled || pending}
        onClick={() =>
          start(async () => {
            const result = await publishResultsAction(organizerCode)
            if (result.ok) router.refresh()
            else setError(result.message ?? 'Could not publish.')
          })
        }
      >
        <Send className="size-4" aria-hidden />
        {pending ? 'Publishing…' : 'Publish results to the group'}
      </Button>
      {!enabled ? <p className="mt-2.5 text-sm text-ink-muted">{blockedReason}</p> : null}
      {error ? (
        <p role="alert" className="mt-2.5 text-sm text-clay">{error}</p>
      ) : null}
    </div>
  )
}

/** Pulling results back, e.g. before reworking a trip the group has already seen. */
export function UnpublishButton({ organizerCode }: { organizerCode: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await unpublishResultsAction(organizerCode)
            if (result.ok) router.refresh()
            else setError(result.message ?? 'Could not pull the results back.')
          })
        }
      >
        <EyeOff className="size-4" aria-hidden />
        {pending ? 'Pulling back…' : 'Unpublish'}
      </Button>
      {error ? <p role="alert" className="mt-2 text-sm text-clay">{error}</p> : null}
    </div>
  )
}
