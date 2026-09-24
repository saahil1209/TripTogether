'use client'

import { useEffect, useState } from 'react'
import { CopyButton } from '@/components/copy-button'
import { cn } from '@/lib/cn'

function useAbsolute(path: string) {
  const [href, setHref] = useState(path)
  useEffect(() => {
    setHref(`${window.location.origin}${path}`)
  }, [path])
  return href
}

export function ShareLink({
  path, label, className,
}: { path: string; label?: string; className?: string }) {
  const href = useAbsolute(path)
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center', className)}>
      <code className="flex-1 overflow-x-auto rounded-xl border border-line bg-paper-deep px-3.5 py-2.5 text-sm text-ink-soft">
        {href}
      </code>
      <CopyButton value={href} variant="secondary" label={label ?? 'Copy link'} className="shrink-0" />
    </div>
  )
}

/** A message the organizer can paste straight into the group chat. */
export function ReminderMessage({
  path, tripName, missing, deadline,
}: {
  path: string
  tripName: string
  missing: string[]
  deadline: string | null
}) {
  const href = useAbsolute(path)
  const who = missing.length > 0 ? `${missing.join(', ')} — ` : ''
  const by = deadline ? ` Ideally before ${deadline}.` : ''
  const message = [
    `${who}two minutes and we can actually book this trip 🙏`,
    ``,
    `${tripName}: everyone puts in their dates, budget and hard no's here, and the tool works out what actually fits all five of us.${by}`,
    ``,
    href,
  ].join('\n')

  return (
    <div>
      <pre className="whitespace-pre-wrap rounded-xl border border-line bg-paper-deep px-4 py-3.5 font-sans text-sm text-ink-soft">
        {message}
      </pre>
      <CopyButton
        value={message}
        variant="outline"
        size="sm"
        className="mt-3"
        label="Copy reminder for WhatsApp"
        copiedLabel="Copied — go paste it"
      />
    </div>
  )
}
