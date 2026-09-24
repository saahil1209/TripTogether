import { AlertTriangle, CircleCheck, CircleMinus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { FitStatus } from '@/lib/types'

/**
 * Status is always an icon plus a word. Colour is decoration here, never the
 * thing carrying the meaning.
 */
const STATUS = {
  strong: { label: 'Strong fit', Icon: Sparkles, className: 'bg-emerald-soft text-emerald-deep' },
  good: { label: 'Good fit', Icon: CircleCheck, className: 'bg-sky-soft text-sky' },
  compromise: { label: 'Compromise', Icon: CircleMinus, className: 'bg-amber-soft text-amber' },
  conflict: { label: 'Conflict', Icon: AlertTriangle, className: 'bg-clay-soft text-clay' },
} as const satisfies Record<FitStatus, { label: string; Icon: typeof Sparkles; className: string }>

export function FitBadge({ status, className }: { status: FitStatus; className?: string }) {
  const { label, Icon, className: tone } = STATUS[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        tone,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  )
}

export function fitLabel(status: FitStatus): string {
  return STATUS[status].label
}
