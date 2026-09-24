import Link from 'next/link'
import { cn } from '@/lib/cn'

export function Wordmark({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn('inline-flex items-baseline gap-1.5 font-display text-lg text-ink', className)}
    >
      <span className="font-semibold">Trip</span>
      <span className="text-emerald">Together</span>
    </Link>
  )
}
