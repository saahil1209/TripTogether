import Link from 'next/link'
import { CreateTripForm } from '@/components/create-trip-form'
import { Wordmark } from '@/components/wordmark'

export const metadata = { title: 'Create a trip — TripTogether' }

export default function NewTripPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-xl px-5 pb-24 sm:px-8">
      <header className="flex items-center justify-between py-7">
        <Wordmark />
        <Link href="/" className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          Back
        </Link>
      </header>

      <main className="pt-6">
        <h1 className="text-4xl">Set up the trip</h1>
        <p className="mt-3 text-ink-soft">
          This takes a minute. Everything after it happens without you chasing anyone.
        </p>
        <div className="mt-9">
          <CreateTripForm />
        </div>
      </main>
    </div>
  )
}
