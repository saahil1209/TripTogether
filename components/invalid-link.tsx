import { LinkIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/wordmark'

export function InvalidLink({
  title = 'This link doesn’t work',
  body = 'It may have been mistyped, or the trip it pointed at no longer exists. Ask whoever sent it to share it again.',
}: {
  title?: string
  body?: string
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 sm:px-8">
      <header className="py-7">
        <Wordmark />
      </header>
      <main className="flex flex-1 flex-col justify-center pb-24">
        <div className="flex size-12 items-center justify-center rounded-full bg-paper-deep">
          <LinkIcon className="size-5 text-ink-muted" aria-hidden />
        </div>
        <h1 className="mt-6 text-3xl">{title}</h1>
        <p className="mt-3 text-ink-soft">{body}</p>
        <div className="mt-8">
          <Button asChild variant="outline">
            <Link href="/">Go to TripTogether</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
