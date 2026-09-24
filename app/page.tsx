import { ArrowRight, CalendarCheck, Link2, Scale } from 'lucide-react'
import Link from 'next/link'
import { LoadDemoButton } from '@/components/load-demo-button'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/wordmark'

const STEPS = [
  {
    icon: Link2,
    title: 'One link, five answers',
    body: 'Everyone fills in the same short form on their own. Nobody sees anyone else’s answers first, so nobody anchors to the loudest voice.',
  },
  {
    icon: Scale,
    title: 'Constraints, not opinions',
    body: 'Hard limits — budget ceilings, can’t-go dates, absolute no’s — are separated from preferences. A strong preference never overrides a hard constraint.',
  },
  {
    icon: CalendarCheck,
    title: 'One locked decision',
    body: 'Up to three genuinely viable options, with every person’s position on each one, and a lock that holds.',
  },
]

export default function LandingPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-5 pb-20 sm:px-8">
      <header className="flex items-center justify-between py-7">
        <Wordmark />
        <Link href="/trip/new" className="text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          Create a trip
        </Link>
      </header>

      <main className="pt-10 sm:pt-20">
        <p className="rise text-sm font-medium uppercase tracking-[0.16em] text-emerald">
          Group decisions for travel
        </p>
        <h1 className="rise mt-5 text-[2.6rem] leading-[1.08] sm:text-6xl" style={{ animationDelay: '60ms' }}>
          Stop planning your trip in the group chat.
        </h1>
        <p className="rise mt-6 max-w-xl text-lg text-ink-soft" style={{ animationDelay: '120ms' }}>
          Everyone gets a say. Nobody has to argue. One decision gets made.
        </p>

        <div className="rise mt-9 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: '180ms' }}>
          <Button asChild size="lg">
            <Link href="/trip/new">
              Plan a trip
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <LoadDemoButton />
        </div>
        <p className="mt-4 text-sm text-ink-muted">
          No signup. No accounts for anyone you invite.
        </p>

        <section className="mt-20 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:mt-24">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-card p-6 sm:p-7">
              <Icon className="size-5 text-emerald" aria-hidden />
              <h2 className="mt-4 text-xl">{title}</h2>
              <p className="mt-2 text-ink-soft">{body}</p>
            </div>
          ))}
        </section>

        <p className="mt-14 max-w-xl border-l-2 border-line pl-5 font-display text-lg italic text-ink-soft">
          Three months. Twelve hundred messages. Nothing booked. The problem was
          never that people disagreed — it was that nobody could hold five sets of
          answers in their head at once.
        </p>
      </main>
    </div>
  )
}
